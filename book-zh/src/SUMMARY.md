# 目录

[首页](index.md)
[关于](about.md)

---

# 操作系统

## GNU/Linux
- [在 Ubuntu 衍生版上安装 Google 拼音](blog/operating-system/gnulinux/google-pinyin-installation-ubuntu-derivatives.md)
- [CentOS 7 跳板 DD 安装 Debian 12](blog/operating-system/gnulinux/centos7-jumpbox-dd-debian12-vps.md)
- [在 Arch Linux 上模拟 macOS 键盘习惯](blog/operating-system/gnulinux/archlinux-macos-keyboard-keyd-sway-wezterm.md)
- [纯字符极简 Arch Linux 装机指南](blog/operating-system/gnulinux/minimal-archlinux-install-guide.md)
- [XFCE 桌面环境 lightdm 包列表参考](blog/operating-system/gnulinux/xfce-lightdm-package-list.md)
- [ThinkPad E490 风扇温度自动控制实录：thinkfan 缺位，自写曲线脚本接管](blog/operating-system/gnulinux/thinkpad-e490-fan-control.md)

## Windows
- [嵌入式 Python Windows 版 pip 安装](blog/operating-system/windows/embed-python-pip-installation-windows.md)
- [7-Zip SFX 标准 Stub 选型](blog/operating-system/windows/7zip-sfx-stub-selection.md)
- [修复 RunProgram 失效](blog/operating-system/windows/fix-7zip-sfx-runprogram-failure.md)
- [LLM 静默部署 EXE](blog/operating-system/windows/llm-deploy-silent-7zip-sfx.md)
- [设置 Zed 为 bat 编辑器](blog/operating-system/windows/set-zed-as-bat-editor.md)
- [Windows 终端环境终极改造](blog/operating-system/windows/windows-terminal-overhaul.md)
- [受限网络下 Windows 10 LTSB 远程管理踩坑实录](blog/operating-system/windows/windows-ltsb-winrm-remote-management.md)
- [Windows 下通过 Scoop 安装 Nushell](blog/operating-system/windows/scoop-install-nushell-windows.md)
- [System Management 核心脚本存档](blog/operating-system/windows/system-management-scripts.md)
- [PowerShell Invoke-RestMethod SSL/TLS 安全通道错误排查](blog/operating-system/windows/powershell-invoke-restmethod-ssl-tls.md)
- [Windows VPS 终端显示全乱：三层独立问题叠加的排查与修复](blog/operating-system/windows/windows-vps-terminal-garbled.md)
- [修复 SSH 进 Windows 输出逐字累积：\r 回车被当换行，winpty 与 Win10 1607 无 ConPTY](blog/operating-system/windows/ssh-windows-output-buffering.md)

# 工具
- [Nushell + AtomCode 配置踩坑记录](blog/tools/nushell-atomcode-config-pitfalls.md)
- [macOS 解压 40GB 分卷+中文密码固件镜像的五个深坑](blog/tools/macos-multivolume-zip-chinese-password.md)
- [CSDN 写作 Agent 内容审核实测：什么话题会被拒、怎么绕过](blog/tools/csdn-writing-agent-content-review.md)
- [WezTerm + Nushell + Cargo 找不到命令](blog/tools/wezterm-nushell-cargo-not-found.md)
- [CSDN 写作 Agent 输入限制实测与分段策略](blog/tools/csdn-writing-agent-input-limits.md)
- [macOS 上 Nushell 自定义配置陷阱](blog/tools/macos-nushell-config-path-pitfall.md)
- [NuShell 协作避坑实录](blog/tools/nushell-ai-collaboration-pitfalls.md)
- [从 PowerShell 到 Nushell 迁移指南](blog/tools/powershell-to-nushell-migration.md)
- [rvs（rust-verb-shell）：面向人类和 AI Agent 的结构化 Shell](blog/tools/rvs-structured-shell-intro.md)
- [rvs（rust-verb-shell）更新全览 26.7.17~26.8.10](blog/tools/rvs-changelog-26.7.17-26.8.10.md)
- [rvs（rust-verb-shell）更新全览 26.7.12~26.7.17](blog/tools/rvs-changelog-26.7.12-26.7.17.md)
- [rvs（rust-verb-shell）迭代全览 26.7.0~26.7.12](blog/tools/rvs-iteration-26.7.0-26.7.12.md)
- [WezTerm 终端 CJK 字形混乱排查与修复](blog/tools/wezterm-cjk-glyph-fix.md)
- [macOS 电路设计自动校验工作流：KiCad CLI + ngspice + Python 从零搭建](blog/tools/macos-kicad-ngspice-circuit-validation.md)

