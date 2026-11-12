/* AA Plug 2 — UI text lookup: chosen language → English → key.
   Five UI languages; English is the default (no browser/device detection). */
window.AAPi18n = {
  LANGS: ['en', 'ko', 'th', 'zh', 'hi'],
  DEFAULT: 'en',
  NATIVE: { en: 'English', ko: '한국어', th: 'ภาษาไทย', zh: '中文', hi: 'हिन्दी' },
  t(lang, key, vars) {
    const D = window.AAP_I18N; let s = (D[lang] && D[lang][key]) ?? (D.en && D.en[key]) ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
};
