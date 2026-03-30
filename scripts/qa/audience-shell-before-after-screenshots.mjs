import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";
import { buildQaAudienceFixture } from "../../src/apps/Mobile/qaAudienceFixtures.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const DIST_DIR = path.join(repoRoot, "dist");
const OUTPUT_DIR = path.join(repoRoot, "artifacts", "qa", "audience-shell-before-after");
const DEFAULT_PORT = 0;
const DEFAULT_TIMEOUT_MS = 90000;
const ROOM_CODE = "DEMOAUD";

const FIREBASE_RUNTIME_CONFIG = {
  apiKey: "AIzaSyBmX0XXpGE0wGcR9YXw3oKOqnJE9GT6_Jc",
  authDomain: "beaurocks-karaoke-v2.firebaseapp.com",
  projectId: "beaurocks-karaoke-v2",
  storageBucket: "beaurocks-karaoke-v2.firebasestorage.app",
  messagingSenderId: "426849563936",
  appId: "1:426849563936:web:03c1d7eefd0c66e4649345",
  measurementId: "G-KRHWBTB7V7",
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeXml = (value = "") => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

const resolveDistFilePath = async (requestPath = "/") => {
  const normalized = decodeURIComponent(String(requestPath || "/")).split("?")[0];
  const trimmed = normalized.replace(/^\/+/, "");
  const joined = path.resolve(DIST_DIR, trimmed || "index.html");
  if (!joined.startsWith(DIST_DIR)) return path.join(DIST_DIR, "index.html");
  try {
    const stats = await fs.stat(joined);
    if (stats.isDirectory()) return path.join(joined, "index.html");
    return joined;
  } catch {
    return path.join(DIST_DIR, "index.html");
  }
};

const startLocalServer = async ({ port }) => {
  await fs.access(path.join(DIST_DIR, "index.html"));
  const server = http.createServer(async (req, res) => {
    try {
      const filePath = await resolveDistFilePath(req?.url || "/");
      const body = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Server error: ${String(error?.message || error)}`);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    baseUrl: `http://127.0.0.1:${actualPort}`,
    stop: async () => {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
};

const captureFixture = async (page, fixtureId, baseUrl, outputPath, timeoutMs) => {
  const fixture = buildQaAudienceFixture(fixtureId, { roomCode: ROOM_CODE });
  if (!fixture) throw new Error(`Unknown audience fixture: ${fixtureId}`);

  await page.goto(`${baseUrl}/?mode=audience-qa&room=${encodeURIComponent(ROOM_CODE)}&qaAudienceFixture=${encodeURIComponent(fixtureId)}`, {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });

  await page.waitForFunction(() => !!document.querySelector('[data-audience-qa-ready="true"]'), { timeout: timeoutMs });
  await delay(350);
  await page.screenshot({ path: outputPath, fullPage: true });
};

const buildComparison = async ({ leftPath, rightPath, outputPath, title }) => {
  const left = sharp(leftPath);
  const right = sharp(rightPath);
  const [leftMeta, rightMeta] = await Promise.all([left.metadata(), right.metadata()]);
  const width = Math.max(leftMeta.width || 430, rightMeta.width || 430);
  const leftBuffer = await left.resize({ width }).png().toBuffer();
  const rightBuffer = await right.resize({ width }).png().toBuffer();
  const resizedLeftMeta = await sharp(leftBuffer).metadata();
  const resizedRightMeta = await sharp(rightBuffer).metadata();
  const cardWidth = width;
  const cardHeight = Math.max(resizedLeftMeta.height || 932, resizedRightMeta.height || 932);
  const headerHeight = 96;
  const gap = 32;
  const padding = 32;
  const canvasWidth = (cardWidth * 2) + gap + (padding * 2);
  const canvasHeight = cardHeight + headerHeight + (padding * 2);

  const titleSvg = Buffer.from(`
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#12091f"/>
          <stop offset="52%" stop-color="#0b1525"/>
          <stop offset="100%" stop-color="#13262f"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <text x="${padding}" y="46" fill="#9be7f3" font-size="16" font-family="Arial, sans-serif" letter-spacing="4">AUDIENCE UX</text>
      <text x="${padding}" y="76" fill="#ffffff" font-size="30" font-weight="700" font-family="Arial, sans-serif">${title}</text>
      <text x="${padding}" y="112" fill="#9ca3af" font-size="16" font-family="Arial, sans-serif">Classic on the left, streamlined on the right.</text>
      <text x="${padding}" y="${headerHeight + padding - 8}" fill="#d1d5db" font-size="18" font-weight="700" font-family="Arial, sans-serif">Before</text>
      <text x="${padding + cardWidth + gap}" y="${headerHeight + padding - 8}" fill="#d1d5db" font-size="18" font-weight="700" font-family="Arial, sans-serif">After</text>
    </svg>
  `);

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: "#0b0b12",
    },
  })
    .composite([
      { input: titleSvg, top: 0, left: 0 },
      { input: leftBuffer, top: headerHeight + padding, left: padding },
      { input: rightBuffer, top: headerHeight + padding, left: padding + cardWidth + gap },
    ])
    .png()
    .toFile(outputPath);
};

const buildPresentationBoard = async ({
  leftPath,
  rightPath,
  outputPath,
  title,
  subtitle,
  leftLabel = "Before",
  rightLabel = "After",
  leftBullets = [],
  rightBullets = [],
}) => {
  const left = sharp(leftPath);
  const right = sharp(rightPath);
  const [leftMeta, rightMeta] = await Promise.all([left.metadata(), right.metadata()]);
  const width = Math.max(leftMeta.width || 430, rightMeta.width || 430);
  const leftBuffer = await left.resize({ width }).png().toBuffer();
  const rightBuffer = await right.resize({ width }).png().toBuffer();
  const resizedLeftMeta = await sharp(leftBuffer).metadata();
  const resizedRightMeta = await sharp(rightBuffer).metadata();
  const cardWidth = width;
  const cardHeight = Math.max(resizedLeftMeta.height || 932, resizedRightMeta.height || 932);
  const gap = 32;
  const padding = 36;
  const headerHeight = 132;
  const footerHeight = 280;
  const canvasWidth = (cardWidth * 2) + gap + (padding * 2);
  const canvasHeight = headerHeight + cardHeight + footerHeight + (padding * 2);
  const columnWidth = cardWidth;
  const calloutTop = headerHeight + cardHeight + padding + 28;

  const renderBulletBlock = (items = [], columnX = 0, accent = "#9be7f3") => items
    .map((item, index) => {
      const y = calloutTop + 62 + (index * 54);
      return `
        <circle cx="${columnX + 18}" cy="${y - 7}" r="5" fill="${accent}" />
        <text x="${columnX + 38}" y="${y}" fill="#f8fafc" font-size="19" font-weight="600" font-family="Arial, sans-serif">${escapeXml(item)}</text>
      `;
    })
    .join("");

  const overlaySvg = Buffer.from(`
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#140b20"/>
          <stop offset="48%" stop-color="#091220"/>
          <stop offset="100%" stop-color="#0f2230"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" />
      <text x="${padding}" y="46" fill="#9be7f3" font-size="16" font-family="Arial, sans-serif" letter-spacing="4">AUDIENCE UX</text>
      <text x="${padding}" y="82" fill="#ffffff" font-size="34" font-weight="700" font-family="Arial, sans-serif">${escapeXml(title)}</text>
      <text x="${padding}" y="114" fill="#9ca3af" font-size="18" font-family="Arial, sans-serif">${escapeXml(subtitle)}</text>

      <text x="${padding}" y="${headerHeight + padding - 8}" fill="#d1d5db" font-size="19" font-weight="700" font-family="Arial, sans-serif">${escapeXml(leftLabel)}</text>
      <text x="${padding + columnWidth + gap}" y="${headerHeight + padding - 8}" fill="#d1d5db" font-size="19" font-weight="700" font-family="Arial, sans-serif">${escapeXml(rightLabel)}</text>

      <rect x="${padding}" y="${headerHeight + cardHeight + padding}" width="${columnWidth}" height="${footerHeight - 22}" rx="28" fill="rgba(8,15,30,0.52)" stroke="rgba(255,255,255,0.12)" />
      <rect x="${padding + columnWidth + gap}" y="${headerHeight + cardHeight + padding}" width="${columnWidth}" height="${footerHeight - 22}" rx="28" fill="rgba(8,15,30,0.52)" stroke="rgba(255,255,255,0.12)" />

      <text x="${padding + 24}" y="${calloutTop + 12}" fill="#f8fafc" font-size="24" font-weight="700" font-family="Arial, sans-serif">${escapeXml(leftLabel)} key changes</text>
      <text x="${padding + columnWidth + gap + 24}" y="${calloutTop + 12}" fill="#f8fafc" font-size="24" font-weight="700" font-family="Arial, sans-serif">${escapeXml(rightLabel)} key changes</text>

      ${renderBulletBlock(leftBullets, padding + 24, "#f472b6")}
      ${renderBulletBlock(rightBullets, padding + columnWidth + gap + 24, "#22d3ee")}
    </svg>
  `);

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: "#09090f",
    },
  })
    .composite([
      { input: overlaySvg, top: 0, left: 0 },
      { input: leftBuffer, top: headerHeight + padding, left: padding },
      { input: rightBuffer, top: headerHeight + padding, left: padding + cardWidth + gap },
    ])
    .png()
    .toFile(outputPath);
};

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const port = Math.max(0, Number(process.env.QA_PORT || DEFAULT_PORT));
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript((firebaseConfig) => {
    if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
  }, FIREBASE_RUNTIME_CONFIG);
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });

  const server = await startLocalServer({ port });

  try {
    const classicHomePath = path.join(OUTPUT_DIR, "classic-home.png");
    const streamlinedHomePath = path.join(OUTPUT_DIR, "streamlined-home.png");
    const classicTriviaPath = path.join(OUTPUT_DIR, "classic-trivia.png");
    const streamlinedTriviaPath = path.join(OUTPUT_DIR, "streamlined-trivia.png");

    await captureFixture(page, "classic-home", server.baseUrl, classicHomePath, timeoutMs);
    await captureFixture(page, "streamlined-home", server.baseUrl, streamlinedHomePath, timeoutMs);
    await captureFixture(page, "classic-trivia", server.baseUrl, classicTriviaPath, timeoutMs);
    await captureFixture(page, "streamlined-trivia", server.baseUrl, streamlinedTriviaPath, timeoutMs);

    await buildComparison({
      leftPath: classicHomePath,
      rightPath: streamlinedHomePath,
      outputPath: path.join(OUTPUT_DIR, "compare-home-before-after.png"),
      title: "Home Shell Comparison",
    });
    await buildComparison({
      leftPath: classicTriviaPath,
      rightPath: streamlinedTriviaPath,
      outputPath: path.join(OUTPUT_DIR, "compare-live-mode-before-after.png"),
      title: "Live Mode Comparison",
    });
    await buildPresentationBoard({
      leftPath: classicHomePath,
      rightPath: streamlinedHomePath,
      outputPath: path.join(OUTPUT_DIR, "presentation-home-before-after.png"),
      title: "Audience Shell Simplification",
      subtitle: "The streamlined version reduces persistent navigation and moves secondary actions into contextual shortcuts.",
      leftBullets: [
        "Bottom nav carries Party, Songs, Social, and Profile.",
        "Social and profile controls compete with the stage view.",
        "More room state is visible at the same time.",
      ],
      rightBullets: [
        "Bottom nav is reduced to Party and Songs only.",
        "Chat, host contact, and profile move into Party shortcuts.",
        "The home view keeps attention on the room and queue.",
      ],
    });
    await buildPresentationBoard({
      leftPath: classicTriviaPath,
      rightPath: streamlinedTriviaPath,
      outputPath: path.join(OUTPUT_DIR, "presentation-live-mode-before-after.png"),
      title: "Live Mode Takeover",
      subtitle: "Streamlined rooms open crowd-directed modes as focused full-screen takeovers instead of embedding them inside the standard shell.",
      leftBullets: [
        "Trivia lives inside the normal shell.",
        "Navigation stays visible during the break.",
        "People can keep drifting to other tabs mid-mode.",
      ],
      rightBullets: [
        "The live mode takes over the full screen by default.",
        "Navigation is tucked away until the user minimizes it.",
        "A Live Mode pill gives people a clear path back in.",
      ],
    });

    console.log(`Saved screenshots to ${OUTPUT_DIR}`);
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
