<!-- SPDX-License-Identifier: MulanOWL-PL OR CC0-1.0 -->

# Five Deep Pitfalls in Extracting a 40GB Multi-Volume Encrypted Firmware Image on macOS

> Date: 2026-08-07

## 1. Trigger: 40GB Split Archive + Chinese Password Firmware Image

A task came in: extract a disk image from an R36S handheld "64G single-card lazy firmware" package. Files on an external drive:

- `R36s-64G.zip` + `R36s-64G.z01` ~ `z19`, 20 volumes, ~40GB total
- Hint file `解压密码-浪子玩数码.txt` (first line: "解压密码-浪子玩数码")
- Goal: extract the single `R36s-64G.img` (53.5GB) inside

Environment: macOS arm64. First `ls` to confirm volumes, `7z l` to list (install p7zip first), confirmed: multi-volume zip, AES-256 encryption, single image file. Then the nightmare began.

### Symptom timeline

1. `7z x -p'浪子玩数码'` → `ERROR: Wrong password`
2. Tried `7zz` (brew 7zip) → same Wrong password
3. Even `7zz a -p'浪子玩数码'` to create a test archive → `E_INVALIDARG`
4. Python pyzipper → "zipfiles that span multiple disks are not supported"
5. Finally wrote my own Python decryption stream, worked through it step by step: full 53.5GB extraction + HMAC verified

## 2. Misdiagnoses: Five Traps

### Trap 1: macOS built-in unzip handles multi-volume zips

No. `unzip`/`zipinfo`/`ditto` only handle single-file zips; `.z01` volumes are unrecognized. Multi-volume zips need 7-Zip (brew install `p7zip` or `7zip`).

### Trap 2: 7-Zip CLI can directly extract Chinese-password AES zips

Wrong, and the sneakiest. The zip was created on Windows; AES key derivation uses the password bytes **encoded in GBK**, while macOS 7zz converts the `-p` argument **as UTF-8** — the PBKDF2 keys differ completely → Wrong password. Passing GBK via iconv also fails because 7zz re-encodes internally. Even creating a Chinese-password zip with 7zz gives E_INVALIDARG; the whole Chinese-password path is broken on macOS.

### Trap 3: pyzipper can read multi-volume zips directly

pyzipper supports AES decryption but inherits zipfile; opening a multi-volume zip throws "multiple disks not supported" while reading the ZIP64 locator. It checks `diskno != 0 or disks != 1` in `_EndRecData64`.

### Trap 4: Standard WinZip PBKDF2 params

Assumed `PBKDF2(password, salt, count=1000, dkLen=34)` taking the last 2 bytes as verifier — no match. The real params come from 7-Zip/pyzipper source: AES-256 `dkLen = 2*32 + 2 = 66` (enc key 32B + HMAC key 32B + verifier 2B), verifier at `dk[64:66]`.

### Trap 5: AES-CTR counter starts at 0

Decrypted bytes were garbage; zlib reported `invalid stored block lengths`. Comparing pyzipper source revealed 7-Zip zip AES uses `Counter.new(nbits=128, little_endian=True, initial_value=1)` — **starts at 1**. This was the most time-consuming trap.

## 3. Source Verification: Real Decryption Flow (All Measured)

### 3.1 Parse z01 local header, take salt + verifier

The first volume `R36s-64G.z01` starts with a 4-byte stub (`PK\x07\x08`, 7z reports Embedded Stub Size=4); local header begins at offset 4:

```python
mv.seek(4); hdr = mv.read(30)
sig, ver, flags, method, tm, dt, crc, csize, usize, nlen, elen = struct.unpack('<4s5H3L2H', hdr)
# method=99 (AES), name R36s-64G.img, extra AES 0x9901: strength=3 (AES-256)
pos = 34 + nlen + elen
salt = mv.read(16); verifier = mv.read(2)
data_off = mv.tell()
```

### 3.2 Multi-volume virtual concatenation + ZIP64 locator patch

pyzipper rejects multi-volume zips. Solution: write a `MultiVolumeReader` exposing the 20 volumes as one seekable read-only view (no 42GB copy), and patch the ZIP64 locator (20 bytes before EOCD) to look single-volume:

```python
ba[4:8]  = (0).to_bytes(4, 'little')   # diskno -> 0
ba[16:20] = (1).to_bytes(4, 'little')  # disks  -> 1
```

