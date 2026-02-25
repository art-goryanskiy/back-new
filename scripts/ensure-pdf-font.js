/**
 * Скачивает TTF шрифт PT Serif (кириллица) для генерации PDF, если файл ещё нет.
 * Вызывается из postinstall и из Dockerfile.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const FONT_DIR = path.join(process.cwd(), 'assets', 'fonts');
const FONT_FILE = 'PT_Serif-Web-Regular.ttf';
const FONT_PATH = path.join(FONT_DIR, FONT_FILE);
const FONT_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/ptserif/PT_Serif-Web-Regular.ttf';

if (fs.existsSync(FONT_PATH)) {
  process.exit(0);
}

try {
  fs.mkdirSync(FONT_DIR, { recursive: true });
} catch (e) {
  console.warn('ensure-pdf-font: mkdir failed', e.message);
  process.exit(0);
}

const file = fs.createWriteStream(FONT_PATH);
https
  .get(FONT_URL, (res) => {
    if (res.statusCode !== 200) {
      file.close();
      try {
        fs.unlinkSync(FONT_PATH);
      } catch (_) {}
      console.warn('ensure-pdf-font: download failed', res.statusCode);
      process.exit(0);
      return;
    }
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      process.exit(0);
    });
  })
  .on('error', (err) => {
    file.close();
    try {
      if (fs.existsSync(FONT_PATH)) fs.unlinkSync(FONT_PATH);
    } catch (_) {}
    console.warn('ensure-pdf-font: request failed', err.message);
    process.exit(0);
  });
