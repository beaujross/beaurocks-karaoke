import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

export const DEFAULT_FIREBASE_RUNTIME_CONFIG = {
  apiKey: "AIzaSyBmX0XXpGE0wGcR9YXw3oKOqnJE9GT6_Jc",
  authDomain: "beaurocks-karaoke-v2.firebaseapp.com",
  projectId: "beaurocks-karaoke-v2",
  storageBucket: "beaurocks-karaoke-v2.firebasestorage.app",
  messagingSenderId: "426849563936",
  appId: "1:426849563936:web:03c1d7eefd0c66e4649345",
  measurementId: "G-KRHWBTB7V7",
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(`Playwright is not installed (${message}). Run: npm install && npm run qa:admin:prod:install`);
  }
};

export const resolveDistFilePath = async (distDir, requestPath = "/") => {
  const normalized = decodeURIComponent(String(requestPath || "/")).split("?")[0];
  const trimmed = normalized.replace(/^\/+/, "");
  const joined = path.resolve(distDir, trimmed || "index.html");
  const hasExplicitExtension = Boolean(path.extname(trimmed));
  const relativeToDist = path.relative(distDir, joined);
  const outsideDist = relativeToDist.startsWith("..") || path.isAbsolute(relativeToDist);
  if (outsideDist) {
    return {
      filePath: path.join(distDir, "index.html"),
      statusCode: hasExplicitExtension ? 404 : 200,
    };
  }
  try {
    const stats = await fs.stat(joined);
    if (stats.isDirectory()) {
      return { filePath: path.join(joined, "index.html"), statusCode: 200 };
    }
    return { filePath: joined, statusCode: 200 };
  } catch {
    return {
      filePath: path.join(distDir, "index.html"),
      statusCode: hasExplicitExtension ? 404 : 200,
    };
  }
};

export const startStaticDistServer = async ({ distDir, port = 0, host = "127.0.0.1" }) => {
  await fs.access(path.join(distDir, "index.html"));
  const server = http.createServer(async (req, res) => {
    try {
      const { filePath, statusCode } = await resolveDistFilePath(distDir, req?.url || "/");
      const body = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(statusCode, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(body);
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(`Server error: ${String(error?.message || error)}`);
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    baseUrl: `http://${host}:${actualPort}`,
    stop: async () => {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
};

export const runCheck = async (checks, name, fn) => {
  try {
    const detail = await fn();
    checks.push({ name, pass: true, detail: detail || "" });
    return true;
  } catch (error) {
    checks.push({ name, pass: false, detail: String(error?.message || error) });
    return false;
  }
};

export const waitForAnyVisible = async (locators = [], timeoutMs = 30000, pollMs = 200) => {
  const startedAt = Date.now();
  let lastError = null;
  while ((Date.now() - startedAt) < timeoutMs) {
    for (const locator of locators) {
      try {
        if (await locator.isVisible()) return locator;
      } catch (error) {
        lastError = error;
      }
    }
    await delay(pollMs);
  }
  throw lastError || new Error("No fallback locator became visible.");
};
