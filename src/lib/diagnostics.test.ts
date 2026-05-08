import { describe, expect, it } from "vitest";
import { createInitialCampaignState, normalizeCampaignLibraryState } from "./campaign";
import {
  buildCampaignOperationalRisks,
  buildProductSafetyChecklist,
  buildReleaseQaChecklist,
  buildReviewQualityDiagnostics,
  buildSessionStorageDiagnostics,
  buildSupportDiagnostics,
  formatReleaseQaMarkdown,
  releaseQaItemIds,
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

describe("buildReleaseQaChecklist", () => {
  it("lists the manual release gates that cannot be fully covered by unit tests", () => {
    expect(buildReleaseQaChecklist()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "local-check" }),
      expect.objectContaining({ id: "starter-flow" }),
      expect.objectContaining({ id: "ten-second-comprehension" }),
      expect.objectContaining({ id: "no-provider-activation" }),
      expect.objectContaining({ id: "gm-workflow" }),
      expect.objectContaining({ id: "data-portability" }),
      expect.objectContaining({ id: "responsive-ui" }),
      expect.objectContaining({ id: "asset-manifest-budget" }),
      expect.objectContaining({ id: "privacy-network-boundary" }),
      expect.objectContaining({ id: releaseQaItemIds.extractionProviderLiveCheck }),
      expect.objectContaining({ id: releaseQaItemIds.transcriptionProviderLiveCheck }),
    ]));
    expect(buildReleaseQaChecklist()).toHaveLength(11);
  });
});

describe("formatReleaseQaMarkdown", () => {
  it("exports release QA gates as a portable checklist", () => {
    const markdown = formatReleaseQaMarkdown([
      { id: "local-check", label: "ローカルチェック", detail: "npm run check を実行する。" },
      { id: "provider-live-check", label: "Provider実地確認", detail: "ユーザー所有のAPIキーで確認する。" },
    ], "Loreline Release QA", ["local-check"], {
      "local-check": "12 files / 118 tests passed",
    }, "2026-05-05T00:00:00.000Z");

    expect(markdown).toContain("# Loreline Release QA");
    expect(markdown).toContain("Exported at: 2026-05-05T00:00:00.000Z");
    expect(markdown).toContain("Status: Incomplete");
    expect(markdown).toContain("Completed: 1/2");
    expect(markdown).toContain("Evidence: 1/2");
    expect(markdown).toContain("Incomplete checks: Provider実地確認");
    expect(markdown).toContain("Missing evidence: Provider実地確認");
    expect(markdown).toContain("- [x] ローカルチェック: npm run check を実行する。");
    expect(markdown).toContain("  - Evidence: 12 files / 118 tests passed");
    expect(markdown).toContain("- [ ] Provider実地確認: ユーザー所有のAPIキーで確認する。");
  });

  it("redacts secrets from portable evidence notes", () => {
    const markdown = formatReleaseQaMarkdown([
      { id: "provider-live-check", label: "Provider実地確認", detail: "ユーザー所有のAPIキーで確認する。" },
    ], "Loreline Release QA", ["provider-live-check"], {
      "provider-live-check": "OpenAI ok with api_key=sk-testSecretValue123456 and Authorization: Bearer liveSecretToken123456",
    });

    expect(markdown).toContain("api_key=***");
    expect(markdown).toContain("Authorization=***");
    expect(markdown).not.toContain("sk-testSecretValue123456");
    expect(markdown).not.toContain("liveSecretToken123456");
  });

  it("marks release QA markdown ready only when every check has evidence", () => {
    const markdown = formatReleaseQaMarkdown([
      { id: "local-check", label: "ローカルチェック", detail: "npm run check を実行する。" },
    ], "Loreline Release QA", ["local-check"], {
      "local-check": "123 tests passed",
    }, "2026-05-05T00:00:00.000Z");

    expect(markdown).toContain("Status: Ready");
    expect(markdown).toContain("Completed: 1/1");
    expect(markdown).toContain("Evidence: 1/1");
    expect(markdown).not.toContain("Incomplete checks:");
    expect(markdown).not.toContain("Missing evidence:");
  });
});

