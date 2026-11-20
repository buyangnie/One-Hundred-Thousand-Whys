"""Render the original bilingual teaching films from chapter narration and caption times.

Requires Python, Pillow, NumPy and FFmpeg with libx264. Run with --help for paths.
The five scene indices match the corresponding chapter's timed narration.
"""

import argparse
import json
import math
import subprocess
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


WIDTH, HEIGHT = 960, 540
INK = "#091519"
PANEL = "#102328"
EDGE = "#345053"
CREAM = "#f5efdf"
MUTED = "#abbdba"
DIM = "#7c9899"
LIME = "#c1e997"
AQUA = "#88d6ce"
AMBER = "#f3c389"
DARK_LINE = "#243c40"
MONO = "mono"
SANS = "sans"
SERIF = "serif"
FONT_FILES = {}
EVIDENCE = {}


def clamp(value):
    return min(1.0, max(0.0, value))


def ease(value):
    value = clamp(value)
    return value * value * (3 - 2 * value)


def interval(p, a, b):
    return ease((p - a) / (b - a))


def rgb(color):
    return tuple(bytes.fromhex(color[1:]))


def mixture(a, b, weight):
    color = [round(x + (y - x) * clamp(weight)) for x, y in zip(rgb(a), rgb(b))]
    return "#%02x%02x%02x" % tuple(color)


@lru_cache(300)
def font(key, size):
    file = FONT_FILES[key]
    return ImageFont.truetype(
        str(file), int(size), index=2 if key.startswith("cjk") and str(file).endswith(".ttc") else 0
    )


def contains_cjk(s):
    return any(0x3000 <= ord(ch) <= 0x9FFF or 0xFF00 <= ord(ch) <= 0xFFEF for ch in s)


@lru_cache(2200)
def glyphs(value, family, size, color):
    if contains_cjk(value):
        family = "cjkserif" if family == SERIF else "cjk"
    elif any(ch in value for ch in "↔₀₁₂₃₄"):
        family = MONO
    face = font(family, size)
    box = face.getbbox(value)
    width, height = max(1, box[2] - box[0] + 4), max(1, box[3] - box[1] + 4)
    layer = Image.new("RGBA", (width, height))
    ImageDraw.Draw(layer).text((2 - box[0], 2 - box[1]), value, font=face, fill=color)
    return layer


def text(im, x, y, value, size=22, color=CREAM, family=SANS, anchor="l", max_width=0):
    value = str(value)
    size = round(size)
    g = glyphs(value, family, size, color)
    if max_width and g.width > max_width:
        size = max(11, int(size * (max_width - 4) / g.width))
        g = glyphs(value, family, size, color)
    # The supplied y coordinate is always the visual center, independent of script.
    x -= g.width / 2 if anchor == "c" else g.width if anchor == "r" else 0
    im.paste(g, (round(x), round(y - g.height / 2)), g)


def stroke(d, pts, color=EDGE, width=2):
    if len(pts) >= 2:
        d.line(pts, fill=color, width=width, joint="curve")


def circle(d, x, y, r, color, outline=None, width=1):
    d.ellipse((x - r, y - r, x + r, y + r), fill=color, outline=outline, width=width)


def rounded(d, rect, fill=PANEL, edge=EDGE, radius=9, width=1):
    d.rounded_rectangle(rect, radius=radius, fill=fill, outline=edge, width=width)


def center(a, b, p):
    return (a[0] + (b[0] - a[0]) * p, a[1] + (b[1] - a[1]) * p)


def arrow(d, a, b, color=AQUA, width=2, head=6):
    stroke(d, (a, b), color, width)
    angle = math.atan2(b[1] - a[1], b[0] - a[0])
    ends = [
        (b[0] - head * math.cos(angle + s * 0.58), b[1] - head * math.sin(angle + s * 0.58))
        for s in (-1, 1)
    ]
    d.polygon([b, *ends], fill=color)


def path(d, points, color, phase=0, pulse=True):
    """Signal path. Pulse location is decorative; experimental endpoints carry labels."""
    stroke(d, points, color, 2)
    if not pulse:
        return
    edges = [(a, b, math.dist(a, b)) for a, b in zip(points, points[1:])]
    pos = phase % 1 * sum(s for _, _, s in edges)
    for a, b, length in edges:
        if pos <= length:
            x, y = center(a, b, pos / max(0.01, length))
            circle(d, x, y, 4, color)
            break
        pos -= length


def cutpoints(pts, frac):
    if frac >= 1:
        return pts
    if frac <= 0:
        return []
    k = frac * (len(pts) - 1)
    i = math.floor(k)
    return pts[: i + 1] + [center(pts[i], pts[min(i + 1, len(pts) - 1)], k - i)]


@lru_cache(8)
def background(ch):
    yy, xx = np.mgrid[:HEIGHT, :WIDTH]
    top = np.array([9.0, 20.0, 26.0])
    halo = np.exp(-(((xx - (230 + ch * 36)) / (410 + ch * 6)) ** 2 + ((yy - 240) / 243) ** 2))
    side = np.exp(-(((xx - 841) / 228) ** 2 + ((yy - 280) / 285) ** 2))
    raster = top + halo[..., None] * [3.0, 16.0, 16.0] + side[..., None] * [4.8, 8.0, 7.0]
    image = Image.fromarray(raster.astype(np.uint8))
    d = ImageDraw.Draw(image)
    # Subtle guide marks give the film the same instrument-panel finish as the course.
    stroke(d, [(42, 105), (918, 105)], EDGE, 1)
    stroke(d, [(42, 481), (918, 481)], EDGE, 1)
    for x in (42, 918):
        stroke(d, [(x, 101), (x, 109)], DIM, 1)
        stroke(d, [(x, 477), (x, 485)], DIM, 1)
    return image


