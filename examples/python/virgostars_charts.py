"""Python-to-Astrological-Charts bridge; free, stdlib-only.
Copyright (c) 2026 Cesare-ml (VirgoStars project). CPAL-1.0.
See ../../LICENSE (including Exhibits A/B).

No astronomical computation happens here. Supply positions and house
cusps calculated by your own code or an external library.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

REPOSITORY = Path(__file__).resolve().parents[2]
RENDER_SCRIPT = REPOSITORY / "scripts" / "render-chart.mjs"


def render_chart(
    payload: dict[str, Any],
    output: str | Path,
    *,
    mode: str | None = None,
    skin: str | None = None,
) -> Path:
    """Render version-1 chart JSON to a PNG or JPEG using the local Angular renderer.

    Prerequisites: Node.js, `npm ci`, and Chrome/Chromium.
    The Node bridge starts/stops the two local demo servers automatically.
    This invokes the actual TypeScript/Three.js library, not matplotlib.
    """
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js was not found. Install Node.js 22 LTS and run npm ci.")
    path = Path(output).expanduser().resolve()
    if path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
        raise ValueError("Output filename must end in .png, .jpg or .jpeg")
    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise ValueError("Expected a dict with schemaVersion: 1 (see docs/PYTHON_INTEGRATION.md).")
    with tempfile.TemporaryDirectory(prefix="virgostars-input-") as temp:
        json_file = Path(temp) / "chart.json"
        with json_file.open("w", encoding="utf-8") as file:
            json.dump(payload, file, ensure_ascii=False, allow_nan=False)
        cmd = [node, str(RENDER_SCRIPT), "--input", str(json_file), "--output", str(path)]
        if mode is not None:
            cmd.extend(["--mode", mode])
        if skin is not None:
            cmd.extend(["--skin", skin])
        try:
            subprocess.run(cmd, cwd=REPOSITORY, check=True)
        except FileNotFoundError as error:
            raise RuntimeError("Local Node.js chart renderer was not found.") from error
        except subprocess.CalledProcessError as error:
            raise RuntimeError(
                "Chart rendering failed. Read the console output and "
                "docs/PYTHON_INTEGRATION.md for setup and troubleshooting."
            ) from error
    return path
