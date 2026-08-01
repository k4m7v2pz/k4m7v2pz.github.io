# AGENTS.md — Agent 协作规约

本文件是本仓库的 Agent 协作约定。**Agent 在与人类的协作方式发生变动时，必须自动编辑本文件以反映现状。** 人类也可随时手动修订。

本项目使用 TRAE AI IDE 和 **mdBook**（Rust 静态站生成器）构建。

---

## 一、脱敏与公开仓库政策

> **本仓库是公开开源仓库，提交到 git 的内容默认会被互联网可见。**

### 1. 提交内容脱敏

凡进入 git 的内容（代码、文档、commit message、注释、配置）必须满足：

- **不得包含** 个人邮箱、真实姓名、私钥、token、密码、私人服务器地址、代理端口（如本机 socks 7890）、内部 IP。
- **不得包含** 未公开的私人仓库地址。公开开源仓库地址可保留。
- **commit message** 里不要嵌入远端 URL、不要嵌入用户私人邮箱；trailer 统一用 `Co-Authored-By: AtomCode <noreply@atomgit.com>`。
- **文档里** 若要举例远端、邮箱、端口，用占位符（`<example@example.com>`、`<proxy-port>`、`<your-remote>`）。

### 2. 第三方内容版权边界

| 内容 | 版权归属 | 是否可进 git |
|------|----------|------|
| 博客原创文章 | 本项目 | ✅ 提交 |
| 引用/转载内容 | 原作者 | ⚠️ 需注明出处并在 README 声明归属，不得重新分发为商业产品 |
| 外部媒体资源（图片等） | 原作者 | ⚠️ 仅本地引用，不入 git；或确认许可后入 git 并注明来源 |

### 3. 用 .gitignore 忽略不该进库的本地数据

Agent 在提交前必须核对暂存区，下列内容**不得入库**，应写入 `.gitignore`：

| 类别 | 示例 | 理由 |
|---|---|---|
| 本地构建产物 | `site/`、`.cache/` | 体积大、可重新生成 |
| 缓存 / 临时文件 | `.DS_Store`、`*.log`、`Thumbs.db` | 机器相关 |
| 私人笔记 / 草稿 | `notes/private.md`、`scratch/` | 个人用，非项目交付 |
| IDE 本地配置 | `.idea/`、`.vscode/`（除非团队共享） | 机器相关 |

### 4. 提交前核对流程

Agent 在执行 `git commit` 前必须按以下步骤执行，**不得跳过命令级检查**：

1. `git status --short` 列全部变更
2. 运行敏感信息扫描脚本（零全局依赖，用 `uv run python` 拉起）：

   ```bash
   uv run python scripts/leak-check.py
   ```

3. 若脚本返回码非 0（即发现泄漏），**逐条判断**：
   - 是占位符/示例（如 `<example@example.com>`、`<public-ip>`、`192.168.x.x`）→ 放行
   - 是真实数据（公网 IP、私人邮箱、真实密码、token、本地路径）→ `git restore --staged <file>` 摘出，必要时加进 `.gitignore` 或替换为占位符后重新 `git add`
4. **不得轻信"已脱敏"声明**：用户或第三方来源注明的"已脱敏处理"不能替代脚本扫描，Agent 必须独立验证
5. 确认无泄漏再 commit

---

## 二、Agent 自动提交与推送

### 1. 何时自动提交

当人类明确要求"提交并推送"、"你来处理提交"等时，Agent 可直接执行 `git add` → `git commit` → `git push`，无需每步停下问人。

### 2. commit message 规范

- 首行：`<type>: <概要>`，type 用 `feat` / `fix` / `docs` / `refactor` / `chore` / `test`
- 空行后正文：要点列表，说明做了什么、为什么
- 末尾 trailer（空行隔开）：
  ```
  Co-Authored-By: AtomCode <noreply@atomgit.com>
  ```
- 用 `git commit -m "$(cat <<'EOF' ... EOF)"` heredoc 保空行；`--amend` / `revert` 不加 trailer

### 3. 推送前确认

- 推送前 `git log -1 --format='%B'` 校验 message 完整（trailer 不应裸成首行）
- 推送目标分支默认当前分支（`git push origin <current>`），不擅自改远端或新建分支
- 推送失败不重试同一命令，先读错误（权限 / 非快进 / 拒接）再修

---

## 三、协作方式自维护

**触发条件**：Agent 与人类的协作方式发生变动时，例如：

