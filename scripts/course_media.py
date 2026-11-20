"""Stage versioned chapter films for web playback and build a single-file course."""
import base64
import json
import mimetypes
import re
import shutil
import tempfile
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".course-media"


def film_names(course):
    return [
        f"{language}-{i}.mp4"
        for language in course["languages"]
        for i in range(1, len(course["chapters"]) + 1)
    ]


def tag_for(course):
    return f'{course["id"]}-v{course["version"]}'


def cached_films(course):
    destination = CACHE / tag_for(course)
    names = film_names(course)
    if all((destination / name).is_file() and (destination / name).stat().st_size for name in names):
        return destination
    url = urljoin(course["release"], course["filmArchive"])
    CACHE.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=CACHE) as work:
        work = Path(work)
        req = urllib.request.Request(url, headers={"User-Agent": "One-Hundred-Thousand-Whys-build"})
        with urllib.request.urlopen(req, timeout=120) as src, (work / "archive.zip").open("wb") as out:
            shutil.copyfileobj(src, out)
        with zipfile.ZipFile(work / "archive.zip") as archive:
            if sorted(archive.namelist()) != sorted(names):
                raise ValueError(f"Unexpected movie set in {url}")
            staged = work / "ready"
            staged.mkdir()
            for name in names:
                with archive.open(name) as src, (staged / name).open("wb") as out:
                    shutil.copyfileobj(src, out)
                if not (staged / name).stat().st_size:
                    raise ValueError(f"Empty movie {name}")
            destination.mkdir(exist_ok=True)
            for name in names:
                (staged / name).replace(destination / name)
    return destination


def encoded(path):
    return base64.b64encode(path.read_bytes()).decode("ascii")


def data_url(path):
    mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return f"data:{mime};base64,{encoded(path)}"


def standalone(course, films, target):
    folder = ROOT / "courses" / course["id"]
    html = (folder / course["entry"]).read_text(encoding="utf-8")

    def style(match):
        css_path = folder / match[1]
        css = css_path.read_text(encoding="utf-8")
        css = re.sub(r'url\(["\']([^"\']+)["\']\)', lambda m: f'url("{data_url(css_path.parent / m[1])}")', css)
        return "<style>\n" + css + "\n</style>"

    def script(match):
        body = (folder / match[1]).read_text(encoding="utf-8").replace("</script", "<\\/script")
        return "<script>\n" + body + "\n</script>"

    payload = {"manifest": course}
    for key in ("notes", "evidence", "cues"):
        payload[key] = json.loads((folder / "content" / f"{key}.json").read_text(encoding="utf-8"))
    content = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    blocks = [f'<script type="application/json" id="offline-content">{content}</script>']
    for image in sorted((folder / "assets").glob("*.webp")):
        if image.name != "hero.webp":
            blocks.append(f'<script type="application/octet-stream" data-asset="assets/{image.name}">{encoded(image)}</script>')
    for name in film_names(course):
        blocks.append(f'<script type="application/octet-stream" data-asset="films/{name}">{encoded(films / name)}</script>')
    for notice in sorted((folder / "assets/fonts").glob("license-*.txt")):
        blocks.append('<script type="text/plain" data-font-notice="' + notice.name + '">' + notice.read_text(encoding="utf-8") + "</script>")
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', style, html)
    html = html.replace('src="assets/hero.webp"', 'src="' + data_url(folder / "assets/hero.webp") + '"')
    html = html.replace('<script src=', '\n'.join(blocks) + '\n<script src=', 1)
    html = re.sub(r'<script src="([^"]+)"></script>', script, html)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding="utf-8")


def make_outputs(course, films, output_dir):
    attachment = output_dir / course["release"].rsplit("/", 1)[1]
    standalone(course, films, attachment)
    archive = output_dir / course["filmArchive"]
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as output:
        for name in film_names(course):
            member = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            member.external_attr = 0o100644 << 16
            output.writestr(member, (films / name).read_bytes())
    return attachment, archive
