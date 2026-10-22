# ArgoFirm – 60 second promotional ad

`ArgoFirm_Ad_60s.mp4` – 1920×1080, 30 fps, 60 s, H.264 + AAC, Urdu voiceover (ur-PK neural voice), loudness normalised to -14 LUFS (YouTube / Facebook / WhatsApp ready).

## Storyline
| Time | Scene |
|---|---|
| 0–6s | Problem: accounts lost in registers and notebooks |
| 6–14s | Farmer payments, aadat commission, stock, godown — totals never match |
| 14–23s | Brand reveal: ArgoFirm – complete mill & mandi software |
| 23–31s | All modules in one place (purchases/sales, ledgers, roznamcha, banks, godowns, weighbridge, aadat, bill maker) |
| 31–36s | One-click bill + print + trader ledger |
| 36–42s | Balance sheet, P&L, automatic reports |
| 42–47s | Urdu & English, mobile & computer |
| 47–52s | Save time · Zero errors · Every rupee accounted |
| 52–60s | Call to action: "اپنی پریشانی ختم کریں — ابھی رابطہ کریں" |

## Rebuilding (`source/`)
1. `python3 build.py` – writes `ad.html` from `ad.tpl.html` (brand name is set in `build.py`).
2. `node render.mjs` – renders the frames with Playwright/Chromium into `video.mp4`.
3. `python3 tts.py <voice> <text> <out.mp3> +8%` regenerates voice lines from `lines.txt` (already in `vo/`).
4. `python3 music.py` – synthesises the music, ducks it under the voice → `audio.wav`.
5. `ffmpeg -i audio.wav -af loudnorm=I=-14:TP=-1.5 audio_n.wav && ffmpeg -i video.mp4 -i audio_n.wav -c:v copy -c:a aac -b:a 192k final.mp4`
