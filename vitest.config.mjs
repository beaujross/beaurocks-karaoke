import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/unit/**/*.test.mjs", "tests/unit/**/*.test.cjs"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      enabled: false,
      reportsDirectory: "./coverage/unit",
      reporter: ["text", "html", "json-summary"],
      skipFull: true,
      all: true,
      include: [
        "src/**/*.{js,jsx,mjs}",
        "functions/lib/**/*.js",
      ],
      exclude: [
        "node_modules/**",
        "dist/**",
        "tests/**",
        "scripts/**",
        "public/**",
        "functions/index.js",
      ],
      thresholds: {
        "src/lib/playbackSource.js": {
          statements: 95,
          branches: 90,
          functions: 100,
          lines: 100,
        },
        "src/lib/karaokeBracketSupport.js": {
          statements: 93,
          branches: 75,
          functions: 100,
          lines: 98,
        },
        "src/lib/volleyOrbUiState.js": {
          statements: 100,
          branches: 94,
          functions: 100,
          lines: 100,
        },
        "src/apps/TV/lobbyPlaygroundEngine.js": {
          statements: 95,
          branches: 76,
          functions: 97,
          lines: 98,
        },
        "src/apps/Host/partyOrchestrator.js": {
          statements: 90,
          branches: 81,
          functions: 100,
          lines: 91,
        },
        "src/apps/Host/missionControl.js": {
          statements: 77,
          branches: 53,
          functions: 88,
          lines: 84,
        },
        "functions/lib/entitlementsUsage.js": {
          statements: 96,
          branches: 82,
          functions: 100,
          lines: 97,
        },
        "functions/lib/popTrivia.js": {
          statements: 84,
          branches: 73,
          functions: 100,
          lines: 92,
        },
        "functions/lib/geminiClient.js": {
          statements: 82,
          branches: 77,
          functions: 88,
          lines: 83,
        },
        "src/apps/Marketing/pages/discoverOfficialSummary.js": {
          statements: 100,
          branches: 86,
          functions: 100,
          lines: 100,
        },
        "src/apps/Marketing/pages/discoverFacets.js": {
          statements: 100,
          branches: 96,
          functions: 100,
          lines: 100,
        },
        "src/apps/Marketing/pages/discoverListingTypes.js": {
          statements: 100,
          branches: 94,
          functions: 100,
          lines: 100,
        },
        "src/apps/Marketing/pages/discoverListingViewModel.js": {
          statements: 90,
          branches: 77,
          functions: 87,
          lines: 97,
        },
        "src/apps/Marketing/pages/discoverRanking.js": {
          statements: 90,
          branches: 83,
          functions: 94,
          lines: 93,
        },
      },
    },
  },
});
