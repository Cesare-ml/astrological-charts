"""Run: python examples/python/example.py
This example uses MADE-UP coordinates only — not real astronomical output.
Copyright (c) 2026 Cesare-ml (VirgoStars project). CPAL-1.0.
"""
from __future__ import annotations

from pathlib import Path
import sys

from virgostars_charts import render_chart


def main() -> None:
    # Replace these illustrative numbers with the result of your own
    # Python calculations or, when released, VirgoStars-Ephemeris bindings.
    computed_positions = {
        "Sun": 15.0,
        "Moon": 75.0,
        "Mercury": 42.0,
        "Venus": 103.0,
        "Mars": 135.0,
        "Jupiter": 195.0,
        "Saturn": 255.0,
        "Uranus": 278.0,
        "Neptune": 308.0,
        "Pluto": 338.0,
    }
    # Replace with an actual house system's twelve cusp positions.
    house_cusps = [(20 + i * 30) % 360 for i in range(12)]
    natal = {
        "datetime": "2000-01-01T12:00:00Z",
        "ascendant": 20.0,
        "midheaven": 290.0,
        "houseCusps": house_cusps,
        "planets": {
            name: {
                "longitude": longitude,
                "latitude": 0.0,
                "longitudeSpeed": 0.0,
                "latitudeSpeed": 0.0,
                "declination": 0.0,
            }
            for name, longitude in computed_positions.items()
        },
    }
    output = Path(".local/python-example.jpg" if "--jpg" in sys.argv else ".local/python-example.png")
    saved = render_chart({"schemaVersion": 1, "natal": natal}, output, skin="light")
    print("Your sample chart:", saved)
    print("These positions are synthetic examples, not a calculated birth chart.")


if __name__ == "__main__":
    main()
