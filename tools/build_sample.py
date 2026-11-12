# sample/snapledger 폴더를 js/sample-data.js 로 묶는다 (file:// 로 열어도 샘플이 동작하도록)
import os, json, base64
root = os.path.join(os.path.dirname(__file__), '..', 'sample', 'snapledger')
out = {}
for dp, dn, fn in os.walk(root):
    for f in sorted(fn):
        p = os.path.join(dp, f); rel = os.path.relpath(p, root).replace(os.sep, '/')
        data = open(p, 'rb').read()
        if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            out[rel] = {'b64': base64.b64encode(data).decode()}
        else:
            out[rel] = {'text': data.decode('utf-8')}
js = '/* 자동 생성: tools/build_sample.py — 샘플 앱 SnapLedger 파일 묶음 */\nwindow.AAP_SAMPLE = ' + json.dumps({'name': 'SnapLedger (sample)', 'files': out}, ensure_ascii=False) + ';\n'
open(os.path.join(os.path.dirname(__file__), '..', 'js', 'sample-data.js'), 'w').write(js)
print(len(out), 'files', len(js)//1024, 'KB')
