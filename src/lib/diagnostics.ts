import type {
  CampaignLibraryState,
  CampaignState,
  ExtractionProviderSettings,
  SessionState,
  TranscriptionProviderId,
  WorkspaceTab,
} from "../types";
import { getCampaignSummaryStats } from "./campaign";
import type { TranscriptionProviderCheckResult } from "./transcription-providers";

export type SupportDiagnosticsInput = {
  activeTab: WorkspaceTab;
  campaignLibrary: CampaignLibraryState;
  campaignState: CampaignState;
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

export function buildSupportDiagnostics(input: SupportDiagnosticsInput, exportedAt = new Date().toISOString()) {
  return {
    exportedAt,
    app: "chronicle-gm",
    activeCampaignId: input.campaignState.id,
    activeSessionId: input.currentSession.id,
    campaignCount: input.campaignLibrary.campaigns.length,
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
