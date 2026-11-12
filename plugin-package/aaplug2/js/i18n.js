/* AA Plug 2 — 문구 찾기: 고른 언어 → 영어 → 키 */
window.AAPi18n = {
  t(lang, key, vars) {
    const D = window.AAP_I18N; let s = (D[lang] && D[lang][key]) ?? (D.en && D.en[key]) ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
};
