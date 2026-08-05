import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath) => readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("approved Host onboarding source", () => {
  it("tracks applicant email delivery and supports an explicit retry", () => {
    const functionsSource = readSource("functions/index.js");
    const operationsSource = readSource("src/apps/HostRelations/HostRelationsApp.jsx");
    expect(functionsSource).toContain('"resend_invite"');
    expect(functionsSource).toContain("decisionEmail");
    expect(functionsSource).toContain("isHostApplicationApplicantDecisionEventType");
    expect(operationsSource).toContain("data-host-application-delivery-tracking");
    expect(operationsSource).toContain("Resend onboarding email");
  });

  it("keeps complimentary testing free and paid checkout closed by default", () => {
    const functionsSource = readSource("functions/index.js");
    const hostSource = readSource("src/apps/Host/HostApp.jsx");
    expect(functionsSource).toContain('process.env.HOST_SUBSCRIPTION_CHECKOUT_ENABLED || "false"');
    expect(functionsSource).toContain('mode: "complimentary_testing"');
    expect(functionsSource).toContain("Paid Host checkout is paused while complimentary testing is active");
    expect(hostSource).toContain("data-complimentary-testing-terms");
    expect(hostSource).toContain("Usage meters below are for transparency and testing safety; they are not a bill.");
  });

  it("guides approved Hosts into onboarding, help, and private support", () => {
    const functionsSource = readSource("functions/index.js");
    expect(functionsSource).toContain("https://host.beaurocks.app/hub?tab=getting_started");
    expect(functionsSource).toContain("https://host.beaurocks.app/hub?tab=help");
    expect(functionsSource).toContain("https://host.beaurocks.app/hub?tab=support");
    expect(functionsSource).toContain('ctaLabel: "Start Host Onboarding"');
  });
});
