import fs from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp from 'sharp';

const root = process.cwd();
const outDir = path.join(root, 'artifacts', 'printouts');
const svgPath = path.join(outDir, 'beaurocks-night-rules-onepager.svg');
const pngPath = path.join(outDir, 'beaurocks-night-rules-onepager.png');

const W = 2550;
const H = 3300;
const margin = 145;
const joinUrl = process.env.BEAUROCKS_JOIN_URL || 'https://beau.rocks/join';

const colors = {
  ink: '#f7fbff',
  muted: '#aeb8cc',
  dark: '#070711',
  panel: '#10111f',
  panel2: '#17192a',
  pink: '#ff2ba6',
  cyan: '#22d8ff',
  lime: '#b7ff3c',
  gold: '#ffd166',
  violet: '#8c5cff',
};

const esc = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const font = "'Inter', 'Arial', 'Helvetica', sans-serif";

function imageHref(file) {
  return fs.readFile(path.join(root, file)).then((buf) => {
    const mime = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buf.toString('base64')}`;
  });
}

function wordsWrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textLines(lines, x, y, opts = {}) {
  const size = opts.size || 42;
  const fill = opts.fill || colors.ink;
  const weight = opts.weight || 600;
  const lineHeight = opts.lineHeight || Math.round(size * 1.25);
  const anchor = opts.anchor || 'start';
  return lines
    .map((line, index) => {
      const dy = index * lineHeight;
      return `<text x="${x}" y="${y + dy}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(line)}</text>`;
    })
    .join('\n');
}

function wrappedText(text, x, y, maxChars, opts = {}) {
  return textLines(wordsWrap(text, maxChars), x, y, opts);
}

function pill(x, y, width, height, label, fill, stroke = 'none') {
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="42" fill="${fill}" stroke="${stroke}" stroke-width="5"/>
    <text x="${x + width / 2}" y="${y + height / 2 + 17}" font-family="${font}" font-size="40" font-weight="900" fill="${colors.dark}" text-anchor="middle">${esc(label)}</text>
  `;
}

function section({ x, y, w, h, title, kicker, accent, children }) {
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="${colors.panel}" stroke="${accent}" stroke-width="5"/>
    <rect x="${x}" y="${y}" width="${w}" height="24" rx="12" fill="${accent}"/>
    <text x="${x + 44}" y="${y + 88}" font-family="${font}" font-size="34" font-weight="900" fill="${accent}" letter-spacing="2">${esc(kicker)}</text>
    <text x="${x + 44}" y="${y + 145}" font-family="${font}" font-size="58" font-weight="950" fill="${colors.ink}">${esc(title)}</text>
    ${children}
  `;
}

function numbered(items, x, y, width, accent) {
  let cursor = y;
  const parts = [];
  items.forEach((item, index) => {
    const lines = wordsWrap(item, width);
    parts.push(`<circle cx="${x + 22}" cy="${cursor - 11}" r="22" fill="${accent}"/>`);
    parts.push(`<text x="${x + 22}" y="${cursor + 2}" font-family="${font}" font-size="27" font-weight="950" fill="${colors.dark}" text-anchor="middle">${index + 1}</text>`);
    parts.push(textLines(lines, x + 64, cursor, { size: 34, weight: 700, fill: colors.ink, lineHeight: 43 }));
    cursor += lines.length * 43 + 22;
  });
  return parts.join('\n');
}

