import sys, certifi, asyncio
certifi.where = lambda: "/root/.ccr/ca-bundle.crt"
import edge_tts
async def main(voice, text, out, rate="+0%"):
    await edge_tts.Communicate(text, voice, rate=rate).save(out)
asyncio.run(main(*sys.argv[1:]))
