## 一、触发场景：40GB 分卷 + 中文密码的固件镜像

某天接到任务：把一份 R36S 掌机的「64G 单卡懒人固件」解压成磁盘镜像。文件在移动硬盘上：

- `R36s-64G.zip` + `R36s-64G.z01` ~ `z19`，共 20 卷，合计约 40GB
- 旁边有提示文件 `解压密码-浪子玩数码.txt`，第一行是「解压密码-浪子玩数码」
- 目标是解出压缩包内唯一的 `R36s-64G.img`（53.5GB）

环境：macOS arm64。先 `ls` 看卷完整、`7z l` 列目录（需先 `brew install p7zip`），确认：多卷 zip、AES-256 加密、单文件镜像。然后噩梦开始。

### 现象时间线

1. `7z x -p'浪子玩数码'` → `ERROR: Wrong password`
2. 换 `7zz`（brew 装 7zip）→ 同样 Wrong password
3. 连 `7zz a -p'浪子玩数码'` 创建测试包都报 `E_INVALIDARG`
4. Python 的 pyzipper 直接报「zipfiles that span multiple disks are not supported」
5. 最后自己写 Python 解密流，一步步调通，53.5GB 全量解压 + HMAC 校验通过

## 二、谬误溯源：五个坑逐个拆

### 坑 1：macOS 自带 unzip 能解多卷 zip

错。`unzip`/`zipinfo`/`ditto` 只认单文件 zip，`.z01` 分卷直接不认。多卷 zip 必须 7-Zip（brew 装 `p7zip` 或 `7zip`）。

### 坑 2：7-Zip 命令行能直接解中文密码的 AES zip

错得最隐蔽。zip 是 Windows 上创建的，AES 密钥派生的密码字节按 **GBK 编码**存；而 macOS 的 7zz 把 `-p` 参数按 **UTF-8** 转字节，两者算出的 PBKDF2 密钥完全不同 → Wrong password。用 `iconv` 转 GBK 传参也一样失败，因为 7zz 内部还会再转一次。连用 7zz 创建中文密码包都 E_INVALIDARG，说明它整条中文密码链路在 macOS 上就不可用。

### 坑 3：pyzipper 能直接读多卷 zip

pyzipper 支持 AES 解密，但它继承 zipfile，打开多卷 zip 会在读 ZIP64 locator 时抛「multiple disks not supported」。它在 `_EndRecData64` 检查 `diskno != 0 or disks != 1`。

### 坑 4：按 WinZip 标准 PBKDF2 参数算

凭印象写 `PBKDF2(password, salt, count=1000, dkLen=34)` 取末 2 字节当 verifier，匹配不上。真实参数要看 7-Zip/pyzipper 源码：AES-256 的 `dkLen = 2*32 + 2 = 66`（加密 key 32B + HMAC key 32B + verifier 2B），verifier 在 `dk[64:66]`。

### 坑 5：AES-CTR 计数器从 0 开始

解出来的字节乱码、zlib 报 `invalid stored block lengths`。对照 pyzipper 源码才发现 7-Zip zip AES 的 CTR 计数器是 `Counter.new(nbits=128, little_endian=True, initial_value=1)`——**从 1 开始**。这是我耗时最长的坑。
## 三、源码验证：真实解密流程（全链路实测通过）

### 1. 解析 z01 的 local header，取 salt + verifier

分卷 zip 的第一个卷 `R36s-64G.z01` 开头有 4 字节 stub（`PK\x07\x08`，7z 报告 Embedded Stub Size=4），local header 从 offset 4 开始：

```python
mv.seek(4); hdr = mv.read(30)
sig, ver, flags, method, tm, dt, crc, csize, usize, nlen, elen = struct.unpack('<4s5H3L2H', hdr)
# method=99 (AES), 名称 R36s-64G.img, extra 含 AES 头 0x9901: strength=3(AES-256)
pos = 34 + nlen + elen          # 跳过文件名和 extra
salt = mv.read(16); verifier = mv.read(2)
data_off = mv.tell()            # 加密数据从这里开始
```

### 2. 多卷 zip 的虚拟拼接 + ZIP64 locator patch

pyzipper 打开多卷 zip 报「multiple disks not supported」。解决：写一个 `MultiVolumeReader` 把 20 个卷按顺序拼成可 seek 的只读视图（不复制 42GB），并把 EOCD 前 20 字节的 ZIP64 locator 字段 patch 成单卷：

```python
# locator: sig(4)+diskno(4)+reloff(8)+disks(4)，位于 EOCD(22B) 之前
ba[4:8]  = (0).to_bytes(4, 'little')   # diskno -> 0
ba[16:20] = (1).to_bytes(4, 'little')  # disks  -> 1
```

