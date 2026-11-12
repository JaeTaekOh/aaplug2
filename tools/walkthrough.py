# AA Plug 2 — 샘플 흐름을 처음부터 출시 완료까지 자동으로 눌러 보고 화면을 캡처한다.
# 사용: (서버 실행 후) /workspace/venv-pw/bin/python tools/walkthrough.py [URL] [en|ko|th|zh|hi]   (default en; AAPLUG2_SHOTS_DIR to change the output folder)
import sys, os, asyncio, json
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5180/'
LANG = sys.argv[2] if len(sys.argv) > 2 else 'en'   # UI language to walk through; the app itself always starts in English
OUT = os.environ.get('AAPLUG2_SHOTS_DIR') or os.path.join(os.path.dirname(__file__), '..', 'preview-screenshots')
os.makedirs(OUT, exist_ok=True)
errors = []
async def run(p, w, h, tag, full):
    exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
    b = await p.chromium.launch(executable_path=exe, args=['--no-sandbox'])
    ctx = await b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1 if w > 600 else 2, locale='ko-KR', accept_downloads=True, reduced_motion='reduce')
    pg = await ctx.new_page()
    pg.on('console', lambda m: errors.append(f'[{tag}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append(f'[{tag}] pageerror: {e}'))
    await pg.goto(URL); await pg.evaluate("localStorage.clear(); localStorage.setItem('aaplug2.lang', 'ko')"); await pg.reload()   # old 0.1.0 key + Korean browser locale must still give English
    await pg.wait_for_selector('#startSample')
    assert await pg.evaluate("document.documentElement.lang") == 'en', 'first visit must be English'
    assert await pg.evaluate("document.querySelectorAll('#langMenu [data-lang]').length") == 5, 'globe menu must list 5 languages'
    if LANG != 'en':
        await pg.click('#langBtn'); await pg.click(f'#langMenu [data-lang="{LANG}"]'); await pg.wait_for_timeout(300)
        await pg.reload(); await pg.wait_for_selector('#startSample')
        assert await pg.evaluate("document.documentElement.lang") == LANG, 'manual pick must be saved and win after reload'
    async def shot(name):
        await pg.wait_for_timeout(500)
        await pg.screenshot(path=os.path.join(OUT, f'{tag}-{name}.png'), full_page=full)
    await shot('01-home')
    await pg.click('#startSample')
    await pg.wait_for_selector('.an-head', timeout=20000)
    await shot('02-analysis')
    await pg.click('.cta-bar [data-go="decide"]')
    await pg.wait_for_selector('.opt-icon', timeout=20000)
    await pg.wait_for_selector('#shotsRow img', timeout=20000)
    await shot('03-decisions')
    # 몇 개는 직접 고르고, 나머지는 AI 추천대로
    await pg.click('[data-dec="title"][data-val="1"]'); await pg.wait_for_timeout(300)
    await pg.click('#acceptAll'); await pg.wait_for_timeout(800)
    await shot('04-decisions-done')
    await pg.click('#toAssets')
    await pg.wait_for_selector('#zipAll', timeout=20000)
    await pg.wait_for_selector('.shots-row.big img', timeout=20000)
    await shot('05-assets')
    async with pg.expect_download() as dl:
        await pg.click('#zipAll')
    d = await dl.value; zp = os.path.join(OUT, f'_{tag}-bundle.zip'); await d.save_as(zp)
    await pg.click('.cta-bar [data-go="submit"]'); await pg.wait_for_selector('.guide')
    await shot('06-submit-guide')
    await pg.click('#approveBtn'); await pg.wait_for_selector('.modal'); await shot('07-submit-approve-modal')
    await pg.click('.modal [data-ok]'); await pg.wait_for_timeout(600)
    await pg.click('#submitted'); await pg.wait_for_selector('#gotNo')
    await shot('08-review')
    await pg.click('#gotNo'); await pg.wait_for_selector('#analyzeRej'); await pg.click('#analyzeRej'); await pg.wait_for_selector('#resubmit')
    await shot('09-rejection-fix')
    await pg.click('#resubmit'); await pg.click('.modal [data-ok]'); await pg.wait_for_selector('#gotOk'); await pg.click('#gotOk')
    await pg.wait_for_selector('.done'); await pg.wait_for_timeout(900)
    await shot('10-launched')
    st = await pg.evaluate('JSON.stringify(AAPApp.state().review)')
    await b.close(); return zp, st
async def main():
    async with async_playwright() as p:
        r1 = await run(p, 1366, 900, f'desktop-{LANG}', True)
        r2 = await run(p, 390, 844, f'mobile-{LANG}', False)
    print(json.dumps({'zip': r1[0], 'review': r1[1], 'errors': errors}, ensure_ascii=False, indent=1))
asyncio.run(main())
