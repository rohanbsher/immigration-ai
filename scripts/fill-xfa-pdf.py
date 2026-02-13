#!/usr/bin/env python3
"""
Fill XFA form fields in a USCIS PDF template.

Usage:
  python3 scripts/fill-xfa-pdf.py <template.pdf> <data.json> <output.pdf>

data.json is a flat map of XFA field paths to values:
  {"form1.LastName": "DOE", "form1.FirstName": "JOHN", ...}
"""

import pikepdf
import xml.etree.ElementTree as ET
import json
import re
import sys

# Only allow safe XML element names (alphanumeric + underscore)
SAFE_FIELD_PART = re.compile(r'^[a-zA-Z][a-zA-Z0-9_]*$')


def fill_xfa_pdf(template_path: str, field_data: dict, output_path: str) -> dict:
    """Fill XFA fields in a PDF and save to output_path.

    Returns a dict with fill stats:
      {"filled": int, "total": int, "errors": [str]}
    """
    pdf = pikepdf.open(template_path)
    root = pdf.Root

    if "/AcroForm" not in root:
        return {"filled": 0, "total": len(field_data), "errors": ["No AcroForm in PDF"]}

    acroform = root["/AcroForm"]
    if "/XFA" not in acroform:
        return {"filled": 0, "total": len(field_data), "errors": ["No XFA in AcroForm"]}

    xfa = acroform["/XFA"]

    # Find the datasets stream
    datasets_idx = None
    for i in range(0, len(xfa), 2):
        name = str(xfa[i])
        if name == "datasets":
            datasets_idx = i + 1
            break

    if datasets_idx is None:
        return {"filled": 0, "total": len(field_data), "errors": ["No datasets in XFA"]}

    # Read the datasets XML
    stream_obj = xfa[datasets_idx]
    if hasattr(stream_obj, 'read_bytes'):
        datasets_xml = bytes(stream_obj.read_bytes())
    else:
        resolved = pdf.get_object(stream_obj.objgen)
        datasets_xml = bytes(resolved.read_bytes())

    # Parse the XML
    # Register the xfa namespace to preserve it
    ET.register_namespace('xfa', 'http://www.xfa.org/schema/xfa-data/1.0/')
    datasets_root = ET.fromstring(datasets_xml)

    ns = {"xfa": "http://www.xfa.org/schema/xfa-data/1.0/"}
    data_node = datasets_root.find("xfa:data", ns)
    if data_node is None:
        return {"filled": 0, "total": len(field_data), "errors": ["No data node in datasets"]}

    filled = 0
    errors = []

    for field_path, value in field_data.items():
        if value is None or value == "":
            continue

        try:
            # Field paths are dot-separated: "form1.Pt1Line1a_FamilyName"
            parts = field_path.split(".")
            current = data_node

            # Validate all path parts before modifying XML
            if not all(SAFE_FIELD_PART.match(p) for p in parts):
                errors.append(f"{field_path}: invalid field path characters")
                continue

            # Navigate/create the path. XFA datasets may not contain
            # entries for every template-defined field — empty fields
            # are only added when values are filled in. We create any
            # missing nodes (containers and leaves) as needed.
            for part in parts:
                child = current.find(part)
                if child is None:
                    child = ET.SubElement(current, part)
                current = child

            # Set the value
            current.text = str(value)
            filled += 1

        except Exception as e:
            errors.append(f"{field_path}: {str(e)}")

    # Serialize the modified XML
    new_xml = ET.tostring(datasets_root, encoding='unicode', xml_declaration=False)
    # Ensure proper encoding
    new_xml_bytes = new_xml.encode('utf-8')

    # Write back to the PDF
    new_stream = pikepdf.Stream(pdf, new_xml_bytes)
    xfa[datasets_idx] = new_stream

    # Also set NeedAppearances to trigger re-rendering
    if "/NeedAppearances" not in acroform:
        acroform[pikepdf.Name("/NeedAppearances")] = True

    pdf.save(output_path)
    pdf.close()

    return {"filled": filled, "total": len(field_data), "errors": errors}


def main():
    if len(sys.argv) < 4:
        print("Usage: python3 fill-xfa-pdf.py <template.pdf> <data.json> <output.pdf>")
        sys.exit(1)

    template_path = sys.argv[1]
    data_path = sys.argv[2]
    output_path = sys.argv[3]

    with open(data_path) as f:
        field_data = json.load(f)

    result = fill_xfa_pdf(template_path, field_data, output_path)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
