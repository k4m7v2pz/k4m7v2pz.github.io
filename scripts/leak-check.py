#!/usr/bin/env python3
# SPDX-License-Identifier: MulanPSL-2.0 OR Unlicense
"""
leak-check.py — 暂存区 / 全仓敏感信息扫描

用法：
  uv run python scripts/leak-check.py               # 扫暂存区（提交前用）
  uv run python scripts/leak-check.py --all          # 扫全仓已提交文件
  uv run python scripts/leak-check.py --diff <file>  # 从文件读取 diff（测试用）

从 git diff --cached 或全仓文件中扫描公网 IP、真实端口、邮箱、token、
本地路径等敏感信息，帮助 Agent 在提交前发现泄漏。

返回码：0 = 无泄漏，1 = 发现泄漏
"""

import re
import subprocess
import sys
from pathlib import Path


# ── 正则模式 ──────────────────────────────────────────────

# 公网 IP：排除 RFC 1918 / 回环 / 链路本地 / 0.0.0.0
_PUBLIC_IP_RE = re.compile(r"\b(\d{1,3}\.){3}\d{1,3}\b")
_RFC1918 = re.compile(
    r"\b(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.0\.0\.0)"
)
_LINK_LOCAL = re.compile(r"\b169\.254\.")

# 端口号（4-5 位数字，出现在冒号后）
_PORT_RE = re.compile(r":(\d{4,5})\b")

# 常见非敏感端口（代理工具、开发服务器、默认端口等，不视为泄漏）
_SAFE_PORTS = {
    "1080", "1081", "1086",           # socks 代理常见端口
    "7890", "7891", "7892", "7897",   # 常见代理客户端端口
    "8000", "8001", "8080", "8443",   # 开发服务器 / 备用 HTTPS
    "9090", "9091",                   # Cockpit / 管理面板
    "1254",                           # 本地开发调试端口
    "3389", "3390",                   # RDP
    "5985", "5986",                   # WinRM
    "9999",                           # 通用开发端口
    "16444", "16445",                 # NAT 映射示例端口
}

# 邮箱
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

# 公共官方邮箱域名（不视为泄漏）
_SAFE_EMAIL_DOMAINS = {"atomgit.com", "example.com", "example.org", "example.net"}

# 疑似 token / 密钥
_TOKEN_RE = re.compile(
    r"(token|secret|key|password|passwd|apikey|api_key)\s*[=:]\s*"
    r'["\']?[A-Za-z0-9_\-]{16,}',
    re.IGNORECASE,
)

# 本地绝对路径（macOS / Linux）
_PATH_RE = re.compile(r"\b(/Users/|/home/|/root/|/var/|/etc/)")


# ── 判断辅助 ──────────────────────────────────────────────

def _is_placeholder(line: str) -> bool:
    """检查行是否包含占位符标记（尖括号包裹的示例值）。"""
    placeholders = [
        "<public-ip>",
        "<nat-port>",
        "<proxy-port>",
        "<your-remote>",
        "<your-email>",
        "<example@",
        "<your_password>",
        "your_password",
        "your_email",
    ]
    for p in placeholders:
        if p in line.lower():
            return True
    return False


def _is_inline_comment(line: str) -> bool:
    """检查是否纯注释行（diff 上下文中的注释）。"""
    stripped = line.strip()
    return stripped.startswith("#") or stripped.startswith("//") or stripped.startswith("/*")


# ── 检查器 ────────────────────────────────────────────────

Finding = tuple[str, int, str, str]  # (file, line_num, category, content)


def check_public_ip(lines: list[tuple[str, int, str]]) -> list[Finding]:
    findings = []
    for file, lineno, line in lines:
        for m in _PUBLIC_IP_RE.finditer(line):
            ip = m.group()
            if _RFC1918.search(ip) or _LINK_LOCAL.search(ip):
                continue
            if _is_placeholder(line):
                continue
            # 排除 ::1 (IPv6 回环) — 不会匹配 IPv4 正则但做防御性处理
            if ip == "::1":
                continue
            findings.append((file, lineno, "公网IP", ip))
    return findings


def check_port(lines: list[tuple[str, int, str]]) -> list[Finding]:
    findings = []
    for file, lineno, line in lines:
        for m in _PORT_RE.finditer(line):
            port = m.group(1)
            # 忽略常见默认端口、安全端口和占位符
            if port in _SAFE_PORTS:
                continue
            if _is_placeholder(line):
                continue
            findings.append((file, lineno, "端口", m.group()))
    return findings


def check_email(lines: list[tuple[str, int, str]]) -> list[Finding]:
    findings = []
    for file, lineno, line in lines:
        for m in _EMAIL_RE.finditer(line):
            email = m.group()
            domain = email.split("@")[-1] if "@" in email else ""
            tld = domain.split(".")[-1] if "." in domain else ""
            # 允许占位符邮箱、公共官方域名、example 域名
            if _is_placeholder(line):
                continue
            if domain in _SAFE_EMAIL_DOMAINS:
                continue
            if "example.com" in email or "example.org" in email:
                continue
            # 排除非邮箱模式：TLD 不是有效 gTLD/ccTLD（如 .service .local .internal）
            if tld not in {
                "com", "org", "net", "edu", "gov", "mil",
                "cn", "jp", "kr", "tw", "hk", "uk", "de", "fr", "ca", "au", "in", "br", "ru",
                "io", "ai", "dev", "app", "me", "info", "biz", "pro", "name",
                "cc", "tv", "xyz", "top", "site", "icu", "online", "club", "vip",
                "shop", "store", "blog", "win", "love", "live", "life", "tech",
                "cloud", "space", "link", "world", "press", "wiki", "email",
                "team", "today", "news", "media", "design", "tools", "zone",
                "wang", "xin", "mobi", "co", "so", "tel", "int",
            }:
                continue
            findings.append((file, lineno, "邮箱", email))
    return findings


