# Bytebeat Moog City Reconstruction v3.2: Technical Analysis and Implementation

> Date: 2026-08-02

### 1. Project Overview

**Bytebeat approximation of Moog City (archive, with timeout silence)** 📌 This is a personal development archive recording a Bytebeat-based approximate reconstruction of *Moog City*, written in JavaScript and runnable directly in the [Bytebeat composer](https://dollchan.net/bytebeat/). I'll keep polishing it when I have time.


***Moog City*** is a track by C418 from *Minecraft - Volume Alpha*, released on March 4, 2011, 02:40 long, Ambient style. The original features a looping ascending melody + Moog-style synth timbre, with piano entering mid-way, then strings building up before resolving.


**Bytebeat** is a minimalist form of generative music: a single expression over a time variable t directly generates the waveform, usually output at 8000Hz as 8-bit mono audio. **Dollchan Bytebeat Composer** is an online real-time editing player supporting several modes: classic Bytebeat (outputs 0–255 integers), Signed Bytebeat, Floatbeat (outputs -1.0 to 1.0), and JS-big mode (supports JavaScript Bytebeat code larger than 1KB). This archive's code is JS-big / Floatbeat style, leveraging JS arrays, floating-point arithmetic, Math.random(), and so on.


Project status: **runnable / work in progress (WIP)**, last updated 2026-07-22.



### 2. Core Architecture and Algorithm Principles


#### 2.1 Time and Pitch Handling


- **Time scaling**: `t /= 6` slows down the raw time variable to form the piece's base tempo.
- **Pitch mapping**: uses the 12-TET formula `2**(p/12)` to convert semitone indices into frequency multipliers.
- **Pitch quantization function**: `EqT = p => 32/d * round(d/32 * 2**(p/12 - 0.02))` quantizes the computed frequency onto a grid to keep pitches stable, while the -0.02 semitone adjustment simulates the slight detune of analog synths.



#### 2.2 Waveform Generation and Silence Logic


- **Waveform generation**: uses a triangle-wave variant of `abs(modulation) % 4 - 2` (shown in the code as `abs(t*M/8 % 4 - 2) - 1`) to generate the lead and harmony layers.
- **Micro-rests**: a silence gate (`S = R > 6`) triggers at step 7 of the 8-step sequence, injecting breathing room into the rhythm.
- **Global silence gate**: when the sample count `t` exceeds `MAX_T = 25000000`, the `IS_SILENT` flag is set to true and multiplies every signal path, ensuring the output goes to zero.



#### 2.3 Feedback Delay Line (Echo)

The project uses a feedback delay line (FDL) to create the echo effect:



- **Delay buffer**: `a` is a ring array of length `n ≈ d * 9` that stores historical audio samples.
- **Feedback injection**: each frame's mixed signal `ev` accumulates into the buffer at the current position: `a[T % n] += ev`.
- **Decay**: the buffer value is then divided by 3 (`a[T % n] /= 3`), producing an exponentially decaying echo.
- **Mixed output**: the final output `ev` is a mix of the dry signal and the attenuated delayed signal.



### 3. Voices and Melody Structure


#### 3.1 Lead


```M = EqT([5,10,12,17,20,24,27,32][c]) * (!S) * (!IS_SILENT)```javascript


The lead pitch array `M` is `[5,10,12,17,20,24,27,32]` (semitone offsets). The index `c` is determined by `int((t + random()*D) / d) % 8`, with the random jitter `random()*D` simulating analog oscillator instability.



#### 3.2 Harmony


```M2 = EqT([-7,-4,0,3,5,10,12,15][c]) * (!S) * (!IS_SILENT)```javascript


The harmony pitch array `M2` is `[-7,-4,0,3,5,10,12,15]`, forming the chord progression against the lead. Note that in the code `M2` must be defined before `ev` is computed, or a ReferenceError will occur.



#### 3.3 Bass/Noise


```C = 8 * EqT([12,12,12,15,10,10,10,3,5,5,5,5,8,8,8,5,10,10,10,10,8,8,8,3,5,5,5,5,8,8,8,10][int((t + d*32 + random()*D) / d / 2) % 32]) * (!S) * (!IS_SILENT)```javascript


The bass uses a complex 32-step sequence array, stepping at half the lead's speed (`/2`) with a fixed offset `d*32`. Multiplying by a factor of 8 boosts low-frequency energy.



#### 3.4 Volume Envelopes


- **Lead volume**: `MV = t < 54864 ? t/128E3 : .42`, implementing an opening fade-in.
- **Harmony volume**: `MV2 = (t > 164592 && t < 219456 ? (t-164592)/128E3 : .42) * (!S) * (!IS_SILENT)`, fading in mid-piece.
- **Bass volume**: `CV = (t > 274320 && !S) * .5 * (!IS_SILENT)`, cutting in at a specific time.



### 4. Full Source Code


```d=1714.5,D=0,T=t,
MAX_T = 25000000,
IS_SILENT = t > MAX_T,
t?(t/=6,
  R=(0|t/d)%8,
  S=R>6,
  EqT=p=>32/d*round(d/32*2**(p/12-.02)),
  c=int((t+random()*D)/d)%8,
  M=EqT([5,10,12,17,20,24,27,32][c])*(!S)*(!IS_SILENT),
  M2=EqT([-7,-4,0,3,5,10,12,15][c])*(!S)*(!IS_SILENT),
  C=8*EqT([12,12,12,15,10,10,10,3,5,5,5,5,8,8,8,5,10,10,10,10,8,8,8,3,5,5,5,5,8,8,8,10][int((t+d*32+random()*D)/d/2)%32])*(!S)*(!IS_SILENT),
  MV=t<54864?t/128E3:.42,
  MV2=(t>164592&&t<219456?(t-164592)/128E3:.42)*(!S)*(!IS_SILENT),
  CV=(t>274320&&!S)*.5*(!IS_SILENT),
  ev=(abs(t*M/8%4-2)-1)*MV + (abs(t*M2/8%4-2)-1)*MV2/2 + t*C%256*CV/192 -.5 + a[T%n],
  a[T%n]+=ev,
  a[T%n]/=3,
  IS_SILENT ? 0 : ev/2
):(
  a=Array(n=round(d*6*1.5)).fill(0)
)```javascript



### 5. Known Issues and Future Work


#### 5.1 Known Issues


- **Macro-rests not implemented**: only the per-cycle micro-rests are implemented; structural silences based on absolute time are missing (e.g., the rests around 1:30 and 2:25).
- **Missing piano timbre layer**: the piano timbre from the original track hasn't been synthesized yet.
- **Missing string crescendo**: the string crescendo section from the original track is absent.



#### 5.2 Future Work Plan


- Implement structural silences based on absolute time.
- Add a second synthesis pass to generate the piano timbre.
- Refactor the pitch arrays to exactly match the standard frequencies of the E minor scale.
- Optimize code structure for better readability and maintainability.



### 6. Run and Debug Instructions

Copy the full code above into the JS-big mode editor of the [Dollchan Bytebeat Composer](https://dollchan.net/bytebeat/) and press play to hear the synthesis result. Watch out for the browser audio context to avoid automatic pausing.


Suggestions during development:



1. Use `console.log` to output key variables (such as `R`, `S`, `M`) to debug the timing logic.
2. Gradually comment out `IS_SILENT` or the volume envelopes to listen to each voice in isolation.
3. Try modifying `d` (the base tempo divisor), the delay feedback coefficient (currently 3), or the pitch arrays to explore different sounds.