CHAPTERS = [
    ("An unwritten animal", "没说出口的动物"),
    ("Reading a hidden state", "读取隐藏状态"),
    ("Arithmetic by depth", "算式与模型层深"),
    ("One value, many uses", "一个表征，多种用途"),
    ("When the task matters", "任务改变了什么"),
    ("Reflection and behavior", "反思与行为"),
]
TITLES = [
    [
        ("How many legs?", "它有几条腿？"),
        ("Finding the intermediate", "读出中间概念"),
        ("Exchange two coordinates", "交换两个方向的坐标"),
        ("The preferred answer changes", "首选答案变了"),
        ("From observation to intervention", "从观察走向干预"),
    ],
    [
        ("Layers read and write", "每一层都能读取和更新"),
        ("A direct readout", "直接读取中间层"),
        ("Average the local effects", "求局部影响的平均值"),
        ("One position, two lenses", "同一位置，两种透镜"),
        ("A sparse combination", "稀疏的组合"),
    ],
    [
        ("A single forward pass", "一次前向计算"),
        ("First, add", "先做加法"),
        ("Next, multiply", "接着做乘法"),
        ("Finally, add seven", "最后加七"),
        ("Test the order", "用干预检验顺序"),
    ],
    [
        ("Can one value travel?", "同一信息能否被复用？"),
        ("Exchange the country", "交换国家表征"),
        ("How the trial count adds up", "一共怎样得到这些试验？"),
        ("Count the successful swaps", "替换成功了多少次？"),
        ("Where the swap works", "替换在哪些任务上有效？"),
    ],
    [
        ("One passage, four tasks", "同一段文字，四种任务"),
        ("Name the language", "说出语种"),
        ("Retrieve an author", "说出一位作家"),
        ("Continue or detect", "续写与检测"),
        ("Read out versus relied on", "读到了，任务用到了吗？"),
    ],
    [
        ("Report and directed modulation", "报告与主动调动"),
        ("Train on the reflection", "只对反思文本计算损失"),
        ("Evaluate without interruption", "在评测时连续完成任务"),
        ("Remove the selected directions", "消融选定的表征方向"),
        ("What the findings establish", "这些结果支持什么？"),
    ],
]
FIGURES = [
    ["12–13", "12", "13", "13", "12–13"],
    ["4", "4", "4", "51", "4"],
    ["17", "17", "17", "17", "17 • 88"],
    ["18", "18", "19", "19", "19"],
    ["20"] * 5,
    ["9 • 36", "48", "49–50", "49–50", "1"],
]
MEASUREMENT = [{1, 3}, {3}, {1, 2, 3}, {1, 2, 3, 4}, {1, 2, 3, 4}, {2, 3}]


class Frame:
    def __init__(self, ch, s, lang, p, sec, chapter_p):
        self.ch, self.s, self.lang, self.p, self.sec = ch, s, lang, p, sec
        self.ph = sec * 0.19
        self.im = background(ch).copy()
        self.d = ImageDraw.Draw(self.im)
        self.q = 0 if lang == "en" else 1
        self.t(42, 31, ("BEFORE THE ANSWER", "答案出现之前")[self.q], 15, AMBER, SANS)
        self.t(918, 31, CHAPTERS[ch][self.q], 17, MUTED, SANS, "r")
        title = TITLES[ch][s][self.q]
        self.t(40, 71, title, 43 if self.q == 0 else 36, CREAM, SERIF, "l", 826)
        status = ("Published result", "论文结果") if s in MEASUREMENT[ch] else ("Schematic", "原理示意")
        self.t(42, 508, self.msg(*status), 16, LIME if s in MEASUREMENT[ch] else AQUA)
        self.t(918, 508, self.msg("Paper Fig. ", "原文图 ") + FIGURES[ch][s], 16, MUTED, SANS, "r")
        for j in range(5):
            x = 374 + 43 * j
            v = clamp(chapter_p * 5 - j)
            self.d.rounded_rectangle((x, 506, x + 35, 509), radius=1, fill=EDGE)
            if v > 0:
                self.d.rounded_rectangle((x, 506, x + max(1, 35 * v), 509), radius=1, fill=LIME)

    def t(self, x, y, value, size=22, c=CREAM, fam=SANS, align="l", limit=0):
        text(self.im, x, y, value, size, c, fam, align, limit)

    def msg(self, a, b):
        return (a, b)[self.q]

    def label(self, x, y, words, c=MUTED, align="l", limit=0, size=17):
        self.t(x, y, self.msg(*words), size, c, SANS, align, limit)

    def node(self, x, y, w, h, words, c=AQUA, *, size=25):
        rounded(self.d, (x - w / 2, y - h / 2, x + w / 2, y + h / 2), PANEL, mixture(EDGE, c, 0.38))
        val = self.msg(*words) if isinstance(words, tuple) else words
        self.t(x, y, val, size, c, SANS, "c", w - 14)

    def band(self, words):
        self.label(480, 449, words, align="c", size=18, limit=860)

    def nodepath(self, a, b, color):
        path(self.d, [a, b], color, self.ph)


def spider(d, x, y, scale=1, color=LIME, phase=0):
    def xy(u, v):
        return (x + u * scale, y + v * scale)

    sway = 1.6 * math.sin(phase * math.tau)
    for sign in [-1, 1]:
        for dx, dy, bx, by, ex, ey in [
            (11, -10, 39, -42, 55, -62),
            (14, -6, 52, -26, 73, -22),
            (14, 0, 57, 8, 75, 28),
            (12, 4, 40, 30, 53, 56),
        ]:
            stroke(
                d,
                [xy(sign * dx, dy), xy(sign * bx, by + sway), xy(sign * ex, ey + sway)],
                color,
                max(2, round(3 * scale)),
            )
    d.ellipse((*xy(-12, -22), *xy(12, -1)), fill=color)
    d.ellipse((*xy(-17, -2), *xy(17, 29)), fill=color)
    circle(d, x - 5 * scale, y - 14 * scale, 2 * scale, INK)
    circle(d, x + 5 * scale, y - 14 * scale, 2 * scale, INK)


