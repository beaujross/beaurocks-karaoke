export const BEAUROCKS_LEDGER_SCHEMA_VERSION = 1;

export const LEDGER_CURRENCIES = Object.freeze({
    points: 'points',
    beaubucks: 'beaubucks',
});

export const LEDGER_DIRECTIONS = Object.freeze({ credit: 'credit', debit: 'debit' });
export const LEDGER_STATUSES = Object.freeze({ pending: 'pending', posted: 'posted', reversed: 'reversed', expired: 'expired' });

export const LEDGER_ENTRY_TYPES = Object.freeze({
    joinGrant: 'join_grant',
    ticketValue: 'ticket_value',
    timedRefill: 'timed_refill',
    promoGrant: 'promo_grant',
    hostGrant: 'host_grant',
    gameEarn: 'game_earn',
    purchaseGrant: 'purchase_grant',
    donationReward: 'donation_reward',
    reactionSpend: 'reaction_spend',
    voteSpend: 'vote_spend',
    boostSpend: 'boost_spend',
    performerAllocation: 'performer_allocation',
    avatarSpend: 'avatar_spend',
    profileSpend: 'profile_spend',
    refund: 'refund',
    expiration: 'expiration',
    adjustment: 'adjustment',
    migrationOpeningBalance: 'migration_opening_balance',
});

const token = (value = '') => String(value || '').trim();
const normalizedToken = (value = '') => token(value).toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_').slice(0, 160);
const encodedAccountToken = (value = '') => encodeURIComponent(token(value)).slice(0, 512);
const allowed = (values = {}) => new Set(Object.values(values));

export const buildLedgerAccountId = ({ roomCode = '', uid = '', currency = LEDGER_CURRENCIES.points } = {}) => {
    const safeCurrency = normalizedToken(currency);
    if (safeCurrency === LEDGER_CURRENCIES.beaubucks) {
        return ['account', encodedAccountToken(uid), safeCurrency].filter(Boolean).join('__');
    }
    return [normalizedToken(roomCode), normalizedToken(uid), safeCurrency].filter(Boolean).join('__');
};

export const buildLedgerIdempotencyKey = ({ provider = 'beaurocks', type = '', roomCode = '', uid = '', sourceId = '' } = {}) => (
    [provider, type, roomCode, uid, sourceId].map(normalizedToken).filter(Boolean).join('__')
);

export const createLedgerEntry = (input = {}) => {
    const currency = normalizedToken(input.currency || LEDGER_CURRENCIES.points);
    const roomCode = token(input.roomCode).toUpperCase();
    const uid = token(input.uid);
    const entry = {
        schemaVersion: BEAUROCKS_LEDGER_SCHEMA_VERSION,
        ledgerEntryId: token(input.ledgerEntryId),
        idempotencyKey: token(input.idempotencyKey),
        accountId: token(input.accountId) || buildLedgerAccountId({ roomCode, uid, currency }),
        roomCode,
        uid,
        currency,
        direction: normalizedToken(input.direction),
        type: normalizedToken(input.type),
        amount: Math.max(0, Math.floor(Number(input.amount) || 0)),
        status: normalizedToken(input.status || LEDGER_STATUSES.posted),
        source: {
            provider: normalizedToken(input.source?.provider || 'beaurocks'),
            sourceId: token(input.source?.sourceId),
            sourceCollection: token(input.source?.sourceCollection),
        },
        attribution: {
            canonicalSongId: token(input.attribution?.canonicalSongId),
            performanceId: token(input.attribution?.performanceId),
            backingTrackId: token(input.attribution?.backingTrackId),
            performerUid: token(input.attribution?.performerUid),
            fundCode: token(input.attribution?.fundCode),
        },
        financial: {
            amountCents: Math.max(0, Math.floor(Number(input.financial?.amountCents) || 0)),
            currency: normalizedToken(input.financial?.currency || ''),
            externalTransactionId: token(input.financial?.externalTransactionId),
        },
        reversalOf: token(input.reversalOf),
        createdAtMs: Math.max(0, Math.floor(Number(input.createdAtMs) || 0)),
    };
    return entry;
};

export const validateLedgerEntry = (input = {}) => {
    const entry = createLedgerEntry(input);
    const errors = [];
    if (!entry.ledgerEntryId) errors.push('ledgerEntryId is required');
    if (!entry.idempotencyKey) errors.push('idempotencyKey is required');
    if (!entry.accountId || !entry.roomCode || !entry.uid) errors.push('accountId, roomCode, and uid are required');
    if (!allowed(LEDGER_CURRENCIES).has(entry.currency)) errors.push('currency is invalid');
    if (!allowed(LEDGER_DIRECTIONS).has(entry.direction)) errors.push('direction is invalid');
    if (!allowed(LEDGER_ENTRY_TYPES).has(entry.type)) errors.push('type is invalid');
    if (!allowed(LEDGER_STATUSES).has(entry.status)) errors.push('status is invalid');
    if (entry.amount <= 0) errors.push('amount must be greater than zero');
    if (entry.status === LEDGER_STATUSES.reversed && !entry.reversalOf) errors.push('reversed entries require reversalOf');
    if (entry.financial.amountCents > 0 && !entry.financial.externalTransactionId) errors.push('financial entries require externalTransactionId');
    if (entry.attribution.backingTrackId && !entry.attribution.canonicalSongId) errors.push('backing-track attribution requires canonicalSongId');
    return { valid: errors.length === 0, errors, entry };
};

export const reconcileLedgerBalance = (entries = []) => (
    (Array.isArray(entries) ? entries : []).reduce((balance, rawEntry) => {
        const { valid, entry } = validateLedgerEntry(rawEntry);
        if (!valid || entry.status !== LEDGER_STATUSES.posted) return balance;
        return balance + (entry.direction === LEDGER_DIRECTIONS.credit ? entry.amount : -entry.amount);
    }, 0)
);