function bullets(items, x, y, width, accent) {
  let cursor = y;
  const parts = [];
  items.forEach((item) => {
    const [lead, rest] = item.split('|');
    const body = rest ? `${lead}: ${rest}` : lead;
    const lines = wordsWrap(body, width);
    parts.push(`<rect x="${x}" y="${cursor - 23}" width="24" height="24" rx="7" fill="${accent}"/>`);
    parts.push(textLines(lines, x + 52, cursor, { size: 32, weight: 700, fill: colors.ink, lineHeight: 41 }));
    cursor += lines.length * 41 + 19;
  });
  return parts.join('\n');
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const [logo, qr] = await Promise.all([
    imageHref('public/images/logo-library/beaurocks-logo-neon trasnparent.png'),
    QRCode.toDataURL(joinUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 620,
      color: { dark: '#05050b', light: '#ffffff' },
    }),
  ]);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#05050b"/>
      <stop offset="0.45" stop-color="#121025"/>
      <stop offset="1" stop-color="#090b14"/>
    </linearGradient>
    <radialGradient id="glowPink" cx="16%" cy="10%" r="52%">
      <stop offset="0" stop-color="#ff2ba6" stop-opacity="0.46"/>
      <stop offset="1" stop-color="#ff2ba6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowCyan" cx="86%" cy="20%" r="46%">
      <stop offset="0" stop-color="#22d8ff" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#22d8ff" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="24" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glowPink)"/>
  <rect width="${W}" height="${H}" fill="url(#glowCyan)"/>
  <path d="M0 480 C420 390 630 620 1020 500 S1760 260 2550 430" fill="none" stroke="${colors.pink}" stroke-width="9" opacity="0.65"/>
  <path d="M0 620 C510 510 720 810 1180 650 S1810 410 2550 560" fill="none" stroke="${colors.cyan}" stroke-width="8" opacity="0.55"/>

  <g filter="url(#shadow)">
    <image href="${logo}" x="${margin - 10}" y="96" width="430" height="287" preserveAspectRatio="xMidYMid meet"/>
    <text x="590" y="188" font-family="${font}" font-size="92" font-weight="950" fill="${colors.ink}">Karaoke Night</text>
    <text x="594" y="254" font-family="${font}" font-size="43" font-weight="800" fill="${colors.cyan}" letter-spacing="3">GUEST RULES + HELPER FLOW</text>
    <text x="594" y="316" font-family="${font}" font-size="38" font-weight="650" fill="${colors.muted}">Scan in, queue songs, donate, and watch the leaderboard climb.</text>
  </g>

  <g transform="translate(1780 105)">
    <rect x="0" y="0" width="625" height="725" rx="34" fill="#ffffff" filter="url(#shadow)"/>
    <image href="${qr}" x="38" y="36" width="548" height="548"/>
    <rect x="42" y="598" width="540" height="84" rx="24" fill="${colors.dark}"/>
    <text x="312" y="653" font-family="${font}" font-size="42" font-weight="950" fill="${colors.lime}" text-anchor="middle">SCAN TO JOIN ROOM</text>
  </g>

  ${pill(146, 468, 362, 86, '1. CHECK IN', colors.gold)}
  ${pill(542, 468, 362, 86, '2. WRISTBAND', colors.cyan)}
  ${pill(938, 468, 362, 86, '3. SCAN QR', colors.lime)}
  ${pill(1334, 468, 362, 86, '4. SING', colors.pink)}

  ${section({
    x: margin,
    y: 650,
    w: 1085,
    h: 690,
    title: 'Guest Flow',
    kicker: 'CHECK-IN SCRIPT',
    accent: colors.gold,
    children: `
      ${numbered([
        'Verify ticket or purchase confirmation.',
        'Give wristband after check-in. Mark 21+ only after ID is verified.',
        'Point to the QR code for songs, donations, credits, and leaderboard.',
        'If scanning fails, send the guest to the tech helper.'
      ], margin + 54, 855, 44, colors.gold)}
      <rect x="${margin + 54}" y="1248" width="975" height="58" rx="18" fill="${colors.panel2}" stroke="${colors.gold}" stroke-width="3"/>
      <text x="${margin + 86}" y="1288" font-family="${font}" font-size="31" font-weight="850" fill="${colors.ink}">Say: "Scan this to join the room and submit songs."</text>
    `
  })}

  ${section({
    x: 1320,
    y: 860,
    w: 1085,
    h: 540,
    title: 'Song Queue',
    kicker: 'HOW SINGERS GET UP',
    accent: colors.cyan,
    children: `
      ${numbered([
        'Guest scans QR and joins the room.',
        'They search a song and submit with their name.',
        'Queue helper checks the next names for the host.',
        'One active song unless boosted or host approved.'
      ], 1374, 1060, 45, colors.cyan)}
    `
  })}

  ${section({
    x: margin,
    y: 1410,
    w: 1085,
    h: 625,
    title: 'Credits + Points',
    kicker: 'SCORING BASICS',
    accent: colors.lime,
    children: `
      ${bullets([
        'Entry credits|Each checked-in guest starts with the event credit amount.',
        'Credits can buy|Song requests, queue boosts, special rounds, or performer support.',
        'Points come from|Performing, crowd energy, donations, challenges, and host bonuses.',
        'Host call|Host has final say on queue order and bonus awards.'
      ], margin + 60, 1622, 45, colors.lime)}
    `
  })}

  ${section({
    x: 1320,
    y: 1410,
    w: 1085,
    h: 625,
    title: 'Donations',
    kicker: 'GIVEBUTTER FLOW',
    accent: colors.pink,
    children: `
      ${bullets([
        'All donations|Run through Givebutter from the QR code.',
        'Donation helper|Helps guests find the page and confirms visible donations.',
        'Do not promise points|Apply credits only by the night rules.',
        'Cash handling|Only assigned helpers touch cash, if accepted.'
      ], 1380, 1622, 45, colors.pink)}
    `
  })}

  <g filter="url(#shadow)">
    <rect x="${margin}" y="2110" width="2260" height="560" rx="30" fill="${colors.panel}" stroke="${colors.violet}" stroke-width="5"/>
    <rect x="${margin}" y="2110" width="2260" height="24" rx="12" fill="${colors.violet}"/>
    <text x="${margin + 54}" y="2214" font-family="${font}" font-size="34" font-weight="900" fill="${colors.violet}" letter-spacing="2">TOP OF EVERY HOUR</text>
    <text x="${margin + 54}" y="2280" font-family="${font}" font-size="62" font-weight="950" fill="${colors.ink}">Leaderboard Check</text>
    ${numbered([
      'Check leaderboard totals and pending Givebutter donations.',
      'Confirm manual bonuses with the host before announcing.',
      'Give the host the top names and any prize notes.',
      'Announce hourly winners, then keep the queue moving.'
    ], margin + 64, 2376, 68, colors.violet)}
    <rect x="1588" y="2250" width="690" height="310" rx="28" fill="${colors.panel2}" stroke="${colors.violet}" stroke-width="3"/>
    <text x="1933" y="2334" font-family="${font}" font-size="37" font-weight="950" fill="${colors.gold}" text-anchor="middle">AWARD IDEAS</text>
    ${wrappedText('Top singer, biggest donation push, best crowd energy, funniest performance, best duet, or host choice.', 1642, 2410, 34, { size: 31, weight: 700, fill: colors.ink, lineHeight: 41 })}
  </g>

  <g>
    <text x="${margin}" y="2796" font-family="${font}" font-size="44" font-weight="950" fill="${colors.ink}">Quick Rules</text>
    <text x="${margin}" y="2860" font-family="${font}" font-size="34" font-weight="700" fill="${colors.muted}">Respect performers. Be ready when called. Missed turns may move down. Boosts go through the room. Givebutter handles donations.</text>
    <rect x="${margin}" y="2928" width="2260" height="118" rx="28" fill="#05050b" stroke="${colors.cyan}" stroke-width="4"/>
    <text x="${margin + 54}" y="3003" font-family="${font}" font-size="39" font-weight="900" fill="${colors.ink}">Helper mantra:</text>
    <text x="${margin + 470}" y="3003" font-family="${font}" font-size="38" font-weight="800" fill="${colors.cyan}">Check ticket. Wristband. Scan QR. Queue song. Keep it moving.</text>
    <text x="${W - margin}" y="3232" font-family="${font}" font-size="30" font-weight="650" fill="${colors.muted}" text-anchor="end">QR target: ${esc(joinUrl)} | Replace with live room link before final printing if needed.</text>
  </g>
</svg>`;

  await fs.writeFile(svgPath, svg, 'utf8');
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  console.log(`Wrote ${svgPath}`);
  console.log(`Wrote ${pngPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
