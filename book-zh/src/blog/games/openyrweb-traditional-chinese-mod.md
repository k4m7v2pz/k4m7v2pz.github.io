# OpenYRWeb 加载繁体中文 MOD 显示简体界面的完整解决方案

> 日期：2026-08-05

### 1. 问题背景

在 OpenYRWeb（红警2 / 尤里的复仇 浏览器移植引擎）项目中，加载繁体中文 MOD（如「黄色警戒」）时，整个游戏界面（包括启动画面、主菜单、遭遇战选项、游戏内文本）均显示为繁体中文。而项目本身已内置简体中文国际化文件（`res/locale/zh-CN.json`），但界面语言并未按预期切换为简体。

环境信息：

- 项目：OpenYRWeb 0.1.0
- 浏览器：Chrome 149
- 运行方式：本地 `node server/index.mjs 8081`
- MOD 数据：通过浏览器 OPFS（持久 profile）注入

期望目标：将游戏界面语言统一切换为简体中文。

### 2. 常见误区与真相

在解决此问题前，需要先澄清几个常见的认知误区，这些误区往往导致解决方案无效或治标不治本。

#### 2.1 误区一：修改引擎 locale json 即可

**错误认知：** 认为只需修改或确保 `res/locale/zh-CN.json` 文件内容正确，就能将整个游戏界面切换为简体。

**真相：** `zh-CN.json` 等 locale 文件仅控制 **引擎本身的 UI 文本**，例如按钮标签、弹窗提示、加载进度文案等。而游戏内的任务简报、单位名称、建筑描述等核心文本，来源于 MOD 自带的 CSF（Command & Conquer String File）翻译表文件。这两套文本系统完全独立，修改 locale 文件无法影响 CSF 中的内容。

#### 2.2 误区二：CSF 是二进制文件，无法修改

**错误认知：** 认为 CSF 文件是封闭的二进制格式，普通开发者无法解析和修改。

**真相：** CSF 文件具有公开的文档化结构，社区已有成熟的工具（如 XCC Mixer、Phobos 等）可以生成和编辑。其存储的字符串值采用「每字节按位取反」的简单加密方式存储，完全可以被解析、转换和重建。

#### 2.3 误区三：修改 CSF 文件头的语言字段即可切换简繁

**错误认知：** 认为 CSF 文件头中有一个明确的"语言"字段，将其从代表繁体的值改为代表简体的值，引擎就会自动切换语言。

**真相：** 引擎在读取 CSF 时，会忽略文件头中语言字段为 0 或 9 的情况。真正的语言检测机制在于 `autoDetectLocale()` 函数。该函数会精确匹配 CSF 中特定键（如 `THEME:Intro`）对应的字符串值：

- 若值为「開場」，则判定为 zh-TW（繁体中文）。
- 若值为「开场」，则判定为 zh-CN（简体中文）。

如果值不匹配任何已知模式，引擎将维持 `defaultLanguage`（通常是英语）。因此，**修改 `THEME:Intro` 等关键字符串的值，才是切换界面语言的真正开关**。

#### 2.4 源码验证：语言检测链与 CSF 格式详解

通过分析 OpenYRWeb 源码（`src/` 目录）和实际测试，可以更精确地理解语言检测机制和 CSF 文件格式：

##### 语言检测链

1. **引擎 UI 语言：** 由 `config.json` 中的 `General.defaultLanguage` 决定，控制引擎本身的界面语言。
2. **游戏文本语言：** 引擎初始化后，通过 `new CsfFile(vfs.openFile("ra2.csf"))` 读取游戏翻译表。
3. **语言映射：** `getIsoLocale()` 函数根据 CSF 文件头中的 `language` 字段进行映射：
   - 0 → en-US
   - 100 → zh-CN
   - 101 → zh-TW
   - 9 → Unknown（此时会调用 `autoDetectLocale()`）
4. **自动检测：** `autoDetectLocale()` 函数仅检查一个关键键值：
   ```javascript
   switch (this.data["THEME:Intro"]) {
     case "開場": return ChineseTW;
     case "开场": return ChineseCN;
     default: return English; // 或其他默认语言
   }
   ```
   该函数进行精确匹配，其他值一律不会触发语言切换。

##### CSF 二进制格式（基于 XCC 工具生成，实测解析）

##### OpenCC t2s 转换实测数据

此验证进一步证实了 **修改 `THEME:Intro` 等关键字符串的值是切换语言的必要条件**，同时揭示了 CSF 文件格式的细节，为编写精确的转换工具提供了依据。

- **文件头（24 字节）：**
  - 魔数：`" FSC"`（十六进制 0x20 46 53 43，XCC 工具生成；西木原版为 `"CSF "`）
  - 版本号
  - numLabels（标签数量）
  - 2 个未使用的字段
  - language（第 6 个 u32 整数）
