"""Render and package a course locally, or publish missing versions from main in CI."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

from course_media import CACHE, ROOT, film_names, make_outputs, tag_for


def existing_release(repository, tag):
    url = f"https://api.github.com/repos/{repository}/releases/tags/{tag}"
    headers = {"Authorization": "Bearer " + os.environ["GH_TOKEN"], "Accept": "application/vnd.github+json"}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
    return None


def read_course(folder):
    path = ROOT / "courses" / folder.name / "course.json"
    course = json.loads(path.read_text(encoding="utf-8"))
    if folder.name != course["id"] or not re.fullmatch(r"[a-z0-9-]+", course["id"]):
        raise ValueError(f"Invalid course folder {folder}")
    if not re.fullmatch(r"\d+\.\d+\.\d+", course["version"]):
        raise ValueError("Expected a three-part version")
    return course


def prepare(folder, course, output):
    films = CACHE / tag_for(course)
    if not all((films / name).is_file() and (films / name).stat().st_size for name in film_names(course)):
        subprocess.run([sys.executable, str(folder / "build_media.py"), str(films)], check=True)
    return make_outputs(course, films, output)


def publish(folder, course, release, repository, output):
    html, archive = prepare(folder, course, output)
    tag = tag_for(course)
    title = course["title"]["en"] + " " + course["version"]
    digest = hashlib.sha256(html.read_bytes()).hexdigest()
    notes = output / "notes.md"
    notes.write_text(
        course["description"]["en"] + "\n\n"
        "**Classroom download** — open the HTML attachment in a browser. English and Mandarin films, "
        "captions, transcripts and all experiments work offline. The ZIP contains the separately playable "
        "chapter films used by the online edition.\n\n"
        f'[Open the course](https://buyangnie.github.io/One-Hundred-Thousand-Whys/courses/{course["id"]}/)\n\n'
        f'SHA-256 of {html.name}: `{digest}`\n', encoding="utf-8")
    if release is None:
        subprocess.run(["gh","release","create",tag,"--repo",repository,"--draft","--target",os.environ["GITHUB_SHA"],
                        "--title",title,"--notes-file",str(notes)],check=True)
    subprocess.run(["gh","release","upload",tag,str(html),str(archive),"--repo",repository,"--clobber"],check=True)
    subprocess.run(["gh","release","edit",tag,"--repo",repository,"--draft=false","--notes-file",str(notes)],check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true", help="Print whether a new release is required")
    group.add_argument("--publish", action="store_true", help="Publish missing versions using GH_TOKEN")
    group.add_argument("--package", metavar="COURSE", help="Write the HTML and movie ZIP locally")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    folders = sorted(p.parent for p in (ROOT / "production").glob("*/build_media.py"))
    if args.package:
        folder = next((f for f in folders if f.name == args.package), None)
        if not folder or not args.output:
            parser.error("Pass a known course ID and --output DIRECTORY")
        html, archive = prepare(folder, read_course(folder), args.output.resolve())
        print(html, archive, sep="\n")
        return
    repository = os.environ["GITHUB_REPOSITORY"]
    pending = []
    for folder in folders:
        course = read_course(folder)
        release = existing_release(repository, tag_for(course))
        expected = {course["filmArchive"], course["release"].rsplit("/",1)[1]}
        if release is None or release["draft"]:
            pending.append((folder, course, release))
        elif not expected <= {a["name"] for a in release["assets"]}:
            raise RuntimeError(f"Published version {tag_for(course)} is missing an asset")
    if args.check:
        print("yes" if pending else "no")
        return
    if os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise RuntimeError("Release publication runs on main")
    for folder, course, release in pending:
        with tempfile.TemporaryDirectory() as directory:
            publish(folder, course, release, repository, Path(directory))


if __name__ == "__main__":
    main()
