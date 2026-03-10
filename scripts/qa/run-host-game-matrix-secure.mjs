import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const DEFAULT_SUPER_ADMIN_EMAIL = "hello@beauross.com";

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return fallback;
};

const parseEmailTokens = (value = "") =>
  String(value || "")
    .split(",")
    .map((entry) => String(entry || "").trim().toLowerCase())
    .filter(Boolean);

const ask = (question = "") =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(String(answer || "").trim());
    });
  });

const askSecret = (question = "") =>
  new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Secure password prompt requires a TTY."));
      return;
    }

    const stdin = process.stdin;
    let value = "";
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };

    const onData = (char) => {
      if (char === "\u0003") {
        cleanup();
        reject(new Error("Prompt cancelled by user."));
        return;
      }
      if (char === "\r" || char === "\n") {
        cleanup();
        resolve(value);
        return;
      }
      if (char === "\u0008" || char === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };

    stdin.on("data", onData);
  });

const run = async () => {
  const allowSuperAdmin = toBool(process.env.QA_ALLOW_SUPERADMIN, false);
  const blockedEmails = new Set([
    ...parseEmailTokens(process.env.SUPER_ADMIN_EMAILS || DEFAULT_SUPER_ADMIN_EMAIL),
    ...parseEmailTokens(process.env.QA_BLOCKED_HOST_EMAILS || ""),
  ]);
  const explicitlyAllowedEmails = new Set(parseEmailTokens(process.env.QA_ALLOWED_HOST_EMAILS || ""));

  let email = String(process.env.QA_HOST_EMAIL || "").trim();
  let password = String(process.env.QA_HOST_PASSWORD || "");

  if (!email) {
    email = await ask("QA host email: ");
  }
  if (!password) {
    password = await askSecret("QA host password (hidden): ");
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error("Both QA host email and password are required.");
  }
  if (explicitlyAllowedEmails.size > 0 && !explicitlyAllowedEmails.has(normalizedEmail)) {
    throw new Error(
      `QA host email "${email}" is not in QA_ALLOWED_HOST_EMAILS. Use a dedicated low-privilege QA account.`
    );
  }
  if (!allowSuperAdmin && blockedEmails.has(normalizedEmail)) {
    throw new Error(
      `QA host email "${email}" is blocked by super-admin policy. Use a dedicated QA host account.`
    );
  }

  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const targetScript = path.join(thisDir, "host-game-matrix-playwright.mjs");

  const env = {
    ...process.env,
    QA_HOST_EMAIL: email,
    QA_HOST_PASSWORD: password,
  };

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [targetScript], {
      stdio: "inherit",
      env,
      cwd: process.cwd(),
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Secure QA runner failed with exit code ${code}`));
      }
    });
  });

  delete process.env.QA_HOST_EMAIL;
  delete process.env.QA_HOST_PASSWORD;
};

run().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: String(error?.message || error),
      },
      null,
      2
    )
  );
  process.exit(1);
});
