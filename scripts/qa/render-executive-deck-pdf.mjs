import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const root = process.cwd();
const sourcePath = path.resolve(root, "docs/reviews/decks/2026-07-13-beaurocks-executive-plan.html");
const outputPath = path.resolve(root, "docs/reviews/decks/2026-07-13-beaurocks-executive-plan.pdf");
const previewDir = path.resolve(root, "docs/reviews/decks/evidence/2026-07-13-beaurocks-executive-plan");

await fs.mkdir(previewDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(sourcePath).href, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.ready);

  const slides = page.locator(".slide");
  const slideCount = await slides.count();
  if (slideCount !== 10) {
    throw new Error(`Expected 10 slides, found ${slideCount}.`);
  }

  const layoutFindings = await page.evaluate(() => Array.from(document.querySelectorAll(".slide")).map((slide, index) => {
    const slideRect = slide.getBoundingClientRect();
    const offenders = Array.from(slide.querySelectorAll("*")).flatMap((element) => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return [];
      const rect = element.getBoundingClientRect();
      const tolerance = 1;
      const outside = rect.left < slideRect.left - tolerance
        || rect.top < slideRect.top - tolerance
        || rect.right > slideRect.right + tolerance
        || rect.bottom > slideRect.bottom + tolerance;
      if (!outside) return [];
      return [{
        tag: element.tagName.toLowerCase(),
        className: String(element.className || ""),
        bounds: [rect.left, rect.top, rect.right, rect.bottom].map((value) => Math.round(value)),
      }];
    });
    return {
      slide: index + 1,
      scrollOverflow: slide.scrollWidth > slide.clientWidth + 1 || slide.scrollHeight > slide.clientHeight + 1,
      offenders: offenders.slice(0, 12),
    };
  }));

  const failedLayouts = layoutFindings.filter((finding) => finding.scrollOverflow || finding.offenders.length > 0);
  if (failedLayouts.length > 0) {
    throw new Error(`Slide bounds check failed: ${JSON.stringify(failedLayouts, null, 2)}`);
  }

  for (let index = 0; index < slideCount; index += 1) {
    await slides.nth(index).screenshot({
      path: path.join(previewDir, `slide-${String(index + 1).padStart(2, "0")}.png`),
      type: "png",
    });
  }

  await page.pdf({
    path: outputPath,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  });

  const pdfStat = await fs.stat(outputPath);
  if (pdfStat.size < 100_000) {
    throw new Error(`PDF output is unexpectedly small (${pdfStat.size} bytes).`);
  }

  process.stdout.write(`${JSON.stringify({
    ok: true,
    sourcePath,
    outputPath,
    previewDir,
    slideCount,
    pdfBytes: pdfStat.size,
    layoutFindings,
  }, null, 2)}\n`);
} finally {
  await browser.close();
}
