import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const readText = (relPath) => fs.readFileSync(path.join(root, relPath), "utf8");

const assertIncludes = (text, needle, label, results) => {
  const pass = text.includes(needle);
  results.push({ check: label, pass, needle });
};

const run = () => {
  const runbook = readText("docs/VIP_SMS_AUTH_RUNBOOK.md");
  const singerApp = readText("src/apps/Mobile/SingerApp.jsx");
  const firebaseClient = readText("src/lib/firebase.js");
  const envLocal = fs.existsSync(path.join(root, ".env.local"))
    ? readText(".env.local")
    : "";

  const results = [];

  assertIncludes(runbook, "Email-link upgrade flow", "runbook_names_email_link_flow", results);
  assertIncludes(runbook, "same device", "runbook_mentions_same_device_guidance", results);
  assertIncludes(runbook, "expired or already-used link", "runbook_covers_invalid_link_recovery", results);
  assertIncludes(runbook, "Run host smoke test with write checks enabled", "runbook_requires_host_smoke", results);
  assertIncludes(runbook, "Validate App Check dashboard", "runbook_mentions_app_check_validation", results);

  assertIncludes(singerApp, "sendBeauRocksEmailSignInLink({", "ui_sends_email_sign_in_link", results);
  assertIncludes(singerApp, "localStorage.setItem(AUDIENCE_EMAIL_LINK_STORAGE_KEY", "ui_persists_email_link_context", results);
  assertIncludes(singerApp, "isSignInWithEmailLink(auth, emailLinkHref)", "ui_detects_email_link_return", results);
  assertIncludes(singerApp, "EmailAuthProvider.credentialWithLink(email, emailLinkHref)", "ui_builds_email_link_credential", results);
  assertIncludes(singerApp, "linkWithCredential(auth.currentUser, credential)", "ui_links_anonymous_user_when_possible", results);
  assertIncludes(singerApp, "signInWithCredential(auth, credential)", "ui_signs_into_existing_account", results);
  assertIncludes(singerApp, "mergeAnonymousAccountData({", "ui_merges_anonymous_progress", results);
  assertIncludes(singerApp, "setMyVipAccountStatus({", "ui_uses_vip_status_callable", results);
  assertIncludes(singerApp, "source: 'audience_email_verify'", "ui_uses_email_verify_source", results);
  assertIncludes(singerApp, "code.includes('expired-action-code')", "ui_maps_expired_link_error", results);
  assertIncludes(singerApp, "code.includes('invalid-action-code')", "ui_maps_invalid_link_error", results);
  assertIncludes(singerApp, "stripEmailLinkParamsFromUrl();", "ui_strips_email_link_query_params", results);
  assertIncludes(singerApp, "Email verified. ${premiumAccessLabel} perks unlocked! +5000 PTS", "ui_announces_email_vip_reward", results);

  assertIncludes(firebaseClient, 'requireAppCheckToken("sendBeauRocksEmailSignInLink")', "callable_requires_app_check", results);

  const hasRecaptchaSiteKey = /VITE_RECAPTCHA_V3_SITE_KEY\s*=.+/.test(envLocal);
  results.push({ check: "env_has_recaptcha_site_key", pass: hasRecaptchaSiteKey, needle: "VITE_RECAPTCHA_V3_SITE_KEY" });

  const failed = results.filter((item) => !item.pass);
  const output = {
    ok: failed.length === 0,
    failedCount: failed.length,
    results,
  };
  console.log(JSON.stringify(output, null, 2));
  if (failed.length) process.exit(1);
};

run();
