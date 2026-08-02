# rvs（rust-verb-shell）更新全览 26.7.17~26.8.10

> 日期：2026-08-02

### 一、核心能力新增

#### 1. .rvs 脚本支持控制流（26.7.20）

此前 rvs 脚本是线性逐行执行。本轮引入 AST 解析器 + 执行器（crates/rvs-repl 的 parser.rs / executor.rs），脚本支持 for / if / while / block 四种控制流，带链式变量作用域（进入 for/block 压一层、退出弹一层）。

这对批量运维脚本是质的提升——原来要拆成多条命令手动拼，现在可以写循环遍历、按条件分支。

#### 2. 本机代理端口自动报告（26.8.9 / 26.8.10）

针对「agent 远程操作时需要知道本机有代理」的痛点：

- 新增 `~/.config/rvs/proxy.json` 声明文件，rvs 用 netstat 实测端口监听状态，只报告「声明过且当前在监听」的端口。
- 结果进两处：

- 人类 REPL 的 banner 显示「代理: 127.0.0.1:7890 (http/socks) [lan]」；
- `--json` 输出的 `session.proxy` 字段每次响应自动携带，agent 无需手动喂话。
- 26.8.10 把 host 升级为 hosts 地址数组，支持 IPv4 / IPv6 / mDNS / hosts 域名，IPv6 自动加方括号，旧单值 host 格式兼容。

### 二、表格输出大改（ls 可读性重做）

26.7.18-19 集中重做了列表表格的「Human 大小列」，目标是紧凑、可扫描、无小数：

- **列对齐**：Human/Bytes/Size 右对齐，数字与单位分列对齐。
- **紧凑格式**：无小数、无多余空格，从 1KiB 起步（<1KiB 显示空，避免噪声）。
- **二进制台阶取整**：就近取整到 1/2/4/8/16/32/64/128/256/512 台阶，如 1.03KiB 显示为「> 1KiB」。
- **方向标记**：历经 +/- → ⬆️/⬇️ emoji → ↑/↓ → 最终定型为 > / < 前缀（如「> 1KiB」「< 32KiB」），紧凑且无 emoji 依赖。
- **单位扩展**：到 EiB/ZiB/YiB（2^80），大文件也显示得下。
- **颜色**：只给 Human 列的方向符着色（默认中国红↑绿↓），可通过 `~/.config/rvs/colors.json` 自定义颜色方案。

此外：

- ls 表格列布局调整（Path 在前、IsDir 用 Y/N、去掉重复 Name 列）。
- 表头 i18n 化（中文表头「是否为目录」不再被列宽截断）。
- 命令名统一 verb-noun（Get-ChildItem 等废弃 PowerShell 名仅作别名）。

### 三、交互与工程改进

- **非交互模式 stdout 纯净透传**：ssh 传参 / 管道 / 重定向时，元信息走 stderr，stdout 只透传命令输出，修复 scp/sftp/tar-pipe 二进制流被 rvs 包装输出污染的问题。
- **物理 tty 降级**：TERM=linux 物理终端自动降级为英文 + ASCII 符号（💡→* 等），避免乱码。
- **banner 显示网卡 IP**：启动 banner 列出非回环网卡与 IP（en0=192.168.1.5/24），配代理行一起给 agent 局域网寻址依据。
- **单引号字面量**：exec/ssh 远程命令支持单引号全字面（不展开 $ 变量），与双引号（可拼 && ||）互补。
- **小改进**：`clear-host` 别名（claer 拼写容错）、ssh 别名兑现、POSIX 重定向检测与 ~ 展开。

### 四、跨机器部署与三类读者速查

#### 部署

rvs 已部署到 <lan-host> / 局域网打印机 / Ubuntu VPS / 远程 Windows 四台机器，并全部把默认 shell 切换为 rvs（Linux 用 usermod + /etc/shells，Windows 用 OpenSSH DefaultShell 注册表）。跨机器统一 verb-noun 语法 + `--json` 输出，不再有 shell 方言差异。

#### 人类开发者

- REPL 里 `ls`、`cd`、`cat` 等 POSIX 肌肉记忆别名照常用；
- `show-version` 一眼看版本；
- `list-items --chat-llm` 输出给对话式 AI 的纯文本清单；
- `enter-shell bash` 临时回 POSIX。

#### 对话式 AI（ChatGPT/元宝/豆包）

- 粘贴 `list-items --llm` 的输出即可获得项目结构视图；
- rvs 输出表格/纯文本都是给 LLM 直接消费的，无需二次转述。

#### 代码 Agent

- `rvs --json -c ''` 拿结构化输出；
- `session.proxy` 字段自动报告本机代理（如 Mac 7890 http/socks、支持局域网），agent 据此让远端走 `http://<局域网IP>:7890` 联网；
- `exec  ""` 跨机器执行；
- `search-content` 替代 grep。
