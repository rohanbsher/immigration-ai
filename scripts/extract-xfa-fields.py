#!/usr/bin/env python3
"""
Extract XFA form field names from USCIS PDF templates.

Parses the XFA template XML to find all interactive form fields
(text, checkbox, radio, dropdown, date, etc.) and outputs them
with their full qualified names and types.
"""

import pikepdf
import sys
import xml.etree.ElementTree as ET
import json


def extract_xfa_template(pdf_path: str) -> bytes:
    """Extract the XFA template XML from a PDF."""
    pdf = pikepdf.open(pdf_path)
    root = pdf.Root

    if "/AcroForm" not in root:
        raise ValueError("No AcroForm found")

    acroform = root["/AcroForm"]
    if "/XFA" not in acroform:
        raise ValueError("No XFA data found")

    xfa = acroform["/XFA"]

    # XFA is an array of [name, stream, name, stream, ...]
    if isinstance(xfa, pikepdf.Array):
        for i in range(0, len(xfa), 2):
            name = str(xfa[i])
            if name == "template":
                stream = xfa[i + 1]
                if isinstance(stream, pikepdf.Stream):
                    return bytes(stream.read_bytes())
                elif isinstance(stream, pikepdf.Object):
                    resolved = pdf.get_object(stream.objgen)
                    return bytes(resolved.read_bytes())

    raise ValueError("Could not find template in XFA data")


def extract_fields(template_xml: bytes) -> list:
    """Parse XFA template XML to extract field definitions."""
    # XFA uses namespaces
    ns = {"t": "http://www.xfa.org/schema/xfa-template/3.3/"}

    root = ET.fromstring(template_xml)
    fields = []

    def walk(element, path=""):
        tag = element.tag.split("}")[-1] if "}" in element.tag else element.tag
        name = element.get("name", "")

        current_path = f"{path}.{name}" if path and name else (name or path)

        # Field types in XFA
        if tag == "field":
            field_type = "text"  # default
            # Check ui child for specific widget type
            for ui in element.findall("t:ui", ns):
                for child in ui:
                    child_tag = child.tag.split("}")[-1] if "}" in child.tag else child.tag
                    if child_tag == "checkButton":
                        field_type = "checkbox"
                    elif child_tag == "choiceList":
                        field_type = "dropdown"
                    elif child_tag == "dateTimeEdit":
                        field_type = "date"
                    elif child_tag == "numericEdit":
                        field_type = "numeric"
                    elif child_tag == "textEdit":
                        field_type = "text"
                    elif child_tag == "imageEdit":
                        field_type = "image"
                    elif child_tag == "signatureEdit":
                        field_type = "signature"
                    elif child_tag == "barcode":
                        field_type = "barcode"

            # Get caption/tooltip for context
            caption = ""
            for cap in element.findall("t:caption", ns):
                for val in cap.findall("t:value", ns):
                    for text in val.findall("t:text", ns):
                        if text.text:
                            caption = text.text.strip()

            # Get assist/toolTip
            tooltip = ""
            for assist in element.findall("t:assist", ns):
                for tip in assist.findall("t:toolTip", ns):
                    if tip.text:
                        tooltip = tip.text.strip()

            # Check for items (dropdown options)
            options = []
            for items in element.findall("t:items", ns):
                for item in items:
                    if item.text:
                        options.append(item.text.strip())

            fields.append({
                "name": current_path,
                "xfa_name": name,
                "type": field_type,
                "caption": caption,
                "tooltip": tooltip,
                "options": options if options else None,
            })

        # Also check for exclGroup (radio groups)
        elif tag == "exclGroup":
            # Get radio options from child fields
            radio_options = []
            for child_field in element.findall("t:field", ns):
                child_name = child_field.get("name", "")
                # Get items for radio option values
                for items in child_field.findall("t:items", ns):
                    for item in items:
                        if item.text:
                            radio_options.append(item.text.strip())
                if child_name:
                    radio_options.append(child_name)

            fields.append({
                "name": current_path,
                "xfa_name": name,
                "type": "radio",
                "caption": "",
                "tooltip": "",
                "options": radio_options if radio_options else None,
            })

        # Recurse into children
        for child in element:
            walk(child, current_path)

    walk(root)
    return fields


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 extract-xfa-fields.py <pdf_path> [--json]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    as_json = "--json" in sys.argv

    template_xml = extract_xfa_template(pdf_path)
    fields = extract_fields(template_xml)

    if as_json:
        print(json.dumps(fields, indent=2))
    else:
        print(f"\n=== {pdf_path} ===")
        print(f"Total fields: {len(fields)}\n")

        type_counts = {}
        for f in fields:
            t = f["type"]
            type_counts[t] = type_counts.get(t, 0) + 1

            extras = ""
            if f["caption"]:
                extras += f'  caption="{f["caption"][:60]}"'
            if f["tooltip"]:
                extras += f'  tip="{f["tooltip"][:60]}"'
            if f["options"]:
                opts = ", ".join(f["options"][:5])
                if len(f["options"]) > 5:
                    opts += "..."
                extras += f"  options=[{opts}]"

            print(f'[{f["type"]:10}] {f["name"]}{extras}')

        print(f"\n--- Summary ---")
        for t, c in sorted(type_counts.items()):
            print(f"  {t}: {c}")
        print(f"  Total: {len(fields)}")


if __name__ == "__main__":
    main()
