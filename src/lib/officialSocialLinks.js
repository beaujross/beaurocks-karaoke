export const OFFICIAL_BEAUROCKS_SOCIAL_LINKS = Object.freeze([
  Object.freeze({
    id: "facebook",
    label: "Facebook",
    url: "https://www.facebook.com/BeauRocksKaraoke",
    iconClass: "fa-brands fa-facebook-f",
  }),
  Object.freeze({
    id: "instagram",
    label: "Instagram",
    url: "https://www.instagram.com/beaurockskaraoke/",
    iconClass: "fa-brands fa-instagram",
  }),
  Object.freeze({
    id: "youtube",
    label: "YouTube",
    url: "https://www.youtube.com/channel/UCkWxI2CivAk52-l9zXofrKA",
    iconClass: "fa-brands fa-youtube",
  }),
]);

export const getOfficialBeauRocksSocialLink = (id = "") =>
  OFFICIAL_BEAUROCKS_SOCIAL_LINKS.find((entry) => entry.id === String(id || "").trim().toLowerCase()) || null;

export default OFFICIAL_BEAUROCKS_SOCIAL_LINKS;
