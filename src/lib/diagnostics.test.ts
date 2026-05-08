import { describe, expect, it } from "vitest";
import { createInitialCampaignState, normalizeCampaignLibraryState } from "./campaign";
import {
  buildCampaignOperationalRisks,
  buildProductSafetyChecklist,
  buildReviewQualityDiagnostics,
  buildSessionStorageDiagnostics,
  buildSupportDiagnostics,
} from "./diagnostics";
import type { SupportDiagnosticsInput } from "./diagnostics";

function createSupportDiagnosticsInput(
  overrides: Partial<SupportDiagnosticsInput> = {},
): SupportDiagnosticsInput {
  const campaign = createInitialCampaignState();
  const campaignLibrary = normalizeCampaignLibraryState({
    activeCampaignId: campaign.id,
    campaigns: [campaign],
  });

  return {
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
      extractionPromptLength: 12000,
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
    reviewSortMode: "status",
    reviewWorkspaceMode: "inspect",
    rightPanelMode: "settings",
    sessionArchiveFilter: "active",
    sessionListDensity: "detailed",
    sessionSortMode: "review-debt",
    sessionTranscriptionFilter: "all",
    settingsPanelMode: "roadmap",
    storage: {
      libraryBytes: 2048,
      quotaBytes: 10000,
      usageBytes: 5000,
      usagePercent: 50,
    },
    transcriptionProviderId: campaign.transcriptionProvider.providerId,
    transcriptionProviderReadiness: { ok: true, message: "ready" },
    ...overrides,
  };
}

describe("buildProductSafetyChecklist", () => {
  it("summarizes operational safety and continuity risks", () => {
    const checklist = buildProductSafetyChecklist({
      backupStatus: { ageDays: 12, label: "12日前にバックアップ", needsBackup: true },
      extractionProviderReady: false,
      playerHandoutAvailable: true,
      playerHandoutWarningCount: 1,
      providerSecretsExcludedFromExports: true,
      reviewQualityDebtCount: 2,
      storageUsagePercent: 83,
      transcriptionProviderReady: true,
    });

    expect(checklist).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "provider-secrets", status: "ok" }),
      expect.objectContaining({ id: "player-handout", status: "action" }),
      expect.objectContaining({ id: "backup", status: "warning" }),
      expect.objectContaining({ id: "storage", status: "warning" }),
      expect.objectContaining({ id: "review-quality", status: "warning" }),
      expect.objectContaining({ id: "extraction-provider", status: "warning" }),
      expect.objectContaining({ id: "transcription-provider", status: "ok" }),
      expect.objectContaining({ id: "ui-manual-check", status: "warning" }),
    ]));
    expect(checklist.find((item) => item.id === "player-handout")?.detail).toContain("1件");
  });
});

describe("buildSupportDiagnostics", () => {
  it("exports support-safe state, provider readiness, storage, and campaign stats", () => {
    const input = createSupportDiagnosticsInput();
    const diagnostics = buildSupportDiagnostics(input, "2026-05-05T00:00:00.000Z");

    expect(diagnostics).toMatchObject({
      app: "chronicle-gm",
      exportedAt: "2026-05-05T00:00:00.000Z",
      campaignCount: 1,
      backup: { ageDays: 9, label: "9日前にバックアップ", needsBackup: true },
      currentSession: {
        approvedCount: 1,
        duplicateReviewItemCount: 2,
        extractionPromptLength: 12000,
        invalidReviewItemCount: 3,
        reviewItemCount: 4,
        speakerIssueCount: 5,
      },
      providers: {
        extraction: { providerId: "rule-based", ready: true },
        transcription: { providerId: "manual", readiness: { ok: true, message: "ready" } },
      },
      storage: { libraryBytes: 2048, usagePercent: 50 },
      ui: {
        activeTab: "home",
        reviewSortMode: "status",
        sessionListDensity: "detailed",
        sessionSortMode: "review-debt",
        settingsPanelMode: "roadmap",
      },
    });
    expect(diagnostics).not.toHaveProperty("providerSecrets");
    expect(diagnostics.campaignStats[0]).toMatchObject({
      campaignId: input.campaignState.id,
      campaignName: input.campaignState.campaignName,
      sessionCount: 1,
    });
    expect(diagnostics.sessionStorage[0]).toMatchObject({
      campaignId: input.campaignState.id,
      sessionId: input.currentSession.id,
      sessionTitle: input.currentSession.title,
    });
    expect(diagnostics.reviewQuality).toEqual([]);
    expect(diagnostics.productSafety).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "provider-secrets", status: "ok" }),
      expect.objectContaining({ id: "ui-manual-check", status: "warning" }),
    ]));
    expect(Object.keys(diagnostics)).not.toContain(["release", "Qa"].join(""));
    expect(Object.keys(diagnostics)).not.toContain(["release", "Qa", "Summary"].join(""));
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

describe("buildReviewQualityDiagnostics", () => {
  it("reports invalid and duplicate review debt by approval status", () => {
    const campaign = createInitialCampaignState();
    const session = {
      ...campaign.sessions[0],
      extractionItems: [
        { id: "approved-invalid", kind: "手がかり" as const, title: " ", detail: "x", visibility: "PL既知" as const },
        { id: "duplicate-base", kind: "手がかり" as const, title: "鍵", detail: "古い", visibility: "PL既知" as const },
        { id: "pending-duplicate", kind: "手がかり" as const, title: "鍵", detail: "古い", visibility: "PL既知" as const },
        { id: "pending-invalid", kind: "伏線" as const, title: "謎", detail: " ", visibility: "未開示候補" as const },
      ],
      approvedIds: ["approved-invalid", "duplicate-base"],
    };
    const campaignLibrary = {
      activeCampaignId: campaign.id,
      campaigns: [{ ...campaign, sessions: [session] }],
    };

    expect(buildReviewQualityDiagnostics(campaignLibrary)).toEqual([
      {
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        sessionId: session.id,
        sessionTitle: session.title,
        approvedInvalidCount: 1,
        approvedDuplicateCount: 0,
        pendingInvalidCount: 1,
        pendingDuplicateCount: 1,
      },
    ]);
  });
});

describe("buildCampaignOperationalRisks", () => {
  it("aggregates session storage and review debt per campaign", () => {
    const risks = buildCampaignOperationalRisks(
      [
        {
          campaignId: "campaign-a",
          campaignName: "A",
          sessionId: "session-a",
          sessionTitle: "A1",
          totalBytes: 100,
          logBytes: 0,
          speakerLogBytes: 0,
          reviewBytes: 0,
          transcriptionBytes: 0,
        },
        {
          campaignId: "campaign-a",
          campaignName: "A",
          sessionId: "session-b",
          sessionTitle: "A2",
          totalBytes: 50,
          logBytes: 0,
          speakerLogBytes: 0,
          reviewBytes: 0,
          transcriptionBytes: 0,
        },
      ],
      [
        {
          campaignId: "campaign-a",
          campaignName: "A",
          sessionId: "session-a",
          sessionTitle: "A1",
          approvedInvalidCount: 1,
          approvedDuplicateCount: 2,
          pendingInvalidCount: 3,
          pendingDuplicateCount: 4,
        },
      ],
    );

    expect(risks.get("campaign-a")).toEqual({
      campaignId: "campaign-a",
      reviewDebt: 10,
      storageBytes: 150,
    });
  });
});
