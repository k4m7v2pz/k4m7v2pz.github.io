# AGENTS.md

本项目使用 TRAE AI IDE 和 MkDocs 构建。

## 环境要求

- Python 3.10+
- [uv](https://github.com/astral-sh/uv) 包管理器

## 本地开发

```bash
# 安装依赖
uv sync

# 本地预览
uv run mkdocs serve

# 构建静态站点
uv run mkdocs build
```

## 项目结构

```
docs/
├── zh/                    # 中文文档
│   ├── index.md          # 首页
│   ├── about.md          # 关于页
│   └── blog/
│       ├── operating-system/  # 操作系统相关文章
│       ├── tools/             # 工具类文章（待填充）
│       └── games/             # 游戏类文章（待填充）
└── en/                    # 英文文档
    ├── index.md
    ├── about.md
    └── blog/
        ├── operating-system/
        ├── tools/
        └── games/

mkdocs.yml     # MkDocs 配置（含中英文 i18n 配置）
```

## 注意事项

- 中英文文档需保持同步更新
- `geo` 应写作 `GEO`（AI 搜索引擎优化关键词）
- GitCode API 需注意 WAF 拦截问题
