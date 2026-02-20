"""
PDF filling microservice for USCIS immigration forms.

Wraps pikepdf XFA fill logic in a FastAPI endpoint so Vercel
(which lacks Python) can request filled PDFs over HTTP.

Endpoints:
  POST /fill-pdf  — fill a USCIS template and return PDF bytes
  GET  /health    — verify pikepdf + templates are available
"""

import hmac
import io
import logging
import os
import re
import json
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import pikepdf
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger("pdf-service")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="USCIS PDF Fill Service", version="1.0.0")

# -- Security middleware -------------------------------------------------------

# Deny all cross-origin requests — this service is internal only
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_methods=[],
    allow_headers=[],
)

# Max request body size: 5 MB (field_data JSON should never approach this)
MAX_BODY_BYTES = 5 * 1024 * 1024

@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    """Reject requests with bodies exceeding MAX_BODY_BYTES."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_BYTES:
        return Response(status_code=413, content="Request body too large")
    return await call_next(request)

TEMPLATES_DIR = Path(__file__).parent / "templates"
SERVICE_SECRET = os.environ.get("PDF_SERVICE_SECRET", "")

# Only allow safe XML element names (alphanumeric + underscore)
SAFE_FIELD_PART = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*$")

# Map form type identifiers to template filenames
TEMPLATE_FILES: dict[str, str] = {
    "I-130": "i-130.pdf",
    "I-485": "i-485.pdf",
    "I-765": "i-765.pdf",
    "I-131": "i-131.pdf",
    "I-140": "i-140.pdf",
    "N-400": "n-400.pdf",
    "G-1145": "g-1145.pdf",
    "I-129": "i-129.pdf",
    "I-539": "i-539.pdf",
}


class FillRequest(BaseModel):
    form_type: str
    field_data: dict[str, str]
    flatten: bool = False


class FillStats(BaseModel):
    filled: int
    total: int
    errors: list[str]


def _verify_auth(authorization: str | None) -> None:
    """Verify the Bearer token matches PDF_SERVICE_SECRET using timing-safe comparison."""
    if not SERVICE_SECRET:
        raise HTTPException(500, "PDF_SERVICE_SECRET not configured on server")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header")
    token = authorization.removeprefix("Bearer ")
    if not hmac.compare_digest(token.encode(), SERVICE_SECRET.encode()):
        raise HTTPException(401, "Invalid service token")


def fill_xfa_pdf(template_path: str, field_data: dict[str, str], form_type: str = "", flatten: bool = False) -> tuple[bytes, FillStats]:
    """Fill XFA fields in a PDF and return (pdf_bytes, stats)."""
    with pikepdf.open(template_path) as pdf:
        root = pdf.Root

        if "/AcroForm" not in root:
            return b"", FillStats(filled=0, total=len(field_data), errors=["No AcroForm in PDF"])

        acroform = root["/AcroForm"]
        if "/XFA" not in acroform:
            return b"", FillStats(filled=0, total=len(field_data), errors=["No XFA in AcroForm"])

        xfa = acroform["/XFA"]

        # Find the datasets stream
        datasets_idx = None
        for i in range(0, len(xfa), 2):
            name = str(xfa[i])
            if name == "datasets":
                datasets_idx = i + 1
                break

        if datasets_idx is None:
            return b"", FillStats(filled=0, total=len(field_data), errors=["No datasets in XFA"])

        # Read the datasets XML
        stream_obj = xfa[datasets_idx]
        if hasattr(stream_obj, "read_bytes"):
            datasets_xml = bytes(stream_obj.read_bytes())
        else:
            resolved = pdf.get_object(stream_obj.objgen)
            datasets_xml = bytes(resolved.read_bytes())

        # Parse the XML
        ET.register_namespace("xfa", "http://www.xfa.org/schema/xfa-data/1.0/")
        datasets_root = ET.fromstring(datasets_xml)

        ns = {"xfa": "http://www.xfa.org/schema/xfa-data/1.0/"}
        data_node = datasets_root.find("xfa:data", ns)
        if data_node is None:
            return b"", FillStats(filled=0, total=len(field_data), errors=["No data node in datasets"])

        filled = 0
        errors: list[str] = []

        for field_path, value in field_data.items():
            if value is None or value == "":
                continue

            try:
                parts = field_path.split(".")
                current = data_node

                if not all(SAFE_FIELD_PART.match(p) for p in parts):
                    errors.append(f"{field_path}: invalid field path characters")
                    continue

                for part in parts:
                    child = current.find(part)
                    if child is None:
                        child = ET.SubElement(current, part)
                    current = child

                current.text = str(value)
                filled += 1

            except Exception as e:
                errors.append(f"{field_path}: {str(e)}")

        # Serialize the modified XML
        new_xml = ET.tostring(datasets_root, encoding="unicode", xml_declaration=False)
        new_xml_bytes = new_xml.encode("utf-8")

        # Write back to the PDF
        new_stream = pikepdf.Stream(pdf, new_xml_bytes)
        xfa[datasets_idx] = new_stream

        if "/NeedAppearances" not in acroform:
            acroform[pikepdf.Name("/NeedAppearances")] = True

        # Flatten fields if requested (locks them for filing)
        if flatten:
            for field in acroform.get("/Fields", []):
                field[pikepdf.Name("/Ff")] = 1  # ReadOnly flag

        # Set PDF metadata
        now = datetime.now(timezone.utc)
        with pdf.open_metadata() as meta:
            meta["dc:title"] = f"USCIS Form {form_type}" if form_type else "USCIS Form"
            meta["dc:description"] = f"Immigration Form {form_type} - Filled"
            meta["dc:creator"] = ["Immigration AI"]
            meta["xmp:CreatorTool"] = "Immigration AI PDF Service"
            meta["xmp:CreateDate"] = now.isoformat()

        # Save to memory buffer
        buf = io.BytesIO()
        pdf.save(buf)

    stats = FillStats(filled=filled, total=len(field_data), errors=errors)
    return buf.getvalue(), stats


@app.post("/fill-pdf")
async def handle_fill_pdf(
    request: FillRequest,
    authorization: str | None = Header(default=None),
) -> Response:
    _verify_auth(authorization)

    logger.info("fill-pdf request: form_type=%s fields=%d", request.form_type, len(request.field_data))

    # Resolve template
    filename = TEMPLATE_FILES.get(request.form_type)
    if not filename:
        raise HTTPException(
            422,
            f"Unknown form type: {request.form_type}. "
            f"Supported: {', '.join(sorted(TEMPLATE_FILES))}",
        )

    template_path = TEMPLATES_DIR / filename
    if not template_path.exists():
        raise HTTPException(
            422,
            f"Template file not found for {request.form_type}: {filename}",
        )

    try:
        pdf_bytes, stats = fill_xfa_pdf(str(template_path), request.field_data, request.form_type, request.flatten)
    except Exception as e:
        logger.exception("PDF fill error for %s", request.form_type)
        raise HTTPException(500, f"PDF fill error: {str(e)}")

    if not pdf_bytes:
        raise HTTPException(
            422,
            json.dumps({"errors": stats.errors, "filled": 0, "total": stats.total}),
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "X-Fill-Stats": json.dumps(stats.model_dump()),
        },
    )


@app.get("/health")
async def health_check() -> dict:
    available_templates = []
    for form_type, filename in sorted(TEMPLATE_FILES.items()):
        template_path = TEMPLATES_DIR / filename
        if template_path.exists():
            available_templates.append(form_type)

    return {
        "status": "healthy",
        "pikepdf_version": pikepdf.__version__,
        "templates": available_templates,
        "templates_dir": str(TEMPLATES_DIR),
    }
