import { execFileSync } from "node:child_process";

const DEFAULT_PROJECT_ID = "beaurocks-karaoke-v2";
const TARGET_MODE = "UNENFORCED";

const args = new Set(process.argv.slice(2));
const projectArg = process.argv.find((arg) => arg.startsWith("--project="));
const projectId = String(projectArg?.split("=").slice(1).join("=") || process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID).trim();
const checkOnly = args.has("--check");

const gcloudCommand = "gcloud";

const run = (command, commandArgs) => execFileSync(command, commandArgs, {
  encoding: "utf8",
  shell: process.platform === "win32",
  stdio: ["ignore", "pipe", "pipe"],
}).trim();

const getJson = async (url, token) => {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "x-goog-user-project": projectId,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GET ${url} failed ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
};

const postJson = async (url, token, payload) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-goog-user-project": projectId,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`POST ${url} failed ${response.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
};

const main = async () => {
  if (!projectId) throw new Error("Missing Firebase project id.");

  const projectNumber = run(gcloudCommand, ["projects", "describe", projectId, "--format=value(projectNumber)"]);
  const token = run(gcloudCommand, [
    "auth",
    "print-access-token",
    "--scopes=https://www.googleapis.com/auth/cloud-platform",
  ]);
  const parent = `projects/${projectNumber}`;
  const listUrl = `https://firebaseappcheck.googleapis.com/v1/${parent}/services`;
  const listed = await getJson(listUrl, token);
  const services = Array.isArray(listed.services) ? listed.services : [];

  if (!services.length) {
    console.log(`[app-check:event-mode] No App Check service configs found for ${projectId}.`);
    return;
  }

  const notReady = services.filter((service) => service.enforcementMode !== TARGET_MODE);
  console.log(`[app-check:event-mode] ${projectId} (${projectNumber})`);
  services.forEach((service) => {
    console.log(`- ${service.name.split("/").pop()}: ${service.enforcementMode}`);
  });

  if (!notReady.length) {
    console.log("[app-check:event-mode] All Firebase App Check services are already UNENFORCED.");
    return;
  }

  if (checkOnly) {
    throw new Error(`${notReady.length} App Check service(s) are not ${TARGET_MODE}.`);
  }

  const updateUrl = `https://firebaseappcheck.googleapis.com/v1/${parent}/services:batchUpdate`;
  const payload = {
    updateMask: "enforcementMode",
    requests: notReady.map((service) => ({
      service: {
        name: service.name,
        enforcementMode: TARGET_MODE,
      },
      updateMask: "enforcementMode",
    })),
  };
  const updated = await postJson(updateUrl, token, payload);
  console.log("[app-check:event-mode] Updated services:");
  (updated.services || []).forEach((service) => {
    console.log(`- ${service.name.split("/").pop()}: ${service.enforcementMode}`);
  });
};

main().catch((error) => {
  console.error("[app-check:event-mode] Failed.");
  console.error(error?.message || error);
  process.exit(1);
});