- **标签结构：**
  - 标签头：`' LBL'` + flags + nameLen + name（ASCII 字符串）
  - 当 flags & 1 时，跟随值结构：
    - vmagic：`' RTS'` 或 `'WRTS'`
    - charCount（字符数）
    - 值数据
- **值存储与加密：**
  - 字符串以 UTF-16LE 编码存储。
  - 每个字节在存储前会进行按位取反（~）操作。
  - 解密公式：`chr(((~hi & 0xff) << 8) | (~lo & 0xff))`（针对每个 UTF-16 字符）。
- **WRTS 额外数据：** 如果 vmagic 是 `'WRTS'`，后面会跟随 extra 段（通常包含 RTS 音频引用文件名）。**注意：** 这部分内容绝不能进行简繁转换。
  - **ra2.csf：** 4702 个标签，其中 3836 处繁体成功转换为简体，转换后文件字节数保持不变（简体字符大多与繁体等长）。
  - **ra2md.csf：** 5213 个标签，同步完成转换。
  - **语言字段更新：** 文件头 `language` 字段从 0 或 9 修改为 100（ChineseCN），使得 `getIsoLocale()` 返回 zh-CN。
  - **转换效果：** 转换后残留繁体标签数为 0。headless 测试显示，主菜单中的「主选单」、「遭遇战」、「回放」、「选项」等文本均已正确显示为简体。

### 3. 解决方案：转换 MOD 的 CSF 文件

核心思路是：将 MOD 中所有 CSF 文件内的繁体中文字符串，批量转换为简体中文，并确保关键检测字符串（如 `THEME:Intro`）的值符合简体中文特征。

#### 3.1 准备工作

1. **定位 CSF 文件：** 在 MOD 的目录结构中（通常在 `./data/` 或 `./lang/` 下），找到扩展名为 `.csf` 或 `.cps` 的文件。
2. **备份原文件：** 在进行任何操作前，务必备份原始文件。
3. **准备工具：** 需要一个能解析、修改和重新打包 CSF 文件的工具或脚本。可以使用 Python 结合 `pycnc` 库，或使用社区工具如 XCC Mixer 的导出/导入功能。

#### 3.2 转换步骤（以编程方式为例）

以下是一个概念性的 Python 脚本步骤，展示了如何解析 CSF、转换文本并重新写入：

```python
import struct
from zhconv import convert  # 需要安装 zhconv 库：pip install zhconv
def decrypt_csf_string(encrypted_bytes):
"""解密 CSF 字符串（每字节按位取反）"""
return bytes([~b & 0xFF for b in encrypted_bytes])
def encrypt_csf_string(plain_bytes):
"""加密 CSF 字符串（每字节按位取反）"""
return bytes([~b & 0xFF for b in plain_bytes])
def convert_csf_file(input_path, output_path):
with open(input_path, 'rb') as f:
# 1. 读取文件头（示例结构，实际需参考 CSF 规范）
header = f.read(24)
# ... 解析文件头，获取字符串表偏移量等 ...
    # 2. 读取字符串条目
    string_entries = []
    while True:
        entry_header = f.read(8)
        if not entry_header:
            break
        # 解析条目类型、键名长度、值长度等
        # ...
    # 3. 读取并解密字符串值
    encrypted_value = f.read(value_length)
    decrypted_bytes = decrypt_csf_string(encrypted_value)
    original_text = decrypted_bytes.decode('utf-16le', errors='ignore')
# 4. 繁体转简体
simplified_text = convert(original_text, 'zh-cn')
5. 特别处理关键检测字符串
if key_name == "THEME:Intro":
simplified_text = "开场"  # 确保引擎识别为简体
6. 重新加密
new_bytes = simplified_text.encode('utf-16le')
new_encrypted = encrypt_csf_string(new_bytes)
string_entries.append({
'key': key_name,
'original': original_text,
'simplified': simplified_text,
'encrypted_data': new_encrypted
})
将修改后的字符串条目重新写入新文件
with open(output_path, 'wb') as f_out:
f_out.write(header)
... 按 CSF 格式重新写入所有条目 ...
print(f"转换完成：{input_path} -> {output_path}")
使用示例
convert_csf_file("./mod/ra2md.csf", "./mod/ra2md_zh-CN.csf")
```

**关键点：**

- 必须使用支持 UTF-16LE 编码的库来解码/编码中文字符串。
- 转换后，确保 `THEME:Intro` 的值是「开场」而非「開場」。
- 重新加密时，务必保持每字节取反的规则。

#### 3.3 替换与测试

1. 将 MOD 中原始的 CSF 文件替换为转换后的简体版本。
2. 清空浏览器缓存或 OPFS 中的游戏数据，确保重新加载。
3. 重启 OpenYRWeb 服务并加载 MOD，检查界面语言是否已切换为简体。

### 4. 引擎 locale 文件的补充修正

