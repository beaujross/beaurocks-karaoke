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

  it("keeps the host waitlist hero direct and party-focused", () => {
    const source = readSource("src/apps/Marketing/pages/ForHostsPage.jsx");
    expect(source).toContain("Host karaoke your way.");
    expect(source).toContain("Run the queue, TV, and guest phones");
    expect(source).toContain("<b>Limited invitation release</b>");
    expect(source).toContain("mk3-host-golden-ticket");
    expect(source).toContain("Invitations are selected in small batches—not first come, first served.");
  });

  it("separates room access from the highlighted Host waitlist call to action", () => {
    const navSource = readSource("src/apps/Marketing/iaModel.js");
    const siteSource = readSource("src/apps/Marketing/MarketingSite.jsx");
    expect(navSource).toContain('navItem(MARKETING_ROUTE_PAGES.join, "Room Access")');
    expect(siteSource).toContain("mk3-waitlist-ticket-cta");
    expect(siteSource).toContain("Join Host Waitlist");
    expect(siteSource).toContain("Room Access");
  });

  it("keeps public persona copy free of internal strategy language", () => {
    const sources = [
      "src/apps/Marketing/pages/ForFansPage.jsx",
      "src/apps/Marketing/pages/ForHostsPage.jsx",
      "src/apps/Marketing/pages/ForPerformersPage.jsx",
      "src/apps/Marketing/pages/ForVenuesPage.jsx",
      "src/apps/Marketing/emptyStateOrchestrator.js",
      "src/apps/Marketing/lib/directoryExperience.js",
      "src/apps/Marketing/components/DemoProductShells.jsx",
    ].map(readSource).join("\n");
    expect(sources).not.toMatch(
      /operating surface|shared-night system|qualified performances|room signal|persona pages|persona paths|conversion-friendly|recap(?:-powered)? proof|product-faithful walkthrough|signals a more modern|which surface runs/i
    );
  });

  it("documents both BeauRocks-hosted and independent map listing paths", () => {
    const venueSource = readSource("src/apps/Marketing/pages/ForVenuesPage.jsx");
    const discoverSource = readSource("src/apps/Marketing/pages/DiscoverPage.jsx");
    const submissionSource = readSource("src/apps/Marketing/pages/ListingSubmissionPage.jsx");
    expect(venueSource).toContain("Two ways to get on the map");
    expect(venueSource).toContain("Publish a public room");
    expect(venueSource).toContain("List an existing night");
    expect(discoverSource).toContain("List Your Karaoke Night");
    expect(submissionSource).toContain("Put Your Karaoke Night on the Map");
    expect(submissionSource).toContain("Venue Timezone");
  });

  it("provides a complete owner path from discovery through ongoing schedule management", () => {
    const discoverSource = readSource("src/apps/Marketing/pages/DiscoverPage.jsx");
    const eventSource = readSource("src/apps/Marketing/pages/EventPage.jsx");
    const venueSource = readSource("src/apps/Marketing/pages/VenuePage.jsx");
    const claimSource = readSource("src/apps/Marketing/pages/ClaimOwnershipCard.jsx");
    const submissionSource = readSource("src/apps/Marketing/pages/ListingSubmissionPage.jsx");
    const profileSource = readSource("src/apps/Marketing/pages/ProfileDashboardPage.jsx");
    const apiSource = readSource("src/apps/Marketing/api/directoryApi.js");

    expect(discoverSource).toContain('targetType: "event"');
    expect(discoverSource).toContain("DirectoryOwnerPathway");
    expect(eventSource).toContain("ClaimOwnershipCard");
    expect(eventSource).toContain("CadenceUpdateCard");
    expect(venueSource).toContain("venueCanManage");
    expect(claimSource).toContain("You Manage This Listing");
    expect(submissionSource).toContain("venue-add-or-claim-fork");
    expect(submissionSource).toContain("Find the venue first");
    expect(submissionSource).toContain("Run This Night With BeauRocks");
    expect(profileSource).toContain("My Karaoke Listings");
    expect(profileSource).toContain('intent: "manage_listing"');
    expect(apiSource).toContain('collection(db, "directory_claim_requests")');
  });

  it("keeps nationwide discovery as the device-independent default", () => {
    const source = readSource("src/apps/Marketing/pages/DiscoverPage.jsx");
    expect(source).toContain('const initialRegion = "";');
    expect(source).toContain('setRegion("");');
    expect(source).not.toContain("initialIsMobile ? KITSAP_BOOTSTRAP_REGION");
  });

  it("keeps technical listing metadata optional for venue owners", () => {
    const source = readSource("src/apps/Marketing/pages/ListingSubmissionPage.jsx");
    expect(source).toContain("Optional experience details");
    expect(source).not.toContain("Region Token");
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
