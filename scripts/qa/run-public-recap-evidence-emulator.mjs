import { spawnSync } from "node:child_process";

const testCommand = "node tests/integration/publicRoomRecapEvidenceCallable.test.cjs";
const result = spawnSync("npx", [
  "firebase-tools",
  "emulators:exec",
  "--project",
  "demo-bross",
  "--only",
  "firestore,storage",
  process.platform === "win32" ? `"${testCommand}"` : testCommand,
], {
  cwd: process.cwd(),
  shell: process.platform === "win32",
  env: {
    ...process.env,
    DEBUG: "",
    QA_APP_CHECK_DEBUG_TOKEN: "",
    QA_ALLOWED_HOST_EMAILS: "",
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(Number.isInteger(result.status) ? result.status : 1);
