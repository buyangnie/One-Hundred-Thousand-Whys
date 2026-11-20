# One Hundred Thousand Whys

A collection of interactive science courses built around questions you can investigate yourself. Each course has an online edition and a self-contained HTML download for offline classrooms.

**[Browse the course catalog](https://buyangnie.github.io/One-Hundred-Thousand-Whys/)**

## Before the Answer

How do researchers tell whether an unspoken concept helped a language model answer? Six narrated experiments let you exchange a spider for an ant, compare two lenses on the same hidden state, trace an arithmetic result and examine which tasks follow an intervention. The labs use published figure data from Gurnee, Sofroniew and colleagues. English opens by default, with Mandarin narration, bilingual captions and selectable transcript lines.

[Open the course](https://buyangnie.github.io/One-Hundred-Thousand-Whys/courses/before-the-answer/) · [Download the offline HTML](https://github.com/buyangnie/One-Hundred-Thousand-Whys/releases/download/before-the-answer-v1.0.0/Before_the_Answer.html) · [Release notes](https://github.com/buyangnie/One-Hundred-Thousand-Whys/releases/tag/before-the-answer-v1.0.0) · [Figure data and sources](courses/before-the-answer/DATA.md)

## Earth & Moon

Why do the hemispheres have opposite seasons? Why do we see nearly the same face of the Moon? Follow six narrated chapters, then pause to test each idea in two synchronized views. English opens by default. Switch to Mandarin at any time or enable bilingual captions.

[Open the course](https://buyangnie.github.io/One-Hundred-Thousand-Whys/courses/earth-and-moon/) · [Download the offline HTML, about 39 MB](https://github.com/buyangnie/One-Hundred-Thousand-Whys/releases/download/earth-and-moon-v1.0.0/Orbit_Atlas_Earth_and_Moon.html) · [Release notes](https://github.com/buyangnie/One-Hundred-Thousand-Whys/releases/tag/earth-and-moon-v1.0.0)

| Chapter | Investigate |
| --- | --- |
| [Day and night](https://buyangnie.github.io/One-Hundred-Thousand-Whys/courses/earth-and-moon/?chapter=day-and-night) | Follow sunrise, noon and sunset in Hangzhou. |
| [Seasons](https://buyangnie.github.io/One-Hundred-Thousand-Whys/courses/earth-and-moon/?chapter=seasons) | Compare daylight at 30° north and south, then straighten Earth's axis. |
| [The tropics](https://buyangnie.github.io/One-Hundred-Thousand-Whys/courses/earth-and-moon/?chapter=tropics) | Trace the overhead Sun and measure a pole's shadow. |
| [The Moon's spin](https://buyangnie.github.io/One-Hundred-Thousand-Whys/courses/earth-and-moon/?chapter=synchronous-rotation) | Turn off lunar rotation and follow a surface landmark. |
| [Moon phases](https://buyangnie.github.io/One-Hundred-Thousand-Whys/courses/earth-and-moon/?chapter=moon-phases) | Compare the illuminated lunar hemisphere with the disk seen from Earth. |
| [Eclipses](https://buyangnie.github.io/One-Hundred-Thousand-Whys/courses/earth-and-moon/?chapter=eclipses) | Move a new or full Moon near an orbital node. |

For offline use, download the HTML from the release, open it in a browser and press **Play chapter one**. Both narrations, all films, captions and experiments are included.

## Repository guide

| Path | Contents |
| --- | --- |
| `courses/<course-id>/course.json` | Titles, subjects, search terms, chapter links, release version and download URL |
| `courses/<course-id>/` | The course entry point, cover, editable lesson content, code, assets and credits |
| [Course authoring guide](docs/COURSE_AUTHORING.md) | Visual style, chapter interactions, bilingual media, accessibility, verification and release workflow |
| `production/<course-id>/` | Optional film renderer and narration inputs |
| `site/` | The searchable catalog interface |
| `scripts/build.py` | Validates manifests and builds the published site |
| `.github/workflows/pages.yml` | Checks pull requests and deploys the catalog from main |

The Earth & Moon online edition renders each scene from the model and loads narration by chapter. Its offline release embeds the twelve original narrated MP4 films. The full download is distributed through GitHub Releases. Before the Answer serves the selected MP4 from Pages. Its twelve generated films are distributed in a versioned Release archive and staged during the site build.

## Preview locally

The published catalog builds with Python 3.9 or newer. The first build downloads the versioned web films. From the repository root, run:

```sh
python3 scripts/build.py
python3 -m http.server 8000 --directory _site
```

Open [the local catalog](http://localhost:8000/).

## Add a course

Read the [course authoring guide](docs/COURSE_AUTHORING.md) and choose the closest reference course.

1. Create `courses/<stable-id>/` with an HTML entry point, cover and credits. Use an existing manifest as a reference.
2. List its languages, subject tags and chapter questions in `course.json`. Keep course and chapter IDs stable so classroom links continue to work.
3. Publish the offline file as a release asset under a course-specific tag such as `earth-and-moon-v1.0.0` and set the download URL in the manifest.
4. Run the local build and test both editions. Push the approved course directly to `main`. The workflow publishes new versions with a production recipe and updates the catalog.

## Credits

See [Earth & Moon sources and asset credits](courses/earth-and-moon/CREDITS.md), [Before the Answer credits](courses/before-the-answer/CREDITS.md) and the [repository license](LICENSE). Third-party materials carry their own notices.
