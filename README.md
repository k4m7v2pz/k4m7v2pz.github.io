# k4m7v2pz.github.io

个人博客网站，使用 MkDocs 和 Material 主题构建，通过 GitHub Actions 自动部署到 GitHub Pages。

## 技术栈

- **静态网站生成**：[MkDocs](https://www.mkdocs.org/) 1.6.1
- **主题**：[Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) 9.7.6
- **依赖管理**：[uv](https://github.com/astral-sh/uv)
- **部署**：
  - [GitHub Actions](https://github.com/features/actions)（CI/CD 流程）
  - [GitHub Pages](https://pages.github.com/)（静态站点托管）

## 构建流程

### 新手入门 - 从零开始

1. **创建 GitHub 仓库**：
   - 仓库名必须是：`你的用户名.github.io`（例如：`k4m7v2pz.github.io`）
   - 选择 Public，初始化 README（可选）

2. **本地开发**：
   - 启动开发服务器：`uv run mkdocs serve`
   - 访问：`http://localhost:8000`

3. **构建静态网站**：
   - 执行：`uv run mkdocs build`
   - 输出目录：`site/`

4. **GitHub Pages 设置（关键步骤）**：
   - 进入 GitHub 仓库 → **Settings**（顶部菜单）
   - 左侧边栏找到并点击 **Pages**
   - 在 **Build and deployment** 区域：
     - **Source** 选择：`Deploy from a branch`
     - **Branch** 选择：`gh-pages`
     - 分支右侧目录选择：`/(root)`
     - 点击 **Save**

5. **自动部署**：
   - 推送到 `dev` 分支后，GitHub Actions 会自动：
     - 安装依赖
     - 构建网站
     - 部署到 `gh-pages` 分支
     - GitHub Pages 自动发布

### 分支说明
- **dev**：开发分支，存放源码（Markdown、配置等）
- **gh-pages**：自动生成的分支，存放构建后的静态网站（HTML/CSS/JS）

## 目录结构

```
k4m7v2pz.github.io/
├── .github/workflows/  # GitHub Actions 工作流
├── docs/               # 文档源码
│   ├── blog/           # 博客文章
│   └── index.md        # 首页
├── overrides/          # 主题覆盖
├── site/               # 构建输出（自动生成）
├── mkdocs.yml          # MkDocs 配置
├── pyproject.toml      # 项目配置
└── uv.lock             # 依赖锁定
```

## 主要功能

- **响应式设计**：适配各种设备
- **明暗模式**：支持主题切换
- **全文搜索**：快速查找内容
- **RSS 订阅**：支持内容订阅
- **代码高亮**：美化代码显示
- **自动部署**：推代码即发布

## 快速开始

1. **克隆仓库**：
   ```bash
   git clone https://github.com/k4m7v2pz/k4m7v2pz.github.io.git
   cd k4m7v2pz.github.io
   ```

2. **安装依赖**：
   ```bash
   uv install
   ```

3. **启动开发服务器**：
   ```bash
   uv run mkdocs serve
   ```

4. **构建网站**：
   ```bash
   uv run mkdocs build
   ```

## 部署状态

[![Deploy to GitHub Pages](https://github.com/k4m7v2pz/k4m7v2pz.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/k4m7v2pz/k4m7v2pz.github.io/actions/workflows/deploy.yml)

## 访问地址

- **网站**：https://k4m7v2pz.github.io
- **仓库**：https://github.com/k4m7v2pz/k4m7v2pz.github.io
