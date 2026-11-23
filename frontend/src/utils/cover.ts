const PALETTES: Record<string, [string, string]> = {
  rose: ['#e11d48', '#4a044e'],
  night: ['#1e3a5f', '#07101f'],
  teal: ['#0f766e', '#042f2e'],
  dusk: ['#c2410c', '#312e81'],
  slate: ['#475569', '#0f172a'],
  gold: ['#facc15', '#a16207'],
  green: ['#15803d', '#052e16'],
  red: ['#dc2626', '#4c0519'],
  plum: ['#7e22ce', '#2e1065'],
  sky: ['#0284c7', '#0c4a6e'],
  orange: ['#f97316', '#9a3412'],
  blue: ['#1d4ed8', '#0b1d4d'],
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if ((cur + ' ' + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

const SHAPES = [
  '<circle cx="200" cy="170" r="70" fill="#fff" fill-opacity="0.18"/><circle cx="200" cy="170" r="38" fill="#fff" fill-opacity="0.25"/>',
  '<polygon points="200,100 270,230 130,230" fill="#fff" fill-opacity="0.2"/>',
  '<rect x="130" y="100" width="140" height="140" rx="12" fill="#fff" fill-opacity="0.18" transform="rotate(12 200 170)"/>',
  '<path d="M60 230 Q200 80 340 230" stroke="#fff" stroke-opacity="0.35" stroke-width="14" fill="none"/><circle cx="200" cy="150" r="26" fill="#fff" fill-opacity="0.3"/>',
];

const cache = new Map<string, string>();

/** Builds an inline SVG data-URI cover so the app needs no image files or network. */
export function coverFor(image: string, title: string, author: string, id: number): string {
  const key = `${image}|${title}|${author}|${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const token = image.replace('cover://', '');
  const [c1, c2] = PALETTES[token] ?? PALETTES.slate;
  const titleLines = wrap(title.toUpperCase(), 13, 4);
  const titleSvg = titleLines
    .map((l, i) => `<text x="200" y="${330 + i * 44}" text-anchor="middle" font-size="38" font-weight="800" fill="#fff" font-family="Georgia,serif">${esc(l)}</text>`)
    .join('');
  const authorLine = wrap(author.toUpperCase(), 26, 1)[0] ?? '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/>${SHAPES[id % SHAPES.length]}${titleSvg}<text x="200" y="548" text-anchor="middle" font-size="18" letter-spacing="3" fill="#fff" fill-opacity="0.9" font-family="Arial,sans-serif">${esc(authorLine)}</text></svg>`;
  const uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  cache.set(key, uri);
  return uri;
}
