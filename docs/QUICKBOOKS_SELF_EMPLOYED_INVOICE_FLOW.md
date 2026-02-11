# QuickBooks Self-Employed Invoice Flow

Last updated: 2026-02-11

## Goal

Use BROSS usage metering output to support monthly invoicing and reconciliation in QuickBooks Self-Employed (QBSE).

## Current Integration Shape

From Host Billing -> Usage:

1. Select billing period.
2. Generate invoice draft.
3. Download:
- Line-item CSV (for manual invoice entry reference).
- QBSE transaction CSV (for income import/reconciliation reference).
- Invoice draft JSON (audit trail).

## Recommended QBSE Workflow

1. Create invoice manually in QBSE using values from Line-item CSV.
2. Send invoice from QBSE as normal.
3. When payment settles, import QBSE transaction CSV and reconcile payment as business income against that invoice.

## Important Constraint

QBSE does not currently use the same public invoice API path as QuickBooks Online (QBO).
This implementation therefore prioritizes:
- Accurate line-item export for manual invoice entry.
- Clean transaction CSV for reconciliation.

## Upgrade Path (If Moving to QuickBooks Online)

The invoice draft payload already includes:
- `quickbooks.online.invoicePayloadCandidate`

This is intended as a starter mapping for QBO Invoice API line items.

