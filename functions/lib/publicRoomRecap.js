const DEFAULT_PUBLIC_RECAP_ORIGIN = "https://app.beaurocks.app";
const DEFAULT_BEAUROCKS_LOGO_URL = "/images/logo-library/beaurocks-logo-neon trasnparent.png";
const AAHF_RECAP_LOGO_URL = "/images/marketing/aahf-combined-badge-clean.png";
const PUBLIC_RECAP_STORAGE_PREFIX = "public_recaps";

const cleanText = (value = "") => String(value || "").trim();

const normalizeRoomCode = (value = "") =>
  cleanText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);

const escapeHtml = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const labelFor = (value = "", fallback = "") => cleanText(value) || fallback;

const normalizeComparableUrl = (value = "", origin = DEFAULT_PUBLIC_RECAP_ORIGIN) => {
  const token = cleanText(value);
  if (!token) return "";
  try {
    const url = /^https?:\/\//i.test(token)
      ? new URL(token)
      : new URL(token, origin);
    return `${url.pathname.replace(/\/+$/, "").toLowerCase()}${url.search}`;
  } catch {
    return token.replace(/\/+$/, "").toLowerCase();
  }
};

const isAahfRoom = (roomCode = "", roomName = "") =>
  `${cleanText(roomCode)} ${cleanText(roomName)}`.toLowerCase().match(/aahf|asian arts|heritage festival/);

const toAbsoluteUrl = (value = "", origin = DEFAULT_PUBLIC_RECAP_ORIGIN) => {
  const token = cleanText(value);
  if (!token) return "";
  try {
    return new URL(token, cleanText(origin) || DEFAULT_PUBLIC_RECAP_ORIGIN).toString();
  } catch {
    return token;
  }
};

const buildPublicRoomRecapUrl = (roomCode = "", origin = DEFAULT_PUBLIC_RECAP_ORIGIN) => {
  const safeRoomCode = normalizeRoomCode(roomCode);
  if (!safeRoomCode) return "";
  const safeOrigin = cleanText(origin).replace(/\/+$/, "");
  return safeOrigin ? `${safeOrigin}/recaps/${encodeURIComponent(safeRoomCode)}` : `/recaps/${encodeURIComponent(safeRoomCode)}`;
};

const buildPublicRoomRecapStoragePath = (roomCode = "") => {
  const safeRoomCode = normalizeRoomCode(roomCode);
  return safeRoomCode ? `${PUBLIC_RECAP_STORAGE_PREFIX}/${safeRoomCode}/index.html` : "";
};

const formatCount = (value = 0) =>
  new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(safeNumber(value, 0))));

