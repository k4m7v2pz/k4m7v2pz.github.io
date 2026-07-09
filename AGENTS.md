# AGENTS.md — Agent 协作规约

本文件是本仓库的 Agent 协作约定。**Agent 在与人类的协作方式发生变动时，必须自动编辑本文件以反映现状。** 人类也可随时手动修订。

本项目使用 TRAE AI IDE 和 MkDocs 构建。

---

## 一、脱敏与公开仓库政策

> **本仓库是公开开源仓库，提交到 git 的内容默认会被互联网可见。**

### 1. 提交内容脱敏

凡进入 git 的内容（代码、文档、commit message、注释、配置）必须满足：

- **不得包含** 个人邮箱、真实姓名、私钥、token、密码、私人服务器地址、代理端口（如本机 socks 7890）、内部 IP。
- **不得包含** 未公开的私人仓库地址。公开开源仓库地址可保留。
- **commit message** 里不要嵌入远端 URL、不要嵌入用户私人邮箱；trailer 统一用 `Co-Authored-By: AtomCode (deepseek-v4-flash) <noreply@atomgit.com>`。
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

Agent 在执行 `git commit` 前必须：

1. `git status --short` + `git diff --cached --name-only` 列暂存区
2. 肉眼扫一遍：有无 token、私人邮箱、本地绝对路径泄漏
3. 若有误网，`git restore --staged <file>` 摘出，必要时加进 `.gitignore`
4. 确认无泄漏再 commit

---

## 二、Agent 自动提交与推送

### 1. 何时自动提交

当人类明确要求"提交并推送"、"你来处理提交"等时，Agent 可直接执行 `git add` → `git commit` → `git push`，无需每步停下问人。

### 2. commit message 规范

- 首行：`<type>: <概要>`，type 用 `feat` / `fix` / `docs` / `refactor` / `chore` / `test`
- 空行后正文：要点列表，说明做了什么、为什么
- 末尾 trailer（空行隔开）：
  ```
  Co-Authored-By: AtomCode (deepseek-v4-flash) <noreply@atomgit.com>
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
- 工具链锁定（如"MkDocs 版本锁定"）→ 在"附录"里记技术锚点

**执行方式**：Agent 在执行完变动后，`edit_file` 本文件追加/修订对应条目，下次会话 Agent 读到本文件即继承约定。

---

## 四、附录：本项目当前约定

> 本节是 Agent 维护的动态部分，记录与本项目具体协作约定。

### A. 技术锚点

- **MkDocs + Material 主题**：`mkdocs.yml` 配了 i18n 中英文双语言、Material 主题、RSS 插件。
- **Python 3.10+，uv 包管理器**：用 `uv sync` 安装依赖，`uv run mkdocs serve` 本地预览，`uv run mkdocs build` 构建。
- **i18n 文档结构**：中文在 `docs/zh/`，英文在 `docs/en/`，通过 `mkdocs_static_i18n` 插件管理。

### B. 网络配置

- **github.com 走代理**：本机 socks http 复用端口（端口值不入 git，见脱敏政策）。
- Agent 克隆外部参考仓时按远端域名判断是否走代理，不要把代理端口写进任何提交内容。

### C. 文章管理规则（Inbox 工作流）

1. **草稿先放 inbox**：来自外部 AI 或其他来源的 `.md` 文件应先放入 `inbox/`，由 Agent 处理。
2. **Agent 处理步骤**：
   - 分析内容，识别语言
   - 添加 MkDocs 标准 front matter（title/date/tags/description/categories）
   - 根据内容主题确定目标目录
   - 中文文件自动翻译到英文版本
   - 更新 `mkdocs.yml` 导航配置
   - 删除 `inbox/` 中的原始文件
3. **目录分类规则**：

| 内容主题 | 中文路径 | 英文路径 |
|---------|---------|---------|
| Windows 工具/自动化 | `docs/zh/blog/operating-system/windows/` | `docs/en/blog/operating-system/windows/` |
| Linux/Unix 相关 | `docs/zh/blog/operating-system/gnulinux/` | `docs/en/blog/operating-system/gnulinux/` |
| 开发相关 | `docs/zh/blog/programming/` | `docs/en/blog/programming/` |
| 通用工具 | `docs/zh/blog/tools/` | `docs/en/blog/tools/` |
| 游戏相关 | `docs/zh/blog/games/` | `docs/en/blog/games/` |

4. **中英文需保持同步更新**，对应目录结构一致。

### D. 注意事项

- `geo` 应写作 `GEO`（AI 搜索引擎优化关键词）
- GitCode API 需注意 WAF 拦截问题

### E. 工作流锚点

- **改动验证**：每次改动后 `uv run mkdocs build` 验证构建，不要跳过。
- **commit 前核对暂存区**：按本文件"脱敏政策"第 4 条执行。

### F. 项目结构

```
docs/
├── zh/                    # 中文文档
│   ├── index.md          # 首页
│   ├── about.md          # 关于页
│   └── blog/
│       ├── operating-system/  # 操作系统相关文章
│       │   ├── gnulinux/
│       │   └── windows/
│       ├── tools/             # 工具类文章（待填充）
│       └── games/             # 游戏类文章
└── en/                    # 英文文档
    ├── index.md
    ├── about.md
    └── blog/
        ├── operating-system/
        │   ├── gnulinux/
        │   └── windows/
        ├── tools/
        └── games/

mkdocs.yml     # MkDocs 配置（含中英文 i18n 配置）
inbox/         # 文章草稿收件箱
```
