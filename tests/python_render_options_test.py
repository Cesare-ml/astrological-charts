"""Stdlib-only tests for Python's explicit external asset options.
Copyright (c) 2026 Cesare-ml (VirgoStars project); CPAL-1.0.
No browser, private artwork or running Node renderer required.
"""
from pathlib import Path
from unittest import TestCase, mock

from examples.python.virgostars_charts import render_chart


CHART = {
    "schemaVersion": 1,
    "natal": {
        "datetime": "2000-01-01T12:00:00Z",
        "ascendant": 20,
        "midheaven": 290,
        "houseCusps": [(20 + i * 30) % 360 for i in range(12)],
        "planets": {"Sun": {"longitude": 15, "latitude": 0}},
    },
}


class PythonApprovedAssetsTest(TestCase):
    @mock.patch("examples.python.virgostars_charts.subprocess.run")
    @mock.patch("examples.python.virgostars_charts.shutil.which", return_value="node")
    def test_explicit_paired_paths_reach_node_cli(self, _which, runner):
        output = render_chart(
            CHART, "chart-approved.png",
            asset_root="../astrological-assets/public/assets",
            asset_manifest="../astrological-assets/manifests/approved-assets.json",
        )
        command = runner.call_args.args[0]
        self.assertEqual(command[command.index("--assets-root") + 1],
                         str(Path("../astrological-assets/public/assets").resolve()))
        self.assertEqual(command[command.index("--assets-manifest") + 1],
                         str(Path("../astrological-assets/manifests/approved-assets.json").resolve()))
        self.assertEqual(output, Path("chart-approved.png").resolve())
        self.assertTrue(runner.call_args.kwargs["check"])

    @mock.patch("examples.python.virgostars_charts.subprocess.run")
    @mock.patch("examples.python.virgostars_charts.shutil.which", return_value="node")
    def test_synthetic_default_passes_no_external_paths(self, _which, runner):
        render_chart(CHART, "chart.png")
        command = runner.call_args.args[0]
        self.assertNotIn("--assets-root", command)
        self.assertNotIn("--assets-manifest", command)

    @mock.patch("examples.python.virgostars_charts.subprocess.run")
    @mock.patch("examples.python.virgostars_charts.shutil.which", return_value="node")
    def test_reject_unpaired_external_paths_before_process_start(self, _which, runner):
        with self.assertRaisesRegex(ValueError, "provided together"):
            render_chart(CHART, "chart.png", asset_root="../astrological-assets/public/assets")
        with self.assertRaisesRegex(ValueError, "provided together"):
            render_chart(CHART, "chart.png", asset_manifest="manifest.json")
        with self.assertRaisesRegex(ValueError, "must not be empty"):
            render_chart(CHART, "chart.png", asset_root="", asset_manifest="manifest.json")
        runner.assert_not_called()
