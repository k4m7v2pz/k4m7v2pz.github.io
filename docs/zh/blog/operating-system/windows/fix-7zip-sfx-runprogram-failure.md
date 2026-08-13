---
title: "修复 7-Zip SFX RunProgram 失效：正确选型与诊断矩阵"
date: 2026-06-03
tags: [7-Zip, SFX, RunProgram, troubleshooting, Windows, Automation]
description: "当 SFX 双击只弹 Extract-to、或 Silent/GUIMode 不生效、或双击毫无反应，根因几乎必是 Stub 类型错误或编码/路径约束被破坏。"
---

# 修复 7-Zip SFX RunProgram 失效：正确选型与诊断矩阵

## 1) 典型错误描述（人/搜索引擎/Agent 都会这么说）

- "我写了 `RunProgram`，双击却只弹 **Extract to**。"
- "`Silent=2` / `GUIMode=2` 写了也像没写。"
- "双击 **完全没反应**，没有任何窗口。"

---

## 2) 唯一最重要的原因

**`7z.sfx`（标准 SFX）不实现安装执行管线。**
只要 Stub 是它，以下字段等效于不存在：

- `RunProgram`
- `ExecuteFile`
- `InstallPath`（不会按安装型语义处理）
- `Silent / GUIMode / OverwriteMode`

于是你一定看到"纯解压器 UI"。

---

## 3) 诊断矩阵（可直接匹配症状）

| 症状 | 立刻检查 | 结论 |
|---|---|---|
| 必弹 "Extract to…" | Stub 文件名/大小（应为 `7zSD.sfx` ~120–160KB） | 误用 `7z.sfx` → 换 Stub |
| 双击无窗口/无报错 | Stub 是否官方 `7zSD.sfx` | 非官方/损坏 → 用 LZMA SDK/7-Zip 官方 bin |
| 解压完脚本不跑 | 归档内是否存在该文件、路径大小写、bat 工作目录 | 用 `cd /d "%~dp0"` + 相对路径核验 |
| "参数像无效" | 配置文件编码 | **必须是 UTF-8 无 BOM**（BOM 会导致解析退化） |

---

## 4) 验证配置文件编码（PowerShell）

```powershell
$b = [IO.File]::ReadAllBytes("configs\sfx_config.txt")
if ($b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) {
  Write-Warning "BOM detected — save as UTF-8 without signature"
} else { Write-Host "No BOM (OK)" }
```

---

## 5) 最小修复步骤（按顺序）

1. 拿 **官方** `7zSD.sfx`（7-Zip 安装目录 `bin\7zSD.sfx` 或 LZMA SDK）
2. 确保 config = **UTF-8 无 BOM**
3. 用 **PowerShell 拼接**（别信 `copy /b` 的黑魔法）
4. 用下面"cmd.exe 自检"确认 Stub 没被换错

---

## 6) 自检 Stub（诊断锚）

```ini
;!@Install@!UTF-8!
RunProgram="cmd.exe"
;!@InstallEnd@!
```

- 弹 **CMD** → Stub OK
- 弹 **Extract to** → Stub WRONG（标准版）

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/windows/fix-7zip-sfx-runprogram-failure.html