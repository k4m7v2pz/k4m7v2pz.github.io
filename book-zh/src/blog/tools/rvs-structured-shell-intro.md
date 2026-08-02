# rvs（rust-verb-shell）：面向人类和 AI Agent 的结构化 Shell

> 日期：2026-08-02

### 项目地址

开源仓库：[rust-verb-shell:基于Rust的verb-noun风格Shell项目 - AtomGit](https://atomgit.com/k4m7v2pz/rust-verb-shell)


采用 MulanPSL-2.0 许可证，欢迎 Fork、Issue、PR。后续教程中所有命令均以此仓库的最新 dev 分支为准。



### 设计理念

rvs 的定位是「结构化、沙盒优先的 Shell」——既给人用，也给 AI 用。



#### verb-noun 命名

命令名采用全小写 kebab-case，格式为 verb-noun、verb-noun-noun2……遵循 verb-noun 语义命名规范。


**正确写法（rvs native）：**



```get-child-item
get-child-item -recurse
set-location /tmp
get-content README.md
new-item -item-type directory -name demo
remove-item demo -recurse
get-system-info
get-network-interface
get-file-hash```bash


参数同样全小写 kebab-case（-recurse、-item-type、-force）。同时保留 POSIX 常用别名作为肌肉记忆桥接：ls / cd / pwd / cat / mkdir / rm / echo / clear，输入别名时 rvs 会提示 💡 对应的完整命令名。



#### 沙盒安全

通过 --sandbox 参数启动沙盒模式，将所有文件系统操作限制在指定目录内：



```rvs --sandbox /tmp/sandbox```bash


沙盒模式下拒绝执行外部二进制，防止绕过路径检查。不带 --sandbox 时默认完全文件系统访问。



#### 结构化输出

人类交互默认输出可读表格；AI 或脚本调用时加 --json 参数，只输出合法 JSON，零噪声：



```rvs --json get-child-item```bash



#### AI 友好

所有输出避免字符画、Logo 等 AI 难以解析的内容。命令名采用 verb-noun 语义命名，让 AI 能通过名称推断用途（get-child-item 就是列出子项，set-location 就是切换目录）。



### 版本号：CalVer YY.M.P

rvs 从 26.7.0 起采用日历版本号（CalVer），格式为 **YY.M.P**：



| 段 | 含义 | 范围 |
|---|---|---|
| YY | 年份后两位 | 26、27…… |
| M | 月份 | 1–12，不加前导零，不会出现 0.10 |
| P | 本月第几次发布 | 0 起递增，跨月重置为 0 |


当前最新版本：**v26.7.0**（2026 年 7 月首次发布）。低心智负担，看一眼版本号就知道是什么时候发布的。跨月自然进位，月份永远两位数以内。



### 人类用法速查（面向开发者）


#### 安装与启动

编译（需要 Rust 工具链）：



```git clone https://atomgit.com/k4m7v2pz/rust-verb-shell.git
cd rust-verb-shell
cargo build --release
./target/release/rvs
# 或直接 cargo run
cargo run -- rvs```bash


进入 REPL 交互模式后，直接输入命令即可：



```2026-07-25 20:30:00 UTC+08:00 user@host:/home/user  [linux/x86_64]
rvs — rust-verb-shell (v26.7.0)  user@host: demo@my-pc  cwd: /home/user
no sandbox (full FS access).  use --sandbox  to restrict.
commands use Verb-Noun style (get-child-item, set-location, ...).
aliases: ls / cd / pwd / cat / mkdir / rm / echo / clear; 'exit' to quit.
>```bash



#### 常用命令速查


| 你要做什么 | rvs 命令 | 别名 | 说明 |
|---|---|---|---|
| 列目录 | `get-child-item` | ls, dir | 加 -recurse 递归 |
| 切换目录 | `set-location` | cd | — |
| 显示路径 | `get-location` | pwd | — |
| 读文件 | `get-content` | cat, type | — |
| 创建目录 | `new-item -item-type directory -name mydir` | mkdir | — |
| 创建文件 | `new-item -item-type file -name test.rs` | touch, ni | — |
| 删除 | `remove-item path -recurse` | rm | 目录加 -recurse |
| 写文件 | `set-content path -value "内容"` | sc | 覆盖写入 |
| 追加文件 | `add-content path -value "内容"` | ac | — |
| 回显 | `write-output "hello"` | echo | — |
| 清屏 | `clear-host` | clear, cls | — |
| 查帮助 | `get-help get-child-item` | help, man | — |
| 看进程 | `get-process` | ps | — |
| 看历史 | `get-history` | history, h | — |
| 退出 | `exit` | quit | — |



#### 管道与过滤

rvs 内建管道，支持按条件过滤、排序、选择列：



```get-child-item -recurse | where-object "size > 1024" | sort-object -descending size | select-object -first 5```bash


等价于 POSIX 的 `find . -size +1k | sort -rn | head -5`。



#### 切换传统 Shell

不熟悉 rvs 语法？或临时需要 POSIX 管道？一行命令切换到 bash/zsh/nu：



```enter-shell bash
# 现在在 bash 里，exit 回到 rvs
exit```bash


sshd 环境下也一样工作：`rvs -c 'enter-shell bash -c "ls | grep foo"'`。


td>0 起递增，跨月重置为 0


当前最新版本：**v26.7.0**（2026 年 7 月首次发布）。低心智负担，看一眼版本号就知道是什么时候发布的。跨月自然进位，月份永远两位数以内。



### AI / Agent 速查


#### 对话式 AI（ChatGPT / 腾讯元宝 / 豆包等）

当用户问「帮我列出当前目录文件」或「读取那个配置文件」时，对话 AI 应该生成 rvs 语法：


**命令模板：**



```# 列目录
get-child-item [path] [-recurse]
读文件
get-content
切换目录
set-location
创建目录
new-item -item-type directory -name
查看进程
get-process [name]
管道过滤
get-child-item -recurse | where-object "size > 1024"```bash


**不要**输出 PowerShell 的 PascalCase（`Get-ChildItem`），rvs 所有命令和参数都是全小写 kebab-case。如果用户传入的指令是 POSIX 风格的管道（如 `ls | grep foo`），提示用 `enter-shell bash` 切换到 bash 后再执行。



#### 代码 Agent（VSCode Copilot / Trae IDE / AtomCode 等）

Agent 调用 rvs 时应走 `--json` 模式，输出是合法 JSON，无需额外解析：



```# 单个命令
rvs --json get-child-item /tmp
输出示例（简化）
{"ok":true,"command":"get-child-item","args":["/tmp"],"output":["file1.txt","file2.rs"],"exit_code":0}```bash


**标准调用流程：**



```rvs --json -c ''
# 或管道喂多行
echo -e "get-location\nget-child-item" | rvs --json```bash


**常用调试命令：**



```# 检查路径是否存在
rvs --json test-path /some/file
获取系统信息
rvs --json get-system-info
获取文件信息
rvs --json get-item /path
列出所有可用命令
rvs --json get-command```bash


**沙盒模式调用（处理不可信输入时）：**



```rvs --sandbox /tmp/safe-box --json get-child-item```bash



#### 一句话总结

rvs = 全小写 Verb-Noun 命令 + 可选沙盒 + 人类表格输出 + AI 的 `--json` 模式。项目在 [rust-verb-shell:基于 Rust 的 PowerShell 风格 Shell 项目 - AtomGit](https://atomgit.com/k4m7v2pz/rust-verb-shell)，版本号 CalVer `YY.M.P`，当前 `v26.7.0`。
