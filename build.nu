#!/usr/bin/env nu
# build.nu —— 构建 + 本地预览
#
# 用法：
#   ./build.nu              构建中英文（等价旧 build.sh）
#   ./build.nu --serve      构建后启动预览服务器 http://localhost:8080
#   ./build.nu --serve-only 仅启动预览服务器（不重新构建）
#   ./build.nu --help       显示本帮助

let ROOT = ($env.CURRENT_FILE | path dirname)
let SITE = $"($ROOT)/site"

def main [
  --serve (-s)       # 构建后启动预览服务器 http://localhost:8080
  --serve-only (-o)  # 仅启动预览服务器，不重新构建
] {
  if $serve_only {
    start-server
    return
  }

  if $serve {
    build-all
    print ""
    start-server
    return
  }

  # 默认：仅构建
  build-all
  print ""
  print "═══════════════════════════════════════════════"
  print "  ✔ 构建完成"
  print ""
  print "  预览： ./build.nu --serve        # 构建 + 启动 http://localhost:8080"
  print "         ./build.nu --serve-only   # 仅启动预览（不重新构建）"
  print "═══════════════════════════════════════════════"
}

def build-all [] {
  print "=== Building Chinese (zh) ==="
  ^mdbook build $"($ROOT)/book-zh" --dest-dir $"($SITE)/zh"
  if ($env.LAST_EXIT_CODE? != 0) {
    print "<=== 中文构建失败"
    exit 1
  }

  print "=== Building English (en) ==="
  ^mdbook build $"($ROOT)/book-en" --dest-dir $"($SITE)/en"
  if ($env.LAST_EXIT_CODE? != 0) {
    print "<=== 英文构建失败"
    exit 1
  }

  print "=== Copying root index.html ==="
  cp $"($ROOT)/index.html" $"($SITE)/"

  print "=== Done ==="
}

def start-server [] {
  let port = 8080
  let dir = $SITE

  if not ($dir | path exists) {
    print $"<=== 目录不存在：($dir)，请先运行 ./build.nu 构建"
    exit 1
  }

  print $"=== Starting preview server at http://localhost:($port) ==="
  print $"=== Serving: ($dir) ==="
  print $"=== Press Ctrl+C to stop ==="
  print ""

  # 用 uv 跑 Python 3 内置 HTTP 服务器，免额外依赖
  ^uv run python -m http.server $port --directory $dir
}