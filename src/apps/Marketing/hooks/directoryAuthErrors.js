const getAuthCode = (error) =>
  String(error?.code || "")
    .trim()
    .toLowerCase();

export const getDirectoryAuthErrorMessage = (error) => {
  const code = getAuthCode(error);

  if (code.includes("email-already-in-use")) {
    return "An account already exists for this email. Sign in instead, or reset your password.";
  }
  if (
    code.includes("invalid-credential")
    || code.includes("wrong-password")
    || code.includes("user-not-found")
  ) {
    return "That email and password did not match. Try again, or reset your password.";
  }
  if (code.includes("invalid-email")) {
    return "Enter a valid email address.";
  }
  if (code.includes("weak-password")) {
    return "Choose a password with at least 6 characters.";
  }
  if (code.includes("too-many-requests")) {
    return "Too many sign-in attempts were made. Wait a few minutes, then try again.";
  }
  if (code.includes("network-request-failed")) {
    return "We could not connect. Check your internet connection and try again.";
  }
  if (code.includes("operation-not-allowed")) {
    return "This sign-in option is not available right now. Please contact BeauRocks support.";
  }

  return "We could not complete that sign-in request. Please try again.";
};