The central directory's `header_offset` is relative to the logical start; add 4 in the real file (stub).

### 3.3 Key derivation: the params are the hard core

```python
import hashlib
PWD = '浪子玩数码'.encode('gbk')          # key: GBK bytes, not UTF-8!
dk = hashlib.pbkdf2_hmac('sha1', PWD, salt, 1000, 66)
key, mac_key, ver = dk[:32], dk[32:64], dk[64:66]
assert ver == verifier
```

### 3.4 AES-CTR decrypt + HMAC verify + zlib inflate

```python
from Cryptodome.Cipher import AES
from Cryptodome.Util import Counter
dec = AES.new(key, AES.MODE_CTR,
    counter=Counter.new(nbits=128, little_endian=True, initial_value=1))
hm = hmac.new(mac_key, digestmod=hashlib.sha1)
d = zlib.decompressobj(-15)
# stream: hm.update(cipher) -> plain = dec.decrypt(cipher) -> d.decompress(plain)
# trailing 10 bytes are HMAC: compare hm.digest()[:10]
```

### Measured data (2026-08-07, macOS arm64, USB drive)

- 20 volumes total physical size `42482360207` bytes, matches central directory exactly (no damaged volumes)
- Password `浪子玩数码` GBK bytes PBKDF2 verifier matched ✓
- Full 53.5GB extraction in **423 seconds** (~105 MiB/s), 8MB streaming chunks
- Decrypted head is standard x86 MBR (`fa b8 00 10 8e d0`), trailing **HMAC ok: True**
- No 42GB intermediate file; streamed straight to .img

## 4. Conclusions: Reusable Approach

### Next time: "multi-volume zip + Chinese password + AES" — copy this

1. **List**: `7z l -p'password' file.zip`, confirm volumes and inner filename
2. **Verify password**: don't trust 7zz's Wrong password on macOS — verify with Python: read z01 local header → salt/verifier → `pbkdf2_hmac('sha1', 密码.encode('gbk'), salt, 1000, 66)`, compare `dk[64:66]`
3. **Encoding**: password bytes are GBK (Windows-side creation), skip the UTF-8 detour
4. **Full extract**: virtual-concat volumes (MultiVolumeReader) + patch ZIP64 locator + AES-CTR(initial_value=1) + zlib(-15) streaming; 53.5GB in ~7 min

### Scope

- Taobao/Xianyu "lazy firmware" / "integrated packages": mostly Windows 7-Zip, Chinese passwords, multi-volume, AES-256
- Same approach for EmuELEC/ArkOS handheld images and other "netdisk" split archives
- Pure ASCII password + single volume: just use 7zz

### Judgement order (important)

Verify password encoding → then multi-volume → then CTR. Wrong encoding wastes everything; wrong CTR gives garbage without a password error — most confusing.

## 5. Quick Reference

### Human developers

```bash
brew install p7zip 7zip
7z l -p'密码' x.zip          # list (7z needed for multi-volume)
7zz t -p'密码' x.zip         # test password (Chinese may false-report)
python3 -c "import hashlib; print('浪子玩数码'.encode('gbk').hex())"
```

### Conversational AI

Question: "Multi-volume zip password won't verify — how to find the encoding?" Answer: read the z01 header for salt/verifier, run PBKDF2(count=1000, dkLen=66) with GBK bytes, compare the verifier — a hit confirms the encoding before extracting.

### Code agents

- Derive: `hashlib.pbkdf2_hmac('sha1', pwd_gbk, salt, 1000, 66)`, verifier=`dk[64:66]`
- AES-CTR: `Counter.new(nbits=128, little_endian=True, initial_value=1)`, **not 0**
- Multi-volume: custom reader by volume offset, patch ZIP64 locator diskno/disks
- Inflate: `zlib.decompressobj(-15)` raw deflate; trailing 10B is HMAC-SHA1
- Full script idea in §3; 105 MiB/s reproducible

<!-- License Declaration -->
> This article is licensed under Mulan Open Works License Attribution-PatentLicensed, Version 1 (MulanOWL BY-PL v1), or alternatively CC0-1.0 (public domain dedication). Copyright reserved. Attribution required. For enterprise compliance, please retain the original license notice.
> Original version: https://k4m7v2pz.github.io/en/blog/tools/macos-multivolume-zip-chinese-password.html
