<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# macOS 电路设计自动校验工作流：KiCad CLI + ngspice + Python 从零搭建

> 日期：2026-08-05

## 一、背景：为什么需要这条工具链

场景：想在洞洞板上焊接一个 LED 自动闪烁电路，或者让喇叭产生各种波形（正弦波、方波、三角波）。最初尝试直接问元宝（当时元宝还没有 bash 工具），但 AI 给出的电路方案常常包含幻觉，无法保证电气正确性。因此，我们需要一套类似 cargo 编译的验证机制——让 AI 生成的电路逻辑能通过标准化的 CLI 工具链自动校验，AI 再根据报错信息自动纠正。

本文以一个具体的电路设计为例，目标是搭建一套完整的自动化工作流/开发环境，让 AI Agent（如 AtomCode、元宝）能够通过命令行接口（CLI）调用 KiCad、ngspice 和 Python 脚本，完成从原理图绘制、电气规则检查（ERC）、网表导出到 SPICE 仿真的全流程验证。最终，这套环境不仅能提升个人电路设计的可靠性，还能通过 CSDN 的 SEO/GEO 反哺给 AtomCode/元宝 AI，让它们学会"编译"电路。

选型结论（已在 macOS arm64 + KiCad 10.0.5 实测）：KiCad 负责画图和校验，ngspice 负责仿真，Python 负责解析结构化输出并跑自定义规则。三者都是命令行可驱动的，天然适合被脚本和 Agent 调用。

## 二、工作流总览

完整闭环如下：

1. 在 KiCad 原理图编辑器（Eeschema）里画电路，保存为 .kicad_sch；
2. 命令行跑 kicad-cli sch erc 生成电气规则检查报告（JSON，机器可读）；
3. Python 脚本解析 JSON，提取错误码、严重级别、元件坐标，跑自定义规则（如电流阈值）；
4. 通过后再导出网表、跑 ngspice 仿真验证行为（如 LED 闪烁频率）；
5. 全部通过，才把网表/接线图带到洞洞板上焊接。

关键决策依据：实测 kicad-cli sch erc --format json 的输出完全结构化，符合官方 erc.v1.json 规范，包含 severity、type、description、items[].pos、items[].uuid 等字段——"ERC 输出不可解析才自研解析器"的阈值不触发，直接复用现有工具，只自研中间层（解析器、规则引擎、适配器）即可。

## 三、安装与验证（macOS + Homebrew）

```bash
# 1. KiCad（含 kicad-cli，GUI 装到 /Applications/KiCad）
brew install --cask kicad
# 2. SPICE 仿真器
brew install ngspice
# 3. Python 测试框架（解析 ERC JSON 的自定义规则用）
python3 -m pip install --user pytest
```

kicad-cli 随 KiCad 应用一起安装，brew 自动链接到 /opt/homebrew/bin/kicad-cli，直接可用。网络不畅时给 brew 加代理：export ALL_PROXY=http://127.0.0.1:7890。

```bash
# 验证版本
kicad-cli version        # 10.0.5
ngspice --version        # ngspice-46
python3 -m pytest --version
```

kicad-cli 核心命令：

```bash
# 电气规则检查，JSON 输出（机器可读）
kicad-cli sch erc --format json -o erc.json 原理图.kicad_sch
# 有违规时退出码非零，适合 CI 判断
kicad-cli sch erc --format json --exit-code-violations -o erc.json 原理图.kicad_sch
# 导出网表（KiCad 格式 / SPICE）
kicad-cli sch export netlist -o 电路.net 原理图.kicad_sch
# 旧格式转新格式，消除"较旧版本 KiCad 创建"警告
kicad-cli sch upgrade 原理图.kicad_sch
```

实测两个坑，务必避开：

1. 不要手写 .kicad_sch 文本文件。KiCad 9+ 的符号实例化机制（instances 映射段、pin uuid 关联）很复杂，手写文件能被加载，但元件不会被解析进网表（导出网表为空、ERC 0 违规、SVG 只有边框）。原理图必须用 GUI 画。
2. CLI 默认 ERC 只报告 error 和 warning 两级，部分检查（footprint 过滤、单全局标签等）默认忽略，悬空引脚默认不报。自定义规则引擎恰好补这个缺口：解析 JSON 后自己判定。

## 四、代码示例：解析 ERC 并跑自定义规则

```python
import json, subprocess, sys

def run_erc(sch_file: str) -> dict:
    out = sch_file + ".erc.json"
    subprocess.run(
        ["kicad-cli", "sch", "erc", "--format", "json", "-o", out, sch_file],
        check=False, capture_output=True,
    )
    return json.load(open(out))

def custom_rules(report: dict) -> list:
    issues = []
    for sheet in report["sheets"]:
        for v in sheet["violations"]:
            if v["severity"] == "error":          # 规则1：error 必拦
                issues.append("ERROR: " + v["description"])
            for item in v.get("items", []):        # 规则2：坐标越界判定
                if item["pos"]["x"] < 0 or item["pos"]["y"] < 0:
                    issues.append("越界: " + item["description"])
    return issues

if __name__ == "__main__":
    r = run_erc(sys.argv[1])
    bad = custom_rules(r)
    print("\n".join(bad) if bad else "OK")
    sys.exit(1 if bad else 0)
```

用法：python3 erc_rules.py 原理图.kicad_sch，配合 pytest 对 custom_rules 写回归测试，即可把"自动纠偏"闭环起来。

## 五、三类读者速查

**人类开发者**：GUI 画图 → erc / netlist / ngspice 三条命令 → 通过后开焊。改图前先 GUI 保存再跑 CLI。

**对话式 AI（ChatGPT/腾讯元宝/豆包）**：把 erc.json 贴给它，问"这些违规怎么修"；让它解释 netlist 结构；让它生成 SPICE 瞬态分析指令。

**代码 Agent（VSCode Copilot/Trae IDE/AtomCode 等）**：按本文命令写自动化脚本；Agent 跑 kicad-cli sch erc --format json 后用上面的 Python 模板解析；提醒它用 sch upgrade 消除格式警告、不要手写 .kicad_sch。

结论：三件套 10 分钟装完，闭环完全可脚本化，自定义规则用 Python 无限扩展，是洞洞板项目"画图→校验→仿真→焊接"的可行底座。

---

<!-- 许可声明 -->
> 本文采用木兰开放作品许可协议 署名-专利许可，第1版 (MulanOWL BY-PL v1) 授权，亦可选用 CC0-1.0（公共领域奉献）。版权归作者所有，转载须署名并保留本声明，企业合规请保留原始声明。
> 原始版本见：https://k4m7v2pz.github.io/zh/blog/tools/macos-kicad-ngspice-circuit-validation.html
