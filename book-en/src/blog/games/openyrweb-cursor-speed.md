<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# OpenYRWeb: Troubleshooting Battlefield Cursor Speed Anomalies

> Date: 2026-08-05

### Trigger Scenario

The project is OpenYRWeb (a browser port of Red Alert 2 / Yuri's Revenge, self-hosted), and the problem occurs with the in-battlefield self-drawn cursor. The symptom is that the cursor movement speed in the battlefield is abnormal—initially about 10% of desktop speed (10x too slow); after one round of fixes it became about 10x desktop speed (10x too fast). The environment is Vivaldi (Chromium 150), macOS, local `node server/index.mjs 8081`, with MOD data injected into the browser OPFS. The decisive clue is that after exiting pointer lock the cursor returns to normal speed (completely consistent with the desktop), indicating the difference lies only in the lock-mode coordinate path.

### Tracing the Misconceptions

### Source Code Verification (Measured)

Below, combined with the source code, we confirm the cursor coordinate chain and root cause.

#### Cursor Coordinate Chain (src/gui/Pointer.ts.js)

- Non-lock mode: `position = pageX - canvasMetrics.x` (absolute coordinates, 1:1 normal).
- Lock mode: `position += e.movementX/movementY` (incremental accumulation, speed depends on the movementX provided by the browser).
- Actively locks on battlefield entry (GameScreen.ts.js `this.pointer.lock()`).

#### Root Cause

When the engine requests pointer lock it passes `{ unadjustedMovement: !mouseAcceleration.value }`; the "mouse acceleration" setting defaults to off → `unadjustedMovement: true`. Chromium 150 (Vivaldi) on macOS, when unadjustedMovement is enabled, makes movementX/Y about 0.1x of the real displacement → the cursor is 10x too slow.

#### Fix

Permanently disable unadjustedMovement (three places with `request({ unadjustedMovement: !1 })`) → movementX goes through the system pointer path, 1:1 with the desktop cursor, no acceleration. Measured verification: before fix in-game=0.1×desktop; after mistakenly adding ×10 compensation=10×desktop; after removing compensation and keeping only the disable=1×desktop (correct).

#### Cache Pitfall (Verification Requires Hard Refresh)

The build is full (`rmSync(BUILD)` clears and rebuilds) and serve returns `Cache-Control: no-cache`, but the browser may still cache the dist JS; the first "still slow" is actually the old build—you must hard refresh with `Cmd+Shift+R` before verifying.

During troubleshooting, three misconceptions were encountered in sequence, recorded one by one below.

#### 1. Misconception: "Canvas Size / DPR Problem"

Measured the main menu canvas buffer and CSS display as consistent (1280x720 1:1), the engine does not call `setPixelRatio`, and cursor mapping is unrelated to DPR—ruled out.

#### 2. Misconception: "unadjustedMovement Is the Root Cause"

After disabling it, it was still slow—actually the browser had cached the old JS (build was fully rebuilt but the browser was not hard-refreshed), distorting the verification results and misleading subsequent judgment.

#### 3. Misconception: "If movementX Is Slow, Multiply by a Compensation Factor"

Based on "10x too slow", a ×10 compensation was added, resulting in the cursor being 10x too fast—compensation is only usable when the input is genuinely distorted, and you must first eliminate interference like caching before applying compensation.

### Practical Conclusion

The solution is to permanently disable unadjustedMovement in the pointer lock request, so movementX goes through the system pointer path, making the cursor 1:1 with the desktop, with no acceleration (linear when the user has "acceleration off"). The key points are: before changing cursor speed, first eliminate browser caching (hard refresh); do not add scaling compensation based on a single observation, as compensation is easily excessive; the comparison baseline (desktop vs in-game) must be clear. The applicable scope is Chromium-based browsers (Chrome/Edge/Vivaldi) on macOS for pointer lock cursor speed issues; the same approach works for FPS-type web games.

### Human Developer

Self-check: in the battlefield, run in the F12 console `document.addEventListener("mousemove",e=>console.log(e.movementX))`, move the mouse and compare with actual displacement. Verification: hard refresh with `Cmd+Shift+R` before retesting; you can use curl to confirm the new JS content served.

### Conversational AI

One-line question: "Under Chromium 150, the pointer lock cursor moves 10x too slow—how to fix?" Answer points: check unadjustedMovement—on macOS, true makes movementX shrink to about 0.1x; disable it (false) to go through the system path for 1:1; eliminate browser caching before applying scaling compensation.

### Code Agent

Executable flow: grep pointer lock request points → set unadjustedMovement to always false → full build → confirm artifacts → prompt user to hard refresh and verify (do not directly add movementX scaling compensation).

---

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/games/openyrweb-cursor-speed.html
