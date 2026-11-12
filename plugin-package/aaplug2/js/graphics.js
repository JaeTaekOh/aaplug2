/* AA Plug 2 — 스토어 그래픽 생성 (canvas): 아이콘 512, 대표 그래픽 1024×500, 스크린샷 프레임 */
(function () {
  'use strict';
  const FONT = { ko: '"Pretendard Variable", "IBM Plex Sans", sans-serif', en: '"IBM Plex Sans", "Pretendard Variable", sans-serif', th: '"IBM Plex Sans Thai", "IBM Plex Sans", sans-serif' };
  const cache = new Map();
  function img(src) {
    if (!src) return Promise.resolve(null);
    if (cache.has(src)) return cache.get(src);
    const p = new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    cache.set(src, p); return p;
  }
  async function fontsReady(lang) {
    try { await Promise.all([600, 700, 400].map(w => document.fonts.load(`${w} 40px ${FONT[lang]}`, lang === 'th' ? 'ก' : lang === 'ko' ? '가' : 'A'))); } catch (e) { }
  }
  const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); };
  const toHex = rgb => '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
  const lum = h => { const [r, g, b] = hex(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const onColor = h => lum(h) > .42 ? '#111316' : '#ffffff';
  async function avgColor(src) {
    const i = await img(src); if (!i) return '#2f6f5e';
    const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 24, 24);
    const d = x.getImageData(0, 0, 24, 24).data; let r = 0, g = 0, b = 0, n = 0;
    for (let k = 0; k < d.length; k += 4) { if (d[k + 3] < 200) continue; const s = Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]); if (s < 30) continue; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
    return n ? toHex([r / n, g / n, b / n]) : '#2f6f5e';
  }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function rr(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }
  function wrap(x, text, maxW, maxLines) {
    /* 단어 단위로 자른다. 띄어쓰기가 없는 태국어도 Intl.Segmenter 로 단어 경계를 찾는다 */
    const words = (typeof Intl !== 'undefined' && Intl.Segmenter) ? [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)].map(s => s.segment) : /\s/.test(text) ? text.split(/(\s+)/) : [...text]; const lines = []; let cur = '';
    for (const w of words) { const t = cur + w; if (x.measureText(t).width > maxW && cur.trim()) { lines.push(cur.trim()); cur = w.trimStart(); } else cur = t; }
    if (cur.trim()) lines.push(cur.trim());
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/.{2}$/, '…'); }
    return lines;
  }
  function monogram(x, name, size, bg, fg) { x.fillStyle = bg; x.fillRect(0, 0, size, size); x.fillStyle = fg; x.font = `700 ${size * .48}px ${FONT.en}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText((name || 'A').trim().charAt(0).toUpperCase(), size / 2, size * .53); }

  /* 아이콘 3가지: 원본 / 브랜드 바탕 여백 / 밝은 바탕 여백 */
  async function icons(A, brand) {
    const src = A.icon && A.icon.dataUrl; const i = await img(src); const out = [];
    for (const style of ['original', 'brand', 'light']) {
      const [c, x] = canvas(512, 512);
      if (!i) { monogram(x, A.appName, 512, style === 'light' ? '#f4f3ee' : style === 'brand' ? brand : mix(brand, '#000000', .35), style === 'light' ? brand : onColor(brand)); }
      else if (style === 'original') { x.imageSmoothingQuality = 'high'; x.drawImage(i, 0, 0, 512, 512); }
      else {
        const bg = style === 'brand' ? mix(brand, '#ffffff', .12) : '#f6f5f0'; x.fillStyle = bg; x.fillRect(0, 0, 512, 512);
        if (style === 'brand') { const g = x.createRadialGradient(150, 110, 20, 256, 256, 420); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512); }
        x.save(); x.shadowColor = 'rgba(0,0,0,.22)'; x.shadowBlur = 28; x.shadowOffsetY = 10; rr(x, 86, 86, 340, 340, 78); x.clip(); x.drawImage(i, 86, 86, 340, 340); x.restore();
      }
      out.push({ style, dataUrl: c.toDataURL('image/png') });
    }
    return out;
  }

  async function feature(A, lang, style, brand, iconUrl, name, tagline) {
    await fontsReady(lang);
    const [c, x] = canvas(1024, 500); const ic = await img(iconUrl); const shot = A.screenshots[0] ? await img(A.screenshots[0].dataUrl) : null;
    const dark = mix(brand, '#000000', .45), fg = onColor(brand);
    if (style === 'minimal') {
      x.fillStyle = '#f6f5f0'; x.fillRect(0, 0, 1024, 500); x.fillStyle = brand; x.fillRect(0, 440, 1024, 60);
      if (ic) { x.save(); rr(x, 80, 120, 150, 150, 34); x.clip(); x.drawImage(ic, 80, 120, 150, 150); x.restore(); }
      x.fillStyle = '#15171a'; x.font = `700 72px ${FONT[lang]}`; x.textBaseline = 'alphabetic'; x.fillText(name, 270, 210);
      x.fillStyle = '#4b4f57'; x.font = `500 34px ${FONT[lang]}`; wrap(x, tagline, 680, 2).forEach((l, k) => x.fillText(l, 272, 270 + k * 46));
    } else {
      const g = x.createLinearGradient(0, 0, 1024, 500); g.addColorStop(0, brand); g.addColorStop(1, dark); x.fillStyle = g; x.fillRect(0, 0, 1024, 500);
      x.globalAlpha = .1; x.fillStyle = '#fff'; for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(880 - k * 40, 80 + k * 30, 240 - k * 30, 0, Math.PI * 2); x.fill(); } x.globalAlpha = 1;
      const textX = style === 'split' ? 290 : 70, tw = style === 'split' ? 660 : 520;
      if (style === 'split' && ic) { x.save(); x.shadowColor = 'rgba(0,0,0,.3)'; x.shadowBlur = 30; x.shadowOffsetY = 12; rr(x, 80, 150, 180, 180, 40); x.clip(); x.drawImage(ic, 80, 150, 180, 180); x.restore(); }
      const lfg = lum(brand) > .42 ? '#111316' : '#ffffff';
      x.fillStyle = lfg; x.font = `700 ${style === 'split' ? 74 : 66}px ${FONT[lang]}`; x.fillText(name, textX, 225);
      x.globalAlpha = .9; x.font = `500 34px ${FONT[lang]}`; wrap(x, tagline, tw, 2).forEach((l, k) => x.fillText(l, textX + 2, 285 + k * 46)); x.globalAlpha = 1;
      if (style === 'shot') {
        x.save(); x.translate(800, 270); x.rotate(-0.12); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 40; x.shadowOffsetY = 18;
        rr(x, -120, -250, 240, 520, 34); x.fillStyle = '#0d0f12'; x.fill(); x.shadowColor = 'transparent';
        rr(x, -110, -240, 220, 500, 26); x.clip();
        if (shot) x.drawImage(shot, -110, -240, 220, 220 * shot.height / shot.width); else { x.fillStyle = '#fff'; x.fillRect(-110, -240, 220, 500); }
        x.restore();
        if (ic) { x.save(); rr(x, 70, 340, 72, 72, 18); x.clip(); x.drawImage(ic, 70, 340, 72, 72); x.restore(); }
      }
      void fg;
    }
    return c.toDataURL('image/png');
  }

  /* 스크린샷 프레임: 위쪽 캡션 + 휴대폰 안에 실제 화면 */
  async function shots(A, lang, brand, captions, size) {
    await fontsReady(lang); const W = size === 'ios' ? 1290 : 1080, H = size === 'ios' ? 2796 : 1920; const out = [];
    const list = A.screenshots.length ? A.screenshots : [null, null, null];
    for (let k = 0; k < Math.min(list.length, 4); k++) {
      const [c, x] = canvas(W, H); const s = list[k] ? await img(list[k].dataUrl) : null;
      const top = k % 2 === 0 ? brand : mix(brand, '#000000', .35); const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, mix(top, '#000000', .25)); x.fillStyle = g; x.fillRect(0, 0, W, H);
      const fg = onColor(top); x.fillStyle = fg; x.textAlign = 'center';
      const fs = Math.round(W * .066); x.font = `700 ${fs}px ${FONT[lang]}`;
      const lines = wrap(x, (captions[k] || captions[0] || A.appName).replace(/\s*\(.*\)$/, ''), W * .84, 3);
      const capTop = H * .085; lines.forEach((l, i) => x.fillText(l, W / 2, capTop + i * fs * 1.3 + fs));
      const pw = W * .74, ph = pw * 2.05, px = (W - pw) / 2, py = capTop + lines.length * fs * 1.3 + fs * 1.2;
      x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 60; x.shadowOffsetY = 24; rr(x, px, py, pw, ph, pw * .12); x.fillStyle = '#0c0d10'; x.fill(); x.restore();
      const b = pw * .035; x.save(); rr(x, px + b, py + b, pw - 2 * b, ph - 2 * b, pw * .095); x.clip();
      if (s) { const sw = pw - 2 * b; x.drawImage(s, px + b, py + b, sw, sw * s.height / s.width); }
      else { x.fillStyle = '#f4f3ee'; x.fillRect(px, py, pw, ph); x.fillStyle = '#9a9ca3'; x.font = `500 ${fs * .45}px ${FONT[lang]}`; x.fillText({ ko: '실제 앱 화면이 들어갈 자리', en: 'Your real app screen goes here', th: 'ใส่ภาพหน้าจอจริงของแอป' }[lang], W / 2, py + ph / 2); }
      x.restore();
      out.push(c.toDataURL('image/png'));
    }
    return out;
  }
  window.AAPGfx = { icons, feature, shots, avgColor, mix, onColor, img };
})();