# 编程开发
- [Rust Bevy 0.13 到 0.14 升级踩坑指南](blog/programming/rust-bevy-0.13-to-0.14-upgrade-guide.md)
- [RK3326 设备树面板调试：换内核后 LCD 背光亮但屏幕黑](blog/programming/rk3326-dtb-panel-debug.md)
- [玄铁 0.17.5 InputExpression 分支遗漏 Bug](blog/programming/xuantie-input-expression-bug.md)
- [Bevy 0.14 光标踩坑全记录](blog/programming/bevy-0.14-cursor-pitfalls.md)
- [Bevy 0.14 第一人称转视角踩坑全记](blog/programming/bevy-0.14-fps-camera-pitfalls.md)
- [AtomCode 终端 Spinner 词表解析](blog/programming/atomcode-spinner-thinking-labels.md)
- [AtomCode 终端 Spinner 词表勘误：85% 是编的](blog/programming/atomcode-spinner-wordlist-errata.md)
- [从 AtomCode 续杯到昇腾容器](blog/programming/atomcode-ascend-npu-free-tier.md)
- [AtomCode 项目 Agent 记忆化写作 SOP](blog/programming/atomcode-writing-sop.md)
- [AtomCode Ctrl+O 探秘：从工具输出到推理可见的演进史](blog/programming/atomcode-ctrl-o-evolution.md)
- [AtomCode fmt_dur 争议溯源](blog/programming/atomcode-fmt-dur-controversy.md)
- [16GB Mac 本地跑大模型：ollama 局域网 OpenAI 兼容 API 实战](blog/programming/ollama-lan-openai-api-mac.md)
- [Bevy 0.14.2 玩家精灵不渲染排查全记录](blog/programming/bevy-0.14.2-sprite-not-rendering.md)
- [Bytebeat Moog City Reconstruction v3.2 技术解析与实现](blog/programming/bytebeat-moog-city-reconstruction.md)
- [从 rg 到 rr：CLI 工具的 r 前缀拜物教](blog/programming/rg-to-rr-r-prefix-cult.md)
- [Bevy 0.14 窗口纯黑问题排查：Camera2d 只是标记组件，spawn Camera2d 不会创建相机](blog/programming/bevy-0.14-black-window-camera2d.md)
- [Rust 交叉编译实战：从 Mac 到 Linux / Windows（以 rvs 为例）](blog/programming/rust-cross-compile-mac-linux-windows.md)
- [egui 中文渲染整体偏高：FontTweak 基线对齐修复实录](blog/programming/egui-cjk-rendering-fonttweak.md)
- [修复终端表格折行：crossterm 返回缓冲区宽度而非窗口宽度（dwSize vs srWindow）](blog/programming/crossterm-terminal-table-wrap.md)

