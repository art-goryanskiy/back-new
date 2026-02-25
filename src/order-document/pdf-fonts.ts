import fs from 'fs';
import path from 'path';

const FONT_NAME = 'Cyrillic';
const TTF_FONT_FILE = 'PT_Serif-Web-Regular.ttf';

/**
 * Путь к TTF шрифту с поддержкой кириллицы (PT Serif).
 * Файл скачивается в assets/fonts при postinstall или в Docker build.
 */
function getCyrillicFontPath(): string | null {
  const fontPath = path.join(process.cwd(), 'assets', 'fonts', TTF_FONT_FILE);
  return fs.existsSync(fontPath) ? fontPath : null;
}

let fontPathCache: string | null | undefined = undefined;

function getCyrillicFontPathCached(): string | null {
  if (fontPathCache === undefined) {
    fontPathCache = getCyrillicFontPath();
  }
  return fontPathCache;
}

/**
 * Регистрирует и включает шрифт с кириллицей для PDFKit.
 * Если TTF недоступен или регистрация падает (например fontkit с WOFF2) — шрифт не меняется, приложение не падает.
 */
export function registerCyrillicFont(doc: PDFKit.PDFDocument): void {
  try {
    const fontPath = getCyrillicFontPathCached();
    if (!fontPath) return;
    doc.registerFont(FONT_NAME, fontPath);
    doc.font(FONT_NAME);
  } catch {
    // Шрифт недоступен или fontkit ошибка — оставляем стандартный шрифт
  }
}