虽然 CSF 转换是主要矛盾，但为了界面完全统一，也应检查引擎的 `zh-CN.json`：

```json
// res/locale/zh-CN.json 示例
{
  "ui": {
    "startGame": "开始游戏",
    "options": "选项",
    "quit": "退出",
    "loading": "加载中..."
  }
  // ... 其他键值对
}
```

确保所有键对应的值都是简体中文，且没有残留的繁体字。

### 5. 总结

要让 OpenYRWeb 加载繁体中文 MOD 后显示简体界面，必须解决两个独立但需同步处理的文本源：

1. **核心（治本）：** 转换 MOD 的 CSF 翻译文件，将所有繁体字符串转为简体，并确保 `THEME:Intro` 等关键字符串的值能被 `autoDetectLocale()` 正确识别为 zh-CN。
2. **辅助（治标）：** 确认引擎的 `zh-CN.json` locale 文件内容正确无误。

完成以上步骤后，重新加载 MOD，即可实现从启动画面到游戏内文本的全面简体中文体验。

### 6. 落地结论与最佳实践

基于前述分析、源码验证和实际测试，我们得出以下可立即执行的完整解决方案：

#### 6.1 核心方案：三处同步修改

要让繁体中文 MOD 在 OpenYRWeb 中显示简体界面，必须同时完成以下三项操作，缺一不可：

1. **CSF 文本内容转换：** 使用 OpenCC 的 t2s（繁体转简体）功能，批量转换 CSF 文件中所有字符串值（UTF-16LE 编码）。
2. **CSF 文件头语言字段修改：** 将 CSF 文件头第 6 个 u32 整数（language 字段）的值设置为 100（对应 ChineseCN）。
3. **引擎配置同步：** 确保 `config.json` 中的 `General.defaultLanguage` 设置为 `zh-CN`。

#### 6.2 关键要点与注意事项

- **WRTS/RTS extra 段保护：** 如果 CSF 值结构中的 vmagic 是 `'WRTS'` 或 `'RTS'`，其后跟随的 extra 段通常包含音频引用文件名（ASCII 字符串）。**这部分内容绝不能进行简繁转换**，否则会导致音频资源加载失败。
- **字符数重算：** 转换后，如果简体字符数与原繁体字符数不同（如"開場"2字转"开场"2字，长度不变；但某些字转换后字符数可能变化），必须更新值结构中的 `charCount` 字段。
- **CSF 魔数识别：** 注意 CSF 文件头的魔数可能是 `" FSC"`（XCC 工具生成）而非西木原版的 `"CSF "`。解析时不要写死魔数，应兼容两种格式。
- **适用范围：** 本方案适用于所有基于 RA2/YR 引擎的中文 MOD 界面简繁迁移。反向操作（简体转繁体）思路完全相同，只需将 OpenCC 模式改为 s2t，并将语言字段改为 101（ChineseTW）。

#### 6.3 人类开发者自查清单

1. 使用 Python3 读取 CSF 文件，检查文件头第 6 个 u32 整数，确认当前语言字段值。
2. 对整个字节流进行 UTF-16LE 解码，搜索「開始遊戲」和「开始游戏」等关键字符串，判断当前文件是繁体还是简体。
3. 安装 OpenCC Python 包：`pip install opencc`。
4. 使用 `OpenCC('t2s').convert(text)` 进行转换。

#### 6.4 对话式 AI 问答参考

**用户典型提问：** "OpenYRWeb 加载繁体 MOD 界面全繁体，怎么改成简体？"

**回答要点：**

- 需要同时修改三处：CSF 文本内容（OpenCC t2s 转换）、CSF 文件头语言字段（设为 100）、引擎 config 的 defaultLanguage（设为 zh-CN）。
- CSF 值按位取反存储，解析时需先解密再转换，转换后重新加密写回。
- 具体解析结构参考上文"CSF 二进制格式"部分。

#### 6.5 代码 Agent 可执行流程

1. 使用 Python3 按上文描述的 CSF 结构解析文件。
2. 对每个字符串值（UTF-16LE 解码后）应用 OpenCC t2s 转换。
3. 特别处理关键检测字符串（如 `THEME:Intro`），确保其值为简体「开场」。
4. 更新文件头 language 字段为 100。
5. 重新计算并更新转换后值的 charCount。
6. 按 CSF 格式重建文件并写回。
7. 将转换后的 CSF 文件重新注入浏览器的 OPFS（持久化文件系统）。
8. 刷新 OpenYRWeb 页面，验证主菜单等界面文本是否已切换为简体。

遵循以上步骤，即可系统性地解决 OpenYRWeb 加载繁体 MOD 的界面语言问题，实现稳定、完整的简体中文体验。

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名，第1版 (MulanOWL BY v1) 授权。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/games/openyrweb-traditional-chinese-mod.html