def check_token(lines: list[tuple[str, int, str]]) -> list[Finding]:
    findings = []
    for file, lineno, line in lines:
        for m in _TOKEN_RE.finditer(line):
            raw = m.group()
            if _is_placeholder(line):
                continue
            findings.append((file, lineno, "Token/密钥", raw[:60] + ("..." if len(raw) > 60 else "")))
    return findings


def check_path(lines: list[tuple[str, int, str]]) -> list[Finding]:
    findings = []
    for file, lineno, line in lines:
        for m in _PATH_RE.finditer(line):
            if _is_placeholder(line) or _is_inline_comment(line):
                continue
            # 排除 Windows 路径示例：/c/Users/... 或 C:\Users\...
            ctx = line[max(0, m.start() - 3):m.end()]
            if re.search(r'[a-zA-Z]:\\', ctx) or re.search(r'/[a-zA-Z]/Users/', ctx):
                continue
            findings.append((file, lineno, "本地路径", m.group()))
    return findings


# ── 解析 diff ─────────────────────────────────────────────

def parse_diff(diff_text: str) -> list[tuple[str, int, str]]:
    """
    将 git diff --cached 输出解析为 (file, line_no, content) 列表。
    只处理新增行（以 + 开头，排除 +++ 文件头）。
    """
    lines: list[tuple[str, int, str]] = []
    current_file = ""
    line_no = 0

    for raw in diff_text.splitlines():
        # 文件头：diff --git a/... b/...
        if raw.startswith("diff --git "):
            parts = raw.split()
            if len(parts) >= 4:
                current_file = parts[3][2:]  # b/path
            line_no = 0
            continue

        # 行号信息：@@ -a,b +c,d @@
        if raw.startswith("@@ "):
            m = re.search(r"\+(?P<start>\d+)(?:,(?P<count>\d+))?", raw)
            if m:
                line_no = int(m.group("start"))
            continue

        # 新增行（排除 +++ 文件头）
        if raw.startswith("+") and not raw.startswith("+++"):
            lines.append((current_file, line_no, raw[1:]))
            line_no += 1
        elif raw.startswith(" "):
            # 上下文行，行号递增但不检查
            line_no += 1

    return lines


# ── 主入口 ────────────────────────────────────────────────

def scan_all_files(repo_root: Path) -> list[Finding]:
    """扫描全仓已提交文件。"""
    result = subprocess.run(
        ["git", "ls-files", "--cached"],
        capture_output=True,
        text=True,
        cwd=repo_root,
    )
    if result.returncode != 0:
        print("❌ git ls-files 失败")
        sys.exit(1)

    text_exts = {".md", ".py", ".sh", ".toml", ".yml", ".yaml", ".json", ".txt", ".cfg", ".conf", ".ini", ".nu", ".ps1", ".java", ".rs", ".go", ".ts", ".js", ".html", ".css", ".xml"}
    all_findings: list[Finding] = []

    for filepath in result.stdout.splitlines():
        ext = Path(filepath).suffix
        if ext not in text_exts:
            continue
        fullpath = repo_root / filepath
        if not fullpath.exists():
            continue
        try:
            text = fullpath.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        lines = [(filepath, i + 1, line) for i, line in enumerate(text.splitlines())]
        all_findings.extend(check_public_ip(lines))
        all_findings.extend(check_port(lines))
        all_findings.extend(check_email(lines))
        all_findings.extend(check_token(lines))
        all_findings.extend(check_path(lines))

    return all_findings


def main():
    repo_root = Path(__file__).resolve().parent.parent

    if "--all" in sys.argv:
        all_findings = scan_all_files(repo_root)
        if not all_findings:
            print("✅ 全仓敏感信息检查通过，未发现泄漏")
            sys.exit(0)
        print("⚠️  发现潜在敏感信息泄漏:")
        print()
        for file, lineno, category, content in all_findings:
            print(f"  {file}:{lineno}  [{category}]  {content}")
        print()
        sys.exit(1)

    if "--diff" in sys.argv:
        idx = sys.argv.index("--diff")
        diffs = Path(sys.argv[idx + 1]).read_text()
    else:
        result = subprocess.run(
            ["git", "diff", "--cached"],
            capture_output=True,
            text=True,
            cwd=repo_root,
        )
        if result.returncode != 0:
            print("❌ git diff --cached 失败，请确认在 git 仓库中运行")
            sys.exit(1)
        diffs = result.stdout

    if not diffs.strip():
        print("✅ 暂存区无变更，跳过检查")
        sys.exit(0)

    parsed = parse_diff(diffs)
    if not parsed:
        print("✅ 暂存区无新增行，跳过检查")
        sys.exit(0)

    all_findings: list[Finding] = []
    all_findings.extend(check_public_ip(parsed))
    all_findings.extend(check_port(parsed))
    all_findings.extend(check_email(parsed))
    all_findings.extend(check_token(parsed))
    all_findings.extend(check_path(parsed))

    if not all_findings:
        print("✅ 敏感信息检查通过，未发现泄漏")
        sys.exit(0)

    print("⚠️  发现潜在敏感信息泄漏:")
    print()
    for file, lineno, category, content in all_findings:
        print(f"  {file}:{lineno}  [{category}]  {content}")
    print()
    print("📌 请逐一检查：")
    print("   1. 确认是真实数据还是占位符/示例")
    print("   2. 真实数据 → 替换为占位符后重新 git add")
    print("   3. 占位符/示例 → 加入白名单后重跑")
    sys.exit(1)


if __name__ == "__main__":
    main()