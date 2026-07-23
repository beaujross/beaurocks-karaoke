const crypto = require('node:crypto');

const SPEND_OPERATIONS_COLLECTION = 'beaurocks_spend_operations';
const SPEND_OPERATION_SCHEMA_VERSION = 1;
const REACTION_SLOT_5_POINTS_COST = 250;
const SPEND_KINDS = Object.freeze({
  reaction: 'reaction',
  profileChange: 'profile_change',
  avatarUnlock: 'avatar_unlock',
  reactionSlotUnlock: 'reaction_slot_unlock',
});

const token = (value = '') => String(value || '').trim();

const normalizeSpendKind = (value = '') => {
  const safe = token(value).toLowerCase();
  return Object.values(SPEND_KINDS).includes(safe) ? safe : '';
};

const normalizeClientOperationId = (value = '') => {
  const safe = token(value);
  if (!safe || safe.length > 120 || !/^[A-Za-z0-9:_-]+$/.test(safe)) return '';
  return safe;
};

const buildSpendOperationDocumentId = ({ roomCode, uid, clientOperationId } = {}) => {
  const safeRoomCode = token(roomCode).toUpperCase();
  const safeUid = token(uid);
  const safeOperationId = normalizeClientOperationId(clientOperationId);
  if (!safeRoomCode) throw new Error('roomCode is required');
  if (!safeUid) throw new Error('uid is required');
  if (!safeOperationId) throw new Error('clientOperationId is invalid');
  return crypto
    .createHash('sha256')
    .update(`${safeRoomCode}:${safeUid}:${safeOperationId}`)
    .digest('hex');
};

const resolveReactionSpendCost = ({ reactionType, reactionCosts = {} } = {}) => {
  const safeType = token(reactionType).toLowerCase();
  const configuredCost = Number(reactionCosts?.[safeType]);
  if (!safeType || !Number.isFinite(configuredCost) || configuredCost <= 0) {
    return { ok: false, reactionType: safeType, cost: 0 };
  }
  return { ok: true, reactionType: safeType, cost: Math.floor(configuredCost) };
};

const resolveProfileChangeSpendCost = (changeCount = 0) => {
  const safeCount = Math.max(0, Math.floor(Number(changeCount) || 0));
  return safeCount === 0 ? 0 : safeCount * 500;
};

const resolveAvatarUnlockSpend = ({ avatarId, avatarCatalog = [] } = {}) => {
  const safeAvatarId = token(avatarId).toLowerCase();
  const record = Array.isArray(avatarCatalog)
    ? avatarCatalog.find((item) => token(item?.id).toLowerCase() === safeAvatarId)
    : null;
  const cost = Math.max(0, Math.floor(Number(record?.unlock?.cost) || 0));
  if (!record || record?.unlock?.type !== 'points' || cost <= 0) {
    return { ok: false, avatarId: safeAvatarId, cost: 0, record: null };
  }
  return { ok: true, avatarId: safeAvatarId, cost, record };
};

module.exports = {
  SPEND_KINDS,
  SPEND_OPERATIONS_COLLECTION,
  SPEND_OPERATION_SCHEMA_VERSION,
  REACTION_SLOT_5_POINTS_COST,
  buildSpendOperationDocumentId,
  normalizeClientOperationId,
  normalizeSpendKind,
  resolveAvatarUnlockSpend,
  resolveProfileChangeSpendCost,
  resolveReactionSpendCost,
};
