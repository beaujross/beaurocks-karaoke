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
  const envLocal = fs.existsSync(path.join(root, ".env.local"))
    ? readText(".env.local")
    : "";

  const results = [];

  assertIncludes(runbook, "Test number flow", "runbook_has_test_number_flow", results);
  assertIncludes(runbook, "Real number flow", "runbook_has_real_number_flow", results);
  assertIncludes(runbook, "Run host smoke test with write checks enabled", "runbook_requires_host_smoke", results);
  assertIncludes(runbook, "Validate App Check dashboard", "runbook_mentions_app_check_validation", results);

  assertIncludes(singerApp, "startPhoneAuth('recap-container-modal')", "ui_has_modal_sms_entrypoint", results);
  assertIncludes(singerApp, "startPhoneAuth('recap-container-vip')", "ui_has_vip_sms_entrypoint", results);
  assertIncludes(singerApp, "new RecaptchaVerifier(auth, targetContainerId", "recaptcha_verifier_initialized_per_container", results);
  assertIncludes(singerApp, "code.includes('too-many-requests')", "maps_too_many_requests_error", results);
  assertIncludes(singerApp, "code.includes('invalid-phone-number')", "maps_invalid_phone_error", results);
  assertIncludes(singerApp, "setDoc(doc(db, 'users', auth.currentUser.uid), { phone: phoneNumber, vipLevel: 1 }, { merge: true })", "writes_phone_and_vip_level_to_users_doc", results);
  assertIncludes(singerApp, "setDoc(doc(db, 'users', auth.currentUser.uid), { vipLevel: 1, isVip: true }, { merge: true })", "writes_vip_state_on_skip", results);

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
