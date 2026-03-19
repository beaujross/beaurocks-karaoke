import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.resolve(process.cwd(), "dist");
const ASSETS_DIR = path.join(DIST_DIR, "assets");

const LEGACY_INDEX_ALIASES = [
  "index-BbrHeXcI.js",
  "index-BMypM57O.js",
];

const LEGACY_FIREBASE_ALIASES = [
  "firebase-Ci5B9x4A.js",
];

const readCurrentIndexFile = async () => {
  const indexHtml = await fs.readFile(path.join(DIST_DIR, "index.html"), "utf8");
  const match = indexHtml.match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  if (!match?.[1]) {
    throw new Error("Could not determine the current index asset from dist/index.html.");
  }
  return match[1];
};

const readCurrentMainFile = async (indexFile) => {
  const indexSource = await fs.readFile(path.join(ASSETS_DIR, indexFile), "utf8");
  const match = indexSource.match(/\.\/(main-[A-Za-z0-9_-]+\.js)/);
  if (!match?.[1]) {
    throw new Error(`Could not determine the current main asset from ${indexFile}.`);
  }
  return match[1];
};

const readCurrentFirebaseFile = async (mainFile) => {
  const mainSource = await fs.readFile(path.join(ASSETS_DIR, mainFile), "utf8");
  const match = mainSource.match(/\.\/(firebase-[A-Za-z0-9_-]+\.js)/);
  if (!match?.[1]) {
    throw new Error(`Could not determine the current firebase asset from ${mainFile}.`);
  }
  return match[1];
};

const writeAliasIfNeeded = async (aliasName, contents) => {
  const aliasPath = path.join(ASSETS_DIR, aliasName);
  await fs.writeFile(aliasPath, contents, "utf8");
};

const main = async () => {
  const indexFile = await readCurrentIndexFile();
  const mainFile = await readCurrentMainFile(indexFile);
  const firebaseFile = await readCurrentFirebaseFile(mainFile);

  for (const aliasName of LEGACY_INDEX_ALIASES) {
    if (aliasName === indexFile) continue;
    await writeAliasIfNeeded(aliasName, `import "./${indexFile}";\n`);
  }

  for (const aliasName of LEGACY_FIREBASE_ALIASES) {
    if (aliasName === firebaseFile) continue;
    await writeAliasIfNeeded(aliasName, `export * from "./${firebaseFile}";\n`);
  }

  console.log(
    `[asset-aliases] index -> ${indexFile}; firebase -> ${firebaseFile}; aliases written: ${LEGACY_INDEX_ALIASES.length + LEGACY_FIREBASE_ALIASES.length}`
  );
};

main().catch((error) => {
  console.error("[asset-aliases] failed:", error);
  process.exitCode = 1;
});
