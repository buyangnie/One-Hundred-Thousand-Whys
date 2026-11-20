/* The same document and interaction state machine power the web and offline editions. */
(async function startCourse() {
  const byId = (id) => document.getElementById(id);
  const make = (tag, text) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const clock = (seconds) => {
    const n = Math.max(0, Math.floor(seconds || 0));
    return Math.floor(n / 60) + ":" + String(n % 60).padStart(2, "0");
  };
  const standalone = Boolean(byId("offline-content"));
  const mediaBlocks = new Map(
    [...document.querySelectorAll("script[data-asset]")].map((el) => [
      el.dataset.asset,
      el,
    ]),
  );
  const smallImages = new Map();
  function imageURL(path) {
    if (!standalone) return path;
    if (!smallImages.has(path))
      smallImages.set(
        path,
        "data:image/webp;base64," + mediaBlocks.get(path).textContent.trim(),
      );
    return smallImages.get(path);
  }
  function videoURL(path) {
    if (!standalone) return path;
    const bytes = Uint8Array.from(
      atob(mediaBlocks.get(path).textContent.trim()),
      (ch) => ch.charCodeAt(0),
    );
    return URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
  }
  async function loadContent() {
    if (standalone) return JSON.parse(byId("offline-content").textContent);
    const paths = {
      manifest: "course.json",
      notes: "content/notes.json",
      evidence: "content/evidence.json",
      cues: "content/cues.json",
    };
    const entries = await Promise.all(
      Object.entries(paths).map(async ([name, path]) => {
        const response = await fetch(path);
        if (!response.ok) throw Error("Could not load " + path);
        return [name, await response.json()];
      }),
    );
    return Object.fromEntries(entries);
  }
  try {
    const { manifest, notes, evidence, cues } = await loadContent();
    const query = new URLSearchParams(location.search);
    let lang = query.get("lang") === "zh" ? "zh" : "en";
    let index = Math.max(
      0,
      manifest.chapters.findIndex((ch) => ch.id === query.get("chapter")),
    );
    let mode = query.get("mode") === "film" ? "film" : "lab";
    const states = CourseLabs.initial(),
      marks = manifest.chapters.map(() => ({
        cue: 0,
        weight: 0,
        opening: true,
      }));
    const tr = (en, zh) => (lang === "en" ? en : zh),
      local = (words) => words[lang === "en" ? 0 : 1];
    const movie = byId("movie");
    let loaded = null,
      activeURL = null,
      readyListener = null,
      track = null;
    const text = (id, en, zh) => {
      byId(id).textContent = tr(en, zh);
    };
    function syncAddress() {
      if (standalone || location.protocol === "file:") return;
      const url = new URL(location.href);
      url.searchParams.set("chapter", manifest.chapters[index].id);
      if (lang === "zh") url.searchParams.set("lang", "zh");
      else url.searchParams.delete("lang");
      if (mode === "film") url.searchParams.set("mode", "film");
      else url.searchParams.delete("mode");
      history.replaceState(null, "", url);
    }
    function lessonScroll() {
      byId("lesson").scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
    function remember() {
      if (
        !loaded ||
        movie.readyState < 1 ||
        !Number.isFinite(movie.currentTime)
      )
        return;
      const { language, chapter } = loaded,
        dat = cues[language][chapter],
        time = movie.currentTime;
      if (time < dat.cues[0].start) {
        marks[chapter] = { cue: 0, weight: 0, opening: true };
        return;
      }
      let i = dat.cues.length - 1;
      while (i > 0 && dat.cues[i].start > time) i--;
      const a = dat.cues[i].start,
        b = dat.cues[i + 1]?.start || dat.duration;
      marks[chapter] = {
        cue: i,
        weight: Math.max(0, Math.min(1, (time - a) / (b - a))),
        opening: false,
      };
    }
    function markerTime(dat, mark) {
      if (mark.opening) return 0;
      const start = dat.cues[mark.cue].start,
        end = dat.cues[mark.cue + 1]?.start || dat.duration;
      return start + (end - start) * mark.weight;
    }
    function captions() {
      if (!loaded || typeof VTTCue === "undefined") return;
      if (!track)
        track = movie.addTextTrack("captions", "Course captions · 课程字幕");
      track.mode = "hidden";
      for (const cue of Array.from(track.cues || [])) track.removeCue(cue);
      const setting = byId("captions").value;
      if (setting === "off") {
        track.mode = "disabled";
        return;
      }
      const { language, chapter } = loaded,
        primary = cues[language][chapter].cues;
      const alt = cues[language === "en" ? "zh" : "en"][chapter].cues;
      for (const [i, c] of primary.entries()) {
        const cue = new VTTCue(
          c.start,
          c.end,
          c.text + (setting === "both" ? "\n" + alt[i].text : ""),
        );
        cue.align = "center";
        track.addCue(cue);
      }
      track.mode = "showing";
    }
    function play() {
      const current = loaded;
      movie.play().catch((err) => {
        if (
          current !== loaded ||
          err.name === "AbortError" ||
          err.name === "NotAllowedError"
        )
          return;
        movieFailure();
      });
    }
    function movieFailure() {
      byId("film").setAttribute("aria-busy", "false");
      byId("movieError").hidden = false;
      text(
        "movieError",
        "The film could not be played. Try reloading this chapter. The transcript and experiment remain available.",
        "此影片未能播放。可重新载入本章，或阅读讲稿、进行实验。",
      );
    }
    function seekTo(target, resume) {
      const context = loaded;
      context.target = target;
      context.resume = resume;
      if (movie.readyState < 1) return;
      const end = movie.seekable.length
        ? movie.seekable.end(movie.seekable.length - 1)
        : 0;
      if (target < 0.1 || activeURL.startsWith("blob:") || end >= target) {
        byId("film").setAttribute("aria-busy", "false");
        movie.currentTime = Math.min(
          target,
          Math.max(0, movie.duration - 0.06),
        );
        if (resume && mode === "film") play();
        return;
      }
      // Small static servers can play an MP4 while reporting an empty seek range.
      // Buffer only this film when a transcript jump or language change needs seeking.
      if (context.buffering) return;
      context.buffering = true;
      byId("film").setAttribute("aria-busy", "true");
      fetch(context.path)
        .then((response) => {
          if (!response.ok) throw Error("Film unavailable");
          return response.blob();
        })
        .then((blob) => {
          if (loaded !== context) return;
          activeURL = URL.createObjectURL(blob);
          movie.addEventListener(
            "loadedmetadata",
            () => {
              if (loaded !== context) return;
              movie.currentTime = Math.min(
                context.target,
                Math.max(0, movie.duration - 0.06),
              );
              movie.playbackRate = Number(byId("speed").value);
              captions();
              byId("film").setAttribute("aria-busy", "false");
              if (context.resume && mode === "film") play();
            },
            { once: true },
          );
          movie.src = activeURL;
          movie.load();
        })
        .catch(() => {
          if (loaded === context) {
            context.buffering = false;
            movieFailure();
          }
        });
    }
    function prepareMovie({ autoplay = false, explicitTime = null } = {}) {
      byId("movieError").hidden = true;
      if (loaded?.chapter === index && loaded?.language === lang) {
        if (explicitTime !== null) {
          marks[index] = { cue: 0, weight: 0, opening: true };
          seekTo(explicitTime, autoplay);
        }
        if (autoplay) play();
        return;
      }
      if (readyListener)
        movie.removeEventListener("loadedmetadata", readyListener);
      movie.pause();
      byId("film").setAttribute("aria-busy", "true");
      const oldURL = activeURL;
      loaded = {
        language: lang,
        chapter: index,
        path: "films/" + lang + "-" + (index + 1) + ".mp4",
        resume: autoplay,
        target: explicitTime ?? markerTime(cues[lang][index], marks[index]),
      };
      const context = loaded;
      readyListener = () => {
        if (loaded !== context) return;
        movie.playbackRate = Number(byId("speed").value);
        captions();
        if (context.target > 0) seekTo(context.target, context.resume);
        else byId("film").setAttribute("aria-busy", "false");
      };
      movie.addEventListener("loadedmetadata", readyListener, { once: true });
      movie.poster = imageURL(
        "assets/poster-" + (lang === "zh" ? "zh-" : "") + (index + 1) + ".webp",
      );
      movie.preload = "metadata";
      activeURL = videoURL(context.path);
      movie.src = activeURL;
      movie.load();
      if (oldURL?.startsWith("blob:")) URL.revokeObjectURL(oldURL);
      if (autoplay) play();
    }
    function renderRail() {
      const items = [];
      for (const [i, ch] of manifest.chapters.entries()) {
        const b = make("button");
        b.type = "button";
        b.className = "ch-card";
        b.setAttribute("aria-current", String(i === index));
        const img = make("img");
        img.src = imageURL("assets/ch-" + (i + 1) + ".webp");
        img.alt = "";
        img.width = 520;
        img.height = 184;
        const duration = make("span", clock(cues[lang][i].duration));
        duration.className = "duration";
        duration.setAttribute("aria-hidden", "true");
        const name = make("span");
        name.className = "card-name";
        const num = make("small", String(i + 1).padStart(2, "0"));
        num.setAttribute("aria-hidden", "true");
        name.append(num, document.createTextNode(ch.title[lang]));
        b.append(img, duration, name);
        b.addEventListener("click", () => selectChapter(i, true));
        items.push(b);
      }
      byId("rail").replaceChildren(...items);
    }
    function lesson() {
      const ch = manifest.chapters[index],
        note = notes[index];
      byId("chapterNumber").textContent =
        tr("CHAPTER ", "第 ") +
        String(index + 1).padStart(2, "0") +
        tr(" / 06", " / 06 章");
      byId("chapterTitle").textContent = ch.title[lang];
      byId("chapterQuestion").textContent = ch.question[lang];
      byId("labMode").setAttribute("aria-pressed", String(mode === "lab"));
      byId("filmMode").setAttribute("aria-pressed", String(mode === "film"));
      byId("film").hidden = mode !== "film";
      byId("lab").hidden = mode !== "lab";
      byId("prev").disabled = index === 0;
      byId("next").disabled = index === manifest.chapters.length - 1;
      byId("pageCount").textContent =
        index + 1 + " / " + manifest.chapters.length;
      byId("filmInfo").textContent =
        tr("Narration · English", "旁白 · 普通话") +
        "  ·  " +
        clock(cues[lang][index].duration);
      byId("takeTitle").textContent = local(note.takeTitle);
      byId("takeText").textContent = local(note.take);
      const refElements = note.refs.map(([en, zh, url]) => {
        const a = make("a", tr(en, zh));
        a.href = url.startsWith("https://") ? url : evidence.paper + "#" + url;
        a.target = "_blank";
        a.rel = "noreferrer";
        return a;
      });
      byId("refs").replaceChildren(...refElements);
      const method = note.method.map((words) => make("p", local(words)));
      if (note.formula) {
        const formula = make("pre", note.formula);
        formula.className = "formula";
        method.splice(1, 0, formula);
      }
      byId("techBody").replaceChildren(...method);
      const cueNodes = cues[lang][index].cues.map((c) => {
        const li = make("li"),
          b = make("button");
        b.type = "button";
        b.append(make("time", clock(c.start)), make("span", c.text));
        b.addEventListener("click", () => {
          selectMode("film", true, c.start);
          lessonScroll();
        });
        li.append(b);
        return li;
      });
      byId("cues").replaceChildren(...cueNodes);
      CourseLabs.render(byId("labBody"), index, evidence, lang, states);
    }
    function chrome() {
      document.documentElement.lang = tr("en", "zh-CN");
      text("brandName", "One Hundred Thousand Whys", "十万个为什么");
      byId("topNav").setAttribute(
        "aria-label",
        tr("Course navigation", "课件导航"),
      );
      byId("langOptions").setAttribute("aria-label", tr("Language", "语言"));
      byId("en").setAttribute("aria-pressed", String(lang === "en"));
      byId("zh").setAttribute("aria-pressed", String(lang === "zh"));
      text("skip", "Skip to the lesson", "跳到课件");
      text("collectionLabel", "INTERACTIVE COURSES", "双语互动课程");
      text("navChapters", "Chapters", "课程目录");
      text("navLab", "Workbench", "实验台");
      byId("rail").setAttribute("aria-label", tr("Chapters", "课程目录"));
      text("discipline", "Model interpretability", "模型可解释性");
      byId("title").replaceChildren(
        document.createTextNode(tr("Before the ", "答案")),
        make("em", tr("Answer", "出现之前")),
      );
      text(
        "intro",
        "A model answers “8.” It never says spider. What happens if researchers replace that hidden concept with ant?",
        "模型回答“8”，全程没说“蜘蛛”。如果研究者把它内部的蜘蛛表征换成蚂蚁，答案会怎样？",
      );
      byId("startFilm").lastElementChild.textContent = tr(
        "Play chapter one",
        "播放第一章",
      );
      byId("startLab").lastElementChild.textContent = tr(
        "Try the experiment",
        "进入互动实验",
      );
      text("chapterHeading", "Course chapters", "课程目录");
      const total = cues[lang].reduce((acc, c) => acc + c.duration, 0);
      byId("length").textContent =
        tr("6 chapters · ", "6 章 · ") +
        clock(total) +
        tr(" of film", " 讲解视频");
      text("labMode", "Experiment", "互动实验");
      text("filmMode", "Narrated film", "视频讲解");
      text("rateLabel", "Speed", "倍速");
      text("capLabel", "Captions", "字幕");
      Array.from(byId("captions").options).forEach((o, i) => {
        o.textContent = [
          tr("Current language", "当前语言"),
          tr("Bilingual", "双语"),
          tr("Off", "关闭"),
        ][i];
      });
      text("takeLabel", "What the result tells us", "实验说明");
      text("techLabel", "Method notes", "方法与边界");
      text("transLabel", "Chapter transcript", "本章逐字稿");
      text(
        "transHelp",
        "Select a line to play the film from that point.",
        "点击任意一句，可从该处播放视频。",
      );
      text("prev", "Previous chapter", "上一章");
      text("next", "Next chapter", "下一章");
      text("footerTitle", "Before the Answer", "答案出现之前");
      text(
        "credit",
        "Based on Gurnee, Sofroniew et al. · Anthropic, 2026",
        "依据 Gurnee、Sofroniew 等人的研究 · Anthropic，2026",
      );
      text("catalogLink", "Course catalog", "课程目录");
      text("download", "Offline edition", "离线版");
      byId("catalogLink").href = standalone
        ? "https://buyangnie.github.io/One-Hundred-Thousand-Whys/"
        : "../../";
      renderRail();
      lesson();
    }
    function selectChapter(i, scroll = false) {
      if (i < 0 || i >= manifest.chapters.length) return;
      remember();
      movie.pause();
      index = i;
      byId("technical").open = false;
      byId("transcript").open = false;
      renderRail();
      lesson();
      if (mode === "film") prepareMovie();
      syncAddress();
      if (scroll) lessonScroll();
    }
    function selectMode(next, autoplay = false, time = null) {
      if (mode === "film" && next === "lab") {
        remember();
        movie.pause();
      }
      mode = next;
      lesson();
      if (mode === "film") prepareMovie({ autoplay, explicitTime: time });
      syncAddress();
    }
    function translate(next) {
      if (lang === next) return;
      const playing = mode === "film" && !movie.paused;
      remember();
      movie.pause();
      lang = next;
      chrome();
      if (mode === "film") prepareMovie({ autoplay: playing });
      syncAddress();
    }
    byId("en").onclick = () => translate("en");
    byId("zh").onclick = () => translate("zh");
    byId("labMode").onclick = () => selectMode("lab");
    byId("filmMode").onclick = () => selectMode("film");
    byId("startLab").onclick = () => {
      selectMode("lab");
      selectChapter(0);
      lessonScroll();
    };
    byId("startFilm").onclick = () => {
      remember();
      movie.pause();
      index = 0;
      mode = "film";
      renderRail();
      lesson();
      prepareMovie({ autoplay: true, explicitTime: 0 });
      syncAddress();
      lessonScroll();
    };
    byId("prev").onclick = () => selectChapter(index - 1, true);
    byId("next").onclick = () => selectChapter(index + 1, true);
    byId("captions").onchange = captions;
    byId("speed").onchange = () => {
      movie.playbackRate = Number(byId("speed").value);
    };
    movie.addEventListener("error", movieFailure);
    chrome();
    if (mode === "film") prepareMovie();
    if (query.has("chapter") && !location.hash)
      requestAnimationFrame(() =>
        byId("lesson").scrollIntoView({ behavior: "instant" }),
      );
  } catch (err) {
    byId("loadError").hidden = false;
    byId("loadError").textContent =
      "Course data could not be loaded. Reopen the online course or use its single-file offline edition. 课件数据加载失败，请打开在线课程或单文件离线版。";
    console.error(err);
  }
})();
