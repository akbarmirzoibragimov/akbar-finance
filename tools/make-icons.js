// Render icons/icon.svg into PNGs with headless Chrome (build-time only).
const { chromium } = require('/workspace/akbar-tools/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../icons/icon.svg'), 'utf8');
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  for (const [name, size, pad] of [['icon-180', 180, 0], ['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-512-maskable', 512, 0]]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<html><body style="margin:0;background:#000">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
    await p.screenshot({ path: path.join(__dirname, '../icons/' + name + '.png'), omitBackground: false });
    await p.close();
  }
  await b.close(); console.log('icons ok');
})();
