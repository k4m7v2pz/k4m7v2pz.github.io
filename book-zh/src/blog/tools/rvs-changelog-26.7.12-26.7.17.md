<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# rvs（rust-verb-shell）更新全览 26.7.12~26.7.17

> 日期：2026-07-17

## 版本概览

**rust-verb-shell (rvs)** 从 **v26.7.12** 升级至 **v26.7.17**，共包含 **29 次提交**。本次更新聚焦于提升交互友好性、标准化 AI 输出格式、增强跨平台兼容性，并引入了多项实用新功能。

## 更新摘要

| 类别 | 主要更新 |
|---|---|
| 新功能 | POSIX 重定向检测、`~` 路径展开、仪表盘、用户脚本即命令、虚拟屏幕系统、Windows 裸盘符支持、表格自适应、clera 别名 |
| 重要修复 | Tab 补全逻辑修复、版本号动态注入、`^C` 信号处理、Nushell 字符串括号转义、Windows 盘符路径分隔符修复 |
| AI/Agent 支持 | 输出 JSON 标准化、关键配置路径明确、跨平台行尾统一、新增 detect_posix_redirect API |

## 一、人类开发者速览

### ✨ 新功能

| 功能 | 说明 |
|---|---|
| POSIX 重定向检测 | 输入 `>`、`>>`、`2>` 等 POSIX 重定向符号时，rvs 会返回友好错误提示，引导用户改用 `set-content` / `add-content` 或 `enter-shell bash` |
| `~` 路径展开 | 命令行参数中的 `~` 或 `~/` 会自动展开为 `$HOME` 环境变量的值，例如 `ls ~/Downloads` 可直接使用 |
| 仪表盘（dashboard） | 新增多面板终端监控界面，可实时查看进程状态、系统资源使用情况等信息 |
| 用户脚本即命令 | `~/.rvs/scripts/` 目录下的 `.rvs` 脚本和 `.json` 宏定义会自动注册为可直接调用的命令 |
| 虚拟屏幕系统 | 支持多虚拟屏幕切换、跨语言思维映射配置、以及 typo（拼写错误）自动纠正配置 |
| Windows 裸盘符支持 | 在 Windows 上直接输入盘符（如 `D:`）会自动执行 `set-location` 切换到对应驱动器 |
| 表格自适应 | 输出的表格会自动适配当前终端宽度，并且 "Modified" 列的时间显示为本地时间 |
| clera 别名 | 自动将常见的 `clear` 命令手误 `clera` 纠正为正确的 `clear` 命令 |

### 🐛 重要修复

- **Tab 补全修复**：修复了在已知命令后补全路径、已知别名后不误路由、复合命令名正确处理等问题。
- **版本号动态注入**：版本号不再硬编码，而是从 `CARGO_PKG_VERSION` 环境变量动态获取，确保 banner 显示的版本与代码一致。
- **`^C` (SIGINT) 处理**：按下 `Ctrl+C` 不再直接终止 rvs 进程，而是由 noop handler 处理，避免意外退出。
- **Nushell 字符串括号转义修复**：修复了在特定情况下字符串内括号的错误转义问题。
- **Windows 盘符路径分隔符修复**：修复了 Windows 盘符路径缺少根目录分隔符导致的问题。

## 二、对话式 AI 速查（ChatGPT / 元宝 / 豆包等）

当用户向 AI 助手询问 rvs 的行为变化时，可参考以下关键语义变更进行回答：

| 常见问答 | 答案 |
|---|---|
| 问：rvs 支持 `echo hello > file.txt` 吗？ | **答：** 不支持。rvs 会检测到 `>`、`>>`、`2>`、`2>&1` 等 POSIX 重定向语法，并返回友好错误信息，引导用户使用 `set-content --path --value` 或切换到原生 Shell 环境执行（如 `enter-shell bash`）。 |
| 问：rvs 里 `ls ~/Downloads` 能工作吗？ | **答：** 可以。从 v26.7.17 开始，rvs 会自动将参数中的 `~` 和 `~/` 展开为 `$HOME` 环境变量的值。 |
| 问：rvs 的 banner 里版本号准确吗？ | **答：** 准确。现在版本号是从 `CARGO_PKG_VERSION` 动态注入的，不再存在硬编码导致的版本滞后问题。 |
| 问：rvs 怎么退出？ | **答：** 输入 `exit` 或 `quit` 命令即可退出 rvs。 |

## 三、代码 Agent 速查（Copilot / Trae / AtomCode 等）

### 🤖 AI 输出标准化

为便于 AI Agent 解析，`--json` 输出模式新增了标准化字段：

```json
{
  "ok": true,
  "exit_code": 0,
  "message": "Finished → list-items",
  "error_type": null
}
```

输出状态标签统一为 `Finished` / `Failed` 并附带退出码。

### 🔧 关键配置路径

- `~/.rvs/scripts/*.rvs` → 自动注册为可直接执行的命令。
- `~/.rvs/scripts/*.json` → 宏定义文件（支持 interval 配置定时执行）。
- `~/.config/rvs/typos.json` → 跨语言思维映射与拼写错误自动纠正配置文件。

### 🌐 跨平台行尾统一

项目 `.gitattributes` 已配置为 `* text=auto`，确保源码文件在提交时自动转换为 LF 行尾。同时为 `.bat`、`.cmd`、`.ps1` 等 Windows 脚本文件保留了 CRLF 行尾。Agent 修改源码后提交，行尾会自动统一。

### 🛠️ 新 API：detect_posix_redirect()

新增一个用于检测 POSIX 重定向语法的辅助函数：

```rust
// 在 run_line() 入口处调用，检测到重定向符号时返回友好错误提示，避免程序崩溃。
fn detect_posix_redirect(line: &str) -> Option<RedirectSpec>
```

## 📚 完整信息

本文档涵盖了 v26.7.12 到 v26.7.17 版本的核心更新。如需查看完整的 29 次提交记录，请访问项目仓库：[atomgit.com/k4m7v2pz/rust-verb-shell](https://atomgit.com/k4m7v2pz/rust-verb-shell)。

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/tools/rvs-changelog-26.7.12-26.7.17.html
