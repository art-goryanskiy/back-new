import path from 'path';

const FONT_NAME = 'Cyrillic';

/**
 * Путь к TTF/WOFF2 шрифту с поддержкой кириллицы (PT Sans, @fontsource/pt-sans).
 * Используется в PDFKit для корректного отображения и извлечения русского текста.
 */
function getCyrillicFontPath(): string {
  try {
    const pkgPath = require.resolve('@fontsource/pt-sans/package.json');
    return path.join(path.dirname(pkgPath), 'files', 'pt-sans-cyrillic-400-normal.woff2');
  } catch {
    return path.join(
      process.cwd(),
      'node_modules',
      '@fontsource',
      'pt-sans',
      'files',
      'pt-sans-cyrillic-400-normal.woff2',
    );
  }
}

let fontPath: string | null = null;

export function getCyrillicFontPathCached(): string {
  if (fontPath === null) {
    fontPath = getCyrillicFontPath();
  }
  return fontPath;
}

export function registerCyrillicFont(doc: PDFKit.PDFDocument): void {
  const fontPath = getCyrillicFontPathCached();
  doc.registerFont(FONT_NAME, fontPath);
  doc.font(FONT_NAME);
}

export { FONT_NAME };
