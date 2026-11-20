/* Research figures are redrawn from the discrete conditions in content/evidence.json. */
const CourseLabs = (() => {
  function node(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }
  function pair(en, zh) {
    return [en, zh];
  }
  const initial = () => [
    { depth: 0, guess: null, revealed: false },
    { depth: 0, pos: 9, lens: "j", target: "Mars", zoom: false },
    { depth: 7, focus: "all" },
    { task: "capital", strength: 1 },
    { task: "report", answers: {} },
    { benchmark: "fabrication", ablate: false },
  ];
  function render(host, index, data, language, states) {
    const s = states[index];
    const tr = (en, zh) => (language === "en" ? en : zh);
    const local = (words) => words[language === "en" ? 0 : 1];
    const panel = () => node("section", "panel");
    const para = (text, kind = "explain") => node("p", kind, text);
    function button(label, cls, action) {
      const b = node("button", cls, label);
      b.type = "button";
      b.addEventListener("click", action);
      return b;
    }
    function titled(title, side) {
      const bar = node("div", "panel-title");
      bar.append(node("h3", "", title));
      if (side) bar.append(node("small", "", side));
      return bar;
    }
    function picks(label, options, current, change) {
      const row = node("div", "control-row");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", label);
      row.append(node("span", "control-label", label));
      const buttons = [];
      for (const [value, caption] of options) {
        const b = button(caption, "pick", () => {
          buttons.forEach((other) =>
            other.setAttribute("aria-pressed", String(other === b)),
          );
          change(value);
        });
        b.setAttribute("aria-pressed", String(value === current));
        buttons.push(b);
        row.append(b);
      }
      return row;
    }
    function range(label, values, selected, change) {
      const row = node("label", "slider");
      const input = node("input");
      input.type = "range";
      input.min = "0";
      input.max = String(values.length - 1);
      input.step = "1";
      input.value = String(selected);
      input.setAttribute("aria-label", label);
      const out = node("output", "", String(values[selected]));
      function set(i) {
        input.value = String(i);
        out.value = String(values[i]);
        input.setAttribute("aria-valuetext", String(values[i]));
      }
      set(selected);
      input.addEventListener("input", () => {
        const i = Number(input.value);
        set(i);
        change(i);
      });
      row.append(node("span", "", label), input, out);
      return { el: row, set };
    }
    function answerCard(label, text, after = false) {
      const p = panel();
      if (after) p.classList.add("after");
      p.append(titled(label), node("div", "out-text", text));
      return p;
    }
    function rankings(items) {
      const list = node("ol", "panel-list");
      for (const [i, token] of items.entries()) {
        const line = node("li");
        line.append(
          node("small", "", String(i + 1).padStart(2, "0")),
          node("code", "", token),
        );
        list.append(line);
      }
      return list;
    }
    function details(label, body) {
      const el = node("details", "inner-details");
      el.append(node("summary", "", label), body);
      return el;
    }
    function table(head, rows) {
      const wrap = node("div", "table-scroll"),
        t = node("table", "data-table");
      const thead = node("thead"),
        tr = node("tr");
      for (const h of head) tr.append(node("th", "", h));
      thead.append(tr);
      t.append(thead);
      const body = node("tbody");
      for (const row of rows) {
        const line = node("tr");
        row.forEach((v) => line.append(node("td", "", String(v))));
        body.append(line);
      }
      t.append(body);
      wrap.append(t);
      return wrap;
    }
    const d = [
      data.spider,
      data.lens,
      data.arithmetic,
      data.broadcast,
      data.language,
      data.reflection,
    ][index];
    const titles = [
      pair("Intervention replay", "干预回放"),
      pair("Paired lens readouts", "双透镜读数"),
      pair("Arithmetic rank trajectories", "算术中间量名次"),
      pair("Broadcast across tasks", "跨任务广播"),
      pair("Language swap", "语言表征替换"),
      pair("Uninterrupted evaluation", "无反思提示的评估"),
    ];
    const figRefs = ["12–13", "51", "17", "18–19", "20", "49–50"];
    const head = node("div", "lab-bar"),
      source = node("a", "", tr("Source · Fig. ", "原图 · ") + figRefs[index]);
    source.href = d.url;
    source.target = "_blank";
    source.rel = "noreferrer";
    head.append(node("span", "", local(titles[index])), source);
    const inside = node("div", "lab-inner");
    host.replaceChildren(head, inside);

    function spider() {
      inside.append(para(d.prompt, "prompt"));
      if (language === "zh")
        inside.append(para("题意：会织网的动物有几条腿？", "fine"));
      inside.append(
        para(
          tr(
            "Keep the prompt fixed. Inspect the readout, predict the result, then exchange the spider and ant coordinates.",
            "保持原题不变，先看中间读数，预测结果，再交换蜘蛛和蚂蚁对应的坐标。",
          ),
          "instruct",
        ),
      );
      const lookup = panel(),
        strip = node("div", "token-strip");
      const slider = range(
        tr("Model depth", "模型深度"),
        d.depths.map((x) => x.layer),
        s.depth,
        (i) => {
          s.depth = i;
          drawTokens();
        },
      );
      function drawTokens() {
        strip.replaceChildren(
          ...d.depths[s.depth].tokens
            .slice(0, 6)
            .map((t) => node("code", "token", t)),
        );
      }
      drawTokens();
      const top = node("div", "toolbar");
      top.append(
        node("h4", "", tr("First six lens tokens", "排名最前的六个词元")),
        slider.el,
      );
      lookup.append(top, strip);
      strip.style.marginTop = "12px";
      const guesses = picks(
        tr("Your prediction", "你的预测"),
        [
          ["8", tr("Still 8", "仍是 8")],
          ["6", tr("Changes to 6", "变为 6")],
        ],
        s.guess,
        (value) => {
          s.guess = value;
          draw();
        },
      );
      const results = node("div", "two-col"),
        feedback = para("", "feedback");
      feedback.setAttribute("aria-live", "polite");
      const swap = button("", "btn primary", () => {
        s.revealed = !s.revealed;
        draw();
      });
      const controls = node("div", "control-row");
      controls.append(swap);
      function bars(values, label, after) {
        const p = panel();
        if (after) p.classList.add("after");
        p.append(titled(label, tr("Next-token probability", "下一词元概率")));
        p.append(node("div", "hero-value leading-token", values[0].token));
        for (const item of values) {
          const pct = 100 * Math.exp(item.logp),
            line = node("div", "bar-row"),
            track = node("div", "track"),
            fill = node("i");
          fill.style.width = pct + "%";
          track.append(fill);
          line.append(
            node("code", "", item.token),
            track,
            node("span", "", pct.toFixed(1) + "%"),
          );
          p.append(line);
        }
        return p;
      }
      function draw() {
        swap.textContent = s.revealed
          ? tr("Restore original state", "恢复原始状态")
          : tr("Exchange spider and ant", "交换 spider 和 ant");
        swap.setAttribute("aria-pressed", String(s.revealed));
        const original = bars(d.clean, tr("Original run", "原始运行"), false);
        if (s.revealed) {
          results.replaceChildren(
            original,
            bars(d.swapped, tr("After the exchange", "交换后"), true),
          );
          const prefix =
            s.guess === null
              ? ""
              : s.guess === "6"
                ? tr("Correct. ", "猜对了。")
                : tr("The measured result was 6. ", "实测结果是 6。");
          feedback.textContent =
            prefix +
            tr(
              "The leading output moved from 8 to 6 with the same input.",
              "原题保持不变，输出首位从 8 变成了 6。",
            );
        } else {
          const p = panel();
          p.append(
            titled(tr("After the exchange", "交换后")),
            para(
              tr(
                "Reveal the second run to compare the five leading answers.",
                "揭晓第二次运行，比较两次排名前五的答案。",
              ),
            ),
          );
          results.replaceChildren(original, p);
          feedback.textContent = "";
        }
      }
      inside.append(lookup, guesses, controls, results, feedback);
      draw();
    }
    function lens() {
      inside.append(
        para(d.prompt, "prompt"),
        para(
          tr(
            "Choose a target token, then select a cell. Both columns read the exact same activation.",
            "选一个目标词元，再点选热力图单元格。右侧两栏读取完全相同的激活向量。",
          ),
          "instruct",
        ),
      );
      if (language === "zh")
        inside.append(para("题意：从太阳数起的第四颗行星是什么颜色？", "fine"));
      const left = panel(),
        right = panel(),
        grid = node("div", "heat"),
        scroll = node("div", "heat-scroll"),
        board = node("div", "two-col lens-layout");
      const posLabel = node("label", "selecter"),
        pos = node("select");
      posLabel.append(node("span", "", tr("Input position", "输入位置")), pos);
      d.tokens.forEach((token, i) =>
        pos.add(new Option(i + 1 + " · " + token, String(i))),
      );
      pos.addEventListener("change", () => {
        s.pos = Number(pos.value);
        paint();
      });
      const slider = range(tr("Depth", "深度"), d.layers, s.depth, (i) => {
        s.depth = i;
        paint();
      });
      const toolbar = node("div", "toolbar");
      toolbar.append(slider.el, posLabel);
      const methods = picks(
        tr("Heatmap method", "热力图方法"),
        [
          ["j", "J-lens"],
          ["logit", "Logit Lens"],
        ],
        s.lens,
        (key) => {
          s.lens = key;
          paint();
        },
      );
      const targets = picks(
        tr("Track a token", "追踪词元"),
        ["Mars", "red", "color"].map((x) => [x, x]),
        s.target,
        (key) => {
          s.target = key;
          paint();
        },
      );
      const cells = [],
        rowLabels = [],
        columnLabels = [];
      d.layers.forEach((depth, di) => {
        const label = node("span", "heat-label", String(depth));
        rowLabels.push(label);
        grid.append(label);
        const row = [];
        d.tokens.forEach((token, ti) => {
          function select() {
            s.depth = di;
            s.pos = ti;
            paint();
          }
          const b = button("", "cell", select);
          b.addEventListener("keydown", (ev) => {
            const moves = {
              ArrowUp: [-1, 0],
              ArrowDown: [1, 0],
              ArrowLeft: [0, -1],
              ArrowRight: [0, 1],
            };
            if (!moves[ev.key]) return;
            ev.preventDefault();
            const [a, c] = moves[ev.key];
            s.depth = Math.max(0, Math.min(d.layers.length - 1, s.depth + a));
            s.pos = Math.max(0, Math.min(d.tokens.length - 1, s.pos + c));
            paint();
            cells[s.depth][s.pos].focus();
          });
          row.push(b);
          grid.append(b);
        });
        cells.push(row);
      });
      grid.append(node("span", "heat-foot", ""));
      d.tokens.forEach((t) => {
        const label = node("span", "heat-foot", t);
        columnLabels.push(label);
        grid.append(label);
      });
      scroll.append(grid);
      const heading = titled(tr("Depth × input position", "深度 × 输入位置"));
      const zoom = button("", "pick", () => {
        s.zoom = !s.zoom;
        paint();
      });
      heading.append(zoom);
      left.append(
        heading,
        scroll,
        para(
          tr(
            "Brighter = higher rank. Dark = outside the published top ten. Gold outline = selected cell.",
            "颜色越亮，名次越高。深色表示未进公开的前十名，金框表示所选位置。",
          ),
          "fine",
        ),
      );
      board.append(left, right);
      function paint() {
        slider.set(s.depth);
        pos.value = String(s.pos);
        const rows = s.zoom ? 8 : d.layers.length,
          colsShown = s.zoom ? 5 : d.tokens.length;
        const startRow = Math.max(
          0,
          Math.min(d.layers.length - rows, s.depth - Math.floor(rows / 2)),
        );
        const startCol = Math.max(
          0,
          Math.min(
            d.tokens.length - colsShown,
            s.pos - Math.floor(colsShown / 2),
          ),
        );
        grid.style.gridTemplateColumns =
          "27px repeat(" + colsShown + ", minmax(0,1fr))";
        zoom.textContent = s.zoom
          ? tr("Full grid", "完整网格")
          : tr("Zoom 2×", "放大 2×");
        zoom.setAttribute("aria-pressed", String(s.zoom));
        rowLabels.forEach((label, i) => {
          label.hidden = i < startRow || i >= startRow + rows;
        });
        columnLabels.forEach((label, i) => {
          label.hidden = i < startCol || i >= startCol + colsShown;
        });
        cells.forEach((row, di) =>
          row.forEach((b, ti) => {
            b.hidden = rowLabels[di].hidden || columnLabels[ti].hidden;
            const rank = d.cells[di][ti][s.lens].indexOf(s.target) + 1;
            b.style.background = rank
              ? "hsl(161 35% " + (75 - (rank - 1) * 5.2) + "%)"
              : "#192b37";
            const here = s.depth === di && s.pos === ti;
            b.classList.toggle("active", here);
            b.tabIndex = here ? 0 : -1;
            b.setAttribute("aria-pressed", String(here));
            const label =
              tr("Depth ", "深度 ") +
              d.layers[di] +
              " · " +
              (ti + 1) +
              " " +
              d.tokens[ti] +
              " · " +
              s.target +
              " " +
              (rank ? "#" + rank : ">10");
            b.setAttribute("aria-label", label);
            b.title = label;
          }),
        );
        const cell = d.cells[s.depth][s.pos],
          cols = node("div", "readouts");
        [
          ["j", "J-lens"],
          ["logit", "Logit Lens"],
        ].forEach(([key, name]) => {
          const col = node("div");
          col.append(node("h4", "", name), rankings(cell[key]));
          cols.append(col);
        });
        right.replaceChildren(
          titled(
            tr("Top ten · ", "前十名 · ") + d.tokens[s.pos],
            tr("Depth ", "深度 ") + d.layers[s.depth],
          ),
          cols,
        );
      }
      inside.append(targets, methods, toolbar, board);
      board.style.marginTop = "14px";
      paint();
    }
    function arithmetic() {
      inside.append(
        para("(4 + 17) × 2 + 7 = ?", "prompt"),
        para(
          tr(
            "Follow one number or compare all three. Each dot is a measured rank at the last input position.",
            "单独追踪一个数，或比较三个数。每个点是输入末位置在某个采样深度的实测名次。",
          ),
          "instruct",
        ),
      );
      const plot = panel(),
        picture = node("div"),
        vals = node("div", "metrics");
      const svgNS = "http://www.w3.org/2000/svg";
      function svg(tag, attrs, label) {
        const e = document.createElementNS(svgNS, tag);
        for (const [key, val] of Object.entries(attrs))
          e.setAttribute(key, String(val));
        if (label !== undefined) e.textContent = label;
        return e;
      }
      const colors = ["#a4e3cf", "#f5cf91", "#9fbbe9"];
      const slider = range(tr("Depth", "深度"), d.layers, s.depth, (i) => {
        s.depth = i;
        draw();
      });
      const row = node("div", "toolbar");
      row.append(
        picks(
          tr("Highlight", "高亮"),
          [
            ["all", tr("All values", "全部")],
            ...d.series.map((x) => [String(x.value), String(x.value)]),
          ],
          s.focus,
          (k) => {
            s.focus = k;
            draw();
          },
        ),
        slider.el,
      );
      function draw() {
        const chart = svg("svg", {
          viewBox: "0 0 720 220",
          role: "img",
          "aria-label": tr(
            "Vocabulary rank against reindexed model depth",
            "词表名次随归一化模型深度的变化",
          ),
          class: "chart",
        });
        const x = (depth) => 55 + ((depth - 17) * 641) / 83,
          y = (rank) => 19 + Math.log10(Math.min(rank, 10000)) * 39;
        for (const rank of [1, 10, 100, 1000, 10000]) {
          chart.append(
            svg("line", {
              x1: 55,
              x2: 696,
              y1: y(rank),
              y2: y(rank),
              class: "gridline",
            }),
            svg(
              "text",
              { x: 48, y: y(rank) + 4, "text-anchor": "end" },
              rank === 10000 ? "≥9999" : rank,
            ),
          );
        }
        d.layers.forEach((v) =>
          chart.append(
            svg("text", { x: x(v), y: 203, "text-anchor": "middle" }, v),
          ),
        );
        chart.append(
          svg("line", {
            x1: x(d.layers[s.depth]),
            x2: x(d.layers[s.depth]),
            y1: 12,
            y2: 181,
            stroke: "#e5e1bd",
            "stroke-dasharray": "4 4",
          }),
        );
        vals.replaceChildren();
        d.series.forEach((ser, i) => {
          const active = s.focus === "all" || s.focus === String(ser.value);
          const path = ser.ranks
            .map((r, k) => x(d.layers[k]) + "," + y(r))
            .join(" ");
          chart.append(
            svg("polyline", {
              points: path,
              fill: "none",
              stroke: colors[i],
              "stroke-width": active ? 2.6 : 1,
              opacity: active ? 1 : 0.24,
            }),
          );
          ser.ranks.forEach((r, k) =>
            chart.append(
              svg("circle", {
                cx: x(d.layers[k]),
                cy: y(r),
                r: k === s.depth ? 5 : 2.9,
                fill: colors[i],
                opacity: active ? 1 : 0.25,
              }),
            ),
          );
          const badge = node("div", "metric");
          badge.style.borderColor = colors[i];
          badge.append(
            node("span", "", tr("Token ", "词元 ") + ser.value),
            node(
              "strong",
              "",
              ser.ranks[s.depth] >= d.rankCap
                ? "≥9,999"
                : "#" + ser.ranks[s.depth],
            ),
          );
          vals.append(badge);
        });
        picture.replaceChildren(chart);
      }
      plot.append(
        titled(
          tr("Vocabulary rank", "词表名次"),
          tr("Rank 1 is highest", "第一名在顶部"),
        ),
        picture,
        para(
          tr(
            "Horizontal axis: reindexed model depth (0–100). The vertical scale is logarithmic.",
            "横轴是归一化模型深度（0–100）。纵轴为对数名次。",
          ),
          "fine",
        ),
      );
      const rows = d.layers.map((depth, i) => [
        depth,
        ...d.series.map((v) =>
          v.ranks[i] >= d.rankCap ? "≥9,999" : v.ranks[i],
        ),
      ]);
      inside.append(
        row,
        plot,
        vals,
        details(
          tr("View all sampled ranks", "查看全部采样名次"),
          table([tr("Depth", "深度"), "21", "42", "49"], rows),
        ),
      );
      draw();
    }
    function broadcast() {
      const names = {
        capital: pair("Capital", "首都"),
        language: pair("Language", "语言"),
        continent: pair("Continent", "大洲"),
        currency: pair("Currency", "货币"),
      };
      const translated = {
        ...names,
        season: pair("Season", "季节"),
        number: pair("Month number", "月份序号"),
        holiday: pair("Holiday", "节日"),
        next_month: pair("Next month", "下个月"),
        habitat: pair("Habitat", "栖息地"),
        legs: pair("Leg count", "腿数"),
        class: pair("Class", "类别"),
        group: pair("Group", "群体"),
        double: pair("Double", "两倍"),
        square: pair("Square", "平方"),
        successor: pair("Successor", "后继数"),
        first_letter: pair("First letter", "首字母"),
      };
      const categories = {
        countries: pair("Countries", "国家"),
        months: pair("Months", "月份"),
        animals: pair("Animals", "动物"),
        numbers: pair("Numbers", "数字"),
      };
      inside.append(
        para("France → China", "prompt"),
        para(
          tr(
            "Hold the internal exchange fixed and change the question about France.",
            "保持同一种内部替换，改变关于法国的问题。",
          ),
          "instruct",
        ),
      );
      const outcome = node("div", "two-col"),
        cohort = panel(),
        score = node("div", "out-text"),
        stats = node("div", "track gold"),
        fill = node("i"),
        label = para("", "fine");
      stats.append(fill);
      function taskView() {
        const t = d.tasks.find((v) => v.id === s.task);
        outcome.replaceChildren(
          answerCard(tr("Original · France", "原始 · France"), t.clean),
          answerCard(
            tr("After the swap · China", "替换后 · China"),
            t.swapped,
            true,
          ),
        );
      }
      function pooled() {
        const v = d.totals[s.strength - 1];
        score.textContent = v.hits + " / " + v.n;
        fill.style.width = (100 * v.hits) / v.n + "%";
        label.textContent =
          tr(
            "Target answer reached first place in ",
            "目标答案排到第一的比例为 ",
          ) +
          ((100 * v.hits) / v.n).toFixed(1) +
          "%" +
          tr(" of trials.", "。");
      }
      cohort.append(
        titled(
          tr("All sixteen functions", "全部十六种运算"),
          tr("192 ordered trials", "192 次有方向的替换"),
        ),
        picks(
          tr("Swap strength", "替换强度"),
          [
            [1, tr("Standard · 1×", "常规 · 1×")],
            [2, tr("Double · 2×", "加倍 · 2×")],
          ],
          s.strength,
          (k) => {
            s.strength = k;
            pooled();
          },
        ),
        score,
        stats,
        label,
      );
      const rows = d.functions.map((v) => [
        local(categories[v.category]),
        local(translated[v.id]),
        v.standard + " / " + v.n,
        v.strong + " / " + v.n,
      ]);
      inside.append(
        picks(
          tr("Question", "问题"),
          d.tasks.map((t) => [t.id, local(names[t.id])]),
          s.task,
          (k) => {
            s.task = k;
            taskView();
          },
        ),
        outcome,
        node("div", "hr"),
        cohort,
        details(
          tr(
            "See successes and failures by function",
            "查看每种运算的成功与失败",
          ),
          table(
            [tr("Category", "类别"), tr("Function", "运算"), "1×", "2×"],
            rows,
          ),
        ),
      );
      taskView();
      pooled();
    }
    function languageSwap() {
      const tasks = {
        report: pair("Name the language", "判断语言"),
        author: pair("Name an author", "举出作家"),
        continue: pair("Continue the passage", "续写原文"),
        detect: pair("Detect the intrusion", "检测混入句"),
        hello: pair("Say hello", "问候语"),
        currency: pair("Historical currency", "旧货币"),
      };
      const questions = {
        report: pair(
          "Which language is this passage written in?",
          "这段文字是什么语言？",
        ),
        author: pair(
          "Name an author who wrote in this language.",
          "举一位用这种语言写作的作家。",
        ),
        continue: pair(
          "Continue the passage in its original language.",
          "请沿用原文语言续写。",
        ),
        detect: pair(
          "Does a sentence in a different language interrupt the passage?",
          "文章中是否混入了另一种语言的句子？",
        ),
        hello: pair(
          "How do you greet someone in this language?",
          "这种语言怎样表达问候？",
        ),
        currency: pair(
          "Which currency preceded the euro in the associated country?",
          "这个语言所对应的国家在欧元之前使用什么货币？",
        ),
      };
      inside.append(
        para("Spanish → French", "prompt"),
        para(
          tr(
            "The passage is Spanish. Researchers change its internal language label while the model reads the question. Predict whether the response follows that exchange.",
            "原文为西班牙语。模型阅读问题时，研究者替换了内部的语言标签。猜一猜回答会不会跟着变。",
          ),
          "instruct",
        ),
      );
      const body = node("div");
      function view() {
        const item = d.tasks.find((t) => t.id === s.task),
          choice = s.answers[s.task],
          result = node("div", "two-col");
        const yes = tr("Follows French", "转向法语"),
          no = tr("Keeps the original behavior", "保留原来的行为");
        const query = para(local(questions[s.task]), "prompt");
        const pick = picks(
          tr("Your prediction", "你的预测"),
          [
            [true, yes],
            [false, no],
          ],
          choice,
          (k) => {
            s.answers[s.task] = k;
            view();
          },
        );
        const clean = answerCard(
          tr("Original response", "原始回答"),
          item.clean,
        );
        if (choice === undefined) {
          result.append(
            clean,
            answerCard(
              tr("After the exchange", "交换后"),
              tr("Choose a prediction to reveal.", "选择预测后揭晓。"),
              true,
            ),
          );
          body.replaceChildren(query, pick, result);
          return;
        }
        result.append(
          clean,
          answerCard(tr("After the exchange", "交换后"), item.swapped, true),
        );
        const fb = para(
          (choice === item.flips
            ? tr("Correct. ", "猜对了。")
            : tr("Compare the two recorded answers. ", "对照两次实测回答。")) +
            (item.flips
              ? tr(
                  "The response follows the substituted language.",
                  "回答转向了替换后的语言。",
                )
              : tr(
                  "The task still works in the original language context.",
                  "这项任务仍按原来的语言语境完成。",
                )),
          "feedback",
        );
        fb.setAttribute("role", "status");
        const family = para(
          tr(
            "Across the eight passages, the published follow rate for this task family was ",
            "在八段文字的汇总实验中，此类任务跟随替换的比例为 ",
          ) +
            (100 * item.followRate).toLocaleString(language) +
            "%.",
          "fine",
        );
        body.replaceChildren(query, pick, result, fb, family);
      }
      inside.append(
        picks(
          tr("Task", "任务"),
          Object.keys(tasks).map((key) => [key, local(tasks[key])]),
          s.task,
          (key) => {
            s.task = key;
            view();
          },
        ),
        body,
      );
      view();
    }
    function reflection() {
      inside.append(
        para(
          tr(
            "Teach a reflection. Test an ordinary answer.",
            "训练时追问反思，评估时直接作答。",
          ),
          "prompt",
        ),
      );
      const path = node("div", "two-col");
      path.append(
        answerCard(
          tr("Training", "训练"),
          tr("Interrupt → ask for a reflection", "打断任务 → 要求反思"),
        ),
        answerCard(
          tr("Evaluation", "评估"),
          tr("Uninterrupted response", "不打断，直接作答"),
          true,
        ),
      );
      const body = panel(),
        measure = node("div"),
        info = para("", "fine");
      const format = (x) => x.toFixed(2);
      function draw() {
        const b = d.benchmarks.find((v) => v.id === s.benchmark);
        const base = s.ablate ? b.baselineAblated : b.baseline,
          trained = s.ablate ? b.ablated : b.trained;
        const rows = [
          [tr("Baseline model", "基线模型"), base],
          [tr("Reflection-trained", "反思训练后"), trained],
        ];
        const result = node("div", "two-col");
        for (const [i, [label, val]] of rows.entries()) {
          const card = answerCard(label, format(val), i === 1),
            track = node("div", "track"),
            line = node("i");
          line.style.width = 100 * val + "%";
          track.append(line);
          card.append(track);
          result.append(card);
        }
        measure.replaceChildren(result);
        info.textContent =
          tr("Haiku 4.5 · ", "Haiku 4.5 · ") +
          b.cases +
          tr(
            " cases × 5 responses. Lower means less dishonesty on this rubric.",
            " 个案例 × 5 次采样。量表上数值越低，表示评估中不诚实程度越低。",
          );
      }
      const bPick = picks(
        tr("Benchmark", "基准"),
        [
          ["fabrication", tr("Fabrication", "虚构")],
          ["deception", tr("Deception", "欺骗")],
        ],
        s.benchmark,
        (k) => {
          s.benchmark = k;
          draw();
        },
      );
      const aPick = picks(
        tr("Ethics-related directions", "与伦理相关的方向"),
        [
          [false, tr("Untouched", "保留")],
          [true, tr("Ablated in both models", "两个模型均消融")],
        ],
        s.ablate,
        (k) => {
          s.ablate = k;
          draw();
        },
      );
      body.append(
        titled(tr("Mean grader score", "评分器平均分"), "0–1"),
        bPick,
        aPick,
        measure,
        info,
      );
      inside.append(path, node("div", "hr"), body);
      draw();
    }
    [spider, lens, arithmetic, broadcast, languageSwap, reflection][index]();
  }
  return { initial, render };
})();
