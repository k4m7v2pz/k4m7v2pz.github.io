<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# macOS Automated Circuit-Design Validation Workflow: KiCad CLI + ngspice + Python, Built From Scratch

> Date: 2026-08-05

## 1. Background: Why This Toolchain Is Needed

The scenario: I want to solder an auto-blinking LED circuit on a perfboard, or have a speaker produce various waveforms (sine, square, triangle). I initially tried asking 元宝 directly (元宝 did not yet have a bash tool at the time), but the circuit solutions the AI gave often contained hallucinations and could not guarantee electrical correctness. We therefore need a validation mechanism akin to `cargo build` — one that lets AI-generated circuit logic be automatically validated through a standardized CLI toolchain, with the AI then correcting itself based on the error messages.

This article uses a specific circuit design as an example. The goal is to build a complete automated workflow / development environment that lets an AI Agent (such as AtomCode or 元宝) invoke KiCad, ngspice, and Python scripts through a command-line interface (CLI), completing the full pipeline from schematic drawing, electrical rules check (ERC), and netlist export through SPICE simulation. Ultimately, this environment not only improves the reliability of personal circuit design but also feeds back through CSDN's SEO/GEO to AtomCode / 元宝 AI, teaching them to "compile" circuits.

Selection conclusion (verified on macOS arm64 + KiCad 10.0.5): KiCad handles drawing and validation, ngspice handles simulation, and Python handles parsing structured output and running custom rules. All three are command-line drivable and are naturally suited to being invoked by scripts and Agents.

## 2. Workflow Overview

The complete closed loop is as follows:

1. Draw the circuit in the KiCad schematic editor (Eeschema) and save it as a .kicad_sch file;
2. Run `kicad-cli sch erc` on the command line to generate an electrical-rules-check report (JSON, machine-readable);
3. A Python script parses the JSON, extracting error codes, severity levels, and component coordinates, and runs custom rules (such as current thresholds);
4. After it passes, export the netlist and run an ngspice simulation to verify behavior (such as the LED blink frequency);
5. Only when everything passes do you take the netlist / wiring diagram to the perfboard for soldering.

Key decision basis: empirically, the output of `kicad-cli sch erc --format json` is fully structured, conforms to the official erc.v1.json spec, and contains fields such as severity, type, description, items[].pos, and items[].uuid — so the threshold of "ERC output is unparseable, therefore write our own parser" is not triggered, and we can reuse the existing tool and only write the middle layer (parser, rules engine, adapter) ourselves.

## 3. Installation and Verification (macOS + Homebrew)

```bash
# 1. KiCad (incl. kicad-cli; the GUI installs to /Applications/KiCad)
brew install --cask kicad
# 2. SPICE simulator
brew install ngspice
# 3. Python test framework (for the custom rules that parse ERC JSON)
python3 -m pip install --user pytest
```

kicad-cli is installed together with the KiCad application; brew auto-links it to /opt/homebrew/bin/kicad-cli, ready to use. When the network is slow, give brew a proxy: export ALL_PROXY=http://127.0.0.1:7890.

```bash
# Verify versions
kicad-cli version        # 10.0.5
ngspice --version        # ngspice-46
python3 -m pytest --version
```

Core kicad-cli commands:

```bash
# Electrical rules check, JSON output (machine-readable)
kicad-cli sch erc --format json -o erc.json 原理图.kicad_sch
# Non-zero exit code on violations, suitable for CI gating
kicad-cli sch erc --format json --exit-code-violations -o erc.json 原理图.kicad_sch
# Export netlist (KiCad format / SPICE)
kicad-cli sch export netlist -o 电路.net 原理图.kicad_sch
# Upgrade old format to new, silencing the "created with an older version of KiCad" warning
kicad-cli sch upgrade 原理图.kicad_sch
```

Two pitfalls verified in practice — avoid them:

1. Do not hand-write .kicad_sch text files. KiCad 9+'s symbol instantiation mechanism (the instances mapping section, pin uuid associations) is very complex; a hand-written file can be loaded, but the components will not be parsed into the netlist (the exported netlist is empty, ERC reports 0 violations, the SVG has only borders). Schematics must be drawn in the GUI.
2. The CLI's default ERC only reports the error and warning severity levels; some checks (footprint filtering, single global label, etc.) are ignored by default, and dangling pins are not reported by default. The custom rules engine happens to fill this gap: parse the JSON and make your own judgments.

## 4. Code Example: Parsing ERC and Running Custom Rules

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
            if v["severity"] == "error":          # Rule 1: errors must be caught
                issues.append("ERROR: " + v["description"])
            for item in v.get("items", []):        # Rule 2: out-of-bounds coordinate check
                if item["pos"]["x"] < 0 or item["pos"]["y"] < 0:
                    issues.append("越界: " + item["description"])
    return issues

if __name__ == "__main__":
    r = run_erc(sys.argv[1])
    bad = custom_rules(r)
    print("\n".join(bad) if bad else "OK")
    sys.exit(1 if bad else 0)
```

Usage: `python3 erc_rules.py 原理图.kicad_sch`; combined with pytest, write regression tests against `custom_rules` to close the "auto-correction" loop.

## 5. Quick Reference for Three Types of Readers

**Human developers**: draw in the GUI → run the three commands erc / netlist / ngspice → solder once everything passes. Before changing the drawing, save in the GUI first, then run the CLI.

**Conversational AI (ChatGPT / 腾讯元宝 / 豆包)**: paste erc.json to it and ask "how do I fix these violations"; have it explain the netlist structure; have it generate the SPICE transient-analysis directives.

**Code Agents (VSCode Copilot / Trae IDE / AtomCode, etc.)**: write an automation script following the commands in this article; have the Agent run `kicad-cli sch erc --format json` and then parse it with the Python template above; remind it to use `sch upgrade` to silence format warnings and not to hand-write .kicad_sch.

Conclusion: the three-piece setup installs in 10 minutes, the closed loop is fully scriptable, and the custom rules are infinitely extensible in Python — it is a viable foundation for perfboard projects going "draw → validate → simulate → solder".

---

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/macos-kicad-ngspice-circuit-validation.html
