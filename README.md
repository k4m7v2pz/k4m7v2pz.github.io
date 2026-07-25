# k4m7v2pz.github.io

个人技术博客，使用 **mdBook** 构建中英双语站点，通过 GitHub Actions 自动部署到 GitHub Pages。

## 技术栈

- **静态网站生成**：[mdBook](https://github.com/rust-lang/mdBook) v0.5.x（Rust）
- **部署**：
  - [GitHub Actions](https://github.com/features/actions)（CI/CD 流程）
  - [GitHub Pages](https://pages.github.com/)（静态站点托管）

## 本地开发

```bash
# 构建站点（同时构建中英文）
bash build.sh

# 本地预览
open site/zh/index.html   # 中文版
open site/en/index.html   # 英文版
```

## 分支说明

- **dev**：开发分支，存放源码（Markdown、mdBook 配置等）
- **gh-pages**：自动生成的分支，存放构建后的静态网站（HTML/CSS/JS）

## 目录结构

```
k4m7v2pz.github.io/
├── .github/workflows/  # GitHub Actions 工作流
├── book-zh/            # 中文 mdBook 项目
│   └── src/
│       ├── SUMMARY.md  # 中文目录
│       ├── index.md    # 首页
│       ├── about.md    # 关于页
│       └── blog/       # 博客文章
├── book-en/            # 英文 mdBook 项目
│   └── src/
│       ├── SUMMARY.md
│       ├── index.md
│       ├── about.md
│       └── blog/
├── build.sh            # 本地构建脚本
├── index.html          # 根语言选择页
└── inbox/              # 文章草稿收件箱
```

## 快速开始

1. **克隆仓库**：
   ```bash
   git clone https://github.com/k4m7v2pz/k4m7v2pz.github.io.git
   cd k4m7v2pz.github.io
   ```

2. **安装 mdBook**（macOS）：
   ```bash
   brew install mdbook
   # 或
   cargo install mdbook
   ```

3. **构建网站**：
   ```bash
   bash build.sh
   ```

4. **本地预览**：
   直接用浏览器打开 `site/zh/index.html` 或 `site/en/index.html`

## 部署状态

[![Deploy to GitHub Pages](https://github.com/k4m7v2pz/k4m7v2pz.github.io/actions/workflows/deploy.yml/badge.svg)](https://github.com/k4m7v2pz/k4m7v2pz.github.io/actions/workflows/deploy.yml)

## 访问地址

- **网站**：https://k4m7v2pz.github.io
- **仓库**：https://github.com/k4m7v2pz/k4m7v2pz.github.io

## 许可协议

本仓库所有原创内容（含代码、技术文档、踩坑记录、分析结论）均采用 **木兰宽松许可证 v2 (Mulan PSL v2)** 授权。
版权归作者所有，作者明确声明：不主动追究署名义务。
个人开发者、研究者可自由使用、修改、分发本仓库内容，无需署名。
企业、知名开源项目或商业产品分发本仓库内容时，请依照木兰 PSL v2 要求保留原始版权、专利、商标及免责声明，建议（非强制）在文档或致谢中标注原始来源链接。
