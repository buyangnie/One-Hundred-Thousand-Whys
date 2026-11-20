# Building a course for One Hundred Thousand Whys

A learner should be able to watch an explanation, try the same idea, switch languages and return to the right place in either edition. Keep that experience familiar. Give each subject its own illustrations, experiments and vocabulary.

Use [Earth & Moon](../courses/earth-and-moon/) as the reference for a physical simulation with linked views. Use [Before the Answer](../courses/before-the-answer/) for a paper-based lesson that replays measured conditions. Both open in English and offer Mandarin throughout.

## 1. Start with a question the learner can test

Write one question for the course and one for each chapter. Open with a concrete observation, invite a prediction and show what would count as evidence. For example, an Earth observer and an orbital observer see the same Moon from different positions. In the language-model lesson a learner keeps a prompt fixed, changes a hidden representation and compares two recorded answers.

Before building a chapter, fill in these fields. They can go into the working storyboard.

| Field | What to specify |
| --- | --- |
| Question | One question a learner can answer after the experiment |
| Starting state | The scene or prompt and its baseline result |
| Learner action | What to choose, move, replace or reveal |
| Observable result | Which two states, numbers or views can be compared |
| Interpretation | What the comparison supports and its scope |
| Evidence | Exact figure, data file, calculation or scientific reference |
| Media | Matched English and Mandarin cues and the visual change at each beat |

Chapter count and duration follow the subject. Six chapters and roughly ten minutes of narrated material plus hands-on time worked for the first two courses. The catalog should show measured playback time separately from estimates of study time.

## 2. Reuse the visual structure

| Keep familiar | Adapt to the subject |
| --- | --- |
| Sticky masthead with collection or course identity, chapter navigation and an EN / 中文 switch | The course mark and subject title |
| A wide hero, title and two clear actions for the film and experiment | A right-weighted hero illustration and an opening question |
| An illustrated chapter rail with short titles, durations and a visible current chapter | Number of chapters, motifs and order |
| A chapter heading, question and two clearly labeled modes | Physics controls, research conditions, axes and comparison views |
| The explanation, transcript, source links and previous/next actions near the stage | A quiz, expandable methods or data table when they help answer the question |

Use the existing palette as the starting point. Ink navy `#09121c` is the page, `#0e1c28` a panel and `#2b4050` a divider. Off-white `#f0f2ea` is primary text and `#acbdc8` secondary text. Mint `#a4e3cf` signals observations or a baseline. Warm gold `#f5cf91` marks primary actions, selection or comparison conditions. Pair color with a label, outline, marker or line style.

Instrument Serif gives English titles their editorial character. DM Sans handles labels and prose. Use a legible Chinese serif for Chinese headings where available and platform CJK fallbacks for prose. Bundle any web fonts and their licenses. A practical desktop starting point is a content width near 1,260 px, 60–65 px navigation, 16 px body copy and 14 px controls. Keep chapter cards in a horizontal scrolling rail on a phone and stack comparison panels when necessary.

Create visual interest with the subject itself. Layered optical glass introduces an internal representation, and a Moon casting a shadow introduces an eclipse. Design each hero with a quiet area behind the title. Treat editorial artwork as illustration. Draw quantitative charts directly from values and give them labeled axes, units, a legend and an accessible numeric readout.

## 3. Preserve the learner’s place

- Open the course in English. Offer Mandarin UI, narration and transcripts. Give the learner current-language captions, bilingual captions and captions off.
- A chapter card, the previous/next buttons and a catalog deep link must land on the same chapter. Give chapters stable lowercase IDs. The default URL format is `?chapter=<id>`. A course may also support an explicit language or mode in its URL.
- Pressing the hero’s play button starts the first film. The experiment button opens a usable first experiment. Audio starts after a learner action. Switching to an experiment pauses the film.
- Keep the selected chapter, film/lab mode, experimental conditions and equivalent narration position when changing language. Map to the corresponding sentence or scene. The recordings can have different durations.
- Make an experiment reversible. A learner should be able to return to baseline, clearly identify the changed variable and compare the outcome. Offer free sliders for continuous simulations and indexed controls for sampled measurements.
- Provide keyboard access, visible focus, meaningful button names, legible mobile axes and a reduced-motion option for animated transitions. Keep a text or table equivalent for important chart values. Test the longest labels in both languages.

## 4. Build media and evidence together

Write paired semantic cues before recording. Render or record the two narrations and measure start and end times from the finished audio. Avoid copying English timecodes onto the Mandarin recording. Use those measured cues to drive scene changes, captions and clickable transcript lines. Avoid burning captions into the video if the player supplies toggleable captions.

