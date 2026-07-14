export const YOUTUBE_EVENT_READINESS_THRESHOLDS = Object.freeze({
  minimumKnownEmbeddableTracks: 25,
  minimumProvenRoomTracks: 3,
  minimumLocalFallbacks: 1,
  healthySearchReserve: 30,
  criticalSearchReserve: 10,
  liveHeavyMinimumSearches: 4,
  liveHeavySharePct: 50,
});

const whole = (value = 0) => Math.max(0, Math.floor(Number(value || 0) || 0));
const pct = (value = 0) => Math.max(0, Math.min(100, Math.round(Number(value || 0) || 0)));

const buildCheck = ({ key, label, value, target, pass, detail = '' }) => ({
  key,
  label,
  value: whole(value),
  target: whole(target),
  pass: pass === true,
  detail: String(detail || '').trim(),
});

export const buildYouTubeEventReadiness = ({
  telemetry = {},
  knownEmbeddableCount = 0,
  freshRoomIndexCount = 0,
  provenRoomIndexCount = 0,
  localFallbackCount = 0,
  thresholds = YOUTUBE_EVENT_READINESS_THRESHOLDS,
} = {}) => {
  const knownCount = whole(knownEmbeddableCount);
  const freshCount = whole(freshRoomIndexCount);
  const provenCount = whole(provenRoomIndexCount);
  const fallbackCount = whole(localFallbackCount);
  const searchReserve = whole(
    telemetry?.todaySearchListCallsRemaining
    ?? telemetry?.todayEstimatedFreshSearchesLeft
    ?? 0
  );
  const recentSearches = whole(telemetry?.recentSearches);
  const liveSharePct = pct(telemetry?.liveSharePct);
  const quotaBlocked = telemetry?.quotaBlocked === true;
  const quotaErrors = whole(telemetry?.todayQuotaErrors);

  const minimumKnown = whole(thresholds?.minimumKnownEmbeddableTracks || 25);
  const minimumProven = whole(thresholds?.minimumProvenRoomTracks || 3);
  const minimumFallbacks = whole(thresholds?.minimumLocalFallbacks || 1);
  const healthyReserve = whole(thresholds?.healthySearchReserve || 30);
  const criticalReserve = whole(thresholds?.criticalSearchReserve || 10);
  const liveHeavy = recentSearches >= whole(thresholds?.liveHeavyMinimumSearches || 4)
    && liveSharePct >= pct(thresholds?.liveHeavySharePct || 50);

  const knownReady = knownCount >= minimumKnown;
  const provenReady = provenCount >= minimumProven;
  const fallbackReady = fallbackCount >= minimumFallbacks;
  const reserveHealthy = searchReserve >= healthyReserve;
  const reserveCritical = searchReserve <= criticalReserve;

  const checks = [
    buildCheck({
      key: 'known_catalog',
      label: 'Known embeddable catalog',
      value: knownCount,
      target: minimumKnown,
      pass: knownReady,
      detail: `${knownCount} verified tracks avoid a live discovery call.`,
    }),
    buildCheck({
      key: 'room_proof',
      label: 'Room-proven backings',
      value: provenCount,
      target: minimumProven,
      pass: provenReady,
      detail: `${freshCount} room-indexed tracks are currently fresh.`,
    }),
    buildCheck({
      key: 'local_fallback',
      label: 'Content-agnostic fallback',
      value: fallbackCount,
      target: minimumFallbacks,
      pass: fallbackReady,
      detail: 'Host uploads and offline files do not consume YouTube search quota.',
    }),
    buildCheck({
      key: 'search_reserve',
      label: 'Estimated search reserve',
      value: searchReserve,
      target: healthyReserve,
      pass: reserveHealthy && !quotaBlocked,
      detail: quotaBlocked
        ? 'This Host browser is in YouTube search cooldown.'
        : `${searchReserve} estimated search.list calls remain in this Host browser today.`,
    }),
  ];

  const actions = [];
  if (!knownReady) actions.push('Add verified backings to the room library.');
  if (!provenReady) actions.push(`Use or approve ${Math.max(0, minimumProven - provenCount)} more room backing${minimumProven - provenCount === 1 ? '' : 's'}.`);
  if (!fallbackReady) actions.push('Add at least one Host upload or offline backup.');
  if (quotaBlocked || reserveCritical || liveHeavy) actions.push('Lean on known tracks and direct validated URLs; pause live discovery searches.');
  else if (!reserveHealthy) actions.push('Protect the remaining live-search reserve for requests the known catalog cannot answer.');

  let key = 'ready';
  let label = 'Event Ready';
  let tone = 'success';
  let icon = 'fa-circle-check';
  let summary = 'Known tracks, room proof, a local fallback, and estimated search reserve are ready for tonight.';

  if (quotaBlocked) {
    if (knownReady && fallbackReady) {
      key = 'fallback_ready';
      label = 'Fallback Ready';
      tone = 'info';
      icon = 'fa-shield-halved';
      summary = 'Live YouTube search is paused, but verified catalog coverage and a local fallback can carry the room.';
    } else {
      key = 'fallback_gap';
      label = 'Fallback Gap';
      tone = 'danger';
      icon = 'fa-triangle-exclamation';
      summary = 'Live YouTube search is paused and the known or local fallback catalog is not deep enough yet.';
    }
  } else if (!knownReady) {
    key = 'catalog_gap';
    label = 'Strengthen Catalog';
    tone = 'warning';
    icon = 'fa-layer-group';
    summary = 'The verified known catalog is thin enough that tonight may depend too heavily on live YouTube search.';
  } else if (!fallbackReady) {
    key = 'fallback_gap';
    label = 'Add a Backup';
    tone = 'warning';
    icon = 'fa-hard-drive';
    summary = 'YouTube coverage is available, but the room has no content-agnostic Host upload or offline fallback.';
  } else if (reserveCritical) {
    key = 'reserve_guard';
    label = 'Protect Reserve';
    tone = 'danger';
    icon = 'fa-shield-halved';
    summary = 'The estimated live-search reserve is critical; known catalog and local sources should carry the room.';
  } else if (!reserveHealthy || liveHeavy || !provenReady || quotaErrors > 0) {
    key = 'watch';
    label = 'Ready with Watchouts';
    tone = 'warning';
    icon = 'fa-eye';
    summary = liveHeavy
      ? 'Recent searches are live-heavy; favor indexed and curated matches before the event gets busier.'
      : !provenReady
        ? 'Coverage exists, but this room needs a few more proven backings before it is fully event-ready.'
        : 'The room can operate, but its estimated live-search reserve should be protected.';
  }

  return {
    key,
    label,
    tone,
    icon,
    summary,
    checks,
    actions: [...new Set(actions)].slice(0, 3),
    knownEmbeddableCount: knownCount,
    freshRoomIndexCount: freshCount,
    provenRoomIndexCount: provenCount,
    localFallbackCount: fallbackCount,
    estimatedSearchReserve: searchReserve,
    quotaBlocked,
    liveHeavy,
    liveSharePct,
    recentSearches,
    caveat: 'Estimate uses this Host browser. Google Cloud Quotas is the source of truth for assigned YouTube limits.',
  };
};
