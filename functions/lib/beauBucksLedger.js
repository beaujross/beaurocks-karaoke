const crypto = require('node:crypto');

const LEDGER_COLLECTION = 'beaurocks_ledger_entries';
const LEDGER_SCHEMA_VERSION = 1;

const token = (value = '') => String(value || '').trim();
const normalizedToken = (value = '') => token(value).toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 160);
const encodedAccountToken = (value = '') => encodeURIComponent(token(value)).slice(0, 512);

const buildLedgerAccountId = ({ roomCode = '', uid = '', currency = 'points' } = {}) => {
  const safeRoomCode = token(roomCode).toUpperCase();
  const safeUid = token(uid);
  const safeCurrency = normalizedToken(currency) === 'beaubucks' ? 'beaubucks' : 'points';
  if (!safeUid) throw new Error('uid is required');
  if (safeCurrency === 'beaubucks') return ['account', encodedAccountToken(safeUid), safeCurrency].join('__');
  if (!safeRoomCode) throw new Error('roomCode is required');
  return [normalizedToken(safeRoomCode), normalizedToken(safeUid), safeCurrency].join('__');
};

const buildLegacyRoomLedgerAccountId = ({ roomCode = '', uid = '', currency = 'beaubucks' } = {}) => {
  const safeRoomCode = token(roomCode).toUpperCase();
  const safeUid = token(uid);
  const safeCurrency = normalizedToken(currency) === 'beaubucks' ? 'beaubucks' : 'points';
  if (!safeRoomCode) throw new Error('roomCode is required');
  if (!safeUid) throw new Error('uid is required');
  return [normalizedToken(safeRoomCode), normalizedToken(safeUid), safeCurrency].join('__');
};

const resolveLedgerCurrency = (eventCredits = {}) => {
  if (eventCredits?.enabled !== true) return 'points';
  const presetId = normalizedToken(eventCredits.presetId);
  const eventId = normalizedToken(eventCredits.eventId);
  const hasSupport = Boolean(token(eventCredits.supportProvider || eventCredits.supportUrl || eventCredits.supportLabel))
    || Number(eventCredits.supportPoints || 0) > 0
    || (Array.isArray(eventCredits.supportOffers) && eventCredits.supportOffers.length > 0);
  return presetId === 'beaubucks' || presetId === 'ticketed_event' || eventId === 'beaubucks' || eventId === 'ticketed_event' || hasSupport
    ? 'beaubucks'
    : 'points';
};

const buildLedgerEntryId = (idempotencyKey = '') => {
  const safeKey = token(idempotencyKey);
  if (!safeKey) throw new Error('idempotencyKey is required');
  return crypto.createHash('sha256').update(safeKey).digest('hex');
};

const buildShadowLedgerEntry = ({
  idempotencyKey,
  roomCode,
  uid,
  eventCredits = {},
  type,
  amount,
  direction = 'credit',
  source = {},
  attribution = {},
  financial = {},
  walletScope = 'room',
  serverTimestamp = null,
} = {}) => {
  const safeAmount = Math.max(0, Math.floor(Number(amount) || 0));
  if (!safeAmount) throw new Error('amount must be greater than zero');
  const currency = resolveLedgerCurrency(eventCredits);
  const safeRoomCode = token(roomCode).toUpperCase();
  const safeUid = token(uid);
  const ledgerEntryId = buildLedgerEntryId(idempotencyKey);
  return {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    ledgerEntryId,
    idempotencyKey: token(idempotencyKey),
    accountId: currency === 'beaubucks' && normalizedToken(walletScope) !== 'account'
      ? buildLegacyRoomLedgerAccountId({ roomCode: safeRoomCode, uid: safeUid, currency })
      : buildLedgerAccountId({ roomCode: safeRoomCode, uid: safeUid, currency }),
    roomCode: safeRoomCode,
    uid: safeUid,
    currency,
    direction: normalizedToken(direction),
    type: normalizedToken(type),
    amount: safeAmount,
    status: 'posted',
    shadow: true,
    authoritative: false,
    source: {
      provider: normalizedToken(source.provider || 'beaurocks'),
      sourceId: token(source.sourceId),
      sourceCollection: token(source.sourceCollection),
    },
    attribution: {
      canonicalSongId: token(attribution.canonicalSongId),
      performanceId: token(attribution.performanceId),
      backingTrackId: token(attribution.backingTrackId),
      performerUid: token(attribution.performerUid),
      fundCode: token(attribution.fundCode),
    },
    financial: {
      amountCents: Math.max(0, Math.floor(Number(financial.amountCents) || 0)),
      currency: normalizedToken(financial.currency || ''),
      externalTransactionId: token(financial.externalTransactionId),
    },
    createdAt: serverTimestamp,
    updatedAt: serverTimestamp,
  };
};

const buildAuthoritativeLedgerEntry = (input = {}) => ({
  ...buildShadowLedgerEntry(input),
  shadow: false,
  authoritative: true,
});

const createAuthoritativeLedgerEntry = ({ writer, db, ...input } = {}) => {
  if (!writer || typeof writer.create !== 'function') throw new Error('writer.create is required');
  if (!db || typeof db.collection !== 'function') throw new Error('db is required');
  const entry = buildAuthoritativeLedgerEntry(input);
  const ref = db.collection(LEDGER_COLLECTION).doc(entry.ledgerEntryId);
  writer.create(ref, entry);
  return { ref, entry };
};

const setShadowLedgerEntry = ({ writer, db, ...input } = {}) => {
  if (!writer || typeof writer.set !== 'function') throw new Error('writer.set is required');
  if (!db || typeof db.collection !== 'function') throw new Error('db is required');
  const entry = buildShadowLedgerEntry(input);
  const ref = db.collection(LEDGER_COLLECTION).doc(entry.ledgerEntryId);
  writer.set(ref, entry, { merge: true });
  return { ref, entry };
};

module.exports = {
  LEDGER_COLLECTION,
  LEDGER_SCHEMA_VERSION,
  buildAuthoritativeLedgerEntry,
  buildLegacyRoomLedgerAccountId,
  buildLedgerAccountId,
  buildLedgerEntryId,
  buildShadowLedgerEntry,
  createAuthoritativeLedgerEntry,
  resolveLedgerCurrency,
  setShadowLedgerEntry,
};
