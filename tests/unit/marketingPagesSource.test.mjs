import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const readSource = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("marketing page source", () => {
  it("prioritizes discover and join-by-code on the fan homepage hero", () => {
    const source = readSource("src/apps/Marketing/pages/ForFansPage.jsx");
    expect(source).toContain('trackPersonaCta("hero_discover")');
    expect(source).toContain("Explore Live Nights");
    expect(source).toContain('trackPersonaCta("hero_join_by_code")');
    expect(source).toContain("Have a room code? Join");
    expect(source).not.toContain('trackPersonaCta("hero_waitlist")');
  });

  it("reduces repeated reviewed-access framing on the host waitlist hero", () => {
    const source = readSource("src/apps/Marketing/pages/ForHostsPage.jsx");
    expect(source).toContain("Apply once, then come back to the same");
    expect(source).toContain("<span>Apply once</span>");
    expect(source).toContain("<b>Same account opens the dashboard</b>");
  });

  it("documents both BeauRocks-hosted and independent map listing paths", () => {
    const venueSource = readSource("src/apps/Marketing/pages/ForVenuesPage.jsx");
    const discoverSource = readSource("src/apps/Marketing/pages/DiscoverPage.jsx");
    const submissionSource = readSource("src/apps/Marketing/pages/ListingSubmissionPage.jsx");
    expect(venueSource).toContain("Two ways to get on the map");
    expect(venueSource).toContain("Publish the room from Host setup");
    expect(venueSource).toContain("Submit a venue or recurring night");
    expect(discoverSource).toContain("List Your Karaoke Night");
    expect(submissionSource).toContain("Independent venues and karaoke nights can be listed");
    expect(submissionSource).toContain("Venue Timezone");
  });

  it("stacks the discover radar hero to one column on smaller screens", () => {
    const source = readSource("src/apps/Marketing/marketing.css");
    expect(source).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.mk3-discover-radar-hero\s*\{\s*grid-template-columns:\s*1fr;/
    );
    expect(source).toMatch(
      /@media \(max-width: 640px\)[\s\S]*?\.mk3-discover-radar-panel\s*\{\s*grid-template-columns:\s*1fr;/
    );
  });
});
