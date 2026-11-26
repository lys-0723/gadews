# 本地字体

GADEWS 在构建时直接读取这两份字体，不再请求 Google Fonts。它们保留此前成功构建实际使用的 Latin 可变字体字节，未重新生成或替换。

| 文件 | 字体版本 | 字重 | 体积 |
| --- | --- | --- | --- |
| `inter-latin-variable.woff2` | Inter 4.001 / git-66647c0bb | 100–900 | 48,432 bytes |
| `jetbrains-mono-latin-variable.woff2` | JetBrains Mono 2.211 | 100–800 | 40,480 bytes |

`app/layout.tsx` 通过 `next/font/local` 加载，保留 `display: swap`、normal 样式以及 `--font-inter`、`--font-jetbrains-mono` 两个变量。内容仍覆盖原来显式预加载的 Latin 子集，其余文字按现有字体栈回退。

`manifest.json` 记录每个文件的 SHA-256、大小、原 `.next/static/media` 文件名及对应的编译 `@font-face`，也记录原 Google Fonts 样式请求地址。这些是从原成功构建恢复的资产；清单没有宣称已重新下载或核对当前远端二进制。

两份字体按 SIL Open Font License 1.1 分发，版权声明及完整许可分别保存在 `Inter-OFL.txt` 和 `JetBrainsMono-OFL.txt`。许可证来自 Google Fonts 官方仓库的 [Inter OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt) 和 [JetBrains Mono OFL](https://raw.githubusercontent.com/google/fonts/main/ofl/jetbrainsmono/OFL.txt)。2026-10-29，官方纯文本经网页读取工具取得并按 LF 换行保存；清单中的许可证校验值对应本仓库文本文件。

核对资产完整性：

```sh
python3 - <<'PY'
from pathlib import Path
from hashlib import sha256
import json
root = Path("app/fonts")
for font in json.loads((root / "manifest.json").read_text())["fonts"]:
    data = (root / font["file"]).read_bytes()
    assert data[:4] == b"wOF2"
    assert len(data) == font["bytes"]
    assert sha256(data).hexdigest() == font["sha256"]
    license = font["license"]
    assert sha256((root / license["file"]).read_bytes()).hexdigest() == license["sha256"]
    print(font["family"], "verified")
PY
```

字体资产或许可证有意升级时，重新核对官方来源、实际字重和本机显示，并更新清单；不要只修改校验值来跳过不明差异。
