#!/usr/bin/env python3
"""generate-sitemap.py —— 构建后生成 site/sitemap.xml（纯标准库，零全局依赖）。

遍历 site/ 下 mdBook 产物（site/zh 与 site/en），输出全部页面 URL：
- 语言首页用目录式（/zh/、/en/），其余用实际 .html 文件路径
- 排除 404.html、print.html、toc.html、searchindex*.js 等非内容页
- lastmod 尽力取对应源 .md 的 git 末次提交时间（%cI，取日期部分），取不到则省略

用法：
  uv run python scripts/generate-sitemap.py     # 本地
  python3 scripts/generate-sitemap.py           # CI（无 uv）
"""
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

SITE_ROOT = "https://k4m7v2pz.github.io"
EXCLUDE = {"404.html", "print.html", "toc.html"}
# 语言目录 -> 源 md 目录（用于 lastmod 溯源）
SRC_ROOTS = {"zh": "book-zh/src", "en": "book-en/src"}

repo_root = Path(__file__).resolve().parent.parent


def git_lastmod(src_md: Path) -> str | None:
    """取源文件 git 末次提交日期（YYYY-MM-DD），失败返回 None。"""
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", str(src_md)],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
    except (subprocess.CalledProcessError, OSError):
        return None
    if not out:
        return None
    # %cI 输出形如 2026-07-25T21:50:36+08:00，仅保留日期
    return out[:10]


def collect() -> list[tuple[str, str | None]]:
    """返回 [(url, lastmod)]，按 URL 排序。"""
    site = repo_root / "site"
    entries: list[tuple[str, str | None]] = []

    # 根语言选择页
    if (site / "index.html").exists():
        entries.append((f"{SITE_ROOT}/", None))

    for lang, src_root in SRC_ROOTS.items():
        lang_dir = site / lang
        if not lang_dir.is_dir():
            continue
        for html in sorted(lang_dir.rglob("*.html")):
            if html.name in EXCLUDE:
                continue
            rel = html.relative_to(lang_dir).as_posix()
            if html.name == "index.html" and html.parent == lang_dir:
                url = f"{SITE_ROOT}/{lang}/"
            else:
                url = f"{SITE_ROOT}/{lang}/{rel}"

            lastmod: str | None = None
            src_md = repo_root / src_root / (rel[:-5] + ".md")
            if src_md.exists():
                lastmod = git_lastmod(src_md)
            entries.append((url, lastmod))

    entries.sort(key=lambda e: e[0])
    return entries


def build_xml(entries: list[tuple[str, str | None]]) -> None:
    ns = "http://www.sitemaps.org/schemas/sitemap/0.9"
    urlset = ET.Element(f"{{{ns}}}urlset")
    for url, lastmod in entries:
        u = ET.SubElement(urlset, f"{{{ns}}}url")
        loc = ET.SubElement(u, f"{{{ns}}}loc")
        loc.text = url
        if lastmod:
            lm = ET.SubElement(u, f"{{{ns}}}lastmod")
            lm.text = lastmod
    ET.register_namespace("", ns)
    tree = ET.ElementTree(urlset)
    out = repo_root / "site" / "sitemap.xml"
    tree.write(out, encoding="UTF-8", xml_declaration=True)


def main() -> int:
    entries = collect()
    if not entries:
        print("generate-sitemap: 未找到 site/ 产物，请先执行构建", file=sys.stderr)
        return 1
    build_xml(entries)
    print(f"generate-sitemap: 写入 {len(entries)} 个 URL -> site/sitemap.xml")
    return 0


if __name__ == "__main__":
    sys.exit(main())
