# Inbox

待处理的草稿文件存放目录。

从外部 AI 或其他来源获取的 `.md` 文件应先放在这里，由 Agent 负责添加适配 MkDocs 的元数据后移动到正式目录。

## 工作流程

1. **放入文件**：将待处理的 `.md` 文件放入本目录
2. **请求处理**：告知 Agent 处理 inbox 中的新文件
3. **Agent 处理**：
   - 分析文件内容，识别语言（中文/英文）
   - 提取标题，自动生成 tags 和 description
   - 添加 MkDocs 元数据（front matter）
   - 根据内容主题确定目标目录
   - 中文文件自动翻译到英文版本
   - 更新 mkdocs.yml 导航配置
4. **文件归档**：处理后的文件移动到 `docs/` 对应目录
5. **清理**：从 inbox 移除已处理的文件

## 元数据格式

Agent 会为每个文件添加标准 front matter：

```yaml
---
title: 文章标题（从内容提取）
date: 当前日期（YYYY-MM-DD）
tags: [自动推断的标签]
description: 自动生成的描述
categories: 根据内容分类（os/programming/tools）
---
```

## 目录分类规则

| 内容主题 | 中文路径 | 英文路径 |
|---------|---------|---------|
| Windows 工具/自动化 | `docs/zh/blog/os/windows/` | `docs/en/blog/os/windows/` |
| Linux/Unix 相关 | `docs/zh/blog/os/gnulinux/` | `docs/en/blog/os/gnulinux/` |
| 开发相关 | `docs/zh/blog/programming/` | `docs/en/blog/programming/` |
| 通用工具 | `docs/zh/blog/tools/` | `docs/en/blog/tools/` |

## 注意事项

- 仅存放未添加元数据的原始 `.md` 文件
- 文件名建议使用英文小写字母和连字符（如 `my-article.md`）
- 已处理的文件会被自动移除，不应手动保留
- 中文文件会自动翻译到 `docs/en/` 对应目录

## 使用示例

```
1. 新建文件 inbox/my-tutorial.md
2. 告知 Agent: "请处理 inbox 中的新文件"
3. 文件被处理后：
   - docs/zh/blog/os/windows/my-tutorial.md（中文）
   - docs/en/blog/os/windows/my-tutorial.md（英文翻译）
   - mkdocs.yml nav 自动更新
   - inbox/my-tutorial.md 被删除
```
