import type {
  CampaignLibraryState,
  CampaignState,
  ExtractionProviderSettings,
  SessionState,
  TranscriptionProviderId,
  WorkspaceTab,
} from "../types";
import type { BackupStatus } from "./backup";
import {
  buildPlayerHandoutShareStatus,
  formatPlayerHandoutMarkdown,
  getCampaignSummaryStats,
} from "./campaign";
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

export type ProductSafetyChecklistItem = {
  detail: string;
  id: string;
  label: string;
  status: "ok" | "warning" | "action";
};

export type ProductSafetyChecklistInput = {
  backupStatus: BackupStatus;
  extractionProviderReady: boolean;
  playerHandoutAvailable: boolean;
  playerHandoutWarningCount: number;
  providerSecretsExcludedFromExports: boolean;
  reviewQualityDebtCount: number;
  storageUsagePercent: number | null;
  transcriptionProviderReady: boolean;
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

export function buildProductSafetyChecklist(
  input: ProductSafetyChecklistInput,
): ProductSafetyChecklistItem[] {
  return [
    {
      detail: input.providerSecretsExcludedFromExports
        ? "APIキーはブラウザに永続保存せず、キャンペーンJSON/診断JSONにも含めません。"
        : "APIキーの永続保存とエクスポート除外を確認してください。",
      id: "provider-secrets",
      label: "APIキー保護",
      status: input.providerSecretsExcludedFromExports ? "ok" : "action",
    },
    {
      detail: !input.playerHandoutAvailable
        ? "PL共有用の安全な出力を生成できる状態にしてください。"
        : input.playerHandoutWarningCount > 0
          ? `${input.playerHandoutWarningCount}件の秘密由来テキスト候補があります。共有前に確認してください。`
          : "PL共有MarkdownはGM秘密、未開示候補、伏線の次手を除外します。",
      id: "player-handout",
      label: "PL共有安全性",
      status: !input.playerHandoutAvailable || input.playerHandoutWarningCount > 0 ? "action" : "ok",
    },
    {
      detail: input.backupStatus.needsBackup
        ? input.backupStatus.label
        : "直近のJSONバックアップが確認できています。",
      id: "backup",
      label: "バックアップ",
      status: input.backupStatus.needsBackup ? "warning" : "ok",
    },
    {
      detail:
        input.storageUsagePercent !== null && input.storageUsagePercent >= 80
          ? `保存容量の使用率が ${input.storageUsagePercent}% です。大きいログの整理を検討してください。`
          : "ローカル保存容量に大きな警告はありません。",
      id: "storage",
      label: "保存容量",
      status: input.storageUsagePercent !== null && input.storageUsagePercent >= 80 ? "warning" : "ok",
    },
    {
      detail:
        input.reviewQualityDebtCount > 0
          ? `${input.reviewQualityDebtCount}件の未入力/重複候補があります。`
          : "承認候補の未入力/重複は検出されていません。",
      id: "review-quality",
      label: "レビュー品質",
      status: input.reviewQualityDebtCount > 0 ? "warning" : "ok",
    },
    {
      detail: input.extractionProviderReady
        ? "抽出Providerは実行可能な設定です。"
        : "外部Providerを使う場合はAPIキーやエンドポイント設定が必要です。",
      id: "extraction-provider",
      label: "抽出Provider",
      status: input.extractionProviderReady ? "ok" : "warning",
    },
    {
      detail: input.transcriptionProviderReady
        ? "文字起こしProviderは現在の設定で利用できます。"
        : "音声文字起こしを使う場合はProvider設定を確認してください。",
      id: "transcription-provider",
      label: "文字起こしProvider",
      status: input.transcriptionProviderReady ? "ok" : "warning",
    },
    {
      detail: "大きなUI変更後は、PC幅と狭幅表示で主要導線を手動確認してください。",
      id: "ui-manual-check",
      label: "表示/導線確認",
      status: "warning",
    },
  ];
}

export function buildSupportDiagnostics(input: SupportDiagnosticsInput, exportedAt = new Date().toISOString()) {
  const sessionStorage = buildSessionStorageDiagnostics(input.campaignLibrary);
  const reviewQuality = buildReviewQualityDiagnostics(input.campaignLibrary);
  const reviewQualityDebtCount = reviewQuality.reduce(
    (total, diagnostic) =>
      total +
      diagnostic.approvedInvalidCount +
      diagnostic.approvedDuplicateCount +
      diagnostic.pendingInvalidCount +
      diagnostic.pendingDuplicateCount,
    0,
  );
  const playerHandoutMarkdown = formatPlayerHandoutMarkdown(input.campaignState);
  const playerHandoutShareStatus = buildPlayerHandoutShareStatus(input.campaignState, playerHandoutMarkdown);

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
    sessionStorage,
    reviewQuality,
    productSafety: buildProductSafetyChecklist({
      backupStatus: input.backupStatus,
      extractionProviderReady: input.extractionProviderReady,
      playerHandoutAvailable: playerHandoutShareStatus.canShare || playerHandoutMarkdown.trim().length > 0,
      playerHandoutWarningCount: playerHandoutShareStatus.warningCount,
      providerSecretsExcludedFromExports: true,
      reviewQualityDebtCount,
      storageUsagePercent: input.storage.usagePercent,
      transcriptionProviderReady: input.transcriptionProviderReadiness.ok,
    }),
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
