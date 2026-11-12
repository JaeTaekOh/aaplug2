# 샘플 프로젝트(SnapLedger)의 아이콘·화면 이미지를 만드는 스크립트 (한 번만 실행)
from PIL import Image, ImageDraw, ImageFont
import os
B = os.path.join(os.path.dirname(__file__), '..', 'sample', 'snapledger')
TEAL = (16, 122, 104); TEAL2 = (11, 92, 79); CREAM = (255, 248, 236); INK = (22, 28, 30)
def font(sz, bold=False):
    for p in ['/usr/share/fonts/truetype/sand-box/google/IBM Plex Sans/IBMPlexSans-%s.ttf' % ('Bold' if bold else 'Regular'),
              '/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf' % ('-Bold' if bold else '')]:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
def icon(sz):
    im = Image.new('RGBA', (sz, sz), TEAL); d = ImageDraw.Draw(im); s = sz / 512
    # receipt
    x0, y0, x1, y1 = 150*s, 105*s, 362*s, 400*s
    d.rounded_rectangle([x0, y0, x1, y1], radius=22*s, fill=CREAM)
    for i in range(7):  # zigzag bottom
        cx = x0 + (i+0.5)*(x1-x0)/7
        d.polygon([(cx-15*s, y1-2), (cx+15*s, y1-2), (cx, y1+24*s)], fill=CREAM)
    for j, w in enumerate([150, 110, 130]):
        d.rounded_rectangle([x0+32*s, y0+48*s+j*44*s, x0+32*s+w*s, y0+66*s+j*44*s], radius=9*s, fill=(196, 214, 208))
    d.ellipse([290*s, 270*s, 420*s, 400*s], fill=(255, 196, 61))
    d.text((355*s, 335*s), '₩', font=font(int(80*s), True), fill=INK, anchor='mm')
    return im
os.makedirs(B + '/app/src/main/res/mipmap-xxxhdpi', exist_ok=True)
icon(512).save(B + '/app/src/main/ic_launcher-playstore.png')
icon(192).save(B + '/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png')
# screenshots (앱 화면 캡처처럼)
os.makedirs(B + '/screenshots', exist_ok=True)
W, H = 1080, 2340
def frame(title):
    im = Image.new('RGB', (W, H), (247, 245, 240)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 300], fill=TEAL)
    d.text((70, 150), title, font=font(64, True), fill='white')
    d.text((70, 60), '9:41', font=font(36, True), fill='white')
    return im, d
im, d = frame('This month')
d.rounded_rectangle([60, 360, W-60, 760], 40, fill='white')
d.text((110, 410), 'Spent', font=font(40), fill=(110, 116, 120)); d.text((110, 470), '₩ 842,300', font=font(96, True), fill=INK)
d.rounded_rectangle([110, 640, 110+620, 680], 20, fill=(220, 236, 232)); d.rounded_rectangle([110, 640, 110+430, 680], 20, fill=TEAL)
d.text((110, 690), 'Budget ₩1,200,000 · 70% used', font=font(34), fill=(110, 116, 120))
rows = [('Groceries', 'Lotus\'s', '₩ 54,200', (255, 196, 61)), ('Coffee', 'Cafe Amazon', '₩ 4,500', (233, 120, 90)), ('Transport', 'BTS', '₩ 3,200', (90, 150, 233)), ('Dining', 'Somtam Der', '₩ 18,900', (16, 122, 104)), ('Pharmacy', 'Boots', '₩ 12,000', (160, 110, 210))]
for i, (c, m, a, col) in enumerate(rows):
    y = 820 + i*190
    d.rounded_rectangle([60, y, W-60, y+160], 34, fill='white'); d.ellipse([100, y+35, 190, y+125], fill=col)
    d.text((220, y+40), c, font=font(44, True), fill=INK); d.text((220, y+95), m, font=font(34), fill=(120, 126, 130))
    d.text((W-110, y+60), a, font=font(44, True), fill=INK, anchor='ra')
d.ellipse([W-260, H-300, W-80, H-120], fill=(255, 196, 61)); d.text((W-170, H-210), '+', font=font(110, True), fill=INK, anchor='mm')
im.save(B + '/screenshots/01-home.png')
im, d = frame('Scan receipt')
d.rounded_rectangle([60, 360, W-60, 1700], 40, fill=(30, 36, 38))
d.rounded_rectangle([230, 470, W-230, 1580], 18, fill=CREAM)
for j in range(9):
    d.rounded_rectangle([300, 560+j*100, 300+(420 if j%3 else 300), 590+j*100], 12, fill=(205, 210, 205))
for (x, y) in [(200, 440), (W-200, 440), (200, 1610), (W-200, 1610)]:
    d.ellipse([x-18, y-18, x+18, y+18], fill=(255, 196, 61))
d.rounded_rectangle([60, 1780, W-60, 2000], 40, fill='white')
d.text((110, 1820), 'Detected total', font=font(38), fill=(110, 116, 120)); d.text((110, 1880), '₩ 54,200  ·  Groceries', font=font(58, True), fill=INK)
d.ellipse([W/2-90, 2080, W/2+90, 2260], fill=TEAL)
im.save(B + '/screenshots/02-scan.png')
im, d = frame('Reports')
d.rounded_rectangle([60, 360, W-60, 1260], 40, fill='white')
d.text((110, 410), 'Spending by category', font=font(44, True), fill=INK)
vals = [(0.36, (255, 196, 61)), (0.22, (16, 122, 104)), (0.18, (233, 120, 90)), (0.14, (90, 150, 233)), (0.10, (160, 110, 210))]
a = -90
for v, col in vals:
    d.pieslice([240, 520, W-240, 1120], a, a+v*360, fill=col); a += v*360
d.ellipse([400, 680, W-400, 960], fill='white'); d.text((W/2, 820), '₩842k', font=font(64, True), fill=INK, anchor='mm')
for i, m in enumerate(['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']):
    h = [420, 520, 380, 610, 560, 470][i]
    x = 130 + i*145
    d.rounded_rectangle([x, 1900-h, x+90, 1900], 22, fill=TEAL if i == 5 else (200, 222, 216))
    d.text((x+45, 1940), m, font=font(34), fill=(110, 116, 120), anchor='ma')
d.text((110, 1330), 'Last 6 months', font=font(44, True), fill=INK)
im.save(B + '/screenshots/03-reports.png')
print('ok')
