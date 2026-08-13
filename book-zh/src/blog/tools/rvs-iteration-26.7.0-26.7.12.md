# rvs（rust-verb-shell）迭代全览 26.7.0~26.7.12

> 日期：2026-07-12

本文讲的是 rvs 从 v26.7.0 到 v26.7.12 这一路迭代更新了什么。所有命令以最新 dev 分支为准。

## 一、先说设计哲学的两处修正

### 1. 从 PowerShell 的 New-Item 思路里跳出来

最初 rvs 抄了 PowerShell 的 `New-Item`，用一个命令、一个 `--type` 参数同时创建文件和目录。听起来很统一，实际很坑：

```bash
new-item --path foo              # 默认 --type file，创建文件 foo
new-item --path bar --type dir   # 创建目录 bar
```

问题在于 `mkdir` 这个别名也指向 `new-item`，而 `new-item` 默认 `--type file`。于是 `mkdir demo` 实际创建了一个名为 `demo` 的**文件**，不是目录。这是个会让人骂街的静默错误。

新版把 `new-item` 拆开，语义各自明确：

| 命令 | 别名 | 说明 |
|---|---|---|
| `new-directory` | `mkdir` | 只创建目录，`--parents`（默认 true）控制递归 |
| `new-file` | `touch` / `ni` | 只创建文件，`--value` 提供初始内容 |

```bash
new-directory --path demo           # 创建目录 demo
mkdir demo                          # 别名，等价
new-file --path test.rs             # 创建空文件
touch test.rs --value "fn main(){}" # 创建带初始内容的文件
```

这个拆分还为未来留了位置：`new-softlink`、`new-hardlink` 都可以按同样模式加进来，不需要在 `--type` 上继续叠条件。

### 2. 用户可见文本里的 Verb-Noun 全部改成 verb-noun

旧版 banner 里写的是「commands use Verb-Noun style」，跟 rvs 自己「全小写 kebab-case」的设计原则自相矛盾——既然命令名是 `get-child-item` 这种全小写形式，那提示语里就不该出现 PascalCase 的 `Verb-Noun`。

新版统一成小写：

```
rvs — rust-verb-shell (v26.7.12)
no sandbox (full FS access).  use --sandbox  to restrict.
commands use verb-noun style (get-child-item, set-location, ...).
aliases: ls / cd / pwd / cat / mkdir / rm / echo / clear; 'exit' to quit.
```

这是个小事，但它涉及一个判断：文档里举的例子要和工具实际接受的输入完全一致，否则 AI 和人类都会被带偏。

## 二、借鉴 ripgrep：search-content 重写

rvs 早期的 `search-content`（别名 `sc` / `grep`）是最小可用版：自写 `collect_files` 递归遍历，硬编码跳过 `.git` / `target` / `node_modules`，单线程搜。这版能跑，但有两个问题：

- 噪音目录硬编码，换个项目就失效
- 不读 `.gitignore`，搜一次能把 `target/debug/` 里几百 MB 的编译产物全扫一遍

新版直接换成 ripgrep 同款的 `ignore` crate 做目录遍历，再上 `rayon` 多文件并行。ripgrep 的"四重默认过滤"全都到位：

- 尊重 `.gitignore` / `.ignore` / `.git/info/exclude` / 全局 gitignore
- 默认跳过隐藏文件（`.` 开头）
- 默认跳过二进制文件（启发式 NUL 字节检测）
- 不跟随符号链接

### 渐进关闭过滤（rg -u / -uu / -uuu）

ripgrep 用户熟悉 `-u` 叠加：`-u` 关 ignore，`-uu` 再加 hidden，`-uuu` 等同 `grep -r`。rvs 参数解析层不支持 `-u` 叠加，所以用显式 switch 对应：

| rg 写法 | rvs 写法 | 语义 |
|---|---|---|
| `rg pat` | `sc --pattern pat` | 默认四重过滤 |
| `rg -u pat` | `sc --pattern pat --no-ignore` | 关 .gitignore |
| `rg -uu pat` | `sc --pattern pat --no-ignore --hidden` | 再加隐藏文件 |
| `rg -uuu pat` | `sc --pattern pat --no-ignore --hidden --binary` | 再加二进制 |

