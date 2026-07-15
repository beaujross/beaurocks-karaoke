import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("public chart admin operations", () => {
  test("wires launch preflight and dry-run-first result repair into Admin moderation", () => {
    const source = read("src/apps/Marketing/pages/AdminModerationPage.jsx");
    expect(source).toMatch(/previewPublicChartLaunch/);
    expect(source).toMatch(/moderatePublicChartResult/);
    expect(source).toMatch(/Preview this exact result before removing it/);
    expect(source).toMatch(/Preview Removal/);
    expect(source).toMatch(/Remove \+ Rebuild/);
  });

  test("keeps public identity and moderation audit data separated", () => {
    const rules = read("firestore.rules");
    const functions = read("functions/index.js");
    expect(rules).toMatch(/match \/public_chart_moderation_events\/\{eventId\}[\s\S]*allow read, write: if false/);
    expect(functions).toMatch(/profileUid: admin\.firestore\.FieldValue\.delete\(\)/);
    expect(functions).toMatch(/topProfileUid: admin\.firestore\.FieldValue\.delete\(\)/);
  });
});
