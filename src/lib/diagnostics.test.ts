import { describe, expect, it } from "vitest";
import { createInitialCampaignState, normalizeCampaignLibraryState } from "./campaign";
import { buildSupportDiagnostics } from "./diagnostics";

describe("buildSupportDiagnostics", () => {
  it("exports support-safe state, provider readiness, storage, and campaign stats", () => {
    const campaign = createInitialCampaignState();
    const campaignLibrary = normalizeCampaignLibraryState({
      activeCampaignId: campaign.id,
      campaigns: [campaign],
    });
    const diagnostics = buildSupportDiagnostics({
      activeTab: "home",
      campaignLibrary,
      campaignState: campaign,
      chronicleClueStatusFilter: "all",
      chronicleViewMode: "overview",
      currentSession: campaign.sessions[0],
      currentSessionMetrics: {
        approvedCount: 1,
        duplicateReviewItemCount: 2,
        invalidReviewItemCount: 3,
        reviewItemCount: 4,
        speakerIssueCount: 5,
      },
      extractionProvider: campaign.extractionProvider,
      extractionProviderReady: true,
      isFocusMode: false,
      logInputMode: "speaker",
      logWorkspaceMode: "editor",
      navigationPanelMode: "sessions",
      prepWorkspaceMode: "recap",
      reviewWorkspaceMode: "inspect",
      rightPanelMode: "settings",
      settingsPanelMode: "roadmap",
      storage: {
        libraryBytes: 2048,
        quotaBytes: 10000,
        usageBytes: 5000,
        usagePercent: 50,
      },
      transcriptionProviderId: campaign.transcriptionProvider.providerId,
      transcriptionProviderReadiness: { ok: true, message: "ready" },
    }, "2026-05-05T00:00:00.000Z");

    expect(diagnostics).toMatchObject({
      app: "chronicle-gm",
      exportedAt: "2026-05-05T00:00:00.000Z",
      campaignCount: 1,
      currentSession: {
        approvedCount: 1,
        duplicateReviewItemCount: 2,
        invalidReviewItemCount: 3,
        reviewItemCount: 4,
        speakerIssueCount: 5,
      },
      providers: {
        extraction: { providerId: "rule-based", ready: true },
        transcription: { providerId: "manual", readiness: { ok: true, message: "ready" } },
      },
      storage: { libraryBytes: 2048, usagePercent: 50 },
      ui: { activeTab: "home", settingsPanelMode: "roadmap" },
    });
    expect(diagnostics).not.toHaveProperty("providerSecrets");
    expect(diagnostics.campaignStats[0]).toMatchObject({
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      sessionCount: 1,
    });
  });
});
