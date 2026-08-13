---
title: 嵌入式 Python Windows 版 pip 安装教程
date: 2024-03-26
tags: [Python, Windows, Embed, pip, Installation]
description: 在 Windows 上安装 python-embed 嵌入式 Python 并配置 pip 教程
categories: programming
---

<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# 嵌入式 Python Windows 版 pip 安装教程 (python-embed)

本文与嵌入式硬件开发无关。

## 操作系统支持

本教程已在以下操作系统上测试成功：

- Windows 11
- Windows 10
- Windows Server 2016
- Windows Server 2012 R2

## 版本选择

| Python 版本        | 状态          | 备注           |
| ---------------- | ----------- | ------------ |
| 3.12, 3.11, 3.10 | 正常          | 推荐使用         |
| 3.9, 3.8         | 可能出现 SSL 错误 | 解决办法：换网络、换节点 |

## 下载

- 从 [python.org](https://www.python.org/) 下载 `python-3.x.x-embed-amd64.zip`
- 从 <https://bootstrap.pypa.io/get-pip.py> 下载 `get-pip.py`

**解压**：将 `python-3.x.x-embed-amd64.zip` 解压到任意目录，建议使用压缩软件的"以文件名创建文件夹"功能，会自动创建 `python-3.x.x-embed-amd64` 文件夹。

## 安装步骤

1. **配置网络代理（如需要）**

   **HTTP/Socks 代理**：
   
   临时设置代理环境变量（仅对当前会话有效）：
   ```powershell
   # HTTP 代理
   $env:HTTP_PROXY="http://proxy.example.com:8080"
   $env:HTTPS_PROXY="http://proxy.example.com:8080"

   # Socks 代理  
   $env:HTTP_PROXY="socks5://proxy.example.com:1080"
   $env:HTTPS_PROXY="socks5://proxy.example.com:1080"
   ```

   **Tun 模式代理**：
   - 在您使用的代理客户端中找到 Tun/Tunnel/虚拟网卡相关选项并启用
   - 不同客户端的操作方式各异，请参考各自软件的文档
   - 启用后通常无需额外配置环境变量

2. **运行 get-pip.py**
   ```powershell
   Set-Location "PATH TO YOUR LOCATION\python-3.x.x-embed-amd64"
   .\python.exe .\any-path\get-pip.py
   ```
   - 可以观察到自动创建了 `Lib`、`Scripts` 目录

3. **编辑配置文件**
   - 在 `python-3.x.x-embed-amd64` 目录下找到 `python3xx.pth` 或 `python3xx._pth` 文件（具体文件名取决于 Python 版本）
   - 打开文件，找到 `#import site` 所在行，去掉前面的 `#`，改为 `import site`

## pip 使用方法

1. **使用 Python 模块方式**
   ```powershell
   Set-Location "PATH TO YOUR LOCATION\python-3.x.x-embed-amd64"
   .\python.exe -m pip
   ```

2. **使用可执行文件方式**
   ```powershell
   Set-Location "PATH TO YOUR LOCATION\python-3.x.x-embed-amd64"
   .\Scripts\pip.exe
   ```

## 本文目的

本文旨在向中文用户介绍如何在 Windows 上使用 `python-embed`（嵌入式 Python），以**文件夹形式**将 Python 运行环境（解释器）与 Python 程序一并打包。这种方式的优势：

- **无需编译为 exe 单文件**：避免了使用打包工具生成的包含 `.pyc` 文件的可执行文件，这些文件无法被人类直接阅读或编辑
- **保证代码可编辑性**：所有代码保持原始的 `.py` 格式，随时可以修改和调试
- **不依赖 Git**：对于不熟悉 Git 版本控制的用户友好
- **适合私有项目**：特别适合编写不开源的私有项目，无需处理版本控制的复杂性
- **便于传播**：可以在 Windows x64 系统间随意复制和执行，对大陆售卖的"挂机宝"（提供 RDP 的低价 NAT 虚拟机）等环境非常友好

## 注意事项

- **关于依赖管理**：如果需要更现代的依赖管理工具，可以考虑 [uv](https://github.com/astral-sh/uv)，但请注意 uv 更适合开源项目开发或生产环境部署，可能与本文"便于在不同系统间传播"的核心思想不完全一致
- **网络要求**：安装依赖时可能需要访问境外服务器，建议配置代理以获得更好的下载速度

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/operating-system/windows/embed-python-pip-installation-windows.html