def ant(d, x, y, scale=1, color=AMBER, phase=0):
    def xy(u, v):
        return (x + u * scale, y + v * scale)

    wave = 1.5 * math.sin(phase * math.tau)
    for sign in [-1, 1]:
        for dx, kx, ex in [(-9, -22, -40), (0, 1, 8), (9, 24, 39)]:
            stroke(
                d,
                [xy(dx, sign * 5), xy(kx, sign * (24 + wave)), xy(ex, sign * (40 + wave))],
                color,
                max(2, round(3 * scale)),
            )
        stroke(
            d, [xy(30, sign * 5), xy(41, sign * 19), xy(57, sign * 27)], color, max(2, round(2 * scale))
        )
    for cx, rx, ry in [(-27, 20, 13), (0, 11, 9), (22, 11, 10)]:
        d.ellipse((*xy(cx - rx, -ry), *xy(cx + rx, ry)), fill=color)
    stroke(d, [xy(-15, 0), xy(19, 0)], color, max(2, round(4 * scale)))


def web(d, x, y, r, p):
    rays = [-1.28, -0.72, -0.16, 0.52, 1.06, 1.78, 2.4, 3.0, 3.68, 4.26]
    for j, a in enumerate(rays):
        length = r * (0.91 + 0.09 * math.cos(j * 4))
        end = (x + math.cos(a) * length, y + math.sin(a) * length)
        stroke(d, [(x, y), center((x, y), end, clamp(p * 2 - j * 0.04))], mixture(EDGE, AQUA, 0.35), 1)
    for k in range(1, 7):
        rad = r * k / 7
        vertices = [
            (x + math.cos(a) * rad * (1 + 0.03 * math.sin(j * 2 + k)), y + math.sin(a) * rad)
            for j, a in enumerate(rays)
        ]
        pts = []
        for j, u in enumerate(vertices):
            v = vertices[(j + 1) % len(vertices)]
            middle = center(u, v, 0.5)
            mid = center(middle, (x, y), 0.09)
            for i in range(6):
                t = i / 6
                pts.append(
                    (
                        (1 - t) ** 2 * u[0] + 2 * t * (1 - t) * mid[0] + t * t * v[0],
                        (1 - t) ** 2 * u[1] + 2 * t * (1 - t) * mid[1] + t * t * v[1],
                    )
                )
        stroke(d, cutpoints(pts + [pts[0]], clamp(p * 2 - 0.11 * k)), mixture(EDGE, AQUA, 0.21), 1)


def layers(f, x, y, count=8, dx=24, scale=1):
    # Stylized residual stream slices, with shape deliberately distinct from a heatmap.
    d = f.d
    for j in range(count):
        xx = x + dx * j
        yy = y - 3 * j
        pts = [
            (xx - 16 * scale, yy - 40 * scale),
            (xx + 23 * scale, yy - 54 * scale),
            (xx + 23 * scale, yy + 38 * scale),
            (xx - 16 * scale, yy + 52 * scale),
        ]
        d.polygon(pts, fill=mixture(PANEL, DARK_LINE, 0.2 * j / count))
        stroke(
            d, pts + [pts[0]], mixture(EDGE, AQUA, 0.62 if j == round((count - 1) * f.p) else 0.08), 2
        )
    path(d, [(x - 39, y + 4), (x + dx * (count - 1) + 48, y - 3 * (count - 1) + 3)], LIME, f.ph)


def chapter_one(f):
    d, p, s = f.d, f.p, f.s
    if s == 0:
        web(d, 251, 278, 135, 0.45 + 0.52 * interval(p, 0, 0.75))
        strength = interval(p, 0.30, 0.68)
        circle(d, 251, 278, 5, mixture(EDGE, AMBER, strength))
        f.label(445, 185, ("Complete the fact", "补全这个事实"), AQUA)
        f.label(445, 240, ("An animal spins webs.", "有一种动物会织网。"), CREAM, size=30)
        f.label(445, 296, ("How many legs?", "它有几条腿？"), CREAM, size=37)
        for j in range(5):
            circle(
                d,
                455 + j * 27,
                381,
                4,
                mixture(EDGE, AMBER, 0.75 if j == int(f.sec * 1.4) % 5 else 0.1),
            )
        f.band(("The question leaves the animal unnamed.", "题目没有说出这种动物的名字。"))
    elif s == 1:
        f.label(70, 159, ("Intermediate layers", "中间层"), AQUA)
        layers(f, 98, 285, 7, 29, 1.1)
        path(d, [(326, 274), (403, 274), (434, 226), (497, 226)], AQUA, f.ph)
        f.node(628, 225, 245, 80, "spider", LIME, size=49)
        spider(d, 829, 229, 0.72, LIME, f.ph)
        f.label(520, 316, ("Lens readout", "透镜读数"), LIME)
        f.label(520, 357, ("An inferred animal", "推断出的动物"), CREAM, size=26)
        f.band(
            (
                "The lens surfaces a concept before the model gives the leg count.",
                "模型给出腿数以前，透镜已经读到了相关概念。",
            )
        )
    elif s == 2:
        f.label(114, 153, ("Original coordinate", "原始坐标"), LIME)
        f.label(641, 153, ("Swap coordinate", "交换坐标"), AMBER)
        spider(d, 232, 266, 1.03, LIME, f.ph)
        ant(d, 730, 271, 1.24, AMBER, f.ph)
        f.t(232, 371, "spider", 44, LIME, SERIF, "c")
        f.t(730, 371, "ant", 44, AMBER, SERIF, "c")
        left = (338, 255)
        right = (622, 255)
        path(d, [left, right], AMBER, f.ph)
        arrow(d, (599, 255), right, AMBER)
        path(d, [(622, 292), (338, 292)], AQUA, f.ph)
        arrow(d, (359, 292), (338, 292), AQUA)
        f.band(
            (
                "The input text stays fixed while the two lens coordinates are exchanged.",
                "输入文字保持原样，在模型内部交换两个方向上的坐标。",
            )
        )
    elif s == 3:
        for x, animal, num, col, typ in [
            (252, "spider", "8", LIME, spider),
            (708, "ant", "6", AMBER, ant),
        ]:
            rounded(d, (x - 164, 153, x + 164, 404), PANEL, mixture(EDGE, col, 0.28), 12)
            f.label(
                x,
                181,
                ("Original run", "原始运行") if num == "8" else ("After the swap", "替换之后"),
                col,
                "c",
            )
            typ(d, x - 48, 243, 0.45, col, f.ph)
            f.t(x + 25, 244, animal, 30, CREAM, SERIF, "c")
            stroke(d, [(x - 125, 286), (x + 125, 286)], EDGE, 1)
            f.t(x, 333, num, 76, col, SERIF, "c")
            key = "clean" if num == "8" else "swapped"
            probability = math.exp(EVIDENCE["spider"][key][0]["logp"])
            rounded(d, (x - 122, 386, x + 48, 392), DARK_LINE, None, 3)
            w = 170 * probability * interval(p, 0.02, 0.55)
            if w > 1:
                rounded(d, (x - 122, 386, x - 122 + w, 392), col, None, 3)
            f.t(x + 114, 387, f"{probability:.0%}", 16, col, MONO, "r")
        arrow(d, (437, 282), (520, 282), AMBER)
        f.band(
            (
                "Top-ranked next token and its probability in each run.",
                "两次运行各自排名第一的下一个词元及其概率。",
            )
        )
    else:
        for j, (y, words, col) in enumerate(
            [(211, ("Read", "读取"), LIME), (327, ("Change", "替换"), AMBER)]
        ):
            f.node(123, y, 130, 64, words, col)
            path(d, [(192, y), (283, y)], col, f.ph)
            f.node(
                398,
                y,
                221,
                70,
                ("spider", "spider") if j == 0 else ("spider  ↔  ant", "spider  ↔  ant"),
                col,
                size=29,
            )
            path(d, [(514, y), (643, y)], col, f.ph)
            f.node(763, y, 224, 70, "8" if j == 0 else "6", col, size=48)
        f.band(
            (
                "A changed output tests whether the readout mattered to this prediction.",
                "答案随干预改变，表明读出的表征确实参与了这次预测。",
            )
        )


