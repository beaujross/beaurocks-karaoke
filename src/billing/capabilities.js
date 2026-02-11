export const CAPABILITY_KEYS = Object.freeze({
  AI_GENERATE_CONTENT: 'ai.generate_content',
  API_YOUTUBE_DATA: 'api.youtube_data',
  API_APPLE_MUSIC: 'api.apple_music',
  BILLING_INVOICE_DRAFTS: 'billing.invoice_drafts',
  WORKSPACE_ONBOARDING: 'workspace.onboarding',
});

export const CAPABILITY_LABELS = Object.freeze({
  [CAPABILITY_KEYS.AI_GENERATE_CONTENT]: 'AI Content Tools',
  [CAPABILITY_KEYS.API_YOUTUBE_DATA]: 'YouTube Data Access',
  [CAPABILITY_KEYS.API_APPLE_MUSIC]: 'Apple Music API Access',
  [CAPABILITY_KEYS.BILLING_INVOICE_DRAFTS]: 'Invoice Draft Tools',
  [CAPABILITY_KEYS.WORKSPACE_ONBOARDING]: 'Workspace Onboarding',
});

export const hasCapability = (capabilities = {}, capability = '') =>
  !!(capability && capabilities && capabilities[capability]);

export const getMissingCapabilityLabel = (capability = '') =>
  CAPABILITY_LABELS[capability] || capability || 'Feature';