`-u` 是 `--no-ignore` 的短别名，方便记忆。

## 三、上下文行与多文件并行

### 上下文行（--context N / --before N / --after N）

Agent 搜到一个匹配，通常要看上下文才能判断"这是不是我要找的"。新版加了上下文行，输出 Table 里多 `Before` 和 `After` 字段：

```bash
sc --pattern "pub struct" --path crates --include *.rs --context 1
```

`--context N` 同时给前后 N 行；`--before N` / `--after N` 单独控制。

### 多文件并行

`rayon` 的 `par_iter` 让多个文件并行搜索。`--max-results` 用 `AtomicUsize` 跨线程计数，超过上限就提前停。单文件搜索不并行，避免小文件场景的线程开销。

## 四、get-version：rvs 自身可观测性

这个命令的背景是一次排错：源码和 locale 都改了，但 wezterm 新开的标签页还是显示旧 banner。绕了好几条命令才定位到——**旧二进制没重编**，而 rvs 自己没有任何机制让 Agent 一眼看清"现在跑的是哪个二进制"。

新版加了 `get-version`（别名 `ver` / `version`），通过编译时 `build.rs` 注入的信息回答这个问题：

```bash
rvs --json -c 'get-version'
```

输出（简化）：

```json
{
  "Version": "26.7.12",
  "BuildTime": "2026-07-25T14:56:08Z",
  "GitCommit": "11e70c4",
  "GitDirty": "dirty",
  "BuildHost": "macos aarch64",
  "Profile": "debug"
}
```

排错决策树因此变得很短：

1. 跑 `get-version` 看 `BuildTime`
2. 对比源码 mtime
3. 源码新于 BuildTime → 跑的是旧二进制，需要 `cargo build`

`GitDirty` 字段额外告诉你当前二进制是从一个有未提交改动的工作区编出来的，Agent 据此能判断"这个二进制能不能信任"。

## 五、get-child-item --llm：尊重 .gitignore，喂对话式 LLM

一个常见场景：你在 wezterm 里想问 ChatGPT/Claude/元宝"这个项目大概是个啥"，最自然的做法是把当前目录的文件列表 copy 进对话框。但 `ls` 的输出又长又乱——表格边框、`target/`、`node_modules/`、隐藏文件全混在一起，贴进去几百行，LLM 还要从噪音里捞信号。

新版加了 `--llm` 模式（`get-child-item --llm`，别名 `ls --llm`）专门解决这个：

```bash
rvs -c 'get-child-item --llm --path crates/rvs-commands'
```

输出：

```
[F] Cargo.toml
[F] build.rs
[D] src/
[F] src/lib.rs
```

`[D]` 是目录、`[F]` 是文件，路径相对，每行一个条目，无表格边框。底层用 `ignore::WalkBuilder`，默认尊重 `.gitignore`，跳过 `target/` / `node_modules/` 等噪音目录。

工作流变成：`ls --llm` → 全选复制 → 粘到对话框。LLM 拿到的是干净的项目结构视图。

## 六、wezterm-rvs.sh：编译期间的双语进度提示

这是 wezterm 用户的体验改进。旧版的启动包装脚本只在"二进制不存在"时编译，于是出现了上面提到的 silent stale 问题——源码改了，但新开的标签页还是跑旧二进制。

新版策略：

1. 每次启动跑 `cargo build --dry-run` 检测是否需要重编
2. 需要时先打印双语进度提示到 stdout（wezterm 直接可见，避免黑屏假死）：
   ```
   rvs: source changed, rebuilding binary before launch…
   rvs：检测到代码更改，正在编译以获取最新二进制…
   ```
3. 编译完成后打印"启动中"
4. 编译失败打印 `[ERR]` + stderr 并退出

