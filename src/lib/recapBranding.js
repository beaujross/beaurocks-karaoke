const AAHF_RECAP_LOGO_URL = '/images/marketing/aahf-combined-badge-clean.png';

const cleanText = (value = '') => String(value || '').trim();

const normalizeComparableUrl = (value = '', origin = '') => {
  const token = cleanText(value);
  if (!token) return '';
  try {
    const baseOrigin = cleanText(origin) || 'https://beaurocks.app';
    const url = /^https?:\/\//i.test(token)
      ? new URL(token)
      : new URL(token, baseOrigin);
    const normalizedPath = url.pathname
      .replace(/\/+$/, '')
      .replace(/%20/g, ' ')
      .toLowerCase();
    return `${normalizedPath}${url.search}`;
  } catch {
    return token
      .replace(/\/+$/, '')
      .replace(/%20/g, ' ')
      .toLowerCase();
  }
};

export const isAahfRoom = (roomCode = '', roomName = '') =>
  `${cleanText(roomCode)} ${cleanText(roomName)}`.toLowerCase().match(/aahf|asian arts|heritage festival/);

export const toAbsoluteRecapUrl = (value = '', origin = '') => {
  const token = cleanText(value);
  if (!token) return '';
  try {
    const baseOrigin = cleanText(origin)
      || (typeof window !== 'undefined' ? window.location.origin : 'https://beaurocks.app');
    return new URL(token, baseOrigin).toString();
  } catch {
    return token;
  }
};

export const resolveRecapBranding = ({
  roomCode = '',
  roomName = '',
  logoUrl = '',
  defaultLogoUrl = '',
  leadImageUrl = '',
  origin = '',
} = {}) => {
  const beauLogo = cleanText(defaultLogoUrl);
  const roomLogo = cleanText(logoUrl) || (isAahfRoom(roomCode, roomName) ? AAHF_RECAP_LOGO_URL : '');
  const hasPartnerLogo = !!roomLogo && normalizeComparableUrl(roomLogo, origin) !== normalizeComparableUrl(beauLogo, origin);
  const socialImageUrl = cleanText(hasPartnerLogo ? roomLogo : '')
    || cleanText(leadImageUrl)
    || beauLogo;

  return {
    partnerLogo: roomLogo,
    beauLogo,
    hasPartnerLogo,
    socialImageUrl,
  };
};