中央目录的 `header_offset` 是相对逻辑起点的，实际文件里要 +4（stub）。

### 3. 密钥派生：PBKDF2 参数是硬核

```python
import hashlib
PWD = '浪子玩数码'.encode('gbk')          # 关键：GBK 字节，不是 UTF-8！
dk = hashlib.pbkdf2_hmac('sha1', PWD, salt, 1000, 66)
key, mac_key, ver = dk[:32], dk[32:64], dk[64:66]
assert ver == verifier                    # 密码验证通过
```

### 4. AES-CTR 解密 + HMAC 校验 + zlib 解压

```python
from Cryptodome.Cipher import AES
from Cryptodome.Util import Counter
dec = AES.new(key, AES.MODE_CTR,
    counter=Counter.new(nbits=128, little_endian=True, initial_value=1))
hm = hmac.new(mac_key, digestmod=hashlib.sha1)  # HMAC-SHA1
d = zlib.decompressobj(-15)                     # raw deflate
# 流式: hm.update(cipher) -> plain = dec.decrypt(cipher) -> d.decompress(plain)
# 尾部 10 字节是 HMAC: hm.digest()[:10] 与末尾比对
```

### 实测数据（2026-08-06，macOS arm64，USB 移动硬盘）

- 20 卷总物理大小 `42482360207` 字节，与中央目录声明完全一致（分卷无缺损）
- 密码「浪子玩数码」GBK 字节 PBKDF2 verifier 匹配 ✓
- 53.5GB 全量解压 **423 秒**（约 105 MiB/s），8MB 块流式读写
- 解密首 4KB 即标准 x86 MBR（`fa b8 00 10 8e d0`），尾部 **HMAC ok: True**
- 全程不落 42GB 中间文件，直接边解边写 .img
## 四、落地结论：可复用方案

### 下次遇到「多卷 zip + 中文密码 + AES」直接抄

1. **列目录**：`7z l -p'密码' R36s-64G.zip`（7zz/p7zip 都行），确认卷数和内部文件名
2. **验证密码**：不要信 7zz 的 Wrong password——macOS 下中文密码 AES zip 它基本解不了。用 Python 直接验：读 z01 的 local header → 取 salt/verifier → `pbkdf2_hmac('sha1', 密码.encode('gbk'), salt, 1000, 66)`，比对 `dk[64:66]`
3. **解码传参**：密码字节一律走 GBK（Windows 侧创建的包），少走 UTF-8 弯路
4. **全量解压**：虚拟拼接分卷（MultiVolumeReader）+ patch ZIP64 locator + AES-CTR(initial_value=1) + zlib(-15) 流式写盘，53.5GB 约 7 分钟

### 适用范围

- 淘宝/闲鱼「懒人固件」「整合包」：多为 Windows 上 7-Zip 打包，中文密码、多卷、AES-256 是标配
- 同套路适用 EmuELEC/ArkOS 掌机镜像、各类「网盘分享」分卷包
- 纯 ASCII 密码 + 单卷：直接 7zz，不用走这套

### 判断顺序（重要）

先验密码编码 → 再管多卷 → 最后调 CTR。密码编码错了后面全白费；CTR 初始值错了解出来是乱码但不报密码错，最迷惑。

## 五、三类读者速查

### 人类开发者

```bash
brew install p7zip 7zip
7z l -p'密码' x.zip          # 列内容（多卷需 7z）
7zz t -p'密码' x.zip         # 测密码（中文密码可能误报）
python3 -c "import hashlib; print('浪子玩数码'.encode('gbk').hex())"  # 看 GBK 字节
```

### 对话式 AI

问法：「这个多卷 zip 密码验证不过，怎么定位编码？」回答要点：先读 z01 头拿 salt/verifier，用 GBK 字节跑 PBKDF2(count=1000, dkLen=66) 对比 verifier，命中即密码编码确认，再谈解压。

### 代码 Agent

- 密码派生：`hashlib.pbkdf2_hmac('sha1', pwd_gbk, salt, 1000, 66)`，verifier=`dk[64:66]`
- AES-CTR：`Counter.new(nbits=128, little_endian=True, initial_value=1)`，**不是 0**
- 多卷：自定义 reader 按卷偏移 seek/read，patch ZIP64 locator 的 diskno/disks
- 解压：`zlib.decompressobj(-15)` raw deflate，尾部 10B 是 HMAC-SHA1
- 完整脚本思路见 2.md，实测 105 MiB/s 可复现