# 游戏
- [Mighty Rodent Splash 黑屏踩坑记录](blog/games/mighty-rodent-splash-black-screen-debug.md)
- [R36S 系统卡与游戏卡分离实战：EmuELEC 双卡方案](blog/games/r36s-emuelec-dual-card-separation.md)
- [给 AI Agent 看的游戏配置：JSON Schema 与 ai_context 注释层设计](blog/games/game-config-json-schema-ai-context.md)
- [Arch Linux + Wine + i3wm 搭建复古游戏环境](blog/games/archlinux-wine-i3wm-retro-game-env.md)
- [浏览器窗口化游戏分辨率适配：CDP 外层尺寸 vs 内容区尺寸](blog/games/browser-windowed-game-resolution-cdp.md)
- [黄色警戒 Mod 移植 ChronoDivide 踩坑记录](blog/games/yellow-alert-chronodivide-mod-port.md)
- [OpenYRWeb 移植红警 MOD 实战：BGM 挂载与 UI 越界修复](blog/games/openyrweb-ra2-bgm-and-ui-fixes.md)
- [OpenYRWeb 浏览器引擎内幕：VFS-mix 加载、locale 检测与音频链路](blog/games/openyrweb-vfs-mix-locale-audio.md)
- [浏览器 OPFS 注入游戏数据方案](blog/games/openyrweb-opfs-game-data-injection.md)
- [R36S 掌机游戏迁移实录：EmuELEC 双卡整理](blog/games/r36s-emuelec-game-migration.md)
- [R36S 掌机系统迁移实战：无牌劣质 TF 卡无损搬到品牌卡](blog/games/r36s-tf-card-migration-rk3326.md)
- [RA2/YR CSF 文件格式逆向解析](blog/games/ra2-yr-csf-format-reverse.md)
- [RA2 MOD 的 BGM 挂载与显示名翻译](blog/games/ra2-mod-bgm-thememd-csf.md)
- [RA2 MOD 移植 OpenYRWeb 踩坑实录](blog/games/ra2-mod-openyrweb-port-pitfalls.md)
- [Bevy wgpu 在 R36S 掌机上屏收官](blog/games/bevy-wgpu-r36s-screen.md)
- [Bevy 0.14 在 R36S 上渲染全链路打通](blog/games/bevy-0.14-r36s-rendering.md)
- [把 Bevy 0.14 游戏移植到 R36S 掌机](blog/games/bevy-0.14-port-to-r36s.md)
- [OpenYRWeb 战场光标速度异常排查记录](blog/games/openyrweb-cursor-speed.md)
- [OpenYRWeb 引擎配置迁移：从 INI 到 JSON Schema 的实践指南](blog/games/openyrweb-config-migration-ini-json.md)
- [OpenYRWeb 加载繁体中文 MOD 显示简体界面的完整解决方案](blog/games/openyrweb-traditional-chinese-mod.md)
- [为什么报错不崩的问题最难修：PNG 建筑渲染崩溃链复盘](blog/games/openyrweb-png-building-crash-chain.md)
- [把红警引擎改成我的形状：OpenYRWeb 现代化改造全景](blog/games/openyrweb-modernization-overview.md)
- [mix/SHP/ini → PNG/WAV/JSON：老引擎的数据格式现代化](blog/games/openyrweb-data-format-modernization.md)
- [引擎改造的取舍：能玩才有动力，审美服务于手感](blog/games/openyrweb-modding-tradeoffs.md)
- [PNG tileset 替换地形图块：从 mix 里挖 meta.json 的真相](blog/games/openyrweb-png-tileset-terrain.md)
- [128 条 TTS 语音注入红警引擎：Qwen-TTS + Neil 音色批量合成](blog/games/openyrweb-tts-voice-batch.md)
- [中英双语 EVA 副官：让原版语音让位给自定义播报](blog/games/openyrweb-bilingual-eva-voice.md)
- [用 JSON Schema 锁死规则配置：事件枚举与 AI 幻觉防护](blog/games/openyrweb-json-schema-rules.md)

# Suno AI
- [红警 2 黄色警戒 主菜单音乐 Suno AI 风格提示词](blog/sunoai/yellow-alert-suno-style-prompt.md)

# 大陆网络技术
- [大陆机房 VPS 网络避坑指南：GitHub 被墙、云电脑安全组、HTTP 代理拦截与文件传输方案](blog/china-network/china-vps-network-pitfalls.md)
