#!/usr/bin/env python3
"""Exportierte SVGs verteilen; unter donner/ Zielpfade prüfen und vorschlagen.

--check: Nur prüfen (SVG-Dateien + lokale Markdown-Bildreferenzen).
--fix:   Fehlende Zuordnungen einzeln zur Bestätigung anbieten; nur JSON ändern.
Ohne Option: Alle konfigurierten SVGs ohne Inhaltsvergleich überschreiben.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

EXPORT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG = EXPORT_DIR / "diagram-targets.json"
DIAGRAMS = EXPORT_DIR / "diagrams"
DEFAULT_REPOS = {
    "E3A": "/home/bernd/GitHub/NixOS-Bunny/repos/MCT_E3A",
    "I3A": "/home/bernd/GitHub/NixOS-Bunny/repos/MCT_I3A",
}

# Lokale Inline-Markdownbilder, Referenzdefinitionen und HTML-<object>/<img>.
MD_IMAGE = re.compile(r"!\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))", re.I)
MD_REFERENCE = re.compile(r"^\s*\[[^\]\n]+\]:\s*(?:<([^>]+)>|(\S+))", re.I | re.M)
HTML_IMAGE = re.compile(r"<(?:object|img)\b[^>]*?\b(?:data|src)\s*=\s*(['\"])(.*?)\1", re.I | re.S)


class ConfigError(Exception):
    pass


def relative_target(value: str, name: str | None = None) -> PurePosixPath:
    """Nur gewöhnliche Dateien unter donner/; niemals Traversal oder Symlink-Ziele."""
    if not isinstance(value, str) or "\\" in value or ":" in value:
        raise ConfigError(f"Ungültiger Zielpfad: {value!r}")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or "." in path.parts or not path.parts or path.parts[0] != "donner":
        raise ConfigError(f"Ziel muss relativ unter donner/ liegen: {value!r}")
    if name is not None and path.name != name:
        raise ConfigError(f"Dateiname stimmt nicht überein: {value!r} != {name}")
    if path.suffix.lower() != ".svg":
        raise ConfigError(f"Kein SVG-Ziel: {value!r}")
    return path


def read_config(path: Path) -> dict:
    if not path.exists():
        return {"repositories": DEFAULT_REPOS.copy(), "diagrams": {}}
    try:
        config = json.loads(path.read_text(encoding="utf-8"))
    except (ValueError, OSError) as error:
        raise ConfigError(f"Konfigurationsdatei nicht lesbar: {path}: {error}") from error
    if not isinstance(config, dict) or not isinstance(config.get("repositories"), dict) or not isinstance(config.get("diagrams"), dict):
        raise ConfigError("JSON benötigt 'repositories' und 'diagrams' als Objekte")
    for repo, root in config["repositories"].items():
        if not isinstance(repo, str) or not isinstance(root, str) or not Path(root).is_absolute():
            raise ConfigError(f"Ungültiges Repository: {repo}: {root!r}")
    for name, destinations in config["diagrams"].items():
        if not isinstance(name, str) or PurePosixPath(name).name != name or not name.endswith(".svg"):
            raise ConfigError(f"Ungültiger Diagrammname: {name!r}")
        if not isinstance(destinations, dict):
            raise ConfigError(f"Ziele für {name} müssen ein Objekt sein")
        for repo, paths in destinations.items():
            if repo not in config["repositories"] or not isinstance(paths, list):
                raise ConfigError(f"Unbekanntes Repository/ungültige Zielliste: {repo}")
            if len(paths) != len(set(paths)):
                raise ConfigError(f"Doppelte Ziele für {name} in {repo}")
            for target in paths:
                relative_target(target, name)
    return config


def repo_donner(root: Path) -> Path:
    donor = root / "donner"
    if not donor.is_dir() or donor.is_symlink():
        raise ConfigError(f"donner/-Verzeichnis fehlt oder ist Symlink: {donor}")
    return donor


def checked_path(root: Path, rel: PurePosixPath) -> Path:
    donor = repo_donner(root)
    dest = root.joinpath(*rel.parts)
    if dest.is_symlink() or not dest.resolve().is_relative_to(donor.resolve()):
        raise ConfigError(f"Symlink oder Ziel außerhalb donner/: {dest}")
    return dest


def entries(config: dict) -> list[tuple[str, str, str]]:
    return sorted((repo, str(target), name)
                  for name, dests in config["diagrams"].items()
                  for repo, paths in dests.items() for target in paths)


def local_svg_target(value: str, markdown: Path, root: Path) -> str | None:
    value = value.strip()
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or value.startswith(("/", "\\", "#")):
        return None
    path = unquote(parsed.path)
    if not path.lower().endswith(".svg"):
        return None
    candidate = (markdown.parent / path).resolve()
    donor = (root / "donner").resolve()
    if not candidate.is_relative_to(donor):
        return None
    relative = candidate.relative_to(root.resolve()).as_posix()
    relative_target(relative)
    return relative



def without_fenced_code(content: str) -> str:
    """In Markdown-Codefences gezeigte Bildbeispiele nicht als Referenzen zählen."""
    fence = None
    cleaned = []
    for line in content.splitlines(keepends=True):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fence is None:
            if marker:
                fence = (marker.group(1)[0], len(marker.group(1)))
                cleaned.append("\n")
            else:
                cleaned.append(line)
        elif marker and marker.group(1)[0] == fence[0] and len(marker.group(1)) >= fence[1] and not line[marker.end():].strip():
            fence = None
            cleaned.append("\n")
        else:
            cleaned.append("\n")
    return "".join(cleaned)


def scan(config: dict) -> tuple[dict[tuple[str, str], set[str]], list[str]]:
    """Beobachtete Ziele aus SVGs und Markdown-Referenzen im donner/-Baum."""
    observed: dict[tuple[str, str], set[str]] = defaultdict(set)
    problems: list[str] = []
    for repo, path in config["repositories"].items():
        root = Path(path)
        try:
            donor = repo_donner(root)
        except ConfigError as error:
            problems.append(str(error))
            continue
        for svg in sorted(donor.rglob("*.svg")):
            try:
                rel = svg.relative_to(root).as_posix()
                checked_path(root, relative_target(rel))
                observed[(repo, rel)].add("Datei")
            except ConfigError as error:
                problems.append(str(error))
        for markdown in sorted(donor.rglob("*.md")):
            try:
                content = without_fenced_code(markdown.read_text(encoding="utf-8"))
            except (UnicodeError, OSError) as error:
                problems.append(f"Markdown nicht lesbar: {markdown}: {error}")
                continue
            values = [a or b for pattern in (MD_IMAGE, MD_REFERENCE)
                      for a, b in pattern.findall(content)]
            values.extend(match.group(2) for match in HTML_IMAGE.finditer(content))
            for value in values:
                try:
                    rel = local_svg_target(value, markdown, root)
                    if rel is not None:
                        checked_path(root, relative_target(rel))
                        observed[(repo, rel)].add("Markdown")
                except (ValueError, ConfigError) as error:
                    problems.append(f"Bildreferenz in {markdown}: {value!r}: {error}")
    return observed, problems


def inspect(config: dict) -> tuple[list[tuple[str, str, str, set[str]]], int]:
    observed, problems = scan(config)
    configured = {(repo, path) for repo, path, _ in entries(config)}
    suggestions: list[tuple[str, str, str, set[str]]] = []
    issues = 0
    for problem in problems:
        print(f"ERROR {problem}")
        issues += 1
    for (repo, rel), why in sorted(observed.items()):
        if (repo, rel) in configured:
            continue
        source = DIAGRAMS / PurePosixPath(rel).name
        print(f"UNCONFIGURED {repo}: {rel} ({', '.join(sorted(why))})")
        issues += 1
        if source.is_file():
            suggestions.append((repo, rel, source.name, why))
        else:
            print(f"  Keine exportierte Quelle: {source.name} (nicht automatisch ergänzen)")
    for repo, rel, name in entries(config):
        root = Path(config["repositories"][repo])
        source = DIAGRAMS / name
        if not source.is_file():
            print(f"SOURCE MISSING {name}: zuerst statisches SVG exportieren")
            issues += 1
        try:
            path = checked_path(root, relative_target(rel, name))
        except ConfigError as error:
            print(f"ERROR {error}")
            issues += 1
            continue
        if not path.is_file():
            print(f"TARGET MISSING {repo}: {rel} (Verteilung kann es wiederherstellen)")
            issues += 1
    if not issues:
        print("OK: Alle gefundenen SVG-Ziele sind konfiguriert und vorhanden.")
    else:
        print(f"Prüfung: {issues} Abweichung(en), {len(suggestions)} Ergänzungsvorschlag/-vorschläge.")
    return suggestions, issues


def fix(config: dict, path: Path) -> int:
    suggestions, _ = inspect(config)
    if not suggestions:
        print("Keine automatisch ergänzbaren Zuordnungen gefunden.")
        return 0
    accepted = 0
    for repo, rel, name, why in suggestions:
        while True:
            try:
                answer = input(f"Zuordnung hinzufügen: {name} -> {repo}:{rel} [j/N]? ").strip().lower()
            except EOFError:
                print("Abgebrochen; Konfiguration unverändert.", file=sys.stderr)
                return 1
            if answer in ("j", "ja", "y", "yes"):
                paths = config["diagrams"].setdefault(name, {}).setdefault(repo, [])
                if rel not in paths:
                    paths.append(rel)
                    paths.sort()
                    accepted += 1
                break
            if answer in ("", "n", "nein", "no"):
                break
            print("Bitte j oder n eingeben.")
    if accepted:
        config["diagrams"] = dict(sorted(config["diagrams"].items()))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"{accepted} Zuordnung(en) in {path} gespeichert. SVGs nicht verändert.")
    else:
        print("Keine Änderung an diagram-targets.json.")
    return 0


def distribute(config: dict) -> int:
    plan: list[tuple[Path, Path]] = []
    try:
        for repo, rel, name in entries(config):
            source = DIAGRAMS / name
            if not source.is_file():
                raise ConfigError(f"Exportierte Quelle fehlt: {source}; zuerst export-diagrams.py starten")
            dest = checked_path(Path(config["repositories"][repo]), relative_target(rel, name))
            if not dest.parent.is_dir():
                # Ein Markdown-Dokument darf auch ein noch nicht angelegtes
                # diagrams/-Unterverzeichnis seiner vorhandenen UE referenzieren.
                if dest.parent.name != "diagrams" or not dest.parent.parent.is_dir():
                    raise ConfigError(f"Zielverzeichnis fehlt: {dest.parent}")
            plan.append((source, dest))
    except ConfigError as error:
        print(f"ERROR {error}; keine Dateien verteilt.", file=sys.stderr)
        return 1
    for source, dest in plan:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, dest)  # Absichtlich stets überschreiben.
        print(f"COPY  {source.name} -> {dest}")
    print(f"Fertig: {len(plan)} SVG-Kopien verteilt.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--check", action="store_true", help="SVG-Dateien, Markdown-Referenzen und Konfiguration abgleichen")
    modes.add_argument("--fix", action="store_true", help="Konfigurations-Ergänzungen interaktiv bestätigen")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Pfad zu diagram-targets.json")
    args = parser.parse_args()
    try:
        config = read_config(args.config)
        if args.check:
            _, issues = inspect(config)
            return int(issues > 0)
        if args.fix:
            return fix(config, args.config)
        if not args.config.is_file():
            raise ConfigError("Zuordnungstabelle fehlt; zuerst --fix ausführen")
        return distribute(config)
    except (ConfigError, OSError) as error:
        print(f"ERROR {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
