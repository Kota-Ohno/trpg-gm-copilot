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

export type ReleaseQaChecklistItem = {
  id: string;
  label: string;
  detail: string;
};

export type ReleaseQaDiagnosticItem = ReleaseQaChecklistItem & {
  completed: boolean;
  evidenceNote?: string;
};

export const releaseQaItemIds = {
  extractionProviderLiveCheck: "extraction-provider-live-check",
  legacyProviderLiveCheck: "provider-live-check",
  transcriptionProviderLiveCheck: "transcription-provider-live-check",
} as const;

export type ProductSafetyChecklistInput = {
  backupStatus: BackupStatus;
  extractionProviderReady: boolean;
  playerHandoutAvailable: boolean;
  playerHandoutWarningCount: number;
  providerSecretsExcludedFromExports: boolean;
  releaseQaCompletedCount?: number;
  releaseQaEvidenceCount?: number;
  releaseQaTotalCount?: number;
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
  releaseQaCompletedIds?: readonly string[];
  releaseQaEvidenceNotes?: Readonly<Record<string, string>>;
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

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-***")
    .replace(/\b(authorization)\s*[:=]\s*["']?(?:Bearer\s+)?[A-Za-z0-9._~+/=-]{8,}/gi, "$1=***")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, "Bearer ***")
    .replace(/\b(api[_ -]?key|token)\s*[:=]\s*["']?[^"',;\s]+/gi, "$1=***");
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
  const releaseQaCompletedCount = input.releaseQaCompletedCount ?? 0;
  const releaseQaEvidenceCount = input.releaseQaEvidenceCount ?? 0;
  const releaseQaTotalCount = input.releaseQaTotalCount ?? 0;
  const hasReleaseQaChecklist = releaseQaTotalCount > 0;
  const releaseQaReady =
    hasReleaseQaChecklist &&
    releaseQaCompletedCount >= releaseQaTotalCount &&
    releaseQaEvidenceCount >= releaseQaTotalCount;

  return [
    {
      detail: input.providerSecretsExcludedFromExports
        ? "APIキーはキャンペーンJSON/診断JSONに含めません。"
        : "APIキーのエクスポート除外を確認してください。",
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
      detail:
        hasReleaseQaChecklist
          ? `${releaseQaCompletedCount}/${releaseQaTotalCount}件のRelease QAを確認済み、証跡 ${releaseQaEvidenceCount}件です。`
          : "Release QAの確認状態を記録してください。",
      id: "release-qa",
      label: "Release QA",
      status: releaseQaReady ? "ok" : "warning",
    },
    {
      detail: "大きなUI変更後は、PC幅と狭幅表示で主要導線を手動確認してください。",
      id: "ui-manual-check",
      label: "表示/導線確認",
      status: "warning",
    },
  ];
}

export function buildReleaseQaChecklist(): ReleaseQaChecklistItem[] {
  return [
    {
      id: "local-check",
      label: "ローカルチェック",
      detail: "npm run check を実行してテストとproduction buildを通す。",
    },
    {
      id: "starter-flow",
      label: "初回導線",
      detail: "新規ブラウザ状態で公開入口、調査/ファンタジー/カスタム開始、戻りユーザーのワークベンチ直行を確認する。",
    },
    {
      id: "ten-second-comprehension",
      label: "10秒理解",
      detail: "公開入口スクリーンショットだけで対象ユーザー、価値、最初の行動が伝わることを第三者視点で確認する。",
    },
    {
      id: "no-provider-activation",
      label: "5分/Provider不要導線",
      detail: "APIキー、アカウント、外部送信なしでサンプルまたは貼り付けログから承認済み記憶と次回準備まで進める。",
    },
    {
      id: "gm-workflow",
      label: "GMワークフロー",
      detail: "ログ、抽出、承認、記憶、次回準備、締め、PL共有をクリック操作で確認する。",
    },
    {
      id: "data-portability",
      label: "データ入出力",
      detail: "キャンペーン/ライブラリ/セッションのJSONとMarkdown出力、JSON読み込みを確認する。",
    },
    {
      id: "responsive-ui",
      label: "表示確認",
      detail: "desktop幅と狭幅表示で公開入口、空状態、ワークベンチの重なり、押しづらさ、横スクロールを確認する。",
    },
    {
      id: "asset-manifest-budget",
      label: "画像/Manifest",
      detail: "公開版画像がmanifestに記録され、hero 350KB以下、各エンブレム/空状態120KB以下であることを確認する。",
    },
    {
      id: "privacy-network-boundary",
      label: "プライバシー境界",
      detail: "公開入口とProvider不要導線でキャンペーン本文が外部送信されず、Provider/診断/書き出し境界が説明通りであることを確認する。",
    },
    {
      id: releaseQaItemIds.extractionProviderLiveCheck,
      label: "抽出Provider実地確認",
      detail: "Settingsの接続テストで、ユーザー所有のAPIキーまたはローカルOllamaの抽出Providerを確認する。",
    },
    {
      id: releaseQaItemIds.transcriptionProviderLiveCheck,
      label: "文字起こしProvider実地確認",
      detail: "Settingsの接続テストで、ユーザー所有のAPIキーまたはローカルエンドポイントの文字起こしProviderを確認する。",
    },
  ];
}

export function formatReleaseQaMarkdown(
  checklist = buildReleaseQaChecklist(),
  title = "Loreline Release QA",
  completedIds: readonly string[] = [],
  evidenceNotes: Readonly<Record<string, string>> = {},
  exportedAt = new Date().toISOString(),
): string {
  const completedIdSet = new Set(completedIds);
  const completedCount = checklist.filter((item) => completedIdSet.has(item.id)).length;
  const evidenceCount = checklist.filter((item) => evidenceNotes[item.id]?.trim()).length;
  const incompleteLabels = checklist.filter((item) => !completedIdSet.has(item.id)).map((item) => item.label);
  const missingEvidenceLabels = checklist.filter((item) => !evidenceNotes[item.id]?.trim()).map((item) => item.label);
  const isReady = checklist.length > 0 && completedCount === checklist.length && evidenceCount === checklist.length;

  return [
    `# ${title.trim() || "Release QA"}`,
    "",
    `Exported at: ${exportedAt}`,
    `Status: ${isReady ? "Ready" : "Incomplete"}`,
    `Completed: ${completedCount}/${checklist.length}`,
    `Evidence: ${evidenceCount}/${checklist.length}`,
    ...(incompleteLabels.length > 0 ? [`Incomplete checks: ${incompleteLabels.join(", ")}`] : []),
    ...(missingEvidenceLabels.length > 0 ? [`Missing evidence: ${missingEvidenceLabels.join(", ")}`] : []),
    "",
    ...checklist.flatMap((item) => {
      const evidenceNote = evidenceNotes[item.id]?.trim();
      const safeEvidenceNote = evidenceNote ? redactSensitiveText(evidenceNote) : "";
      return [
        `- [${completedIdSet.has(item.id) ? "x" : " "}] ${item.label}: ${item.detail}`,
        ...(safeEvidenceNote ? [`  - Evidence: ${safeEvidenceNote}`] : []),
      ];
    }),
  ].join("\n").trimEnd();
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
  const releaseQaCompletedIdSet = new Set(input.releaseQaCompletedIds ?? []);
  const releaseQa: ReleaseQaDiagnosticItem[] = buildReleaseQaChecklist().map((item) => {
    const evidenceNote = input.releaseQaEvidenceNotes?.[item.id]?.trim();
    const safeEvidenceNote = evidenceNote ? redactSensitiveText(evidenceNote) : "";

    return {
      ...item,
      completed: releaseQaCompletedIdSet.has(item.id),
      ...(safeEvidenceNote ? { evidenceNote: safeEvidenceNote } : {}),
    };
  });

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
      releaseQaCompletedCount: releaseQa.filter((item) => item.completed).length,
      releaseQaEvidenceCount: releaseQa.filter((item) => Boolean(item.evidenceNote)).length,
      releaseQaTotalCount: releaseQa.length,
      reviewQualityDebtCount,
      storageUsagePercent: input.storage.usagePercent,
      transcriptionProviderReady: input.transcriptionProviderReadiness.ok,
    }),
    releaseQa,
    releaseQaSummary: {
      completedCount: releaseQa.filter((item) => item.completed).length,
      evidenceCount: releaseQa.filter((item) => Boolean(item.evidenceNote)).length,
      incompleteIds: releaseQa.filter((item) => !item.completed).map((item) => item.id),
      incompleteLabels: releaseQa.filter((item) => !item.completed).map((item) => item.label),
      missingEvidenceIds: releaseQa.filter((item) => !item.evidenceNote).map((item) => item.id),
      missingEvidenceLabels: releaseQa.filter((item) => !item.evidenceNote).map((item) => item.label),
      ready:
        releaseQa.length > 0 &&
        releaseQa.every((item) => item.completed && Boolean(item.evidenceNote)),
      totalCount: releaseQa.length,
    },
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
