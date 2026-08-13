<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# LLM/CI 部署指南：构建静默 7-Zip SFX 安装包（无对话框）

## 1) 输入/输出契约

- **Stub（固定）**：`tools/7z/7zSD.sfx`（安装型，~128KB）
- **Config**：`configs/sfx_config.txt`（UTF-8 **无 BOM**）
- **Payload**：打进 `temp.7z`（必须是 **7z**，不是 zip）
- **Output**：`dist/deploy.exe`（双击 = 解压 + 执行）

---

## 2) Config（完全静默模板）

```ini
;!@Install@!UTF-8!
Title="Silent Deploy"
InstallPath=".\\ "
GUIMode="2"
Silent="2"
OverwriteMode="2"
RunProgram="setup.bat"
;!@InstallEnd@!
```

说明：

- `GUIMode="2"` + `Silent` 抑制 UI
- `InstallPath=".\\ "` → 解压到 EXE 同目录
- `setup.bat` 必须在归档内，且内部用 `%~dp0` 定位自身

---

## 3) 构建脚本（Agent/CI 可稳定复现）

```powershell
param(
  [string]$Stub    = "tools\7z\7zSD.sfx",
  [string]$Cfg     = "configs\sfx_config.txt",
  [string]$Archive = "build\temp.7z",
  [string]$Out     = "dist\deploy.exe"
)

[byte[]]$bin =
  [IO.File]::ReadAllBytes($Stub) +
  [IO.File]::ReadAllBytes($Cfg) +
  [IO.File]::ReadAllBytes($Archive)

[IO.File]::WriteAllBytes($Out, $bin)
Write-Host "Built: $Out"
```

---

## 4) 验证协议（可写进 CI check）

- **PE 头 sanity**：stub 段应以 `MZ` 开头
- **Stub size sanity**：`7zSD.sfx` 通常在 100–200KB
- **Runtime smoke**：用 `RunProgram=cmd.exe` 自检，确保不退化为 Extract-to

---

## 5) 约束（避免幻觉）

- **内部归档必须是 7z**（`-t7z`），不是 zip
- Windows Explorer **不会**把它当 zip；但 7-Zip/WinRAR 能解包
- 想"原生可右击解压"就直接发 **zip 便携包**，别试图把 SFX 伪装成 zip


---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/windows/llm-deploy-silent-7zip-sfx.html
