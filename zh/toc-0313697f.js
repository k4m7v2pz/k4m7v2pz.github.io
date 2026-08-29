// Populate the sidebar
//
// This is a script, and not included directly in the page, to control the total size of the book.
// The TOC contains an entry for each page, so if each page includes a copy of the TOC,
// the total size of the page becomes O(n**2).
class MDBookSidebarScrollbox extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.innerHTML = '<ol class="chapter"><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="index.html">首页</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="about.html">关于</a></span></li><li class="chapter-item expanded "><li class="spacer"></li></li><li class="chapter-item expanded "><li class="part-title">操作系统</li></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/gnulinux/google-pinyin-installation-ubuntu-derivatives.html"><strong aria-hidden="true">1.</strong> 在 Ubuntu 衍生版上安装 Google 拼音</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/gnulinux/centos7-jumpbox-dd-debian12-vps.html"><strong aria-hidden="true">2.</strong> CentOS 7 跳板 DD 安装 Debian 12</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/gnulinux/archlinux-macos-keyboard-keyd-sway-wezterm.html"><strong aria-hidden="true">3.</strong> 在 Arch Linux 上模拟 macOS 键盘习惯</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/gnulinux/minimal-archlinux-install-guide.html"><strong aria-hidden="true">4.</strong> 纯字符极简 Arch Linux 装机指南</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/gnulinux/xfce-lightdm-package-list.html"><strong aria-hidden="true">5.</strong> XFCE 桌面环境 lightdm 包列表参考</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/gnulinux/thinkpad-e490-fan-control.html"><strong aria-hidden="true">6.</strong> ThinkPad E490 风扇温度自动控制实录：thinkfan 缺位，自写曲线脚本接管</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/embed-python-pip-installation-windows.html"><strong aria-hidden="true">7.</strong> 嵌入式 Python Windows 版 pip 安装</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/7zip-sfx-stub-selection.html"><strong aria-hidden="true">8.</strong> 7-Zip SFX 标准 Stub 选型</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/fix-7zip-sfx-runprogram-failure.html"><strong aria-hidden="true">9.</strong> 修复 RunProgram 失效</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/llm-deploy-silent-7zip-sfx.html"><strong aria-hidden="true">10.</strong> LLM 静默部署 EXE</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/set-zed-as-bat-editor.html"><strong aria-hidden="true">11.</strong> 设置 Zed 为 bat 编辑器</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/windows-terminal-overhaul.html"><strong aria-hidden="true">12.</strong> Windows 终端环境终极改造</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/windows-ltsb-winrm-remote-management.html"><strong aria-hidden="true">13.</strong> 受限网络下 Windows 10 LTSB 远程管理踩坑实录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/scoop-install-nushell-windows.html"><strong aria-hidden="true">14.</strong> Windows 下通过 Scoop 安装 Nushell</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/system-management-scripts.html"><strong aria-hidden="true">15.</strong> System Management 核心脚本存档</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/powershell-invoke-restmethod-ssl-tls.html"><strong aria-hidden="true">16.</strong> PowerShell Invoke-RestMethod SSL/TLS 安全通道错误排查</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/windows-vps-terminal-garbled.html"><strong aria-hidden="true">17.</strong> Windows VPS 终端显示全乱：三层独立问题叠加的排查与修复</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/operating-system/windows/ssh-windows-output-buffering.html"><strong aria-hidden="true">18.</strong> 修复 SSH 进 Windows 输出逐字累积：&#92;r 回车被当换行，winpty 与 Win10 1607 无 ConPTY</a></span></li><li class="chapter-item expanded "><li class="part-title">工具</li></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/nushell-atomcode-config-pitfalls.html"><strong aria-hidden="true">19.</strong> Nushell + AtomCode 配置踩坑记录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/macos-multivolume-zip-chinese-password.html"><strong aria-hidden="true">20.</strong> macOS 解压 40GB 分卷+中文密码固件镜像的五个深坑</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/csdn-writing-agent-content-review.html"><strong aria-hidden="true">21.</strong> CSDN 写作 Agent 内容审核实测：什么话题会被拒、怎么绕过</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/wezterm-nushell-cargo-not-found.html"><strong aria-hidden="true">22.</strong> WezTerm + Nushell + Cargo 找不到命令</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/csdn-writing-agent-input-limits.html"><strong aria-hidden="true">23.</strong> CSDN 写作 Agent 输入限制实测与分段策略</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/macos-nushell-config-path-pitfall.html"><strong aria-hidden="true">24.</strong> macOS 上 Nushell 自定义配置陷阱</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/nushell-ai-collaboration-pitfalls.html"><strong aria-hidden="true">25.</strong> NuShell 协作避坑实录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/powershell-to-nushell-migration.html"><strong aria-hidden="true">26.</strong> 从 PowerShell 到 Nushell 迁移指南</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/rvs-structured-shell-intro.html"><strong aria-hidden="true">27.</strong> rvs（rust-verb-shell）：面向人类和 AI Agent 的结构化 Shell</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/rvs-changelog-26.7.17-26.8.10.html"><strong aria-hidden="true">28.</strong> rvs（rust-verb-shell）更新全览 26.7.17~26.8.10</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/rvs-changelog-26.7.12-26.7.17.html"><strong aria-hidden="true">29.</strong> rvs（rust-verb-shell）更新全览 26.7.12~26.7.17</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/rvs-iteration-26.7.0-26.7.12.html"><strong aria-hidden="true">30.</strong> rvs（rust-verb-shell）迭代全览 26.7.0~26.7.12</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/wezterm-cjk-glyph-fix.html"><strong aria-hidden="true">31.</strong> WezTerm 终端 CJK 字形混乱排查与修复</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/tools/macos-kicad-ngspice-circuit-validation.html"><strong aria-hidden="true">32.</strong> macOS 电路设计自动校验工作流：KiCad CLI + ngspice + Python 从零搭建</a></span></li><li class="chapter-item expanded "><li class="part-title">编程开发</li></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/rust-bevy-0.13-to-0.14-upgrade-guide.html"><strong aria-hidden="true">33.</strong> Rust Bevy 0.13 到 0.14 升级踩坑指南</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/rk3326-dtb-panel-debug.html"><strong aria-hidden="true">34.</strong> RK3326 设备树面板调试：换内核后 LCD 背光亮但屏幕黑</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/xuantie-input-expression-bug.html"><strong aria-hidden="true">35.</strong> 玄铁 0.17.5 InputExpression 分支遗漏 Bug</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/bevy-0.14-cursor-pitfalls.html"><strong aria-hidden="true">36.</strong> Bevy 0.14 光标踩坑全记录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/bevy-0.14-fps-camera-pitfalls.html"><strong aria-hidden="true">37.</strong> Bevy 0.14 第一人称转视角踩坑全记</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/atomcode-spinner-thinking-labels.html"><strong aria-hidden="true">38.</strong> AtomCode 终端 Spinner 词表解析</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/atomcode-spinner-wordlist-errata.html"><strong aria-hidden="true">39.</strong> AtomCode 终端 Spinner 词表勘误：85% 是编的</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/atomcode-ascend-npu-free-tier.html"><strong aria-hidden="true">40.</strong> 从 AtomCode 续杯到昇腾容器</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/atomcode-writing-sop.html"><strong aria-hidden="true">41.</strong> AtomCode 项目 Agent 记忆化写作 SOP</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/atomcode-ctrl-o-evolution.html"><strong aria-hidden="true">42.</strong> AtomCode Ctrl+O 探秘：从工具输出到推理可见的演进史</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/atomcode-fmt-dur-controversy.html"><strong aria-hidden="true">43.</strong> AtomCode fmt_dur 争议溯源</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/ollama-lan-openai-api-mac.html"><strong aria-hidden="true">44.</strong> 16GB Mac 本地跑大模型：ollama 局域网 OpenAI 兼容 API 实战</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/bevy-0.14.2-sprite-not-rendering.html"><strong aria-hidden="true">45.</strong> Bevy 0.14.2 玩家精灵不渲染排查全记录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/bytebeat-moog-city-reconstruction.html"><strong aria-hidden="true">46.</strong> Bytebeat Moog City Reconstruction v3.2 技术解析与实现</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/rg-to-rr-r-prefix-cult.html"><strong aria-hidden="true">47.</strong> 从 rg 到 rr：CLI 工具的 r 前缀拜物教</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/bevy-0.14-black-window-camera2d.html"><strong aria-hidden="true">48.</strong> Bevy 0.14 窗口纯黑问题排查：Camera2d 只是标记组件，spawn Camera2d 不会创建相机</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/rust-cross-compile-mac-linux-windows.html"><strong aria-hidden="true">49.</strong> Rust 交叉编译实战：从 Mac 到 Linux / Windows（以 rvs 为例）</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/egui-cjk-rendering-fonttweak.html"><strong aria-hidden="true">50.</strong> egui 中文渲染整体偏高：FontTweak 基线对齐修复实录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/programming/crossterm-terminal-table-wrap.html"><strong aria-hidden="true">51.</strong> 修复终端表格折行：crossterm 返回缓冲区宽度而非窗口宽度（dwSize vs srWindow）</a></span></li><li class="chapter-item expanded "><li class="part-title">游戏</li></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/mighty-rodent-splash-black-screen-debug.html"><strong aria-hidden="true">52.</strong> Mighty Rodent Splash 黑屏踩坑记录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/r36s-emuelec-dual-card-separation.html"><strong aria-hidden="true">53.</strong> R36S 系统卡与游戏卡分离实战：EmuELEC 双卡方案</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/game-config-json-schema-ai-context.html"><strong aria-hidden="true">54.</strong> 给 AI Agent 看的游戏配置：JSON Schema 与 ai_context 注释层设计</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/archlinux-wine-i3wm-retro-game-env.html"><strong aria-hidden="true">55.</strong> Arch Linux + Wine + i3wm 搭建复古游戏环境</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/browser-windowed-game-resolution-cdp.html"><strong aria-hidden="true">56.</strong> 浏览器窗口化游戏分辨率适配：CDP 外层尺寸 vs 内容区尺寸</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/yellow-alert-chronodivide-mod-port.html"><strong aria-hidden="true">57.</strong> 黄色警戒 Mod 移植 ChronoDivide 踩坑记录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-ra2-bgm-and-ui-fixes.html"><strong aria-hidden="true">58.</strong> OpenYRWeb 移植红警 MOD 实战：BGM 挂载与 UI 越界修复</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-vfs-mix-locale-audio.html"><strong aria-hidden="true">59.</strong> OpenYRWeb 浏览器引擎内幕：VFS-mix 加载、locale 检测与音频链路</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-opfs-game-data-injection.html"><strong aria-hidden="true">60.</strong> 浏览器 OPFS 注入游戏数据方案</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/r36s-emuelec-game-migration.html"><strong aria-hidden="true">61.</strong> R36S 掌机游戏迁移实录：EmuELEC 双卡整理</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/r36s-tf-card-migration-rk3326.html"><strong aria-hidden="true">62.</strong> R36S 掌机系统迁移实战：无牌劣质 TF 卡无损搬到品牌卡</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/ra2-yr-csf-format-reverse.html"><strong aria-hidden="true">63.</strong> RA2/YR CSF 文件格式逆向解析</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/ra2-mod-bgm-thememd-csf.html"><strong aria-hidden="true">64.</strong> RA2 MOD 的 BGM 挂载与显示名翻译</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/ra2-mod-openyrweb-port-pitfalls.html"><strong aria-hidden="true">65.</strong> RA2 MOD 移植 OpenYRWeb 踩坑实录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/bevy-wgpu-r36s-screen.html"><strong aria-hidden="true">66.</strong> Bevy wgpu 在 R36S 掌机上屏收官</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/bevy-0.14-r36s-rendering.html"><strong aria-hidden="true">67.</strong> Bevy 0.14 在 R36S 上渲染全链路打通</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/bevy-0.14-port-to-r36s.html"><strong aria-hidden="true">68.</strong> 把 Bevy 0.14 游戏移植到 R36S 掌机</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-cursor-speed.html"><strong aria-hidden="true">69.</strong> OpenYRWeb 战场光标速度异常排查记录</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-config-migration-ini-json.html"><strong aria-hidden="true">70.</strong> OpenYRWeb 引擎配置迁移：从 INI 到 JSON Schema 的实践指南</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-traditional-chinese-mod.html"><strong aria-hidden="true">71.</strong> OpenYRWeb 加载繁体中文 MOD 显示简体界面的完整解决方案</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-png-building-crash-chain.html"><strong aria-hidden="true">72.</strong> 为什么报错不崩的问题最难修：PNG 建筑渲染崩溃链复盘</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-modernization-overview.html"><strong aria-hidden="true">73.</strong> 把红警引擎改成我的形状：OpenYRWeb 现代化改造全景</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-data-format-modernization.html"><strong aria-hidden="true">74.</strong> mix/SHP/ini → PNG/WAV/JSON：老引擎的数据格式现代化</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-modding-tradeoffs.html"><strong aria-hidden="true">75.</strong> 引擎改造的取舍：能玩才有动力，审美服务于手感</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-png-tileset-terrain.html"><strong aria-hidden="true">76.</strong> PNG tileset 替换地形图块：从 mix 里挖 meta.json 的真相</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-tts-voice-batch.html"><strong aria-hidden="true">77.</strong> 128 条 TTS 语音注入红警引擎：Qwen-TTS + Neil 音色批量合成</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-bilingual-eva-voice.html"><strong aria-hidden="true">78.</strong> 中英双语 EVA 副官：让原版语音让位给自定义播报</a></span></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/games/openyrweb-json-schema-rules.html"><strong aria-hidden="true">79.</strong> 用 JSON Schema 锁死规则配置：事件枚举与 AI 幻觉防护</a></span></li><li class="chapter-item expanded "><li class="part-title">Suno AI</li></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/sunoai/yellow-alert-suno-style-prompt.html"><strong aria-hidden="true">80.</strong> 红警 2 黄色警戒 主菜单音乐 Suno AI 风格提示词</a></span></li><li class="chapter-item expanded "><li class="part-title">大陆网络技术</li></li><li class="chapter-item expanded "><span class="chapter-link-wrapper"><a href="blog/china-network/china-vps-network-pitfalls.html"><strong aria-hidden="true">81.</strong> 大陆机房 VPS 网络避坑指南：GitHub 被墙、云电脑安全组、HTTP 代理拦截与文件传输方案</a></span></li></ol>';
        // Set the current, active page, and reveal it if it's hidden
        let current_page = document.location.href.toString().split('#')[0].split('?')[0];
        if (current_page.endsWith('/')) {
            current_page += 'index.html';
        }
        const links = Array.prototype.slice.call(this.querySelectorAll('a'));
        const l = links.length;
        for (let i = 0; i < l; ++i) {
            const link = links[i];
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#') && !/^(?:[a-z+]+:)?\/\//.test(href)) {
                link.href = path_to_root + href;
            }
            // The 'index' page is supposed to alias the first chapter in the book.
            // Check both with and without the '.html' suffix to be robust against pretty URLs
            if (link.href.replace(/\.html$/, '') === current_page.replace(/\.html$/, '')
                || i === 0
                && path_to_root === ''
                && current_page.endsWith('/index.html')) {
                link.classList.add('active');
                let parent = link.parentElement;
                while (parent) {
                    if (parent.tagName === 'LI' && parent.classList.contains('chapter-item')) {
                        parent.classList.add('expanded');
                    }
                    parent = parent.parentElement;
                }
            }
        }
        // Track and set sidebar scroll position
        this.addEventListener('click', e => {
            if (e.target.tagName === 'A') {
                const clientRect = e.target.getBoundingClientRect();
                const sidebarRect = this.getBoundingClientRect();
                sessionStorage.setItem('sidebar-scroll-offset', clientRect.top - sidebarRect.top);
            }
        }, { passive: true });
        const sidebarScrollOffset = sessionStorage.getItem('sidebar-scroll-offset');
        sessionStorage.removeItem('sidebar-scroll-offset');
        if (sidebarScrollOffset !== null) {
            // preserve sidebar scroll position when navigating via links within sidebar
            const activeSection = this.querySelector('.active');
            if (activeSection) {
                const clientRect = activeSection.getBoundingClientRect();
                const sidebarRect = this.getBoundingClientRect();
                const currentOffset = clientRect.top - sidebarRect.top;
                this.scrollTop += currentOffset - parseFloat(sidebarScrollOffset);
            }
        } else {
            // scroll sidebar to current active section when navigating via
            // 'next/previous chapter' buttons
            const activeSection = document.querySelector('#mdbook-sidebar .active');
            if (activeSection) {
                activeSection.scrollIntoView({ block: 'center' });
            }
        }
        // Toggle buttons
        const sidebarAnchorToggles = document.querySelectorAll('.chapter-fold-toggle');
        function toggleSection(ev) {
            ev.currentTarget.parentElement.parentElement.classList.toggle('expanded');
        }
        Array.from(sidebarAnchorToggles).forEach(el => {
            el.addEventListener('click', toggleSection);
        });
    }
}
window.customElements.define('mdbook-sidebar-scrollbox', MDBookSidebarScrollbox);


