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
  reviewWorkspaceMode: string;
  rightPanelMode: string;
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
    ui: {
      activeTab: input.activeTab,
      chronicleClueStatusFilter: input.chronicleClueStatusFilter,
      chronicleViewMode: input.chronicleViewMode,
      isFocusMode: input.isFocusMode,
      logInputMode: input.logInputMode,
      logWorkspaceMode: input.logWorkspaceMode,
      navigationPanelMode: input.navigationPanelMode,
      prepWorkspaceMode: input.prepWorkspaceMode,
      reviewWorkspaceMode: input.reviewWorkspaceMode,
      rightPanelMode: input.rightPanelMode,
      settingsPanelMode: input.settingsPanelMode,
    },
  };
}
