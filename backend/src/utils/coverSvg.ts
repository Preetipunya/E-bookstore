const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/.{0,2}$/, '') + '...';
    return kept;
  }
  return lines;
}

export interface CoverInput {
  id: number;
  title: string;
  author: string;
  description: string;
  color1: string;
  color2: string;
  category: string;
}

export function coverSvg(b: CoverInput, side: 'front' | 'back' = 'front'): string {
  const W = 400;
  const H = 600;
  const defs = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${esc(b.color1)}"/><stop offset="1" stop-color="${esc(b.color2)}"/></linearGradient></defs>`;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(b.title)} by ${esc(b.author)}">${defs}<rect width="${W}" height="${H}" fill="url(#g)"/>`;
  if (side === 'back') {
    const lines = wrapText(b.description, 34, 11);
    const text = lines.map((l, i) => `<text x="40" y="${150 + i * 26}" font-size="16" fill="#ffffff" fill-opacity="0.9" font-family="Georgia,serif">${esc(l)}</text>`).join('');
    return `${open}<rect x="20" y="20" width="360" height="560" fill="none" stroke="#fff" stroke-opacity="0.35"/><text x="40" y="80" font-size="14" letter-spacing="3" fill="#fff" fill-opacity="0.7" font-family="Arial,sans-serif">${esc(b.category.toUpperCase())}</text><text x="40" y="115" font-size="20" font-weight="700" fill="#fff" font-family="Georgia,serif">${esc(wrapText(b.title, 26, 1)[0])}</text>${text}<rect x="40" y="500" width="120" height="50" fill="#fff"/><g stroke="#000" stroke-width="2">${Array.from({ length: 16 }, (_, i) => `<line x1="${48 + i * 7}" y1="508" x2="${48 + i * 7}" y2="542"/>`).join('')}</g></svg>`;
  }
  const shapes = [
    `<circle cx="200" cy="170" r="70" fill="#fff" fill-opacity="0.18"/><circle cx="200" cy="170" r="38" fill="#fff" fill-opacity="0.25"/>`,
    `<polygon points="200,100 270,230 130,230" fill="#fff" fill-opacity="0.2"/>`,
    `<rect x="130" y="100" width="140" height="140" rx="12" fill="#fff" fill-opacity="0.18" transform="rotate(12 200 170)"/>`,
    `<path d="M60 230 Q200 80 340 230" stroke="#fff" stroke-opacity="0.35" stroke-width="14" fill="none"/><circle cx="200" cy="150" r="26" fill="#fff" fill-opacity="0.3"/>`,
  ];
  const titleLines = wrapText(b.title.toUpperCase(), 14, 4);
  const title = titleLines
    .map((l, i) => `<text x="200" y="${330 + i * 44}" text-anchor="middle" font-size="38" font-weight="800" fill="#ffffff" font-family="Georgia,serif">${esc(l)}</text>`)
    .join('');
  return `${open}${shapes[b.id % shapes.length]}${title}<text x="200" y="548" text-anchor="middle" font-size="18" letter-spacing="3" fill="#ffffff" fill-opacity="0.9" font-family="Arial,sans-serif">${esc(wrapText(b.author.toUpperCase(), 24, 1)[0])}</text></svg>`;
}
