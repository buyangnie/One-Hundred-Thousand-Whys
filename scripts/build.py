"""Build the course catalog and a static site with Python 3."""
import argparse
import json
import re
import shutil
from pathlib import Path

from course_media import cached_films, film_names

ROOT = Path(__file__).resolve().parents[1]


def catalog():
    courses = []
    for manifest in sorted((ROOT / "courses").glob("*/course.json")):
        course = json.loads(manifest.read_text(encoding="utf-8"))
        slug = course["id"]
        if slug != manifest.parent.name or not re.fullmatch("[a-z0-9-]+", slug):
            raise ValueError(f"Invalid course id in {manifest}")
        for key in ("entry", "cover"):
            path = (manifest.parent / course[key]).resolve()
            if not path.is_relative_to(manifest.parent) or not path.is_file():
                raise ValueError(f"Invalid {key} in {manifest}")
        chapters = course["chapters"]
        if len({ch["id"] for ch in chapters}) != len(chapters):
            raise ValueError(f"Duplicate chapter id in {manifest}")
        if course["defaultLanguage"] not in course["languages"]:
            raise ValueError(f"Unknown default language in {manifest}")
        courses.append(course)
    return courses


def build(include_films=True):
    out = ROOT / "_site"
    out.mkdir(exist_ok=True)
    for name in ("courses", "site"):
        target = out / name
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(ROOT / name, target)
    shutil.copy2(ROOT / "index.html", out / "index.html")
    courses = catalog()
    if include_films:
        for course in courses:
            if "filmArchive" in course:
                cache = cached_films(course)
                dest = out / "courses" / course["id"] / "films"
                dest.mkdir(exist_ok=True)
                for name in film_names(course):
                    shutil.copy2(cache / name, dest / name)
    (out / "site/catalog.json").write_text(json.dumps(courses, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (out / ".nojekyll").touch()
    return out


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--without-films", action="store_true", help="Validate sources before media publication")
    print(build(include_films=not parser.parse_args().without_films))
