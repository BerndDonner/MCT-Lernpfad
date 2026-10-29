#!/usr/bin/env python3
"""Alle nicht-interaktiven Lernpfad-SVGs unabhängig vom UE-Viewer exportieren.

Nur Python-Standardbibliothek. Die Originale unter diagrams/ bleiben unverändert.
"""

from __future__ import annotations

import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "diagrams"
OUTPUT = ROOT / "export" / "diagrams"
SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK_NS)

IMPORT = re.compile(r"@import\s+url\(\s*(['\"]?)([^'\"\)]+)\1\s*\)\s*;", re.I)
FONT_FACE = re.compile(r"@font-face\s*\{[^}]*\}\s*", re.I | re.S)
CSS_URL = re.compile(r"url\(\s*(['\"]?)(.*?)\1\s*\)", re.I | re.S)


class SvgExportError(Exception):
    pass


def tag_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def is_interactive(root: ET.Element) -> bool:
    """Keine interaktiven SVGs ohne gerenderten DOM exportieren."""
    for node in root.iter():
        if tag_name(node.tag) in {"script", "foreignObject"}:
            return True
        for key, value in node.attrib.items():
            if key.lower().startswith("on") and not key.startswith("{"):
                return True
            if tag_name(key) == "href" and value.lower().startswith("javascript:"):
                return True
    return False


def validate_links(root: ET.Element, name: str) -> None:
    for node in root.iter():
        for attr, value in node.attrib.items():
            key = tag_name(attr)
            if key == "href" and value and not (value.startswith("#") or value.startswith("data:")):
                raise SvgExportError(f"{name}: externe Referenz {value!r} bei <{tag_name(node.tag)}>")
            if key == "style" and external_css_url(value):
                raise SvgExportError(f"{name}: externe CSS-URL im style-Attribut")


def external_css_url(css: str) -> bool:
    return any(not match.group(2).strip().startswith(("#", "data:")) for match in CSS_URL.finditer(css))


def embed_css(style: ET.Element, source: Path) -> None:
    css = style.text or ""
    for match in reversed(list(IMPORT.finditer(css))):
        rel_path = match.group(2).strip()
        # Nur lokale Stylesheets innerhalb des Diagramm-Verzeichnisses.
        if urlsplit(rel_path).scheme or rel_path.startswith(("/", "\\")):
            raise SvgExportError(f"{source.name}: unzulässiger CSS-Import: {rel_path}")
        stylesheet = (source.parent / rel_path).resolve()
        if not stylesheet.is_relative_to(SOURCES.resolve()) or not stylesheet.is_file():
            raise SvgExportError(f"{source.name}: CSS-Datei fehlt/außerhalb diagrams/: {rel_path}")
        embedded = stylesheet.read_text(encoding="utf-8")
        if "@import" in embedded.lower():
            raise SvgExportError(f"{source.name}: verschachtelte CSS-Imports nicht unterstützt")
        embedded = FONT_FACE.sub("", embedded)
        css = css[:match.start()] + embedded + css[match.end():]
    if re.search(r"@import\b", css, re.I) or external_css_url(css):
        raise SvgExportError(f"{source.name}: nicht eingebettete CSS-Ressource")
    style.text = css


def convert(source: Path) -> tuple[bytes | None, str]:
    try:
        root = ET.parse(source).getroot()
    except ET.ParseError as error:
        raise SvgExportError(f"{source.name}: ungültiges XML: {error}") from error
    if root.tag != f"{{{SVG_NS}}}svg":
        raise SvgExportError(f"{source.name}: kein SVG-Wurzelelement")
    if is_interactive(root):
        return None, "interaktiv"

    viewbox = root.get("viewBox", "").replace(",", " ").split()
    try:
        x, y, width, height = (float(v) for v in viewbox)
        if (len(viewbox) != 4 or not all(math.isfinite(v) for v in (x, y, width, height))
                or width <= 0 or height <= 0):
            raise ValueError("ungültige Abmessungen")
    except ValueError as error:
        raise SvgExportError(f"{source.name}: ungültige viewBox") from error

    for node in root.iter():
        if tag_name(node.tag) == "style":
            embed_css(node, source)
    validate_links(root, source.name)

    # Transparenz und @media-Farbvarianten bleiben unverändert erhalten.
    return ET.tostring(root, encoding="utf-8", xml_declaration=True), "exportiert"


def main() -> int:
    if not SOURCES.is_dir():
        print(f"Quellverzeichnis fehlt: {SOURCES}", file=sys.stderr)
        return 1
    results: dict[str, bytes] = {}
    skipped: list[str] = []
    errors: list[str] = []
    for source in sorted(SOURCES.glob("*.svg")):
        try:
            result, reason = convert(source)
            if result is None:
                skipped.append(source.name)
            else:
                results[source.name] = result
        except (SvgExportError, OSError) as error:
            errors.append(str(error))
    for name in skipped:
        print(f"SKIP  {name} (interaktiv)")
    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        print("Kein Export aktualisiert.", file=sys.stderr)
        return 1

    OUTPUT.mkdir(parents=True, exist_ok=True)
    # Alte Exportprodukte dürfen weder irrtümlich verteilt noch als Quelle
    # für interaktive Grafiken verwendet werden.
    for obsolete in OUTPUT.glob("*.svg"):
        if obsolete.name not in results:
            obsolete.unlink()
    for name, data in results.items():
        (OUTPUT / name).write_bytes(data)  # Absichtlich stets neu schreiben.
        print(f"WRITE {name}")
    print(f"Fertig: {len(results)} SVGs exportiert, {len(skipped)} interaktive übersprungen.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