def chapter_two(f):
    d, p, s = f.d, f.p, f.s
    if s == 0:
        f.label(68, 161, ("Shared representation", "共同读取的状态"), AQUA)
        for j in range(5):
            x = 133 + j * 171
            off = ease(clamp(p * 6 - j))
            rounded(d, (x - 47, 229, x + 47, 299), PANEL, mixture(EDGE, AQUA, off))
            f.t(x, 264, "h" + ["₀", "₁", "₂", "₃", "₄"][j], 35, LIME if off > 0.5 else MUTED, SANS, "c")
            if j < 4:
                path(d, [(x + 48, 263), (x + 118, 263)], AQUA, f.ph - j * 0.10)
            if j in [1, 2, 3]:
                arrow(d, (x, 371), (x, 313), AMBER)
                f.label(x, 397, ("update", "更新"), AMBER, "c")
        f.band(
            (
                "Each layer can add information that later layers can use.",
                "每一层都可以补充信息，供后面的层读取。",
            )
        )
    elif s == 1:
        f.label(68, 155, ("At an intermediate layer", "在一个中间层"), AQUA)
        layers(f, 104, 291, 6, 27, 0.91)
        path(d, [(286, 280), (385, 280)], LIME, f.ph)
        f.node(491, 280, 191, 82, ("output map", "输出映射"), AQUA, size=28)
        path(d, [(589, 280), (671, 280)], LIME, f.ph)
        for i, name in enumerate(
            [("first token", "第一名"), ("second token", "第二名"), ("third token", "第三名")]
        ):
            end = (680, 218 + i * 61)
            stroke(d, [(649, 280), (664, 280), end], EDGE, 1)
            f.node(772, end[1], 171, 44, name, mixture(MUTED, LIME, 0.9 - i * 0.34), size=20)
        f.band(
            (
                "The logit lens reads the state using the model’s own output mapping.",
                "Logit 透镜把模型自己的输出映射直接应用于中间状态。",
            )
        )
    elif s == 2:
        for j, y in enumerate((192, 272, 352)):
            f.node(145, y, 178, 47, (f"Context {j + 1}", f"上下文 {j + 1}"), AQUA, size=21)
            path(d, [(235, y), (293, y), (363, 272)], AQUA, f.ph + j * 0.15)
        f.node(448, 272, 161, 81, ("mean J", "平均 J"), LIME, size=34)
        path(d, [(532, 272), (597, 272)], LIME, f.ph)
        f.node(683, 272, 166, 64, ("output map", "输出映射"), AQUA)
        path(d, [(768, 272), (827, 272)], LIME, f.ph)
        circle(d, 848, 272, 13, LIME)
        f.band(
            (
                "The paper averages Jacobians over positions and 1,000 sampled contexts.",
                "论文在多个位置及一千个采样上下文中对雅可比矩阵取平均。",
            )
        )
    elif s == 3:
        # Hold the position constant while stepping through recorded samples.
        depth = 42 if p < 0.45 else 58 if p < 0.73 else 100
        source = EVIDENCE["lens"]
        cell = source["cells"][source["layers"].index(depth)][source["keyPosition"]]
        f.label(
            67,
            145,
            (
                f"Fourth planet’s color  ·  position “is”  ·  reindexed depth {depth}",
                f"第四颗行星的颜色  ·  位置 is  ·  归一化层深 {depth}",
            ),
            AQUA,
            size=19,
        )
        for x, method, items, col in [
            (71, "Logit Lens", cell["logit"][:3], MUTED),
            (503, "J-lens", cell["j"][:3], LIME),
        ]:
            rounded(d, (x, 182, x + 385, 397), PANEL, mixture(EDGE, col, 0.3))
            f.t(x + 25, 212, method, 29, col, SERIF)
            for i, word in enumerate(items):
                yy = 261 + i * 49
                stroke(d, [(x + 23, yy - 24), (x + 361, yy - 24)], DARK_LINE, 1)
                f.t(x + 25, yy, str(i + 1), 17, DIM, MONO)
                f.t(
                    x + 74,
                    yy,
                    word,
                    27,
                    mixture(DIM, CREAM, 0.45 + 0.55 * interval(p, 0.05 + i * 0.1, 0.40 + i * 0.09)),
                    SANS,
                )
        f.band(
            (
                "Ranks are shown for the identical activation. Token boundaries are omitted.",
                "两种透镜读取同一个激活。表中保留排名，省略词元边界符号。",
            )
        )
    else:
        o = (183, 375)
        a = (464, 329)
        b = (315, 202)
        pred = (478, 234)
        actual = (536, 176)
        for k in range(7):
            ang = -1.42 + k * 0.215
            end = (o[0] + 308 * math.cos(ang), o[1] + 228 * math.sin(ang))
            stroke(d, [o, end], DARK_LINE, 1)
        d.polygon([o, a, pred, b], fill="#183330")
        arrow(d, o, a, AQUA, 3, 10)
        arrow(d, o, b, AQUA, 3, 10)
        arrow(d, o, pred, LIME, 3, 12)
        arrow(d, pred, center(pred, actual, interval(p, 0.08, 0.65)), AMBER, 3, 8)
        circle(d, *o, 6, CREAM)
        f.label(590, 191, ("Active token directions", "活跃的词元方向"), AQUA, size=21)
        f.label(590, 270, ("Sparse component", "稀疏组合部分"), LIME, size=21)
        f.label(590, 349, ("Remaining activation", "其余激活"), AMBER, size=21)
        f.band(
            (
                "A few nonnegative weights approximate one component of the hidden state.",
                "少数非负权重组合起来，近似表示隐藏状态的一个分量。",
            )
        )


