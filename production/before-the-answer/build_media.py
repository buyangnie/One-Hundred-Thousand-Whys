"""Recreate all chapter films, using the same cue times and measurements as the course."""
import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
COURSE = HERE.parents[1] / "courses" / HERE.name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    fonts = COURSE / "assets/fonts"
    subprocess.run([
        sys.executable, str(HERE / "render.py"),
        "--cues", str(COURSE / "content/cues.json"),
        "--evidence", str(COURSE / "content/evidence.json"),
        "--narration-dir", str(HERE / "narration"),
        "--serif", str(fonts / "Instrument-Serif.woff"),
        "--sans", str(fonts / "DM-Sans.woff"),
        "--out-dir", str(args.output),
    ], check=True)


if __name__ == "__main__":
    main()
