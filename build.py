"""Builds dist/index.html (and dist/Baseline_Review_Tool_v<VERSION>.html) from src/ and the npm libraries."""
import os, gzip, base64, json
root = os.path.dirname(os.path.abspath(__file__)); src = os.path.join(root, 'src') + os.sep
FILES = ['engine1','engine2','engine3','engine4','engine5','engine6','engine7','xerfields','engine8','engine9','engine10','engine11','engine12','engine13','engine14','engine15','engine16'] + ['app%d' % i for i in range(1, 30)]
EFILES = [f for f in FILES if not f.startswith('app')]
js = ''.join(open(src + f + '.js', encoding='utf-8').read() + '\n' for f in FILES)
esrc = ''.join(open(src + f + '.js', encoding='utf-8').read() + '\n' for f in EFILES)
NM = os.path.join(root, 'node_modules') + os.sep
LIBF = {'xlsx':'xlsx/dist/xlsx.full.min.js','exceljs':'exceljs/dist/exceljs.min.js','docx':'docx/build/index.umd.js','jszip':'jszip/dist/jszip.min.js','pdfjs':'pdfjs-dist/build/pdf.min.js','pdfworker':'pdfjs-dist/build/pdf.worker.min.js'}
LD = {k: base64.b64encode(gzip.compress(open(NM + v, 'rb').read(), 9)).decode() for k, v in LIBF.items()}
VER = open(src + 'VERSION').read().strip()
esrc = esrc.replace("E.VERSION = '1.0'", "E.VERSION = '" + VER + "'")
js = 'const LIBDATA=' + json.dumps(LD) + ';\nconst ENGINE_SRC=' + json.dumps(esrc) + ';\n' + js
html = open(src + 'shell.html', encoding='utf-8').read().replace('/*__JS__*/', js.replace('</script>', '<\\/script>').replace("E.VERSION = '1.0'", "E.VERSION = '" + VER + "'")).replace('__VERSION__', VER)
out = os.path.join(root, 'dist'); os.makedirs(out, exist_ok=True)
for name in ('index.html', 'Baseline_Review_Tool_v' + VER + '.html'):
    open(os.path.join(out, name), 'w', encoding='utf-8').write(html)
open(os.path.join(out, '_headers'), 'w').write(open(os.path.join(root, '_headers')).read())
print(len(html) // 1024, 'KB -> dist/index.html  v' + VER)