def arithmetic(f):
    d, p, s = f.d, f.p, f.s
    if s == 0:
        f.label(480, 158, ("Prompt", "输入算式"), AQUA, "c", size=17)
        parts = ["(", "4", "+", "17", ")", "×", "2", "+", "7", "="]
        widths = [29, 52, 49, 70, 34, 57, 52, 51, 55, 51]
        x = 480 - sum(widths) / 2
        for i, (part, w) in enumerate(zip(parts, widths)):
            c = mixture(DIM, CREAM, 0.25 + 0.75 * interval(p, 0.015 * i, 0.24 + 0.04 * i))
            f.t(x + w / 2, 270, part, 62, c, SERIF, "c")
            x += w
        path(d, [(185, 358), (774, 358)], AQUA, 0.03 + 0.91 * interval(p, 0.05, 0.87))
        f.label(
            480,
            403,
            ("One token position • increasing depth", "固定词元位置，沿层深观察"),
            MUTED,
            "c",
            size=21,
        )
        return
    if s in (1, 2, 3):
        vals = [("4 + 17", "21"), ("21 × 2", "42"), ("42 + 7", "49")]
        exp, ans = vals[s - 1]
        f.label(71, 164, ("Operation", "运算"), AQUA)
        f.t(68, 216, exp, 48, CREAM, SERIF)
        colors = [AQUA, LIME, AMBER]
        f.t(68, 317, ans, 99, colors[s - 1], SERIF)
        data = EVIDENCE["arithmetic"]
        depths = data["layers"]
        x0, x1, y0, y1 = 344, 878, 175, 358

        def xs(v):
            return x0 + (x1 - x0) * (v - 17) / 83

        def ys(rank):
            return y0 + (y1 - y0) * math.log10(min(rank, 9999)) / 4

        f.label(x0, 143, ("Rank at the equals sign", "等号位置的排名"), MUTED, size=17)
        for k in (1, 100, 9999):
            y = ys(k)
            stroke(d, [(x0, y), (x1, y)], DARK_LINE, 1)
            f.t(x0 - 10, y, str(k) if k != 9999 else "≥9999", 14, DIM, MONO, "r")
        for k in (17, 42, 67, 83, 100):
            x = xs(k)
            stroke(d, [(x, y1), (x, y1 + 6)], DIM, 1)
            f.t(x, y1 + 22, str(k), 15, DIM, MONO, "c")
        samples = data["series"]
        for j, row in enumerate(samples):
            col = colors[j] if j + 1 == s else mixture(EDGE, colors[j], 0.35)
            pts = [(xs(z), ys(v)) for z, v in zip(depths, row["ranks"])]
            stroke(d, pts, mixture(EDGE, col, 0.56), 1)
            end = interval(p, 0, 0.88)
            stroke(d, cutpoints(pts, end), col, 4 if j + 1 == s else 2)
            for n, (x, y) in enumerate(pts):
                if n <= end * (len(pts) - 1):
                    circle(d, x, y, 4 if j + 1 == s else 2, col)
            keyx = 430 + j * 90
            circle(d, keyx, 411, 5, colors[j])
            f.t(keyx + 13, 411, str(row["value"]), 18, colors[j], MONO)
        f.label(883, 410, ("Reindexed depth", "归一化层深"), MUTED, "r", 142)
        f.band(
            (
                "First sampled rank 1  •  21 at depth 75, 42 at 83, 49 at 100.",
                "采样点首次排第一：21 在层深 75，42 在 83，49 在 100。",
            )
        )
    else:
        f.label(69, 166, ("Readout order", "读出先后"), AQUA, size=22)
        f.label(69, 302, ("Causal check", "因果检验"), AMBER, size=22)
        for i, (term, c) in enumerate(zip(["21", "42", "49"], [AQUA, LIME, AMBER])):
            x = 403 + i * 196
            if i:
                path(d, [(x - 137, 174), (x - 59, 174)], EDGE, f.ph)
            f.node(x, 175, 115, 66, term, c, size=42)
        for i, words in enumerate(
            [("patch a state", "替换激活"), ("run onward", "继续计算"), ("test the answer", "观察答案")]
        ):
            x = 400 + i * 192
            f.node(x, 310, 159, 64, words, AMBER, size=22)
            if i < 2:
                arrow(d, (x + 81, 310), (x + 111, 310), AMBER, 2)
        f.band(
            (
                "Replacing selected activations tests when an intermediate affects the answer.",
                "替换特定激活，可以检验中间值何时会影响最终答案。",
            )
        )


