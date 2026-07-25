# AtomCode Terminal Spinner Labels: What Are Those "Divining" and "Brewing" Words Really Saying?

## 1. Origin: Mistaken for Model Queueing

When using AtomCode for cross-file refactoring or full-repo search, the terminal status bar often shows **Divining... 5m2s**, **Brewing... 3m10s** and similar unfamiliar prompts. Many developers initially think these indicate model queueing delays.

In reality, these words are friendly status hints for the model's reasoning phases. Real queueing uses distinct labels like **Queued** or **Waiting for capacity**.

## 2. Code Path: Where Do These Words Come From?

AtomCode's spinner logic lives in the `crates/atomcode-tuix` terminal rendering module.

### 2.1 Vocabulary Definition

All gerunds are defined in the `THINKING_LABELS` constant in `crates/atomcode-tuix/src/state.rs`. It's a shared vocabulary pool of 20 words, cycling sequentially per turn (not random).

### 2.2 Word Switching Logic

The `current_thinking()` method advances one word per Agent execution round, ensuring no repeats in consecutive tasks. The spinner is dynamically overridden based on execution phase — e.g., **Running read_file** during tool execution, **Waiting approval** during user confirmation, falling back to `THINKING_LABELS` during reasoning.

### 2.3 Status Bar Format

The **Divining... 5m2s** format is assembled in `format_spinner_label` in `crates/atomcode-tuix/src/event_loop/mod.rs`. The duration is formatted by `fmt_dur` in `crates/atomcode-tuix/src/render/mod.rs`.

## 3. Word Reference Table

### Initial Reasoning Phase

| Word | Meaning | Model Behavior |
|------|---------|----------------|
| Pondering | Deep thought | Analyzing task context |
| Reflecting | Self-review | Checking previous output |
| Analyzing | Breaking down | Decomposing subtasks |
| Synthesizing | Integration | Combining analysis into a plan |
| Reasoning | Logic chain | Multi-step inference |

### Mid-Execution Phase

| Word | Meaning | Model Behavior |
|------|---------|----------------|
| Thinking | Generic reasoning | Internal token generation |
| Processing | Handling intermediates | Organizing context |
| Computing | Calculation | Math or logic computation |
| Evaluating | Comparison | Selecting optimal path |
| Formulating | Planning | Generating structure blueprint |

### Finalization Phase

| Word | Meaning | Model Behavior |
|------|---------|----------------|
| Finalizing | Wrapping up | Generating final output |
| Reviewing | Quality check | Inspecting output quality |
| Polishing | Refinement | Optimizing expression |
| Verifying | Validation | Checking feasibility |

### Metaphor/Fun Words

| Word | Meaning | Memory Anchor |
|------|---------|---------------|
| Divining | Fortune-telling | Crystal ball |
| Brewing | Mixing ideas | Cauldron |
| Conjuring | Summoning knowledge | Magic wand |
| Crafting | Fine construction | Workbench |
| Cultivating | Iterative improvement | Gardening |
| Foraging | Searching context | Squirrel finding nuts |

## 4. Common Misconceptions

### Misconception 1: "These words mean the model is queued"
**Reality:** Queueing has dedicated labels — **Queued**, **Waiting for capacity**. Spinner words only indicate active reasoning.

### Misconception 2: "Many words = model is stuck"
**Reality:** Words advance sequentially. If the same word repeats, it means the model is stuck in **the same reasoning round**, not cycling through the vocabulary.

### Misconception 3: "Verbose mode can backtrack"
**Reality:** Verbose mode (Ctrl+O) must be enabled **before** the reasoning phase. Switching it on mid-task only shows subsequent reasoning, not past output.

---
<!-- License Declaration -->
> This article is licensed under Mulan PSL v2. Copyright reserved. No attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/programming/atomcode-spinner-thinking-labels.html
