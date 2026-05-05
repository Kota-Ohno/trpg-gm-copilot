import { describe, expect, it } from "vitest";
import { createInitialCampaignState, normalizeCampaignLibraryState } from "./campaign";
import { buildSessionStorageDiagnostics, buildSupportDiagnostics } from "./diagnostics";

describe("buildSupportDiagnostics", () => {
  it("exports support-safe state, provider readiness, storage, and campaign stats", () => {
    const campaign = createInitialCampaignState();
    const campaignLibrary = normalizeCampaignLibraryState({
      activeCampaignId: campaign.id,
      campaigns: [campaign],
    });
    const diagnostics = buildSupportDiagnostics({
      activeTab: "home",
      backupStatus: { ageDays: 9, label: "9日前にバックアップ", needsBackup: true },
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
      backup: { ageDays: 9, label: "9日前にバックアップ", needsBackup: true },
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
    expect(diagnostics.sessionStorage[0]).toMatchObject({
      campaignId: campaign.id,
      sessionId: campaign.sessions[0].id,
      sessionTitle: campaign.sessions[0].title,
    });
    expect(diagnostics.sessionStorage[0].totalBytes).toBeGreaterThan(0);
  });
});

describe("buildSessionStorageDiagnostics", () => {
  it("sorts session storage estimates by total bytes", () => {
    const campaign = createInitialCampaignState();
    const smallSession = {
      ...campaign.sessions[0],
      id: "small",
      title: "small",
      log: "short",
    };
    const largeSession = {
      ...campaign.sessions[0],
      id: "large",
      title: "large",
      log: "large text ".repeat(200),
    };
    const campaignLibrary = normalizeCampaignLibraryState({
      activeCampaignId: campaign.id,
      campaigns: [{ ...campaign, sessions: [smallSession, largeSession] }],
    });

    const diagnostics = buildSessionStorageDiagnostics(campaignLibrary);

    expect(diagnostics.map((session) => session.sessionId)).toEqual(["large", "small"]);
    expect(diagnostics[0].logBytes).toBeGreaterThan(diagnostics[1].logBytes);
    expect(diagnostics[0]).not.toHaveProperty("log");
  });
});