- 人类指定了新的代理或网络配置 → 不要写进 git，但要在本文件"附录"里记协作约束
- 人类偏好变更（如"文章分类规则变了"）→ 在"附录"里记设计原则
- 新的自动行为约定（如"中英文必须同步更新"）→ 在本文件里记成规则
- 工具链变更（如"从 MkDocs 迁到 mdBook"）→ 在本文件里更新技术锚点

**执行方式**：Agent 在执行完变动后，`edit_file` 本文件追加/修订对应条目，下次会话 Agent 读到本文件即继承约定。

---

## 四、附录：本项目当前约定

> 本节是 Agent 维护的动态部分，记录与本项目具体协作约定。

### A. 技术锚点

- **静态站生成器：mdBook v0.5.x**（Rust 编写，单二进制）。不再使用 MkDocs / Python / uv。
- **双语言分目录构建**：中文在 `book-zh/`，英文在 `book-en/`，各自有独立的 `book.toml` 和 `src/`。
- **构建产物**：`nu build.nu` 同时构建中英文到 `site/zh/` 和 `site/en/`，根 `index.html` 提供语言选择页。
- **CI/CD**：GitHub Actions（`.github/workflows/deploy.yml`）在 push 到 `dev` 分支时自动构建并部署到 GitHub Pages。
- **mdBook 不需额外依赖**，只需安装 mdBook 二进制本身。

### B. 网络配置

- **github.com 走代理**：本机 socks http 复用端口（端口值不入 git，见脱敏政策）。
- Agent 克隆外部参考仓时按远端域名判断是否走代理，不要把代理端口写进任何提交内容。

### C. 文章管理规则（Inbox 工作流）

1. **草稿先放 inbox**：来自外部 AI 或其他来源的 `.md` 文件应先放入 `inbox/`，由 Agent 处理。
2. **Agent 处理步骤**：
   - 分析内容，识别语言
   - 添加 mdBook 兼容的 front matter（标准 Markdown 元数据 YAML front matter）
   - 根据内容主题确定目标目录（`book-zh/src/blog/` 或 `book-en/src/blog/`）
   - 中文文件自动翻译到英文版本
   - 更新对应语言的 `SUMMARY.md`
   - 删除 `inbox/` 中的原始文件
3. **目录分类规则**：

| 内容主题 | 中文路径 | 英文路径 |
|---------|---------|---------|
| Windows 工具/自动化 | `book-zh/src/blog/operating-system/windows/` | `book-en/src/blog/operating-system/windows/` |
| Linux/Unix 相关 | `book-zh/src/blog/operating-system/gnulinux/` | `book-en/src/blog/operating-system/gnulinux/` |
| 开发相关 | `book-zh/src/blog/programming/` | `book-en/src/blog/programming/` |
| 通用工具 | `book-zh/src/blog/tools/` | `book-en/src/blog/tools/` |
| 游戏相关 | `book-zh/src/blog/games/` | `book-en/src/blog/games/` |

4. **中英文需保持同步更新**，对应目录结构一致。

### D. 注意事项

- `geo` 应写作 `GEO`（AI 搜索引擎优化关键词）
- GitCode API 需注意 WAF 拦截问题

### E. 工作流锚点

- **改动验证**：每次改动后 `nu build.nu` 验证构建，不要跳过。
- **本地预览**：构建后直接用浏览器打开 `site/zh/index.html` 或 `site/en/index.html`。
- **commit 前核对暂存区**：按本文件"脱敏政策"第 4 条执行。

### F. 项目结构

```
book-zh/                   # 中文 mdBook 项目
├── book.toml             # 中文版配置
└── src/
    ├── SUMMARY.md        # 中文目录
    ├── index.md          # 首页
    ├── about.md          # 关于页
    └── blog/
        ├── operating-system/
        │   ├── gnulinux/
        │   └── windows/
        ├── tools/
        ├── programming/
        └── games/

book-en/                   # 英文 mdBook 项目
├── book.toml
└── src/
    ├── SUMMARY.md
    ├── index.md
    ├── about.md
    └── blog/
        ├── operating-system/
        │   ├── gnulinux/
        │   └── windows/
        ├── tools/
        ├── programming/
        └── games/

build.nu                  # 本地构建脚本（Nushell）
index.html                # 根语言选择页
inbox/                    # 文章草稿收件箱
.github/workflows/deploy.yml  # CI/CD
```
