# System Management 核心脚本存档

本文档记录了 Windows 系统管理相关的一组 PowerShell / Nu / Bash 脚本，涵盖文件关联、右键菜单清理、默认应用设置等场景。

## 1. 核心：.bat 关联（双击执行，右键 Zed 编辑）

文件：`scripts/powershell/set-bat-assoc.ps1`

```powershell
# 硬编码：修改此处路径
$zedPath = "C:\Users\user\AppData\Local\Programs\Zed\Zed.exe"

# 恢复双击执行（关键：不改默认打开方式）
Set-ItemProperty -Path "HKCU:\Software\Classes\.bat" -Name "(default)" -Value "batfile" -Force

# 添加右键菜单项
$editPath = "HKCU:\Software\Classes\batfile\shell\EditWithZed"
New-Item -Path $editPath -Force | Out-Null
Set-ItemProperty -Path $editPath -Name "(default)" -Value "用 Zed 编辑" -Force

# 绑定命令
$commandPath = "$editPath\command"
New-Item -Path $commandPath -Force | Out-Null
Set-ItemProperty -Path $commandPath -Name "(default)" -Value "`"$zedPath`" `"%1`"" -Force

# 清理系统缓存（必须：否则不生效）
Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.bat\UserChoice" -Recurse -Force -ErrorAction SilentlyContinue

# 刷新 Explorer
Stop-Process -Name explorer -Force; Start-Sleep 2; Start-Process explorer.exe
```

## 2. 兜底：强制默认应用（.bat + .txt）

文件：`scripts/powershell/set-zed-defaults-full.ps1`

```powershell
$zedPath = "C:\Users\user\AppData\Local\Programs\Zed\Zed.exe"

function Set-FileAssociation {
    param($ext, $progId)
    # 写注册表
    Set-ItemProperty -Path "HKCU:\Software\Classes\.$ext" -Name "(default)" -Value $progId -Force
    Set-ItemProperty -Path "HKCU:\Software\Classes\$progId\shell\open\command" -Name "(default)" -Value "`"$zedPath`" `"%1`"" -Force
    # 干掉 UserChoice 劫持
    Remove-Item -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.$ext\UserChoice" -Recurse -Force -ErrorAction SilentlyContinue
}

Set-FileAssociation -ext "txt" -progId "Zed.txt"
Set-FileAssociation -ext "bat" -progId "Zed.bat"

# 刷新
Stop-Process -Name explorer -Force; Start-Sleep 2; Start-Process explorer.exe
```

## 3. 清理：右键菜单垃圾项

文件：`scripts/powershell/clean-bat-menu.ps1`

```powershell
# 删除 .bat 右键菜单中不需要的项
$unwanted = @(
    "HKCU:\Software\Classes\batfile\shell\opennew",
    "HKCU:\Software\Classes\batfile\shell\runas"
)

foreach ($path in $unwanted) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force
        Write-Host "已删除: $path"
    }
}

# 刷新
Stop-Process -Name explorer -Force; Start-Sleep 2; Start-Process explorer.exe
```

## 4. 脚本使用说明

### 前置条件

- 以管理员身份运行 PowerShell（部分注册表操作需要管理员权限）
- 执行策略需设为 RemoteSigned: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
- 修改 `$zedPath` 变量为实际 Zed 安装路径

### 执行顺序

1. 先运行 `set-bat-assoc.ps1` 添加右键菜单选项
2. 如果默认应用被劫持，运行 `set-zed-defaults-full.ps1` 强制覆盖
3. 运行 `clean-bat-menu.ps1` 清理不需要的右键菜单项

### 注意事项

- 修改注册表有风险，建议先备份相关注册表项
- `UserChoice` 项是 Windows 用来记忆用户选择的，删除后系统会恢复默认关联
- 刷新 Explorer 会使桌面短暂消失后重新出现，请保存好工作