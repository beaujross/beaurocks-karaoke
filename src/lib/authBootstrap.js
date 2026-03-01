export const shouldBootstrapAnonymousAuth = ({ customToken = "", currentUser = null } = {}) => {
  const token = String(customToken || "").trim();
  if (token) return false;
  return !currentUser?.uid;
};