const formatDate = (value = 0) => {
  const ms = safeNumber(value, 0);
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const formatTimeRange = (startMs = 0, endMs = 0) => {
  const safeStart = safeNumber(startMs, 0);
  const safeEnd = safeNumber(endMs, 0);
  if (!safeStart || !safeEnd) return "";
  try {
    const start = new Date(safeStart).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const end = new Date(safeEnd).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${start} - ${end}`;
  } catch {
    return "";
  }
};

const firstMediaUrl = (...entries) => {
  for (const entry of entries) {
    const token = cleanText(
      entry?.downloadUrl
      || entry?.imageUrl
      || entry?.photoUrl
      || entry?.mediaUrl
      || entry?.albumArtUrl
      || entry?.url
      || entry?.src
      || ""
    );
    if (token) return token;
  }
  return "";
};

const buildLeadImageUrl = (recap = {}, origin = DEFAULT_PUBLIC_RECAP_ORIGIN) => {
  const candidates = [
    ...(Array.isArray(recap?.crowdSelfies) ? recap.crowdSelfies : []),
    ...(Array.isArray(recap?.photos) ? recap.photos : []),
    ...(Array.isArray(recap?.topPerformances) ? recap.topPerformances : []),
  ];
  const mediaUrl = candidates.reduce((found, entry) => found || firstMediaUrl(entry), "");
  return toAbsoluteUrl(mediaUrl, origin);
};

const resolveRecapBranding = ({
  roomCode = "",
  roomName = "",
  logoUrl = "",
  defaultLogoUrl = DEFAULT_BEAUROCKS_LOGO_URL,
  leadImageUrl = "",
  origin = DEFAULT_PUBLIC_RECAP_ORIGIN,
} = {}) => {
  const beauLogo = cleanText(defaultLogoUrl) || DEFAULT_BEAUROCKS_LOGO_URL;
  const partnerLogo = cleanText(logoUrl) || (isAahfRoom(roomCode, roomName) ? AAHF_RECAP_LOGO_URL : "");
  const hasPartnerLogo = !!partnerLogo
    && normalizeComparableUrl(partnerLogo, origin) !== normalizeComparableUrl(beauLogo, origin);
  const socialImageUrl = toAbsoluteUrl(hasPartnerLogo ? partnerLogo : leadImageUrl || beauLogo, origin);

  return {
    beauLogo: toAbsoluteUrl(beauLogo, origin),
    partnerLogo: toAbsoluteUrl(partnerLogo, origin),
    hasPartnerLogo,
    socialImageUrl,
  };
};

const buildStatMarkup = (label, value) => `
  <div class="stat">
    <div class="stat-value">${escapeHtml(formatCount(value))}</div>
    <div class="stat-label">${escapeHtml(label)}</div>
  </div>
`;

const buildTopPerformanceMarkup = (entry = {}) => {
  const artUrl = toAbsoluteUrl(firstMediaUrl(entry), DEFAULT_PUBLIC_RECAP_ORIGIN);
  return `
    <article class="card performance-card">
      ${artUrl ? `<img class="performance-art" src="${escapeHtml(artUrl)}" alt="${escapeHtml(labelFor(entry?.songTitle, "Performance artwork"))}" />` : ""}
      <div class="card-body">
        <div class="eyebrow">Top performance</div>
        <h3>${escapeHtml(labelFor(entry?.songTitle, "Song"))}</h3>
        <p>${escapeHtml([labelFor(entry?.singerName, "Singer"), labelFor(entry?.artist, "")].filter(Boolean).join(" | "))}</p>
        <div class="pill-row">
          <span class="pill">${escapeHtml(formatCount(entry?.totalPoints || 0))} pts</span>
          <span class="pill">${escapeHtml(formatCount(entry?.applauseScore || 0))} applause</span>
        </div>
      </div>
    </article>
  `;
};

const buildLeaderMarkup = (title, subtitle, countLabel) => (entry = {}) => `
  <article class="card leader-card">
    <div class="eyebrow">${escapeHtml(title)}</div>
    <h3>${escapeHtml(labelFor(entry?.name, "Guest"))}</h3>
    <p>${escapeHtml(subtitle(entry))}</p>
    <div class="pill-row">
      <span class="pill">${escapeHtml(countLabel(entry))}</span>
    </div>
  </article>
`;

const buildPhotoMarkup = (entry = {}, index = 0) => {
  const imageUrl = toAbsoluteUrl(firstMediaUrl(entry), DEFAULT_PUBLIC_RECAP_ORIGIN);
  if (!imageUrl) return "";
  return `
    <figure class="photo-card">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(labelFor(entry?.caption, `Recap photo ${index + 1}`))}" loading="lazy" />
    </figure>
  `;
};

const buildHighlightMarkup = (entry = {}) => `
  <li>
    <span class="highlight-icon">${escapeHtml(labelFor(entry?.icon, "•"))}</span>
    <span>${escapeHtml(labelFor(entry?.text, "Room moment"))}</span>
  </li>
`;

const buildPublicRoomRecapHtml = ({
  roomCode = "",
  roomData = {},
  recap = {},
  publicUrl = "",
  origin = DEFAULT_PUBLIC_RECAP_ORIGIN,
} = {}) => {
  const safeRoomCode = normalizeRoomCode(roomCode || roomData?.roomCode || recap?.roomCode);
  const roomName = labelFor(roomData?.discover?.title || roomData?.roomName || roomData?.name, safeRoomCode || "Room Recap");
  const recapDate = formatDate(recap?.window?.startMs || recap?.generatedAt || roomData?.closedAt || Date.now());
  const recapTimeRange = formatTimeRange(recap?.window?.startMs, recap?.window?.endMs);
  const leadImageUrl = buildLeadImageUrl(recap, origin);
  const branding = resolveRecapBranding({
    roomCode: safeRoomCode,
    roomName,
    logoUrl: roomData?.logoUrl,
    defaultLogoUrl: DEFAULT_BEAUROCKS_LOGO_URL,
    leadImageUrl,
    origin,
  });
  const socialImageUrl = branding.socialImageUrl || toAbsoluteUrl(DEFAULT_BEAUROCKS_LOGO_URL, origin);
  const title = `${roomName} Recap | BeauRocks Karaoke`;
  const description = [
    `${formatCount(recap?.stats?.totalPerformedSongs || recap?.totalSongs || 0)} performances`,
    `${formatCount(recap?.stats?.reactionCount || recap?.totalEmojiBursts || 0)} crowd reactions`,
    `${formatCount(recap?.metrics?.estimatedPeople || recap?.stats?.totalUsers || recap?.totalUsers || 0)} people`,
  ].join(" • ");
  const canonicalUrl = toAbsoluteUrl(publicUrl || buildPublicRoomRecapUrl(safeRoomCode, origin), origin);

  const topPerformances = (Array.isArray(recap?.topPerformances) ? recap.topPerformances : [])
    .slice(0, 3)
    .map((entry) => buildTopPerformanceMarkup(entry))
    .join("");
  const topPerformers = (Array.isArray(recap?.topPerformers) ? recap.topPerformers : [])
    .slice(0, 3)
    .map(buildLeaderMarkup(
      "Top performer",
      (entry) => `${formatCount(entry?.performances || 0)} songs performed`,
      (entry) => `${formatCount(entry?.loudest || 0)} loudest applause`
    ))
    .join("");
  const topReactors = (Array.isArray(recap?.topReactors) ? recap.topReactors : [])
    .slice(0, 3)
    .map(buildLeaderMarkup(
      "Top reactor",
      () => "Kept the room loud",
      (entry) => `${formatCount(entry?.count || 0)} reactions`
    ))
    .join("");
  const highlightMarkup = (Array.isArray(recap?.highlights) ? recap.highlights : [])
    .slice(0, 8)
    .map((entry) => buildHighlightMarkup(entry))
    .join("");
  const photoMarkup = [
    ...(Array.isArray(recap?.crowdSelfies) ? recap.crowdSelfies : []),
    ...(Array.isArray(recap?.photos) ? recap.photos : []),
  ]
    .slice(0, 6)
    .map((entry, index) => buildPhotoMarkup(entry, index))
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtml(socialImageUrl)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(socialImageUrl)}" />
    <style>
      :root {
        color-scheme: dark;
        --bg: #07131d;
        --bg-soft: rgba(9, 25, 39, 0.78);
        --card: rgba(12, 30, 47, 0.9);
        --line: rgba(109, 215, 255, 0.18);
        --text: #eff6ff;
        --muted: #9fb7c9;
        --accent: #2ed8f4;
        --accent-warm: #ff6ea9;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, "Segoe UI", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top, rgba(46, 216, 244, 0.15), transparent 34%),
          radial-gradient(circle at 85% 20%, rgba(255, 110, 169, 0.18), transparent 25%),
          linear-gradient(180deg, #06111a 0%, #091a28 48%, #040b12 100%);
      }
      a { color: inherit; }
      .page {
        max-width: 1120px;
        margin: 0 auto;
        padding: 32px 20px 72px;
      }
      .hero {
        border: 1px solid var(--line);
        border-radius: 28px;
        background: linear-gradient(180deg, rgba(10, 24, 37, 0.92), rgba(6, 17, 28, 0.98));
        padding: 28px;
        overflow: hidden;
        position: relative;
      }
      .hero::after {
        content: "";
        position: absolute;
        inset: auto -80px -120px auto;
        width: 280px;
        height: 280px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(46, 216, 244, 0.2), transparent 70%);
      }
      .hero-top {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: center;
        flex-wrap: wrap;
      }
      .logo-lockup {
        display: flex;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
      }
      .logo-lockup img {
        max-height: 64px;
        max-width: 220px;
        object-fit: contain;
        filter: drop-shadow(0 10px 28px rgba(0, 0, 0, 0.3));
      }
      .hero-copy {
        margin-top: 28px;
        max-width: 760px;
      }
      .eyebrow {
        color: var(--accent);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      h1 {
        margin: 10px 0 8px;
        font-size: clamp(36px, 6vw, 60px);
        line-height: 0.96;
      }
      .hero-meta, .hero-description {
        color: var(--muted);
        font-size: 16px;
        line-height: 1.6;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 14px;
        margin-top: 28px;
      }
      .stat, .card, .gallery, .highlights {
        border: 1px solid var(--line);
        background: var(--bg-soft);
        border-radius: 22px;
      }
      .stat {
        padding: 18px;
      }
      .stat-value {
        font-size: 30px;
        font-weight: 800;
      }
      .stat-label {
        margin-top: 6px;
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .section {
        margin-top: 26px;
      }
      .section-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: end;
        margin-bottom: 14px;
      }
      .section-header h2 {
        margin: 0;
        font-size: 28px;
      }
      .section-header p {
        margin: 0;
        color: var(--muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 14px;
      }
      .card {
        overflow: hidden;
      }
      .performance-art {
        display: block;
        width: 100%;
        aspect-ratio: 1.35 / 1;
        object-fit: cover;
        background: rgba(255, 255, 255, 0.04);
      }
      .card-body {
        padding: 18px;
      }
      .card h3 {
        margin: 8px 0 6px;
        font-size: 22px;
      }
      .card p {
        margin: 0;
        color: var(--muted);
        line-height: 1.5;
      }
      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 14px;
      }
      .pill {
        border-radius: 999px;
        padding: 7px 12px;
        background: rgba(46, 216, 244, 0.1);
        border: 1px solid rgba(46, 216, 244, 0.18);
        color: #d9f9ff;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .leader-card {
        padding: 18px;
      }
      .gallery {
        padding: 14px;
      }
      .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 10px;
      }
      .photo-card {
        margin: 0;
        overflow: hidden;
        border-radius: 16px;
        min-height: 160px;
        background: rgba(255, 255, 255, 0.04);
      }
      .photo-card img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .highlights {
        padding: 18px 20px;
      }
      .highlights ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 12px;
      }
      .highlights li {
        display: grid;
        grid-template-columns: 28px 1fr;
        gap: 10px;
        align-items: start;
        color: var(--muted);
      }
      .highlight-icon {
        display: inline-flex;
        width: 28px;
        height: 28px;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: rgba(255, 110, 169, 0.12);
        border: 1px solid rgba(255, 110, 169, 0.18);
        color: #ffe0ee;
      }
      .footer {
        margin-top: 18px;
        color: var(--muted);
        font-size: 13px;
      }
      @media (max-width: 720px) {
        .page { padding: 16px 12px 48px; }
        .hero { padding: 20px; border-radius: 22px; }
        .section-header { align-items: start; flex-direction: column; }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="hero">
        <div class="hero-top">
          <div class="logo-lockup">
            ${branding.hasPartnerLogo ? `<img src="${escapeHtml(branding.partnerLogo)}" alt="${escapeHtml(roomName)} logo" />` : ""}
            <img src="${escapeHtml(branding.beauLogo)}" alt="BeauRocks Karaoke" />
          </div>
        </div>
        <div class="hero-copy">
          <div class="eyebrow">Public recap</div>
          <h1>${escapeHtml(roomName)}</h1>
          <div class="hero-meta">${escapeHtml([safeRoomCode, recapDate, recapTimeRange].filter(Boolean).join(" | "))}</div>
          <p class="hero-description">${escapeHtml(description)}</p>
        </div>
        <div class="stats">
          ${buildStatMarkup("Performances", recap?.stats?.totalPerformedSongs || recap?.totalSongs || 0)}
          ${buildStatMarkup("Queued songs", recap?.stats?.totalQueuedSongs || 0)}
          ${buildStatMarkup("Crowd reactions", recap?.stats?.reactionCount || recap?.totalEmojiBursts || 0)}
          ${buildStatMarkup("People", recap?.metrics?.estimatedPeople || recap?.stats?.totalUsers || recap?.totalUsers || 0)}
        </div>
      </section>

      ${topPerformances ? `
      <section class="section">
        <div class="section-header">
          <div>
            <h2>Standout performances</h2>
            <p>Top scoring songs from the night.</p>
          </div>
        </div>
        <div class="grid">${topPerformances}</div>
      </section>` : ""}

      ${(topPerformers || topReactors) ? `
      <section class="section">
        <div class="section-header">
          <div>
            <h2>Crowd leaders</h2>
            <p>The performers and reactors who drove the room.</p>
          </div>
        </div>
        <div class="grid">${topPerformers}${topReactors}</div>
      </section>` : ""}

      ${photoMarkup ? `
      <section class="section gallery">
        <div class="section-header">
          <div>
            <h2>Photo roll</h2>
            <p>Crowd moments captured during the room.</p>
          </div>
        </div>
        <div class="gallery-grid">${photoMarkup}</div>
      </section>` : ""}

      ${highlightMarkup ? `
      <section class="section highlights">
        <div class="section-header">
          <div>
            <h2>Highlights</h2>
            <p>The beats worth remembering.</p>
          </div>
        </div>
        <ul>${highlightMarkup}</ul>
      </section>` : ""}

      <p class="footer">Published by BeauRocks Karaoke.</p>
    </main>
  </body>
</html>`;
};

module.exports = {
  AAHF_RECAP_LOGO_URL,
  DEFAULT_BEAUROCKS_LOGO_URL,
  DEFAULT_PUBLIC_RECAP_ORIGIN,
  PUBLIC_RECAP_STORAGE_PREFIX,
  normalizeRoomCode,
  toAbsoluteUrl,
  buildPublicRoomRecapUrl,
  buildPublicRoomRecapStoragePath,
  resolveRecapBranding,
  buildPublicRoomRecapHtml,
};