describe("buildProductSafetyChecklist", () => {
  it("summarizes operational safety and continuity risks", () => {
    const checklist = buildProductSafetyChecklist({
      backupStatus: { ageDays: 12, label: "12日前にバックアップ", needsBackup: true },
      extractionProviderReady: false,
      playerHandoutAvailable: true,
      playerHandoutWarningCount: 1,
      providerSecretsExcludedFromExports: true,
      releaseQaCompletedCount: 2,
      releaseQaEvidenceCount: 1,
      releaseQaTotalCount: 6,
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
      expect.objectContaining({ id: "release-qa", status: "warning" }),
      expect.objectContaining({ id: "ui-manual-check", status: "warning" }),
    ]));
    expect(checklist.find((item) => item.id === "player-handout")?.detail).toContain("1件");
    expect(checklist.find((item) => item.id === "release-qa")?.detail).toContain("2/6件");
    expect(checklist.find((item) => item.id === "release-qa")?.detail).toContain("証跡 1件");
  });

  it("requires both completed checks and evidence before release QA is ok", () => {
    const baseInput = {
      backupStatus: { ageDays: 1, label: "1日前にバックアップ", needsBackup: false },
      extractionProviderReady: true,
      playerHandoutAvailable: true,
      playerHandoutWarningCount: 0,
      providerSecretsExcludedFromExports: true,
      releaseQaCompletedCount: 6,
      releaseQaTotalCount: 6,
      reviewQualityDebtCount: 0,
      storageUsagePercent: 10,
      transcriptionProviderReady: true,
    };

    expect(buildProductSafetyChecklist({
      ...baseInput,
      releaseQaEvidenceCount: 5,
    }).find((item) => item.id === "release-qa")?.status).toBe("warning");

    expect(buildProductSafetyChecklist({
      ...baseInput,
      releaseQaEvidenceCount: 6,
    }).find((item) => item.id === "release-qa")?.status).toBe("ok");
  });
});

describe("buildSupportDiagnostics", () => {
  it("exports support-safe state, provider readiness, storage, and campaign stats", () => {
    const input = createSupportDiagnosticsInput({
      releaseQaCompletedIds: ["local-check"],
      releaseQaEvidenceNotes: {
        "local-check":
          "12 files / 118 tests passed with api_key=sk-testSecretValue123456; Authorization: Bearer liveSecretToken123456",
      },
    });
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
      expect.objectContaining({ id: "release-qa", status: "warning" }),
      expect.objectContaining({ id: "ui-manual-check", status: "warning" }),
    ]));
    expect(diagnostics.releaseQa).toEqual(expect.arrayContaining([
      expect.objectContaining({
        completed: true,
        evidenceNote: "12 files / 118 tests passed with api_key=***; Authorization=***",
        id: "local-check",
      }),
      expect.objectContaining({ completed: false, id: releaseQaItemIds.extractionProviderLiveCheck }),
      expect.objectContaining({ completed: false, id: releaseQaItemIds.transcriptionProviderLiveCheck }),
    ]));
    expect(diagnostics.releaseQaSummary).toEqual({
      completedCount: 1,
      evidenceCount: 1,
      incompleteIds: expect.arrayContaining([
        releaseQaItemIds.extractionProviderLiveCheck,
        releaseQaItemIds.transcriptionProviderLiveCheck,
      ]),
      incompleteLabels: expect.arrayContaining([
        "抽出Provider実地確認",
        "文字起こしProvider実地確認",
      ]),
      missingEvidenceIds: expect.arrayContaining([
        releaseQaItemIds.extractionProviderLiveCheck,
        releaseQaItemIds.transcriptionProviderLiveCheck,
      ]),
      missingEvidenceLabels: expect.arrayContaining([
        "抽出Provider実地確認",
        "文字起こしProvider実地確認",
      ]),
      ready: false,
      totalCount: buildReleaseQaChecklist().length,
    });
    expect(JSON.stringify(diagnostics)).not.toContain("sk-testSecretValue123456");
    expect(JSON.stringify(diagnostics)).not.toContain("liveSecretToken123456");
    expect(diagnostics.sessionStorage[0].totalBytes).toBeGreaterThan(0);
  });

  it("marks release QA ready only when every gate is completed with evidence", () => {
    const releaseQaChecklist = buildReleaseQaChecklist();
    const completedIds = releaseQaChecklist.map((item) => item.id);
    const evidenceNotes = Object.fromEntries(
      releaseQaChecklist.map((item) => [item.id, `${item.label} evidence`]),
    );

    const diagnostics = buildSupportDiagnostics(createSupportDiagnosticsInput({
      releaseQaCompletedIds: completedIds,
      releaseQaEvidenceNotes: evidenceNotes,
    }), "2026-05-05T00:00:00.000Z");

    expect(diagnostics.releaseQaSummary).toEqual({
      completedCount: releaseQaChecklist.length,
      evidenceCount: releaseQaChecklist.length,
      incompleteIds: [],
      incompleteLabels: [],
      missingEvidenceIds: [],
      missingEvidenceLabels: [],
      ready: true,
      totalCount: releaseQaChecklist.length,
    });
    expect(diagnostics.productSafety).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "release-qa", status: "ok" }),
    ]));
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
