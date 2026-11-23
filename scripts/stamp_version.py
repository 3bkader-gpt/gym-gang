"""Stamp content-hash cache-busting query strings (?v=<sha8>) on all CSS/JS references
in public/index.html and public/admin.html, and write BUILD_VERSION into functions/_lib/util.js."""
import hashlib, os, re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PUBLIC = os.path.join(ROOT, 'public')

def file_hash(rel_path):
    full = os.path.join(PUBLIC, rel_path.lstrip('/'))
    data = open(full, 'rb').read()
    return hashlib.sha256(data).hexdigest()[:8]

combined = hashlib.sha256()
for sub in ('css', 'js'):
    folder = os.path.join(PUBLIC, sub)
    for name in sorted(os.listdir(folder)):
        if name.endswith(('.css', '.js')):
            combined.update(open(os.path.join(folder, name), 'rb').read())
build_version = combined.hexdigest()[:10]

def stamp_html(html_path):
    text = open(html_path, 'r', encoding='utf-8').read()
    def repl(match):
        prefix, path, quote = match.group(1), match.group(2), match.group(3)
        clean_path = path.split('?')[0]
        h = file_hash(clean_path)
        return f'{prefix}{clean_path}?v={h}{quote}'

    text = re.sub(r'((?:href|src)=["\'])(/(?:css|js)/[^"\']+)(["\'])', repl, text)
    if 'name="app-version"' in text:
        text = re.sub(r'<meta name="app-version" content="[^"]*">', f'<meta name="app-version" content="{build_version}">', text)
    else:
        text = text.replace('<meta name="theme-color"', f'<meta name="app-version" content="{build_version}">\n  <meta name="theme-color"', 1)
    open(html_path, 'w', encoding='utf-8').write(text)

stamp_html(os.path.join(PUBLIC, 'index.html'))
stamp_html(os.path.join(PUBLIC, 'admin.html'))

util_path = os.path.join(ROOT, 'functions', '_lib', 'util.js')
util_text = open(util_path, 'r', encoding='utf-8').read()
if 'export const BUILD_VERSION =' in util_text:
    util_text = re.sub(r"export const BUILD_VERSION = '[^']*';", f"export const BUILD_VERSION = '{build_version}';", util_text)
else:
    util_text = f"export const BUILD_VERSION = '{build_version}';\n" + util_text
open(util_path, 'w', encoding='utf-8').write(util_text)

print('Stamped build version:', build_version)
