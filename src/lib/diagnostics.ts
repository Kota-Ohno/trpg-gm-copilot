import type {
  CampaignLibraryState,
  CampaignState,
  ExtractionProviderSettings,
  SessionState,
  TranscriptionProviderId,
  WorkspaceTab,
} from "../types";
import type { BackupStatus } from "./backup";
import { getCampaignSummaryStats } from "./campaign";
import { findDuplicateExtractionItemIds } from "./extraction";
import type { TranscriptionProviderCheckResult } from "./transcription-providers";

export type SessionStorageDiagnostic = {
  campaignId: string;
  campaignName: string;
  sessionId: string;
  sessionTitle: string;
  totalBytes: number;
  logBytes: number;
  speakerLogBytes: number;
  reviewBytes: number;
  transcriptionBytes: number;
};

export type ReviewQualityDiagnostic = {
  campaignId: string;
  campaignName: string;
  sessionId: string;
  sessionTitle: string;
  approvedInvalidCount: number;
  approvedDuplicateCount: number;
  pendingInvalidCount: number;
  pendingDuplicateCount: number;
};

export type CampaignOperationalRisk = {
  campaignId: string;
  reviewDebt: number;
  storageBytes: number;
};

export type SupportDiagnosticsInput = {
  activeTab: WorkspaceTab;
  campaignLibrary: CampaignLibraryState;
  campaignState: CampaignState;
  backupStatus: BackupStatus;
  chronicleClueStatusFilter: string;
  chronicleViewMode: string;
  currentSession: SessionState;
  currentSessionMetrics: {
    approvedCount: number;
    duplicateReviewItemCount: number;
    extractionPromptLength: number;
    invalidReviewItemCount: number;
    reviewItemCount: number;
    speakerIssueCount: number;
  };
  extractionProvider: ExtractionProviderSettings;
  extractionProviderReady: boolean;
  isFocusMode: boolean;
  logInputMode: string;
  logWorkspaceMode: string;
  navigationPanelMode: string;
  prepWorkspaceMode: string;
  reviewSortMode: string;
  reviewWorkspaceMode: string;
  rightPanelMode: string;
  sessionArchiveFilter: string;
  sessionListDensity: string;
  sessionSortMode: string;
  sessionTranscriptionFilter: string;
  settingsPanelMode: string;
  storage: {
    libraryBytes: number;
    quotaBytes: number | null;
    usageBytes: number | null;
    usagePercent: number | null;
  };
  transcriptionProviderId: TranscriptionProviderId;
  transcriptionProviderReadiness: TranscriptionProviderCheckResult;
};

function estimateJsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function buildSessionStorageDiagnostics(
  campaignLibrary: CampaignLibraryState,
): SessionStorageDiagnostic[] {
  return campaignLibrary.campaigns
    .flatMap((campaign) =>
      campaign.sessions.map((session) => ({
        campaignId: campaign.id,
        campaignName: campaign.campaignName,
        sessionId: session.id,
        sessionTitle: session.title,
        totalBytes: estimateJsonBytes(session),
        logBytes: estimateJsonBytes(session.log),
        speakerLogBytes: estimateJsonBytes(session.liveLog),
        reviewBytes: estimateJsonBytes({
          approvedIds: session.approvedIds,
          extractionItems: session.extractionItems,
          extractionRun: session.extractionRun,
        }),
        transcriptionBytes: estimateJsonBytes({
          transcriptionRun: session.transcriptionRun,
        }),
      })),
    )
    .sort((left, right) => right.totalBytes - left.totalBytes);
}

