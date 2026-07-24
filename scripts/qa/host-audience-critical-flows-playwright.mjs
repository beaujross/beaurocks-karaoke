import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_FIREBASE_RUNTIME_CONFIG,
  delay,
  ensurePlaywright,
  runCheck,
  startStaticDistServer,
} from './shared/playwrightQa.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const DIST_DIR = path.join(repoRoot, 'dist');
const DEFAULT_TIMEOUT_MS = 90000;

const assertNoPageErrors = (errors, surface) => {
  if (errors.length) throw new Error(`${surface}: ${errors[0]}`);
};

const main = async () => {
  const timeoutMs = Math.max(30000, Number(process.env.QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
  const headless = String(process.env.QA_HEADFUL || '').trim() !== '1';
  const { chromium } = await ensurePlaywright();
  const server = await startStaticDistServer({ distDir: DIST_DIR });
  const browser = await chromium.launch({ headless });
  const checks = [];
  const hostErrors = [];
  const audienceErrors = [];
  let failure = null;

  try {
    const hostContext = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1,
    });
    await hostContext.addInitScript((firebaseConfig) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
    const hostPage = await hostContext.newPage();
    hostPage.on('pageerror', (error) => {
      hostErrors.push(String(error?.stack || error?.message || error));
    });
    await hostPage.emulateMedia({ reducedMotion: 'reduce' });
    await hostPage.goto(
      `${server.baseUrl}/?mode=host&room=DEMOAAHF&mkDemoEmbed=1&qaHostFixture=room-setup-recipes&hostUiVersion=v2`,
      { waitUntil: 'domcontentloaded', timeout: timeoutMs },
    );
    await hostPage.locator('.host-app').first().waitFor({ state: 'attached', timeout: timeoutMs });
    const hostWizard = hostPage.locator('div.fixed.inset-0').filter({ hasText: 'Pick the night you want' }).last();
    await hostWizard.locator('[data-room-setup-recipes="true"]').waitFor({ state: 'visible', timeout: timeoutMs });
    await delay(400);

    await runCheck(checks, 'host_room_recipes_are_scannable_and_selectable', async () => {
      const cards = hostWizard.locator('[data-room-recipe-card]');
      const count = await cards.count();
      if (count < 4) throw new Error(`Expected at least four room recipes, found ${count}.`);
      const candidate = hostWizard.locator('[data-room-recipe-card][aria-pressed="false"]').first();
      const recipeId = await candidate.getAttribute('data-room-recipe-card');
      await candidate.click();
      const selectedCandidate = hostWizard.locator(`[data-room-recipe-card="${recipeId}"]`);
      let recipeSelected = false;
      for (let attempt = 0; attempt < 20 && !recipeSelected; attempt += 1) {
        recipeSelected = (await selectedCandidate.getAttribute('aria-pressed')) === 'true';
        if (!recipeSelected) await delay(50);
      }
      if (!recipeSelected) {
        throw new Error('Selected room recipe did not expose its selected state.');
      }
      return `${count} recipe cards rendered and selection state updated`;
    });

    await runCheck(checks, 'host_between_performance_program_is_directly_controllable', async () => {
      const program = hostWizard.locator('[data-feature-id="setup-intermission-program"]');
      await program.waitFor({ state: 'visible', timeout: timeoutMs });
      const offToggle = program.getByRole('button', { name: 'Off', exact: true });
      if (await offToggle.isVisible().catch(() => false)) await offToggle.click();
      await program.getByRole('button', { name: 'On', exact: true }).waitFor({ state: 'visible', timeout: timeoutMs });
      const cadenceThree = program.getByRole('button', { name: '3', exact: true });
      await cadenceThree.click();
      let cadenceSelected = false;
      for (let attempt = 0; attempt < 20 && !cadenceSelected; attempt += 1) {
        cadenceSelected = (await cadenceThree.getAttribute('aria-pressed')) === 'true';
        if (!cadenceSelected) await delay(50);
      }
      if (!cadenceSelected) {
        throw new Error('Three-singer cadence did not expose its selected state.');
      }
      return 'activity plan enabled with an every-three-singers cadence';
    });

    await runCheck(checks, 'host_custom_recipe_can_be_saved_for_reuse', async () => {
      hostPage.once('dialog', (dialog) => dialog.accept('QA Night Recipe'));
      await hostWizard.getByRole('button', { name: 'Save current recipe' }).click();
      await hostWizard.getByText('QA Night Recipe', { exact: true }).first().waitFor({
        state: 'visible',
        timeout: timeoutMs,
      });
      return 'custom recipe appeared in the reusable recipe grid';
    });

    await runCheck(checks, 'host_setup_has_no_runtime_errors', async () => {
      assertNoPageErrors(hostErrors, 'Host setup');
      return 'no client-side runtime errors';
    });
    await hostContext.close();

    const audienceContext = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    await audienceContext.addInitScript((firebaseConfig) => {
      if (!window.__firebase_config) window.__firebase_config = firebaseConfig;
    }, DEFAULT_FIREBASE_RUNTIME_CONFIG);
    const audiencePage = await audienceContext.newPage();
    audiencePage.on('pageerror', (error) => {
      audienceErrors.push(String(error?.stack || error?.message || error));
    });
    await audiencePage.emulateMedia({ reducedMotion: 'reduce' });
    await audiencePage.goto(
      `${server.baseUrl}/?mode=mobile&room=DEMOREACT&qaAudienceFixture=cohost-unlimited-reactions`,
      { waitUntil: 'domcontentloaded', timeout: timeoutMs },
    );
    await audiencePage.locator('[data-singer-view="main"]').waitFor({ state: 'visible', timeout: timeoutMs });
    await audiencePage.locator('[data-feature-id="audience-reaction-slot-grid"]').waitFor({
      state: 'visible',
      timeout: timeoutMs,
    });
    await delay(400);

    await runCheck(checks, 'audience_locked_reaction_slots_keep_full_card_size', async () => {
      for (const slotNumber of [5, 6]) {
        const slot = audiencePage.locator(`[data-feature-id="locked-reaction-slot-${slotNumber}"]`);
        await slot.waitFor({ state: 'visible', timeout: timeoutMs });
        const box = await slot.boundingBox();
        if (!box || box.height < 140 || box.width < 140) {
          throw new Error(`Reaction slot ${slotNumber} measured ${box?.width || 0}x${box?.height || 0}.`);
        }
        await slot.getByText(`Reaction slot ${slotNumber}`, { exact: true }).waitFor({ state: 'visible' });
      }
      return 'slots 5 and 6 remain visible, full-size merchandising cards';
    });

    await runCheck(checks, 'audience_slot_six_routes_through_required_points_step', async () => {
      await audiencePage.locator('[data-feature-id="locked-reaction-slot-6"]').click();
      await audiencePage.locator('[data-feature-id="audience-points-conversion-funnel"]').waitFor({
        state: 'visible',
        timeout: timeoutMs,
      });
      await audiencePage.locator('[data-feature-id="audience-account-5000-points-offer"]').waitFor({
        state: 'visible',
        timeout: timeoutMs,
      });
      await audiencePage.getByText('+5,000 PTS', { exact: true }).waitFor({ state: 'visible', timeout: timeoutMs });
      return 'slot 6 correctly explains slot 5 and presents the account reward path';
    });

    await audiencePage.getByRole('button', { name: 'Close points sheet' }).click();
    await runCheck(checks, 'audience_reaction_library_is_obvious_and_actionable', async () => {
      const browse = audiencePage.locator('[data-feature-id="browse-reaction-emoji-library"]');
      await browse.waitFor({ state: 'visible', timeout: timeoutMs });
      await browse.click();
      await audiencePage.getByRole('heading', { name: 'Reaction Emoji Library' }).waitFor({
        state: 'visible',
        timeout: timeoutMs,
      });
      await audiencePage.locator('[data-feature-id="audience-reaction-collection"]').waitFor({
        state: 'visible',
        timeout: timeoutMs,
      });
      await audiencePage.getByText('Compare power. Pick your show.', { exact: true }).waitFor({
        state: 'visible',
        timeout: timeoutMs,
      });
      return 'browse CTA opens the lazy-loaded comparison and purchase library';
    });

    await runCheck(checks, 'audience_reaction_flow_has_no_runtime_errors', async () => {
      assertNoPageErrors(audienceErrors, 'Audience reactions');
      return 'no client-side runtime errors';
    });
    await audienceContext.close();
  } catch (error) {
    failure = error;
  } finally {
    await browser.close().catch(() => {});
    await server.stop().catch(() => {});
  }

  for (const check of checks) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
  }
  if (failure || checks.some((entry) => !entry.pass)) {
    if (failure) console.error(String(failure?.stack || failure?.message || failure));
    process.exitCode = 1;
    return;
  }
  console.log('Host and Audience critical-flow QA passed.');
};

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