`cargo build --dry-run` 本身很快（<0.5s），无变更时直接跳过；有变更时先提示再编译，让人类和 Agent 都知道发生了什么。

## 七、面向三类读者的速查

### 人类开发者（wezterm / 终端）

| 你要做什么 | rvs 命令 | 别名 |
|---|---|---|
| 列目录 | `get-child-item` | `ls` |
| 列目录（喂 LLM 用） | `get-child-item --llm` | `ls --llm` |
| 创建目录 | `new-directory --path demo` | `mkdir demo` |
| 创建文件 | `new-file --path test.rs` | `touch test.rs` |
| 搜代码（ripgrep 风格） | `search-content --pattern foo` | `sc --pattern foo` / `grep foo` |
| 搜代码带上下文 | `sc --pattern foo --context 3` | — |
| 关 ignore 搜 | `sc --pattern foo --no-ignore` | `sc -u foo` |
| 看 rvs 自身版本 | `get-version` | `ver` / `version` |
| 切到 bash | `enter-shell bash` | — |

### 对话式 AI（ChatGPT / 腾讯元宝 / 豆包等）

当用户描述一个文件操作意图时，对话 AI 应该生成 rvs 全小写 verb-noun 命令，不要生成 PowerShell 的 PascalCase（`Get-ChildItem`），也不要生成 POSIX（`ls`）——后者只是别名，rvs native 形式才是 `get-child-item`。

命令模板（v26.7.12+）：

```bash
# 列目录
get-child-item [path] [-recurse]

# 列目录并尊重 .gitignore（喂给对话式 LLM 用）
get-child-item --llm [path]

# 读文件
get-content <path>

# 创建目录 / 文件（注意：new-item 已拆分）
new-directory --path <path>
new-file --path <path>

# 搜代码（ripgrep 风格）
search-content --pattern <pat> [--path <path>] [--regex] [--include *.rs]
              [--no-ignore] [--hidden] [--binary]
              [--context N] [--before N] [--after N]

# 看 rvs 自身版本（排错第一动作）
get-version
```

如果用户传入的指令是 POSIX 风格的管道（如 `ls | grep foo`），提示用 `enter-shell bash` 切换到 bash 后再执行，或用 rvs native 的 `get-child-item | where-object "..."`。

### 代码 Agent（VSCode Copilot / Trae IDE / AtomCode 等）

Agent 调用 rvs 时应走 `--json` 模式，输出是合法 JSON，无需额外解析：

```bash
# 单个命令
rvs --json -c 'get-child-item --llm'

# 管道喂多行
echo -e "get-location\nget-version" | rvs --json
```

rvs 行为异常时的第一动作：

1. 跑 `rvs --json -c 'get-version'` 看 `BuildTime` / `GitCommit` / `Profile`
2. 对比源码 mtime：
   - 源码新于 `BuildTime` → 跑的是旧二进制，需要 `cargo build`
   - `BuildTime` ≥ 源码 mtime → 二进制是最新的，问题在别处

字符串检索（grep 替代品）：Agent 在 rvs 里想搜代码时，不要 `enter-shell bash` 跳出去用 grep。用 rvs 原生 `search-content`（别名 `sc` / `grep`）。沙盒内可用，`--json` 输出 Table `{Path, Line, Content, Before?, After?}`，Agent 直接消费。

## 八、一句话总结

rvs v26.7.12 = 借鉴 ripgrep 的搜索（ignore + rayon + `-u` 渐进 + `--context`）+ 自身可观测（`get-version` 注入 BuildTime/GitCommit/BuildHost/Profile）+ `--llm` 输出尊重 `.gitignore` 喂对话式 LLM + `new-item` 拆成 `new-directory` / `new-file` 修 `mkdir` 创建文件的 bug。项目在 [atomgit.com/k4m7v2pz/rust-verb-shell](https://atomgit.com/k4m7v2pz/rust-verb-shell)，版本号 CalVer YY.M.P，当前 v26.7.12。

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/tools/rvs-iteration-26.7.0-26.7.12.html
