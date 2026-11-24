// Builds akbar-finance-standalone.html: one file with all CSS/JS/icons inlined. No network needed.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');
html = html.replace('<link rel="stylesheet" href="src/styles.css">', () => '<style>\n' + rd('src/styles.css') + '\n</style>');
html = html.replace(/<script src="(src\/[^"]+)"><\/script>/g, (m, p) => '<script>\n' + safe(rd(p)) + '\n</script>');
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'icons/icon-180.png')).toString('base64');
html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '');
html = html.replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/png" href="' + icon + '">');
html = html.replace(/<link rel="apple-touch-icon"[^>]*>/, '<link rel="apple-touch-icon" href="' + icon + '">');
html = html.replace("default-src 'self'", "default-src 'none'").replace("connect-src 'self'", "connect-src 'none'");
html = html.replace('<script>\n', '<script>window.AF_STANDALONE = true;</script>\n<script>\n');
if (/src="src\/|href="src\//.test(html)) throw new Error('unresolved local reference');
fs.writeFileSync(path.join(root, 'akbar-finance-standalone.html'), html);
console.log('standalone written', (html.length / 1024).toFixed(0) + ' KB');
