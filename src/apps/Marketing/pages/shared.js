export const formatDateTime = (ms = 0) => {
  const value = Number(ms || 0);
  if (!Number.isFinite(value) || value <= 0) return "TBD";
  try {
    return new Date(value).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "TBD";
  }
};

export const toDateTimeLocalInput = (valueMs = 0) => {
  const ms = Number(valueMs || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  const tzShifted = new Date(ms - (date.getTimezoneOffset() * 60000));
  return tzShifted.toISOString().slice(0, 16);
};

export const fromDateTimeLocalInput = (value = "") => {
  const token = String(value || "").trim();
  if (!token) return 0;
  const parsed = new Date(token).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCount = (value = 0) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString();
};

export const readStars = (rating = 0) => {
  const rounded = Math.max(1, Math.min(5, Math.round(Number(rating || 0))));
  return `${"*".repeat(rounded)}${"-".repeat(5 - rounded)}`;
};
