const WEEKDAY_ORDER = [
  { key: "mon", label: "Mon", dayIndex: 1 },
  { key: "tue", label: "Tue", dayIndex: 2 },
  { key: "wed", label: "Wed", dayIndex: 3 },
  { key: "thu", label: "Thu", dayIndex: 4 },
  { key: "fri", label: "Fri", dayIndex: 5 },
  { key: "sat", label: "Sat", dayIndex: 6 },
  { key: "sun", label: "Sun", dayIndex: 0 },
];

const DAY_LABEL_TO_KEY = Object.fromEntries(WEEKDAY_ORDER.map((entry) => [entry.label.toLowerCase(), entry.key]));
const TIME_TOKEN_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toRow = (dayMeta = {}) => ({
  key: dayMeta.key,
  label: dayMeta.label,
  dayIndex: dayMeta.dayIndex,
  enabled: false,
  startTime: "",
  endTime: "",
});

const normalizeTimeToken = (value = "") => {
  const token = String(value || "").trim();
  if (!TIME_TOKEN_RE.test(token)) return "";
  return token;
};

export const createEmptyCadenceRows = () => WEEKDAY_ORDER.map((entry) => toRow(entry));

export const normalizeCadenceRows = (rows = []) => {
  const source = Array.isArray(rows) ? rows : [];
  const byKey = {};
  source.forEach((item = {}) => {
    const key = String(item.key || "").trim().toLowerCase();
    if (!key) return;
    byKey[key] = item;
  });
  return WEEKDAY_ORDER.map((entry) => {
    const match = byKey[entry.key] || {};
    const startTime = normalizeTimeToken(match.startTime || "");
    const endTime = normalizeTimeToken(match.endTime || "");
    return {
      key: entry.key,
      label: entry.label,
      dayIndex: entry.dayIndex,
      enabled: !!match.enabled,
      startTime,
      endTime,
    };
  });
};

export const hasCadenceRows = (rows = []) =>
  normalizeCadenceRows(rows).some((entry) => entry.enabled && !!entry.startTime);

const formatRange24h = (start = "", end = "") => {
  const safeStart = normalizeTimeToken(start);
  if (!safeStart) return "";
  const safeEnd = normalizeTimeToken(end);
  if (!safeEnd) return safeStart;
  return `${safeStart}-${safeEnd}`;
};

const selectedCadenceRows = (rows = []) =>
  normalizeCadenceRows(rows).filter((entry) => entry.enabled && !!entry.startTime);

export const buildKaraokeNightsLabel = (rows = []) =>
  selectedCadenceRows(rows)
    .map((entry) => `${entry.label} ${formatRange24h(entry.startTime, entry.endTime)}`.trim())
    .join(" | ");

export const buildRecurringRule = (rows = []) => {
  const segment = selectedCadenceRows(rows)
    .map((entry) => `${entry.label} ${formatRange24h(entry.startTime, entry.endTime)}`.trim())
    .join(" | ");
  return segment ? `Weekly ${segment}` : "";
};

const parseMeridiemToken = (value = "", fallback = "pm") => {
  const token = String(value || "").trim().toLowerCase();
  if (token === "am" || token === "pm") return token;
  return fallback;
};

const from12hToTimeToken = ({
  hourRaw = "",
  minuteRaw = "",
  meridiemRaw = "",
  fallbackMeridiem = "pm",
} = {}) => {
  const hour = Number(hourRaw || 0);
  if (!Number.isFinite(hour) || hour <= 0 || hour > 12) return "";
  const minute = Number(minuteRaw || 0);
  const safeMinute = Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : 0;
  const meridiem = parseMeridiemToken(meridiemRaw, fallbackMeridiem);
  const normalizedHour = meridiem === "pm" ? ((hour % 12) + 12) : (hour % 12);
  return `${String(normalizedHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`;
};

const parseSingleCadenceMatch = (match = []) => {
  const dayLabel = String(match[1] || "").trim();
  const key = DAY_LABEL_TO_KEY[dayLabel.toLowerCase()];
  if (!key) return null;

  const startMeridiem = String(match[4] || "").trim().toLowerCase();
  const endMeridiem = String(match[7] || "").trim().toLowerCase();
  const fallbackMeridiem = endMeridiem || startMeridiem || "pm";
  const startTime = from12hToTimeToken({
    hourRaw: match[2],
    minuteRaw: match[3],
    meridiemRaw: startMeridiem || fallbackMeridiem,
    fallbackMeridiem,
  });
  if (!startTime) return null;
  const endTime = from12hToTimeToken({
    hourRaw: match[5],
    minuteRaw: match[6],
    meridiemRaw: endMeridiem || startMeridiem || fallbackMeridiem,
    fallbackMeridiem: startMeridiem || fallbackMeridiem,
  });

  return {
    key,
    enabled: true,
    startTime,
    endTime,
  };
};

export const parseCadenceTextToRows = (input = "") => {
  const text = String(input || "").trim();
  if (!text) return createEmptyCadenceRows();

  const matches = [...text.matchAll(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b[^0-9]*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s*(?:-|to|until|through|thru|–|—)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/gi)];
  if (!matches.length) return createEmptyCadenceRows();

  const rows = createEmptyCadenceRows();
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  matches.forEach((match) => {
    const parsed = parseSingleCadenceMatch(match);
    if (!parsed) return;
    const target = byKey[parsed.key];
    if (!target) return;
    target.enabled = true;
    target.startTime = parsed.startTime;
    target.endTime = parsed.endTime;
  });
  return normalizeCadenceRows(Object.values(byKey));
};

const toDateAtTime = (baseDate = new Date(), timeToken = "") => {
  const token = normalizeTimeToken(timeToken);
  if (!token) return null;
  const [hourRaw, minuteRaw] = token.split(":");
  const hour = Number(hourRaw || 0);
  const minute = Number(minuteRaw || 0);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const out = new Date(baseDate.getTime());
  out.setHours(hour, minute, 0, 0);
  return out;
};

export const buildNextCadenceWindow = (rows = [], nowMs = Date.now()) => {
  const now = new Date(Number(nowMs || Date.now()));
  const selected = selectedCadenceRows(rows);
  if (!selected.length) return { startsAtMs: 0, endsAtMs: 0 };

  let winner = null;
  selected.forEach((entry) => {
    const startCandidate = toDateAtTime(now, entry.startTime);
    if (!startCandidate) return;
    let daysAhead = (Number(entry.dayIndex) - now.getDay() + 7) % 7;
    if (daysAhead === 0 && startCandidate.getTime() <= now.getTime()) {
      daysAhead = 7;
    }
    startCandidate.setDate(startCandidate.getDate() + daysAhead);
    let endsAtMs = 0;
    if (entry.endTime) {
      const endCandidate = toDateAtTime(startCandidate, entry.endTime);
      if (endCandidate) {
        if (endCandidate.getTime() <= startCandidate.getTime()) {
          endCandidate.setDate(endCandidate.getDate() + 1);
        }
        endsAtMs = endCandidate.getTime();
      }
    }
    const candidate = {
      startsAtMs: startCandidate.getTime(),
      endsAtMs,
    };
    if (!winner || candidate.startsAtMs < winner.startsAtMs) {
      winner = candidate;
    }
  });

  return winner || { startsAtMs: 0, endsAtMs: 0 };
};