// ---------------------------------------------------------------------------
// Support for dynamically adding headers to the sidebar.

(function() {
    // This is used to detect which direction the page has scrolled since the
    // last scroll event.
    let lastKnownScrollPosition = 0;
    // This is the threshold in px from the top of the screen where it will
    // consider a header the "current" header when scrolling down.
    const defaultDownThreshold = 150;
    // Same as defaultDownThreshold, except when scrolling up.
    const defaultUpThreshold = 300;
    // The threshold is a virtual horizontal line on the screen where it
    // considers the "current" header to be above the line. The threshold is
    // modified dynamically to handle headers that are near the bottom of the
    // screen, and to slightly offset the behavior when scrolling up vs down.
    let threshold = defaultDownThreshold;
    // This is used to disable updates while scrolling. This is needed when
    // clicking the header in the sidebar, which triggers a scroll event. It
    // is somewhat finicky to detect when the scroll has finished, so this
    // uses a relatively dumb system of disabling scroll updates for a short
    // time after the click.
    let disableScroll = false;
    // Array of header elements on the page.
    let headers;
    // Array of li elements that are initially collapsed headers in the sidebar.
    // I'm not sure why eslint seems to have a false positive here.
    // eslint-disable-next-line prefer-const
    let headerToggles = [];
    // This is a debugging tool for the threshold which you can enable in the console.
    let thresholdDebug = false;

    // Updates the threshold based on the scroll position.
    function updateThreshold() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        // The number of pixels below the viewport, at most documentHeight.
        // This is used to push the threshold down to the bottom of the page
        // as the user scrolls towards the bottom.
        const pixelsBelow = Math.max(0, documentHeight - (scrollTop + windowHeight));
        // The number of pixels above the viewport, at least defaultDownThreshold.
        // Similar to pixelsBelow, this is used to push the threshold back towards
        // the top when reaching the top of the page.
        const pixelsAbove = Math.max(0, defaultDownThreshold - scrollTop);
        // How much the threshold should be offset once it gets close to the
        // bottom of the page.
        const bottomAdd = Math.max(0, windowHeight - pixelsBelow - defaultDownThreshold);
        let adjustedBottomAdd = bottomAdd;

        // Adjusts bottomAdd for a small document. The calculation above
        // assumes the document is at least twice the windowheight in size. If
        // it is less than that, then bottomAdd needs to be shrunk
        // proportional to the difference in size.
        if (documentHeight < windowHeight * 2) {
            const maxPixelsBelow = documentHeight - windowHeight;
            const t = 1 - pixelsBelow / Math.max(1, maxPixelsBelow);
            const clamp = Math.max(0, Math.min(1, t));
            adjustedBottomAdd *= clamp;
        }

        let scrollingDown = true;
        if (scrollTop < lastKnownScrollPosition) {
            scrollingDown = false;
        }

        if (scrollingDown) {
            // When scrolling down, move the threshold up towards the default
            // downwards threshold position. If near the bottom of the page,
            // adjustedBottomAdd will offset the threshold towards the bottom
            // of the page.
            const amountScrolledDown = scrollTop - lastKnownScrollPosition;
            const adjustedDefault = defaultDownThreshold + adjustedBottomAdd;
            threshold = Math.max(adjustedDefault, threshold - amountScrolledDown);
        } else {
            // When scrolling up, move the threshold down towards the default
            // upwards threshold position. If near the bottom of the page,
            // quickly transition the threshold back up where it normally
            // belongs.
            const amountScrolledUp = lastKnownScrollPosition - scrollTop;
            const adjustedDefault = defaultUpThreshold - pixelsAbove
                + Math.max(0, adjustedBottomAdd - defaultDownThreshold);
            threshold = Math.min(adjustedDefault, threshold + amountScrolledUp);
        }

        if (documentHeight <= windowHeight) {
            threshold = 0;
        }

        if (thresholdDebug) {
            const id = 'mdbook-threshold-debug-data';
            let data = document.getElementById(id);
            if (data === null) {
                data = document.createElement('div');
                data.id = id;
                data.style.cssText = `
                    position: fixed;
                    top: 50px;
                    right: 10px;
                    background-color: 0xeeeeee;
                    z-index: 9999;
                    pointer-events: none;
                `;
                document.body.appendChild(data);
            }
            data.innerHTML = `
                <table>
                  <tr><td>documentHeight</td><td>${documentHeight.toFixed(1)}</td></tr>
                  <tr><td>windowHeight</td><td>${windowHeight.toFixed(1)}</td></tr>
                  <tr><td>scrollTop</td><td>${scrollTop.toFixed(1)}</td></tr>
                  <tr><td>pixelsAbove</td><td>${pixelsAbove.toFixed(1)}</td></tr>
                  <tr><td>pixelsBelow</td><td>${pixelsBelow.toFixed(1)}</td></tr>
                  <tr><td>bottomAdd</td><td>${bottomAdd.toFixed(1)}</td></tr>
                  <tr><td>adjustedBottomAdd</td><td>${adjustedBottomAdd.toFixed(1)}</td></tr>
                  <tr><td>scrollingDown</td><td>${scrollingDown}</td></tr>
                  <tr><td>threshold</td><td>${threshold.toFixed(1)}</td></tr>
                </table>
            `;
            drawDebugLine();
        }

        lastKnownScrollPosition = scrollTop;
    }

    function drawDebugLine() {
        if (!document.body) {
            return;
        }
        const id = 'mdbook-threshold-debug-line';
        const existingLine = document.getElementById(id);
        if (existingLine) {
            existingLine.remove();
        }
        const line = document.createElement('div');
        line.id = id;
        line.style.cssText = `
            position: fixed;
            top: ${threshold}px;
            left: 0;
            width: 100vw;
            height: 2px;
            background-color: red;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(line);
    }

    function mdbookEnableThresholdDebug() {
        thresholdDebug = true;
        updateThreshold();
        drawDebugLine();
    }

    window.mdbookEnableThresholdDebug = mdbookEnableThresholdDebug;

    // Updates which headers in the sidebar should be expanded. If the current
    // header is inside a collapsed group, then it, and all its parents should
    // be expanded.
    function updateHeaderExpanded(currentA) {
        // Add expanded to all header-item li ancestors.
        let current = currentA.parentElement;
        while (current) {
            if (current.tagName === 'LI' && current.classList.contains('header-item')) {
                current.classList.add('expanded');
            }
            current = current.parentElement;
        }
    }

    // Updates which header is marked as the "current" header in the sidebar.
    // This is done with a virtual Y threshold, where headers at or below
    // that line will be considered the current one.
    function updateCurrentHeader() {
        if (!headers || !headers.length) {
            return;
        }

        // Reset the classes, which will be rebuilt below.
        const els = document.getElementsByClassName('current-header');
        for (const el of els) {
            el.classList.remove('current-header');
        }
        for (const toggle of headerToggles) {
            toggle.classList.remove('expanded');
        }

        // Find the last header that is above the threshold.
        let lastHeader = null;
        for (const header of headers) {
            const rect = header.getBoundingClientRect();
            if (rect.top <= threshold) {
                lastHeader = header;
            } else {
                break;
            }
        }
        if (lastHeader === null) {
            lastHeader = headers[0];
            const rect = lastHeader.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            if (rect.top >= windowHeight) {
                return;
            }
        }

        // Get the anchor in the summary.
        const href = '#' + lastHeader.id;
        const a = [...document.querySelectorAll('.header-in-summary')]
            .find(element => element.getAttribute('href') === href);
        if (!a) {
            return;
        }

        a.classList.add('current-header');

        updateHeaderExpanded(a);
    }

    // Updates which header is "current" based on the threshold line.
    function reloadCurrentHeader() {
        if (disableScroll) {
            return;
        }
        updateThreshold();
        updateCurrentHeader();
    }


    // When clicking on a header in the sidebar, this adjusts the threshold so
    // that it is located next to the header. This is so that header becomes
    // "current".
    function headerThresholdClick(event) {
        // See disableScroll description why this is done.
        disableScroll = true;
        setTimeout(() => {
            disableScroll = false;
        }, 100);
        // requestAnimationFrame is used to delay the update of the "current"
        // header until after the scroll is done, and the header is in the new
        // position.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Closest is needed because if it has child elements like <code>.
                const a = event.target.closest('a');
                const href = a.getAttribute('href');
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    threshold = targetElement.getBoundingClientRect().bottom;
                    updateCurrentHeader();
                }
            });
        });
    }

    // Takes the nodes from the given head and copies them over to the
    // destination, along with some filtering.
    function filterHeader(source, dest) {
        const clone = source.cloneNode(true);
        clone.querySelectorAll('mark').forEach(mark => {
            mark.replaceWith(...mark.childNodes);
        });
        dest.append(...clone.childNodes);
    }

    // Scans page for headers and adds them to the sidebar.
    document.addEventListener('DOMContentLoaded', function() {
        const activeSection = document.querySelector('#mdbook-sidebar .active');
        if (activeSection === null) {
            return;
        }

        const main = document.getElementsByTagName('main')[0];
        headers = Array.from(main.querySelectorAll('h2, h3, h4, h5, h6'))
            .filter(h => h.id !== '' && h.children.length && h.children[0].tagName === 'A');

        if (headers.length === 0) {
            return;
        }

        // Build a tree of headers in the sidebar.

        const stack = [];

        const firstLevel = parseInt(headers[0].tagName.charAt(1));
        for (let i = 1; i < firstLevel; i++) {
            const ol = document.createElement('ol');
            ol.classList.add('section');
            if (stack.length > 0) {
                stack[stack.length - 1].ol.appendChild(ol);
            }
            stack.push({level: i + 1, ol: ol});
        }

        // The level where it will start folding deeply nested headers.
        const foldLevel = 3;

        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const level = parseInt(header.tagName.charAt(1));

            const currentLevel = stack[stack.length - 1].level;
            if (level > currentLevel) {
                // Begin nesting to this level.
                for (let nextLevel = currentLevel + 1; nextLevel <= level; nextLevel++) {
                    const ol = document.createElement('ol');
                    ol.classList.add('section');
                    const last = stack[stack.length - 1];
                    const lastChild = last.ol.lastChild;
                    // Handle the case where jumping more than one nesting
                    // level, which doesn't have a list item to place this new
                    // list inside of.
                    if (lastChild) {
                        lastChild.appendChild(ol);
                    } else {
                        last.ol.appendChild(ol);
                    }
                    stack.push({level: nextLevel, ol: ol});
                }
            } else if (level < currentLevel) {
                while (stack.length > 1 && stack[stack.length - 1].level > level) {
                    stack.pop();
                }
            }

            const li = document.createElement('li');
            li.classList.add('header-item');
            li.classList.add('expanded');
            if (level < foldLevel) {
                li.classList.add('expanded');
            }
            const span = document.createElement('span');
            span.classList.add('chapter-link-wrapper');
            const a = document.createElement('a');
            span.appendChild(a);
            a.href = '#' + header.id;
            a.classList.add('header-in-summary');
            filterHeader(header.children[0], a);
            a.addEventListener('click', headerThresholdClick);
            const nextHeader = headers[i + 1];
            if (nextHeader !== undefined) {
                const nextLevel = parseInt(nextHeader.tagName.charAt(1));
                if (nextLevel > level && level >= foldLevel) {
                    const toggle = document.createElement('a');
                    toggle.classList.add('chapter-fold-toggle');
                    toggle.classList.add('header-toggle');
                    toggle.addEventListener('click', () => {
                        li.classList.toggle('expanded');
                    });
                    const toggleDiv = document.createElement('div');
                    toggleDiv.textContent = '❱';
                    toggle.appendChild(toggleDiv);
                    span.appendChild(toggle);
                    headerToggles.push(li);
                }
            }
            li.appendChild(span);

            const currentParent = stack[stack.length - 1];
            currentParent.ol.appendChild(li);
        }

        const onThisPage = document.createElement('div');
        onThisPage.classList.add('on-this-page');
        onThisPage.append(stack[0].ol);
        const activeItemSpan = activeSection.parentElement;
        activeItemSpan.after(onThisPage);
    });

    document.addEventListener('DOMContentLoaded', reloadCurrentHeader);
    document.addEventListener('scroll', reloadCurrentHeader, { passive: true });
})();