def broadcast(f):
    d, p, s = f.d, f.p, f.s
    ops = [("Capital", "首都"), ("Language", "语言"), ("Continent", "大洲")]
    if s == 0:
        f.node(180, 272, 216, 99, ("Country", "国家"), LIME, size=40)
        for j, op in enumerate(ops):
            y = 184 + 91 * j
            path(d, [(289, 272), (360, 272), (474, y), (618, y)], AQUA, f.ph - j * 0.19)
            f.node(745, y, 226, 56, op, [AQUA, LIME, AMBER][j], size=27)
        f.band(
            (
                "Three different questions can take the same country as an argument.",
                "三个不同的问题，都可以接收同一个国家作为输入。",
            )
        )
    elif s == 1:
        f.label(87, 152, ("Operation", "任务"), AQUA)
        f.t(422, 151, "France", 33, LIME, SERIF, "c")
        f.t(745, 151, "China", 33, AMBER, SERIF, "c")
        tasks = {v["id"]: v for v in EVIDENCE["broadcast"]["tasks"]}
        for j, op in enumerate(ops):
            y = 212 + j * 72
            task = tasks[["capital", "language", "continent"][j]]
            f.label(85, y, op, MUTED, size=24)
            f.node(422, y, 230, 51, task["clean"], LIME, size=25)
            path(d, [(540, y), (625, y)], AMBER, f.ph - j * 0.19)
            col = mixture(DIM, AMBER, 0.4 + 0.6 * interval(p, j * 0.16, 0.3 + j * 0.16))
            f.node(744, y, 226, 51, task["swapped"], col, size=25)
        f.band(
            (
                "Top answer after formatting tokens are set aside; the prompt still names France.",
                "略去格式词元后列出首选答案。原题始终写着法国。",
            )
        )
    elif s == 2:
        cats = [
            ("Countries", "国家"),
            ("Months", "月份"),
            ("Animals", "动物"),
            ("Number words", "数词"),
        ]
        for j, c in enumerate(cats):
            x = 59 + (j % 2) * 142
            y = 195 + (j // 2) * 68
            f.node(x + 65, y, 123, 54, c, AQUA, size=20)
        for x, val, desc in [
            (415, "4", ("functions each", "每类任务数")),
            (611, "12", ("swaps each", "每项替换数")),
            (815, "192", ("trials", "试验总数")),
        ]:
            f.t(x, 246, val, 65, AMBER if x == 815 else CREAM, SERIF, "c")
            f.label(x, 326, desc, DIM, "c", 150)
        f.t(330, 247, "×", 30, DIM, SANS, "c")
        f.t(516, 247, "×", 30, DIM, SANS, "c")
        f.t(711, 247, "=", 30, DIM, SANS, "c")
        x = 65 + 826 * interval(p, 0.04, 0.95)
        stroke(d, [(65, 383), (890, 383)], EDGE, 1)
        circle(d, x, 383, 5, AMBER)
        f.band(
            (
                "A trial succeeds when the answer for the replacement ranks first.",
                "替换后对应的新答案排到首位，就计为一次成功。",
            )
        )
    elif s == 3:
        # Independent sorted tallies; the same dot position does not denote a paired trial.
        for j, (x, hit, c) in enumerate([(76, 76, LIME), (503, 101, AMBER)]):
            f.label(x, 151, (("Standard strength", "标准强度"), ("Double strength", "双倍强度"))[j], c)
            f.t(x, 218, str(hit), 67, c, SERIF)
            f.t(x + 134, 230, "/ 192", 31, MUTED, SANS)
            for i in range(192):
                y = 279 + 11 * (i // 24)
                xx = x + 13 * (i % 24)
                on = i < hit * interval(p, 0.02 + j * 0.1, 0.77 + j * 0.1)
                circle(d, xx, y, 3.5, c if on else DARK_LINE)
        f.band(
            (
                "Each dot is one trial. Each condition is sorted separately for counting.",
                "每点代表一次试验。每种条件独立排列，便于计数。",
            )
        )
    else:
        f.label(
            70,
            153,
            ("Top-1 substitutions at standard strength", "标准强度下替换后排名第一的次数"),
            AQUA,
            size=20,
        )
        groups = [
            ("Countries", "国家", 42),
            ("Months", "月份", 24),
            ("Animals", "动物", 10),
            ("Number words", "数词", 0),
        ]
        for j, (en, zh, n) in enumerate(groups):
            y = 211 + j * 53
            f.label(75, y, (en, zh), CREAM, size=21)
            rounded(d, (289, y - 8, 790, y + 8), DARK_LINE, None, 4)
            w = 501 * (n / 48) * interval(p, 0.02 + j * 0.05, 0.55 + j * 0.08)
            if w > 1:
                rounded(d, (289, y - 8, 289 + w, y + 8), [LIME, AQUA, AMBER, DIM][j], None, 4)
            f.t(879, y, f"{n} / 48", 19, CREAM, MONO, "r")
        f.band(
            (
                "Under these tasks, the strongest substitutions cluster among country arguments.",
                "这些任务中，以国家为输入的替换最容易成功。",
            )
        )


def language(f):
    d, p, s = f.d, f.p, f.s
    if s == 0:
        rounded(d, (63, 153, 408, 382), PANEL, EDGE, 12)
        f.label(85, 179, ("Illustrative Spanish text", "西班牙语示例文字"), AQUA)
        for j, line in enumerate(
            ("Desde la plaza se oía", "la lluvia. Un tranvía", "dobló la esquina.")
        ):
            f.t(85, 232 + j * 46, line, 31, CREAM, SERIF)
        for j, lbl in enumerate(
            [
                ("Name the language", "识别语种"),
                ("Name an author", "说出作家"),
                ("Continue the passage", "续写原文"),
                ("Spot a mismatch", "检测异常"),
            ]
        ):
            y = 167 + j * 65
            lane = mixture(EDGE, AQUA, 0.55 + 0.4 * math.sin((p + (j * 0.11)) * 4.4))
            path(d, [(411, 265), (461, 265), (545, y), (582, y)], lane, f.ph - j * 0.17)
            f.node(718, y, 262, 44, lbl, lane, size=21)
        f.band(
            (
                "Exchange the language coordinates across the question tokens.",
                "在问题的各词元位置交换两种语言对应的坐标。",
            )
        )
    elif s in [1, 2]:
        input_ = (("Language report", "说出语种"), ("Author in that language", "说出该语种的一位作家"))[
            s - 1
        ]
        f.label(480, 155, input_, AQUA, "c", size=24)
        vals = ["Spanish", "French"] if s == 1 else ["García Márquez", "Victor Hugo"]
        for j, (x, c) in enumerate([(253, LIME), (707, AMBER)]):
            rounded(d, (x - 177, 199, x + 177, 378), PANEL, mixture(EDGE, c, 0.40), 11)
            f.label(
                x,
                229,
                ("Original run", "原始运行") if j == 0 else ("After the swap", "替换之后"),
                c,
                "c",
            )
            f.t(x, 306, vals[j], 51 if s == 1 else 43, c, SERIF, "c", 321)
        path(d, [(437, 288), (521, 288)], AMBER, f.ph)
        arrow(d, (495, 288), (521, 288), AMBER)
        f.band(
            ("The answer follows the substituted language.", "模型的回答跟随替换后的语言。")
            if s == 1
            else (
                "The inferred language supplies an input to a second operation.",
                "推断出的语言又成为检索作家这一操作的输入。",
            )
        )
    elif s == 3:
        cols = [("Original", "原始运行"), ("Swapped", "替换之后")]
        for j, tit in enumerate(cols):
            f.label(492 + j * 274, 170, tit, LIME if j == 0 else AMBER, "c", size=22)
        for j, (op, v) in enumerate(
            [
                (("Continue", "续写"), ("Spanish", "西班牙语")),
                (("Spot intrusion", "检测混入"), ("Yes", "发现异常")),
            ]
        ):
            y = 245 + j * 108
            f.label(77, y, op, CREAM, size=26)
            for k, c in enumerate([LIME, AMBER]):
                f.node(492 + k * 274, y, 220, 66, v, c, size=28)
            path(d, [(604, y), (651, y)], AQUA, f.ph + j * 0.2)
        f.band(
            (
                "The actual wording can vary while the continuation’s language stays Spanish.",
                "续写的具体措辞可以变化，使用的语言仍是西班牙语。",
            )
        )
    else:
        f.label(
            69,
            145,
            ("Does behavior follow the swap?   •   Eight passages", "行为跟随了替换吗？  ·  八段语料"),
            AQUA,
            size=21,
        )
        for j, (op, yes) in enumerate(
            [
                (("Name the language", "说出语种"), True),
                (("Infer a fact about it", "检索语言相关知识"), True),
                (("Continue the passage", "续写原文"), False),
                (("Spot a mismatch", "检测混入"), False),
            ]
        ):
            y = 202 + j * 53
            f.label(79, y, op, CREAM, size=22)
            col = LIME if yes else DIM
            path(d, [(375, y), (481, y)], col, f.ph - 0.12 * j)
            f.label(
                505,
                y,
                ("Usually follows", "通常跟随") if yes else ("Rarely follows", "很少跟随"),
                col,
                size=23,
            )
        f.band(
            (
                "The readout contains the language across tasks. Its causal role varies.",
                "不同任务中都能读到语言信息，但它在计算中的因果作用不同。",
            )
        )


def reflection(f):
    d, p, s = f.d, f.p, f.s
    if s == 0:
        for j, (y, src, content, end, col) in enumerate(
            [
                (
                    205,
                    ("Audit", "审计"),
                    ("Evaluation cue", "评测相关词"),
                    ("Inspect behavior", "检查实际行为"),
                    AMBER,
                ),
                (
                    324,
                    ("Instruction", "指令"),
                    ("Silent calculation", "心算"),
                    ("Number readouts", "数值读数"),
                    LIME,
                ),
            ]
        ):
            f.node(148, y, 173, 67, src, col, size=26)
            path(d, [(237, y), (320, y)], col, f.ph)
            f.node(462, y, 258, 67, content, col, size=24)
            path(d, [(595, y), (642, y)], col, f.ph)
            f.node(764, y, 233, 67, end, col, size=24)
        f.band(
            (
                "A readout points to a testable question about behavior.",
                "一个读数能提示研究者，下一步应该检验哪种行为。",
            )
        )
    elif s == 1:
        for j, (y, col, items) in enumerate(
            [
                (
                    211,
                    AMBER,
                    [
                        ("Training context", "训练上下文"),
                        ("Interrupt to ask", "插入反思提问"),
                        ("Reflection", "反思回答"),
                    ],
                ),
                (
                    342,
                    LIME,
                    [
                        ("Test context", "评测上下文"),
                        ("Continue the task", "继续执行任务"),
                        ("Action", "直接行动"),
                    ],
                ),
            ]
        ):
            for k, words in enumerate(items):
                x = 173 + 307 * k
                f.node(x, y, 214, 66, words, col, size=24)
                if k < 2:
                    path(d, [(x + 110, y), (x + 197, y)], col, f.ph)
        f.label(787, 264, ("Training loss here only", "只在此处计算损失"), AMBER, "c", 235)
        f.band(
            (
                "Haiku 4.5 learns from the reflection turn; the test asks for no reflection.",
                "Haiku 4.5 从反思轮次学习，评测时没有反思提示。",
            )
        )
    elif s in (2, 3):
        bench = EVIDENCE["reflection"]["benchmarks"]
        f.label(
            72,
            142,
            (
                "Haiku 4.5  ·  mean evaluator score, lower is better",
                "Haiku 4.5  ·  评测平均分，越低越好",
            ),
            AQUA,
            size=19,
        )
        baseline = (("Baseline", "基线"), DIM, "baseline")
        trained = (("Reflection-trained", "反思训练后"), LIME, "trained")
        ablated = (("Trained + ablated", "训练后再消融"), AMBER, "ablated")
        rows = [baseline, trained] if s == 2 else [trained, ablated]
        for j, (r, name) in enumerate(
            zip(bench, [("Fabrication", "虚构事实"), ("Deception", "欺骗行为")])
        ):
            x = 68 + j * 447
            f.label(x, 202, name, CREAM, size=29)
            for k, (label, col, key) in enumerate(rows):
                yy = 249 + k * 74
                f.label(x, yy, label, col, size=17)
                track_start = x
                track_end = x + 318
                rounded(d, (track_start, yy + 19, track_end, yy + 28), DARK_LINE, None, 3)
                w = (track_end - track_start) * r[key] * interval(p, j * 0.1, 0.52 + j * 0.1)
                if w > 1:
                    rounded(d, (track_start, yy + 19, track_start + w, yy + 28), col, None, 3)
                f.t(x + 388, yy + 21, f"{r[key]:.2f}", 27, col, MONO, "r")
            f.t(x, 396, "0", 15, DIM, MONO)
            f.t(x + 318, 396, "1", 15, DIM, MONO, "r")
        f.band(
            (
                "Five responses per case; the plotted quantity is a rubric score.",
                "每个情境采样五次回答。图中显示评分标准下的得分。",
            )
            if s == 2
            else (
                "Selected ethics and reflection directions were suppressed, then scored again.",
                "压低选定的伦理与反思方向后，重新进行评测和打分。",
            )
        )
    else:
        concepts = [
            ("Verbal report", "可报告"),
            ("Directed control", "主动调动"),
            ("Internal reasoning", "内部推理"),
            ("Flexible reuse", "灵活复用"),
            ("Selectivity", "选择性"),
        ]
        for j, label in enumerate(concepts):
            yy = 153 + j * 56
            on = interval(p, -0.1 + j * 0.065, 0.38 + j * 0.08)
            col = mixture(EDGE, LIME, 0.42 + 0.58 * on)
            circle(d, 93, yy, 8, None, col, 2)
            if on > 0.15:
                stroke(d, [(88, yy), (92, yy + 4), (100, yy - 6)], col, 2)
            f.label(119, yy, label, CREAM, size=23)
        stroke(d, [(441, 151), (441, 401)], EDGE, 1)
        f.label(496, 220, ("Subjective experience", "主观体验"), AMBER, size=31)
        f.label(496, 293, ("An open question", "仍是待回答的问题"), MUTED, size=24)
        f.band(
            (
                "These experiments test functional properties of the proposed workspace.",
                "这些实验检验了所提出的工作空间在功能上是否成立。",
            )
        )


PAINTERS = [chapter_one, chapter_two, arithmetic, broadcast, language, reflection]


def frame_at(ch, s, lang, p, sec):
    f = Frame(ch, s, lang, p, sec, (s + p) / 5)
    PAINTERS[ch](f)
    return f.im


def render_chapter(args, ch, lang):
    idx = ch + 1
    media = args.narration_dir
    audio = media / f"{lang}-{idx}.m4a"
    bundle = json.loads(args.cues.read_text())
    chapter = bundle[lang][ch]
    duration = chapter["duration"]
    starts = [0.0]
    for scene in range(1, 5):
        starts.append(next(cue["start"] for cue in chapter["cues"] if cue["sceneIndex"] == scene))
    bounds = starts + [duration]
    out = args.out_dir / f"{lang}-{idx}.mp4"
    tmp = out.with_suffix(".part.mp4")
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-video_size",
        f"{WIDTH}x{HEIGHT}",
        "-framerate",
        str(args.fps),
        "-i",
        "pipe:0",
        "-i",
        str(audio),
        "-map",
        "0:v",
        "-map",
        "1:a",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-tune",
        "animation",
        "-crf",
        "23",
        "-maxrate",
        "650k",
        "-bufsize",
        "1500k",
        "-threads",
        "2",
        "-pix_fmt",
        "yuv420p",
        "-g",
        str(args.fps * 4),
        "-c:a",
        "copy",
        "-movflags",
        "+faststart",
        str(tmp),
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    try:
        s = 0
        for i in range(math.ceil(duration * args.fps)):
            sec = i / args.fps
            while s < 4 and sec >= bounds[s + 1]:
                s += 1
            p = clamp((sec - bounds[s]) / (bounds[s + 1] - bounds[s]))
            image = frame_at(ch, s, lang, p, sec)
            proc.stdin.write(image.tobytes())
        proc.stdin.close()
        if proc.wait():
            raise RuntimeError(f"Video encoder failed for {out}")
        tmp.replace(out)
    except BaseException:
        proc.kill()
        proc.wait()
        tmp.unlink(missing_ok=True)
        raise
    print(f"{out.name}: {duration:.1f}s, {out.stat().st_size / 1e6:.2f} MB", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--narration-dir",
        required=True,
        type=Path,
        help="Directory containing en-1.m4a through zh-6.m4a",
    )
    parser.add_argument("--cues", required=True, type=Path, help="Bilingual cue JSON")
    parser.add_argument(
        "--evidence",
        required=True,
        type=Path,
        help="Course evidence JSON, extracted from the cited paper figures",
    )
    parser.add_argument("--out-dir", required=True, type=Path, help="Directory for films and posters")
    parser.add_argument("--serif", required=True, type=Path, help="Instrument Serif font file")
    parser.add_argument("--sans", required=True, type=Path, help="DM Sans font file")
    parser.add_argument(
        "--cjk", type=Path, default=Path("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc")
    )
    parser.add_argument(
        "--cjk-serif",
        type=Path,
        default=Path("/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"),
    )
    parser.add_argument(
        "--mono", type=Path, default=Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf")
    )
    parser.add_argument("--lang", choices=["en", "zh", "both"], default="both")
    parser.add_argument(
        "--chapter", choices=range(1, 7), type=int, action="append", help="May be repeated"
    )
    parser.add_argument("--fps", type=int, default=12)
    parser.add_argument(
        "--stills", action="store_true", help="Render each scene as a JPEG instead of making films"
    )
    args = parser.parse_args()
    FONT_FILES.update(
        serif=args.serif, sans=args.sans, mono=args.mono, cjk=args.cjk, cjkserif=args.cjk_serif
    )
    EVIDENCE.update(json.loads(args.evidence.read_text()))
    args.out_dir.mkdir(parents=True, exist_ok=True)
    langs = ["en", "zh"] if args.lang == "both" else [args.lang]
    for ch_id in args.chapter or range(1, 7):
        ch = ch_id - 1
        for lang in langs:
            if args.stills:
                for s in range(5):
                    frame_at(ch, s, lang, 0.87, 9.6).save(
                        args.out_dir / f"{lang}-{ch_id}-scene-{s + 1}.jpg", quality=88
                    )
            else:
                render_chapter(args, ch, lang)
                if lang == "en":
                    scene = [2, 3, 2, 1, 2, 2][ch]
                    frame_at(ch, scene, lang, 0.34 if ch == 1 else 0.88, 8.4).save(
                        args.out_dir / f"poster-{ch_id}.webp", quality=86
                    )


if __name__ == "__main__":
    main()