export function buildReviewQualityDiagnostics(
  campaignLibrary: CampaignLibraryState,
): ReviewQualityDiagnostic[] {
  return campaignLibrary.campaigns.flatMap((campaign) =>
    campaign.sessions
      .map((session) => {
        const approvedIds = new Set(session.approvedIds);
        const duplicateIds = new Set(findDuplicateExtractionItemIds(session.extractionItems, session.approvedIds));
        const invalidIds = new Set(
          session.extractionItems
            .filter((item) => !item.title.trim() || !item.detail.trim())
            .map((item) => item.id),
        );

        return {
          campaignId: campaign.id,
          campaignName: campaign.campaignName,
          sessionId: session.id,
          sessionTitle: session.title,
          approvedInvalidCount: session.approvedIds.filter((id) => invalidIds.has(id)).length,
          approvedDuplicateCount: session.approvedIds.filter((id) => duplicateIds.has(id)).length,
          pendingInvalidCount: session.extractionItems.filter((item) => !approvedIds.has(item.id) && invalidIds.has(item.id)).length,
          pendingDuplicateCount: session.extractionItems.filter((item) => !approvedIds.has(item.id) && duplicateIds.has(item.id)).length,
        };
      })
      .filter(
        (diagnostic) =>
          diagnostic.approvedInvalidCount > 0 ||
          diagnostic.approvedDuplicateCount > 0 ||
          diagnostic.pendingInvalidCount > 0 ||
          diagnostic.pendingDuplicateCount > 0,
      ),
  );
}

export function buildCampaignOperationalRisks(
  storageDiagnostics: SessionStorageDiagnostic[],
  reviewQualityDiagnostics: ReviewQualityDiagnostic[],
): Map<string, CampaignOperationalRisk> {
  const risks = new Map<string, CampaignOperationalRisk>();

  storageDiagnostics.forEach((diagnostic) => {
    const current = risks.get(diagnostic.campaignId) ?? {
      campaignId: diagnostic.campaignId,
      reviewDebt: 0,
      storageBytes: 0,
    };

    risks.set(diagnostic.campaignId, {
      ...current,
      storageBytes: current.storageBytes + diagnostic.totalBytes,
    });
  });

  reviewQualityDiagnostics.forEach((diagnostic) => {
    const current = risks.get(diagnostic.campaignId) ?? {
      campaignId: diagnostic.campaignId,
      reviewDebt: 0,
      storageBytes: 0,
    };

    risks.set(diagnostic.campaignId, {
      ...current,
      reviewDebt:
        current.reviewDebt +
        diagnostic.approvedInvalidCount +
        diagnostic.approvedDuplicateCount +
        diagnostic.pendingInvalidCount +
        diagnostic.pendingDuplicateCount,
    });
  });

  return risks;
}

export function buildSupportDiagnostics(input: SupportDiagnosticsInput, exportedAt = new Date().toISOString()) {
  return {
    exportedAt,
    app: "chronicle-gm",
    activeCampaignId: input.campaignState.id,
    activeSessionId: input.currentSession.id,
    campaignCount: input.campaignLibrary.campaigns.length,
    backup: input.backupStatus,
    campaignStats: input.campaignLibrary.campaigns.map((campaign) => ({
      campaignId: campaign.id,
      campaignName: campaign.campaignName,
      campaignMode: campaign.campaignMode,
      ...getCampaignSummaryStats(campaign),
    })),
    currentSession: input.currentSessionMetrics,
    providers: {
      extraction: {
        providerId: input.extractionProvider.providerId,
        ready: input.extractionProviderReady,
      },
      transcription: {
        providerId: input.transcriptionProviderId,
        readiness: input.transcriptionProviderReadiness,
      },
    },
    storage: input.storage,
    sessionStorage: buildSessionStorageDiagnostics(input.campaignLibrary),
    reviewQuality: buildReviewQualityDiagnostics(input.campaignLibrary),
    ui: {
      activeTab: input.activeTab,
      chronicleClueStatusFilter: input.chronicleClueStatusFilter,
      chronicleViewMode: input.chronicleViewMode,
      isFocusMode: input.isFocusMode,
      logInputMode: input.logInputMode,
      logWorkspaceMode: input.logWorkspaceMode,
      navigationPanelMode: input.navigationPanelMode,
      prepWorkspaceMode: input.prepWorkspaceMode,
      reviewSortMode: input.reviewSortMode,
      reviewWorkspaceMode: input.reviewWorkspaceMode,
      rightPanelMode: input.rightPanelMode,
      sessionArchiveFilter: input.sessionArchiveFilter,
      sessionListDensity: input.sessionListDensity,
      sessionSortMode: input.sessionSortMode,
      sessionTranscriptionFilter: input.sessionTranscriptionFilter,
      settingsPanelMode: input.settingsPanelMode,
    },
  };
}
