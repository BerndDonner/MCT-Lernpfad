"""Regressionstests für den separaten SVG-Batch-Export und die Verteilung."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

EXPORT = Path(__file__).resolve().parents[1]
REPO = EXPORT.parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, EXPORT / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.exporter = load("export_diagrams", "export-diagrams.py")

    def test_static_sources_have_white_background_and_embedded_css(self):
        diagrams = REPO / "diagrams"
        exported = []
        skipped = []
        for svg in diagrams.glob("*.svg"):
            data, _ = self.exporter.convert(svg)
            if data is None:
                skipped.append(svg.name)
            else:
                exported.append(svg.name)
                self.assertIn(b"fill: #ffffff; stroke: none", data)
                self.assertNotIn(b"@import", data)
                self.assertNotIn(b"@font-face", data)
                self.assertNotIn(b"<script", data)
        self.assertIn("git-commit-snapshot-diff.svg", skipped)
        self.assertIn("bitoperationen-masken.svg", exported)
        self.assertEqual(len(exported) + len(skipped), len(list(diagrams.glob("*.svg"))))


class DistributionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.course = self.root / "course"
        self.lesson = self.course / "donner" / "03_uebungen"
        self.lesson.mkdir(parents=True)
        (self.course / "schueler").mkdir()
        self.exported = self.root / "exported"
        self.exported.mkdir()
        (self.exported / "test.svg").write_text("export-v1", encoding="utf-8")
        self.config_path = self.root / "config.json"
        self.config = {"repositories": {"E3A": str(self.course)}, "diagrams": {}}
        self.distributor = load("distribute_diagrams", "distribute-diagrams.py")
        self.distributor.DIAGRAMS = self.exported

    def test_fix_adds_missing_markdown_svg_but_does_not_copy(self):
        (self.lesson / "uebung.md").write_text("![Erklärung](diagrams/test.svg)\n")
        with patch("builtins.input", return_value="j"):
            self.assertEqual(self.distributor.fix(self.config, self.config_path), 0)
        saved = json.loads(self.config_path.read_text())
        self.assertEqual(saved["diagrams"]["test.svg"]["E3A"],
                         ["donner/03_uebungen/diagrams/test.svg"])
        self.assertFalse((self.lesson / "diagrams" / "test.svg").exists())

    def test_decline_does_not_change_json(self):
        (self.lesson / "uebung.md").write_text("![x](diagrams/test.svg)")
        with patch("builtins.input", return_value=""):
            self.assertEqual(self.distributor.fix(self.config, self.config_path), 0)
        self.assertFalse(self.config_path.exists())

    def test_distribute_overwrites_and_creates_diagrams_directory(self):
        self.config["diagrams"] = {"test.svg": {"E3A": ["donner/03_uebungen/diagrams/test.svg"]}}
        target = self.lesson / "diagrams" / "test.svg"
        self.assertEqual(self.distributor.distribute(self.config), 0)
        self.assertEqual(target.read_text(), "export-v1")
        target.write_text("alt")
        self.assertEqual(self.distributor.distribute(self.config), 0)
        self.assertEqual(target.read_text(), "export-v1")

    def test_student_files_ignored(self):
        (self.course / "schueler" / "own.svg").write_text("eigen")
        found, problems = self.distributor.scan(self.config)
        self.assertEqual(found, {})
        self.assertFalse(problems)

    def test_reject_unsafe_paths(self):
        for unsafe in ("../donner/test.svg", "donner/../test.svg", "/donner/test.svg", "schueler/test.svg"):
            with self.assertRaises(self.distributor.ConfigError):
                self.distributor.relative_target(unsafe)


if __name__ == "__main__":
    unittest.main()