For web video, H.264 with AAC audio in a fast-start MP4 works with the current course player. The two examples also demonstrate another option for the web edition: a synchronized live scene with a prerecorded narration track. The offline attachment must include its playable films and both narrations. Size media for the smallest text and motion a learner needs to inspect. Load only the selected film while viewing the web edition.

For a paper-based lesson, link each experiment to a primary figure. Record its model or population, sample size, task, condition, metric and transformation in the course’s data notes. Label a schematic, a mathematical simulation, and a replay of measured data according to their origin. Preserve token spellings, units, ranks, rounding conventions and unresolved source discrepancies. Pair memorable individual successes with the aggregate when the study provides one. See the [measurement notes for Before the Answer](../courses/before-the-answer/DATA.md).

## 5. Arrange the source and build both editions

| Location | Purpose |
| --- | --- |
| `courses/<id>/course.json` | Stable ID, version, localized title and description, subjects and tags, languages, chapter questions, cover, entry and release URL |
| `courses/<id>/index.html`, `src/`, `content/`, `assets/` | Web entry, interaction code, editable content and small runtime assets |
| `courses/<id>/CREDITS.md` | Research sources, illustrations, narration, typefaces and third-party notices |
| `production/<id>/` | Optional renderer and editable media inputs for releases built by the workflow |
| `.course-media/<id>-v<version>/` | Local cache of versioned films, excluded from Git |
| `_site/` | Generated Pages deployment, excluded from Git |
| A course-specific GitHub Release | Downloadable single HTML and any versioned movie archive needed by Pages |

Copy an existing manifest and replace every course-specific field. Use `en` and `zh` as language keys. Each chapter has an `id`, a localized `title` and a localized `question`. Use subjects and tags people will search for in both languages.

For a static preview of published courses, run these commands from the repository root:

```sh
python3 scripts/build.py
python3 -m http.server 8000 --directory _site
```

The build fetches released movie archives on the first run and reuses the cache. For a new course under development, `python3 scripts/build.py --without-films` validates the manifests and stages the interactive site before media is ready.

**Reusing the Before the Answer player.** Its web entry loads `course.json`, `content/notes.json`, `content/evidence.json` and `content/cues.json`. The offline packer embeds these objects, fonts, notices, artwork and MP4s in the same document. The web and offline versions therefore share the interaction code. For this shell, use the existing file names and cue format, or extend the packer together with a changed asset layout. New simulation courses can use a different renderer.

Declare `filmArchive` in the manifest for a course whose web films are staged from a Release. The ZIP has one flat file named `<language>-<1-based-chapter>.mp4` per chapter and language. Provide `production/<id>/build_media.py <output-directory>` when automatic releases should render those files. The example renderer uses FFmpeg with libx264, Pillow, NumPy, Noto CJK and DejaVu fonts. To make the local release from source or cached films, run:

```sh
python3 scripts/release_courses.py --package before-the-answer --output /tmp/whys-release
```

## 6. Verify and publish

| Check | How to verify |
| --- | --- |
| Catalog and deep links | Search both languages. Open every chapter from its direct URL. Confirm the existing courses still open. |
| Desktop and phone | Check the hero crop, chapter rail, both modes, long Chinese labels, keyboard navigation and focus. No page-wide horizontal scrolling. |
| Experiments | Exercise baseline, intervention and reset. Check reported results against their source, including a failure or null effect where relevant. |
| Language switching | Change language in the middle of an experiment and during a sentence. Verify chapter, selections, equivalent cue, playback rate and play/pause state. |
| Media | Decode every clip. Test actual playback, seeking from transcript lines, subtitle modes and audio in both languages. |
| Offline | Download the HTML, disable networking and open the file directly in a browser. Test chapters, films, captions and experiments. References can open online when wanted. |
| Distribution | Confirm English README links, version/tag agreement, asset size, SHA-256 of the downloaded HTML, public Pages playback and the deployed catalog. |

For this repository, publish approved work directly to `main`. Keep IDs stable. Bump the course version before distributing changes that affect its offline materials. Use a tag such as `before-the-answer-v1.0.0`. Place the complete offline file and generated large video bundles in the Release. Keep the source, small web assets and media production inputs in Git.

The Pages workflow checks versioned courses on `main`. For courses with a production recipe, a missing version triggers rendering, creation of a draft release, upload of both attachments and publication. The site build then stages those versioned films for same-origin playback. Previously published versions are reused. Review the workflow result and open the public edition before announcing a release.
