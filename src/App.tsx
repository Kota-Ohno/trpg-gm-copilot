import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  CheckCircle2,
  Clock3,
  Compass,
  Copy,
  Download,
  FileText,
  Upload,
  KeyRound,
  Lightbulb,
  Map as MapIcon,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  UserRound,
  Wand2,
} from "lucide-react";
import { ChronicleView, type ChronicleViewMode, type ClueStatusFilter } from "./components/chronicle-view";
import { ExtractionReviewCard } from "./components/extraction-review-card";
import { PlainLogEditor } from "./components/plain-log-editor";
import { PrepSection } from "./components/prep-section";
import { ProviderSettingsCard } from "./components/provider-settings-card";
import { SpeakerLogEditor } from "./components/speaker-log-editor";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Tabs } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { sampleLiveLog } from "./data/sample";
import { getBackupStatus } from "./lib/backup";
import {
  buildCampaignOperationalRisks,
  buildReviewQualityDiagnostics,
  buildSessionStorageDiagnostics,
  buildSupportDiagnostics,
} from "./lib/diagnostics";
import { sortSessions, type SessionSortMode } from "./lib/session-list";
import {
  applyExtraction,
  cloneJson,
  countChronicleItems,
  createExportFileName,
  createInitialCampaignState,
  createId,
  createNewCampaignState,
  createNewSession,
  duplicateCampaignState,
  duplicateSessionState,
  formatCampaignMarkdown,
  formatCampaignLibraryMarkdown,
  formatChronicleMarkdown,
  formatPrepNoteMarkdown,
  generatePrepNote,
  getCampaignSearchText,
  getCampaignSummaryStats,
  getLocalDateString,
  getSessionSearchText,
  normalizeCampaignLibraryState,
  normalizeCampaignState,
  previewCampaignImport,
  previewExtractionApplication,
  readSessionImportPayload,
} from "./lib/campaign";
import {
  appendTranscriptionDraftsToLiveLog,
  buildExtractionInput,
  buildSpeakerSegmentExport,
  findDuplicateExtractionItemIds,
  formatReviewItemsMarkdown,
  formatSessionMarkdown,
  formatSpeakerLogMarkdown,
  getSpeakerLogIssues,
  liveLogToTranscriptionDrafts,
  liveLogToPlainText,
  normalizeExtractionItemText,
  normalizeTranscriptTextSpacing,
  mergeAdjacentTranscriptSegments,
  normalizeTranscriptSegmentTiming,
  parsePlainLogToLiveLog,
  previewTranscriptionDraftPayload,
  splitTranscriptSegment,
  summarizeLiveLog,
  summarizePlainLog,
  transcriptionDraftsToLiveLog,
} from "./lib/extraction";
import { buildExtractionPrompt } from "./lib/extraction-prompt";
import {
  defaultProviderSecretSettings,
  getTranscriptionProvider,
  normalizeProviderSecretSettings,
  transcriptionProviders,
} from "./lib/extraction-provider-settings";
import { runExtractionProvider } from "./lib/extraction-providers";
import {
  checkTranscriptionProviderReadiness,
  runTranscriptionProvider,
  validateTranscriptionAudioFile,
} from "./lib/transcription-providers";
import {
  buildReviewRemovalBatch,
  restoreReviewItems,
  sortReviewItems,
  summarizeReviewItems,
  type RemovedReviewItem,
  type ReviewSortMode,
} from "./lib/review";
import type {
  CampaignState,
  CampaignLibraryState,
  CampaignMode,
  ExtractionRun,
  ExtractionItem,
  LiveLogSession,
  ProviderSecretSettings,
  SessionState,
  ClueStatus,
  SpeakerRole,
  TranscriptionRun,
  TranscriptSegment,
  WorkspaceTab,
} from "./types";

const LEGACY_STORAGE_KEY = "chronicle-gm.campaign-state.v1";
const CAMPAIGN_LIBRARY_STORAGE_KEY = "chronicle-gm.campaign-library.v1";
const LAST_BACKUP_STORAGE_KEY = "chronicle-gm.last-backup.v1";
const PROVIDER_SECRETS_STORAGE_KEY = "chronicle-gm.provider-secrets.v1";
const UI_PREFERENCES_STORAGE_KEY = "chronicle-gm.ui-preferences.v1";
const campaignNameInputId = "campaign-name";
const campaignImportInputId = "campaign-json-import";
const transcriptionAudioInputId = "transcription-audio-import";
const transcriptionDraftImportInputId = "transcription-draft-json-import";
const sessionTitleInputId = "active-session-title";
const sessionDateInputId = "active-session-date";

type LogInputMode = "plain" | "speaker";
type LogWorkspaceMode = "editor" | "transcription";
type NavigationPanelMode = "campaigns" | "sessions";
type PrepWorkspaceMode = "recap" | "hooks" | "questions" | "reminders";
type ReviewWorkspaceMode = "inspect" | "manage";
type RightPanelMode = "rescue" | "settings";
type SettingsPanelMode = "extraction" | "transcription" | "roadmap";
type SessionArchiveFilter = "active" | "all" | "archived";
type SessionTranscriptionFilter = "all" | "transcribed" | "untranscribed";
type ReviewKindFilter = "all" | ExtractionItem["kind"];
type ReviewVisibilityFilter = "all" | ExtractionItem["visibility"];
type ConfirmationRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};
type RejectedReviewBatch = {
  sessionId: string;
  label: string;
  removedItems: RemovedReviewItem[];
};
type UiPreferences = {
  activeTab: WorkspaceTab;
  chronicleClueStatusFilter: ClueStatusFilter;
  chronicleViewMode: ChronicleViewMode;
  isFocusMode: boolean;
  logInputMode: LogInputMode;
  logWorkspaceMode: LogWorkspaceMode;
  navigationPanelMode: NavigationPanelMode;
  prepWorkspaceMode: PrepWorkspaceMode;
  reviewSortMode: ReviewSortMode;
  reviewWorkspaceMode: ReviewWorkspaceMode;
  rightPanelMode: RightPanelMode;
  sessionArchiveFilter: SessionArchiveFilter;
  sessionSortMode: SessionSortMode;
  sessionTranscriptionFilter: SessionTranscriptionFilter;
  settingsPanelMode: SettingsPanelMode;
};
type StorageHealth = {
  libraryBytes: number;
  quotaBytes: number | null;
  usageBytes: number | null;
};

const tabOptions: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "home", label: "ホーム" },
  { value: "log", label: "ログ" },
  { value: "review", label: "承認" },
  { value: "chronicle", label: "記憶" },
  { value: "prep", label: "次回準備" },
];

const campaignModeOptions: Array<{ value: CampaignMode; label: string; description: string }> = [
  { value: "investigation", label: "調査", description: "謎、手がかり、秘密、未回収の伏線を優先" },
  { value: "fantasy", label: "ファンタジー", description: "クエスト、勢力、拠点、世界変化を優先" },
];

const prepSectionLabels: Record<CampaignMode, Record<PrepWorkspaceMode, string>> = {
  investigation: {
    recap: "3行あらすじ",
    hooks: "次回導入案",
    questions: "未解決の問い",
    reminders: "GM確認メモ",
  },
  fantasy: {
    recap: "前回の戦況",
    hooks: "次のクエスト候補",
    questions: "未解決の依頼/勢力",
    reminders: "GM確認メモ",
  },
};

const memoryNavigationLabels: Record<CampaignMode, { clues: string; locations: string; threads: string }> = {
  investigation: {
    clues: "調査ボード",
    locations: "場所",
    threads: "伏線",
  },
  fantasy: {
    clues: "クエスト/情報",
    locations: "拠点/場所",
    threads: "世界変化",
  },
};

const campaignModeDescriptions: Record<CampaignMode, string> = {
  investigation: "セッションログから手がかり、秘密、伏線を抽出して次回準備へつなげます。",
  fantasy: "セッションログからクエスト、勢力事情、世界変化を抽出して次回準備へつなげます。",
};

const quickPromptSets: Record<
  CampaignMode,
  Array<{ icon: typeof UserRound; title: string; result: string }>
> = {
  investigation: [
    {
      icon: UserRound,
      title: "急なNPC",
      result: "潮見レン。灯台守の甥。怖がりだが、夜だけ灯台の鐘が鳴ることを知っている。",
    },
    {
      icon: KeyRound,
      title: "別ルートの手がかり",
      result: "倉庫の泥を水に溶かすと、灯台地下扉と同じ紋章の沈殿が残る。",
    },
    {
      icon: Lightbulb,
      title: "失敗判定の結果",
      result: "情報は得られるが、村長の協力者に探索を見られ、次の場面で先回りされる。",
    },
    {
      icon: Compass,
      title: "場面転換",
      result: "雨が止み、港の鐘が三度鳴る。岬の灯台だけが青白く明滅している。",
    },
  ],
  fantasy: [
    {
      icon: Swords,
      title: "急な依頼",
      result: "北門の衛兵隊が、夜明けまでに狼煙台へ補給を届ける短い護衛を頼んでくる。",
    },
    {
      icon: MapIcon,
      title: "別ルートの情報",
      result: "古い街道碑の裏に、廃鉱へ抜ける巡礼路の印が刻まれている。",
    },
    {
      icon: Lightbulb,
      title: "失敗判定の結果",
      result: "目的地には着くが、敵勢力に先回りされ、交渉相手が一時的に身を隠す。",
    },
    {
      icon: Compass,
      title: "場面転換",
      result: "遠くの稜線に竜骨のような雲がかかり、砦の鐘が避難を告げる。",
    },
  ],
};

const sampleTranscriptionDraftJson = JSON.stringify(
  [
    {
      speakerName: "GM",
      startTimeSec: 0,
      endTimeSec: 6,
      text: "扉の奥から足音が聞こえる。ここから先は慎重に進んでください。",
      confidence: 0.94,
    },
    {
      speakerName: "アキラ",
      startTimeSec: 8,
      endTimeSec: 13,
      text: "聞き耳を立てます。足音は何人分ですか？",
      confidence: 0.88,
    },
    {
      speakerName: "GM",
      startTimeSec: 15,
      endTimeSec: 22,
      text: "少なくとも二人分です。片方は金属を引きずるような音を立てています。",
      confidence: 0.76,
    },
  ],
  null,
  2,
);

const logInputOptions: Array<{ value: LogInputMode; label: string }> = [
  { value: "plain", label: "通常ログ" },
  { value: "speaker", label: "話者付きログ" },
];

const logWorkspaceOptions: Array<{ value: LogWorkspaceMode; label: string }> = [
  { value: "editor", label: "ログ編集" },
  { value: "transcription", label: "文字起こし" },
];

const navigationPanelOptions: Array<{ value: NavigationPanelMode; label: string }> = [
  { value: "campaigns", label: "キャンペーン" },
  { value: "sessions", label: "セッション" },
];

const sessionArchiveOptions: Array<{ value: SessionArchiveFilter; label: string }> = [
  { value: "active", label: "有効" },
  { value: "all", label: "すべて" },
  { value: "archived", label: "アーカイブ" },
];

const sessionSortOptions: Array<{ value: SessionSortMode; label: string }> = [
  { value: "date-desc", label: "新しい順" },
  { value: "size-desc", label: "サイズ順" },
  { value: "review-debt", label: "要確認順" },
  { value: "title", label: "タイトル順" },
];

const prepWorkspaceOptions: Array<{ value: PrepWorkspaceMode; label: string }> = [
  { value: "recap", label: "要約" },
  { value: "hooks", label: "導入" },
  { value: "questions", label: "未解決" },
  { value: "reminders", label: "GMメモ" },
];

const chronicleViewLabels: Record<ChronicleViewMode, string> = {
  overview: "概要",
  clues: "手がかり",
  npcs: "NPC",
  locations: "場所",
  events: "出来事",
  threads: "伏線",
};

const settingsPanelLabels: Record<SettingsPanelMode, string> = {
  extraction: "抽出",
  transcription: "文字起こし",
  roadmap: "拡張",
};

const reviewKindOptions: Array<{ value: ReviewKindFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "出来事", label: "出来事" },
  { value: "NPC", label: "NPC" },
  { value: "手がかり", label: "手がかり" },
  { value: "GM秘密", label: "GM秘密" },
  { value: "伏線", label: "伏線" },
];

const reviewVisibilityOptions: Array<{ value: ReviewVisibilityFilter; label: string }> = [
  { value: "all", label: "全公開範囲" },
  { value: "PL既知", label: "PL既知" },
  { value: "GMのみ", label: "GMのみ" },
  { value: "未開示候補", label: "未開示候補" },
];

const reviewWorkspaceOptions: Array<{ value: ReviewWorkspaceMode; label: string }> = [
  { value: "inspect", label: "確認" },
  { value: "manage", label: "管理" },
];

const reviewSortOptions: Array<{ value: ReviewSortMode; label: string }> = [
  { value: "original", label: "抽出順" },
  { value: "status", label: "未承認優先" },
  { value: "kind", label: "種別" },
  { value: "visibility", label: "公開範囲" },
];

const transcriptionLanguageOptions = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
  { value: "auto", label: "自動" },
];

const rightPanelOptions: Array<{ value: RightPanelMode; label: string }> = [
  { value: "rescue", label: "セッション中" },
  { value: "settings", label: "設定" },
];

const settingsPanelOptions: Array<{ value: SettingsPanelMode; label: string }> = [
  { value: "extraction", label: "抽出" },
  { value: "transcription", label: "文字起こし" },
  { value: "roadmap", label: "拡張" },
];

const extractionSourceLabels: Record<ExtractionRun["sourceType"], string> = {
  plain: "通常ログ由来",
  speaker: "話者付きログ由来",
  fallback: "フォールバック",
};

const defaultUiPreferences: UiPreferences = {
  activeTab: "home",
  chronicleClueStatusFilter: "all",
  chronicleViewMode: "overview",
  isFocusMode: false,
  logInputMode: "plain",
  logWorkspaceMode: "editor",
  navigationPanelMode: "sessions",
  prepWorkspaceMode: "recap",
  reviewSortMode: "original",
  reviewWorkspaceMode: "inspect",
  rightPanelMode: "rescue",
  sessionArchiveFilter: "active",
  sessionSortMode: "date-desc",
  sessionTranscriptionFilter: "all",
  settingsPanelMode: "extraction",
};

function readOptionValue<T extends string>(
  value: unknown,
  options: Array<{ value: T }>,
  fallback: T,
): T {
  return typeof value === "string" && options.some((option) => option.value === value)
    ? value as T
    : fallback;
}

function findOptionLabel<T extends string>(
  options: Array<{ value: T; label: string }>,
  value: T,
  fallback: string,
): string {
  return options.find((option) => option.value === value)?.label ?? fallback;
}

function loadUiPreferences(): UiPreferences {
  if (typeof window === "undefined") {
    return defaultUiPreferences;
  }

  const savedPreferences = window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY);
  if (!savedPreferences) {
    return defaultUiPreferences;
  }

  try {
    const parsedPreferences = JSON.parse(savedPreferences) as Record<string, unknown>;

    return {
      activeTab: readOptionValue(parsedPreferences.activeTab, tabOptions, defaultUiPreferences.activeTab),
      chronicleClueStatusFilter: readOptionValue(
        parsedPreferences.chronicleClueStatusFilter,
        [
          { value: "all" },
          { value: "known" },
          { value: "partial" },
          { value: "hidden" },
        ],
        defaultUiPreferences.chronicleClueStatusFilter,
      ),
      chronicleViewMode: readOptionValue(
        parsedPreferences.chronicleViewMode,
        [
          { value: "overview" },
          { value: "events" },
          { value: "clues" },
          { value: "npcs" },
          { value: "locations" },
          { value: "threads" },
        ],
        defaultUiPreferences.chronicleViewMode,
      ),
      isFocusMode:
        typeof parsedPreferences.isFocusMode === "boolean"
          ? parsedPreferences.isFocusMode
          : defaultUiPreferences.isFocusMode,
      logInputMode: readOptionValue(parsedPreferences.logInputMode, logInputOptions, defaultUiPreferences.logInputMode),
      logWorkspaceMode: readOptionValue(
        parsedPreferences.logWorkspaceMode,
        logWorkspaceOptions,
        defaultUiPreferences.logWorkspaceMode,
      ),
      navigationPanelMode: readOptionValue(
        parsedPreferences.navigationPanelMode,
        navigationPanelOptions,
        defaultUiPreferences.navigationPanelMode,
      ),
      prepWorkspaceMode: readOptionValue(
        parsedPreferences.prepWorkspaceMode,
        prepWorkspaceOptions,
        defaultUiPreferences.prepWorkspaceMode,
      ),
      reviewSortMode: readOptionValue(
        parsedPreferences.reviewSortMode,
        reviewSortOptions,
        defaultUiPreferences.reviewSortMode,
      ),
      reviewWorkspaceMode: readOptionValue(
        parsedPreferences.reviewWorkspaceMode,
        reviewWorkspaceOptions,
        defaultUiPreferences.reviewWorkspaceMode,
      ),
      rightPanelMode: readOptionValue(
        parsedPreferences.rightPanelMode,
        rightPanelOptions,
        defaultUiPreferences.rightPanelMode,
      ),
      sessionArchiveFilter: readOptionValue(
        parsedPreferences.sessionArchiveFilter,
        sessionArchiveOptions,
        defaultUiPreferences.sessionArchiveFilter,
      ),
      sessionSortMode: readOptionValue(
        parsedPreferences.sessionSortMode,
        sessionSortOptions,
        defaultUiPreferences.sessionSortMode,
      ),
      sessionTranscriptionFilter: readOptionValue(
        parsedPreferences.sessionTranscriptionFilter,
        [
          { value: "all" },
          { value: "transcribed" },
          { value: "untranscribed" },
        ],
        defaultUiPreferences.sessionTranscriptionFilter,
      ),
      settingsPanelMode: readOptionValue(
        parsedPreferences.settingsPanelMode,
        settingsPanelOptions,
        defaultUiPreferences.settingsPanelMode,
      ),
    };
  } catch {
    return defaultUiPreferences;
  }
}

function loadCampaignLibraryState(): CampaignLibraryState {
  if (typeof window === "undefined") {
    return normalizeCampaignLibraryState(createInitialCampaignState());
  }

  const savedLibraryState = window.localStorage.getItem(CAMPAIGN_LIBRARY_STORAGE_KEY);
  if (savedLibraryState) {
    try {
      return normalizeCampaignLibraryState(JSON.parse(savedLibraryState));
    } catch {
      return normalizeCampaignLibraryState(createInitialCampaignState());
    }
  }

  const savedState = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!savedState) {
    return normalizeCampaignLibraryState(createInitialCampaignState());
  }

  try {
    return normalizeCampaignLibraryState(JSON.parse(savedState));
  } catch {
    return normalizeCampaignLibraryState(createInitialCampaignState());
  }
}

function readLegacyProviderApiKey(rawState: unknown): string {
  if (!rawState || typeof rawState !== "object") {
    return "";
  }

  const maybeState = rawState as {
    extractionProvider?: {
      apiKey?: unknown;
    };
  };

  return typeof maybeState.extractionProvider?.apiKey === "string" ? maybeState.extractionProvider.apiKey : "";
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function getStorageUsagePercent(storageHealth: StorageHealth): number | null {
  if (!storageHealth.usageBytes || !storageHealth.quotaBytes) {
    return null;
  }

  return Math.round((storageHealth.usageBytes / storageHealth.quotaBytes) * 100);
}

function formatRunTimestamp(value: string): string {
  if (!value.trim()) {
    return "日時不明";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function loadProviderSecrets(): ProviderSecretSettings {
  if (typeof window === "undefined") {
    return defaultProviderSecretSettings;
  }

  const savedSecrets = window.localStorage.getItem(PROVIDER_SECRETS_STORAGE_KEY);
  if (savedSecrets) {
    try {
      return normalizeProviderSecretSettings(JSON.parse(savedSecrets));
    } catch {
      return defaultProviderSecretSettings;
    }
  }

  const savedState = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!savedState) {
    return defaultProviderSecretSettings;
  }

  try {
    return normalizeProviderSecretSettings({
      openAiApiKey: readLegacyProviderApiKey(JSON.parse(savedState)),
    });
  } catch {
    return defaultProviderSecretSettings;
  }
}

function loadLastBackupAt(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const savedValue = window.localStorage.getItem(LAST_BACKUP_STORAGE_KEY);
  return savedValue?.trim() || null;
}

function sanitizeCampaignStateForExport(campaignState: CampaignState): CampaignState {
  return {
    ...campaignState,
    extractionProvider: {
      providerId: campaignState.extractionProvider.providerId,
      model: campaignState.extractionProvider.model,
      endpoint: campaignState.extractionProvider.endpoint,
    },
  };
}

function sanitizeCampaignLibraryStateForExport(campaignLibrary: CampaignLibraryState): CampaignLibraryState {
  return {
    ...campaignLibrary,
    campaigns: campaignLibrary.campaigns.map(sanitizeCampaignStateForExport),
  };
}

function downloadTextFile(content: string, fileName: string, type: string): void {
  const blob = new Blob([content], { type });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function downloadJsonFile(content: unknown, fileName: string): void {
  downloadTextFile(JSON.stringify(content, null, 2), fileName, "application/json");
}

export function App() {
  const [initialUiPreferences] = useState(loadUiPreferences);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(initialUiPreferences.activeTab);
  const [chronicleClueStatusFilter, setChronicleClueStatusFilter] = useState<ClueStatusFilter>(
    initialUiPreferences.chronicleClueStatusFilter,
  );
  const [chronicleViewMode, setChronicleViewMode] = useState<ChronicleViewMode>(
    initialUiPreferences.chronicleViewMode,
  );
  const [isFocusMode, setIsFocusMode] = useState(initialUiPreferences.isFocusMode);
  const [logWorkspaceMode, setLogWorkspaceMode] = useState<LogWorkspaceMode>(initialUiPreferences.logWorkspaceMode);
  const [navigationPanelMode, setNavigationPanelMode] = useState<NavigationPanelMode>(
    initialUiPreferences.navigationPanelMode,
  );
  const [prepWorkspaceMode, setPrepWorkspaceMode] = useState<PrepWorkspaceMode>(initialUiPreferences.prepWorkspaceMode);
  const [reviewSortMode, setReviewSortMode] = useState<ReviewSortMode>(initialUiPreferences.reviewSortMode);
  const [reviewWorkspaceMode, setReviewWorkspaceMode] = useState<ReviewWorkspaceMode>(
    initialUiPreferences.reviewWorkspaceMode,
  );
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>(initialUiPreferences.rightPanelMode);
  const [settingsPanelMode, setSettingsPanelMode] = useState<SettingsPanelMode>(
    initialUiPreferences.settingsPanelMode,
  );
  const [isExtracting, setIsExtracting] = useState(false);
  const [logInputMode, setLogInputMode] = useState<LogInputMode>(initialUiPreferences.logInputMode);
  const [campaignLibrary, setCampaignLibrary] = useState<CampaignLibraryState>(loadCampaignLibraryState);
  const [showApprovedReviewItems, setShowApprovedReviewItems] = useState(true);
  const [reviewKindFilter, setReviewKindFilter] = useState<ReviewKindFilter>("all");
  const [reviewVisibilityFilter, setReviewVisibilityFilter] = useState<ReviewVisibilityFilter>("all");
  const [reviewQuery, setReviewQuery] = useState("");
  const [showDuplicateReviewItemsOnly, setShowDuplicateReviewItemsOnly] = useState(false);
  const [showInvalidReviewItemsOnly, setShowInvalidReviewItemsOnly] = useState(false);
  const [lastRejectedReviewBatch, setLastRejectedReviewBatch] = useState<RejectedReviewBatch | null>(null);
  const [campaignQuery, setCampaignQuery] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [sessionArchiveFilter, setSessionArchiveFilter] = useState<SessionArchiveFilter>(
    initialUiPreferences.sessionArchiveFilter,
  );
  const [sessionSortMode, setSessionSortMode] = useState<SessionSortMode>(initialUiPreferences.sessionSortMode);
  const [sessionTranscriptionFilter, setSessionTranscriptionFilter] = useState<SessionTranscriptionFilter>(
    initialUiPreferences.sessionTranscriptionFilter,
  );
  const [transcriptionAudioFile, setTranscriptionAudioFile] = useState<File | null>(null);
  const [transcriptionDraftJson, setTranscriptionDraftJson] = useState("");
  const [transcriptionImportError, setTranscriptionImportError] = useState<string | null>(null);
  const [transcriptionImportMessage, setTranscriptionImportMessage] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(loadLastBackupAt);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageHealth, setStorageHealth] = useState<StorageHealth>({
    libraryBytes: 0,
    quotaBytes: null,
    usageBytes: null,
  });
  const [providerSecrets, setProviderSecrets] = useState<ProviderSecretSettings>(loadProviderSecrets);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);

  const campaignState =
    campaignLibrary.campaigns.find((campaign) => campaign.id === campaignLibrary.activeCampaignId) ??
    campaignLibrary.campaigns[0];
  const currentSession =
    campaignState.sessions.find((session) => session.id === campaignState.activeSessionId) ?? campaignState.sessions[0];
  const activeRejectedReviewBatch =
    lastRejectedReviewBatch?.sessionId === currentSession.id ? lastRejectedReviewBatch : null;
  const {
    approvedIds,
    extractionItems: items,
    extractionRun,
    liveLog,
    log,
    transcriptionRun,
  } = currentSession;
  const {
    campaignMode,
    campaignName,
    chronicle,
    extractionProvider,
    quickResult,
    transcriptionProvider,
  } = campaignState;
  const quickPrompts = quickPromptSets[campaignMode];
  const memoryNavLabels = memoryNavigationLabels[campaignMode];
  const prepLabels = prepSectionLabels[campaignMode];
  const selectedTranscriptionProvider = getTranscriptionProvider(transcriptionProvider.providerId);
  const transcriptionDraftPreview = useMemo(
    () => previewTranscriptionDraftPayload(transcriptionDraftJson),
    [transcriptionDraftJson],
  );
  const canApplyTranscriptionDraft = transcriptionDraftPreview.status === "valid" && !isExtracting;
  const transcriptionProviderReadiness = useMemo(
    () => checkTranscriptionProviderReadiness(transcriptionProvider, providerSecrets),
    [providerSecrets, transcriptionProvider],
  );
  const extractionProviderReady =
    extractionProvider.providerId !== "openai" || providerSecrets.openAiApiKey.trim().length > 0;
  const transcriptionAudioFileValidation = useMemo(
    () => (transcriptionAudioFile ? validateTranscriptionAudioFile(transcriptionAudioFile) : null),
    [transcriptionAudioFile],
  );
  const canRunAudioTranscription =
    Boolean(transcriptionAudioFileValidation?.ok) &&
    transcriptionProvider.providerId === "openai" &&
    transcriptionProviderReadiness.ok &&
    !isExtracting;

  const approvedCount = approvedIds.length;
  const remainingCount = items.length - approvedCount;
  const duplicateReviewItemIds = findDuplicateExtractionItemIds(items, approvedIds);
  const reviewSummary = summarizeReviewItems(items, approvedIds, duplicateReviewItemIds);
  const invalidReviewItemCount = reviewSummary.invalid;
  const duplicateReviewItemCount = reviewSummary.duplicate;
  const approvableRemainingCount = items.filter(
    (item) => !approvedIds.includes(item.id) && item.title.trim() && item.detail.trim(),
  ).length;
  const normalizedReviewQuery = reviewQuery.trim().toLowerCase();
  const duplicateReviewItemIdSet = new Set(duplicateReviewItemIds);
  const filteredReviewItems = items.filter((item) => {
    if (!showApprovedReviewItems && approvedIds.includes(item.id)) {
      return false;
    }

    if (reviewKindFilter !== "all" && item.kind !== reviewKindFilter) {
      return false;
    }

    if (reviewVisibilityFilter !== "all" && item.visibility !== reviewVisibilityFilter) {
      return false;
    }

    if (showInvalidReviewItemsOnly && item.title.trim() && item.detail.trim()) {
      return false;
    }

    if (showDuplicateReviewItemsOnly && !duplicateReviewItemIdSet.has(item.id)) {
      return false;
    }

    return (
      !normalizedReviewQuery ||
      [item.title, item.detail, item.kind, item.visibility].some((value) =>
        value.toLowerCase().includes(normalizedReviewQuery),
      )
    );
  });
  const reviewItems = sortReviewItems(filteredReviewItems, approvedIds, reviewSortMode);
  const visibleReviewSummary = summarizeReviewItems(reviewItems, approvedIds, duplicateReviewItemIds);
  const hasReviewFilter =
    reviewKindFilter !== "all" ||
    reviewVisibilityFilter !== "all" ||
    !showApprovedReviewItems ||
    showDuplicateReviewItemsOnly ||
    showInvalidReviewItemsOnly ||
    normalizedReviewQuery.length > 0;
  const approvableVisibleReviewCount = visibleReviewSummary.approvable;
  const rejectableVisibleReviewCount = visibleReviewSummary.pending;
  const visibleReviewMemoryPreview = previewExtractionApplication(
    chronicle,
    reviewItems.filter((item) => !approvedIds.includes(item.id)),
  );
  const reviewKindCounts = reviewKindOptions.reduce<Record<ReviewKindFilter, number>>(
    (counts, option) => ({
      ...counts,
      [option.value]:
        option.value === "all"
          ? items.length
          : items.filter((item) => item.kind === option.value).length,
    }),
    {
      all: 0,
      出来事: 0,
      NPC: 0,
      手がかり: 0,
      GM秘密: 0,
      伏線: 0,
    },
  );
  const reviewVisibilityCounts = reviewVisibilityOptions.reduce<Record<ReviewVisibilityFilter, number>>(
    (counts, option) => ({
      ...counts,
      [option.value]:
        option.value === "all"
          ? items.length
          : items.filter((item) => item.visibility === option.value).length,
    }),
    {
      all: 0,
      PL既知: 0,
      GMのみ: 0,
      未開示候補: 0,
    },
  );
  const normalizedCampaignQuery = campaignQuery.trim().toLowerCase();
  const visibleCampaigns = normalizedCampaignQuery
    ? campaignLibrary.campaigns.filter((campaign) =>
        getCampaignSearchText(campaign).toLowerCase().includes(normalizedCampaignQuery),
      )
    : campaignLibrary.campaigns;
  const normalizedSessionQuery = sessionQuery.trim().toLowerCase();
  const filteredSessions = campaignState.sessions.filter((session) => {
    if (sessionArchiveFilter === "active" && session.archivedAt) {
      return false;
    }

    if (sessionArchiveFilter === "archived" && !session.archivedAt) {
      return false;
    }

    if (sessionTranscriptionFilter === "transcribed" && !session.transcriptionRun) {
      return false;
    }

    if (sessionTranscriptionFilter === "untranscribed" && session.transcriptionRun) {
      return false;
    }

    return !normalizedSessionQuery || getSessionSearchText(session).toLowerCase().includes(normalizedSessionQuery);
  });
  const canExtractLog =
    logInputMode === "plain"
      ? summarizePlainLog(log).speakerLineCount > 0
      : liveLog.segments.some((segment) => segment.text.trim().length > 0);
  const extractionPromptLength = useMemo(
    () =>
      buildExtractionPrompt({
        campaignMode,
        lines: buildExtractionInput(log, liveLog, logInputMode),
        source: logInputMode,
      }).length,
    [campaignMode, liveLog, log, logInputMode],
  );
  const dynamicPrepNote = useMemo(
    () => generatePrepNote(chronicle, campaignState.sessions, currentSession, campaignMode),
    [campaignMode, campaignState.sessions, chronicle, currentSession],
  );
  const currentLiveLogSummary = useMemo(() => summarizeLiveLog(liveLog), [liveLog]);
  const currentSpeakerIssueCount = useMemo(() => getSpeakerLogIssues(liveLog).length, [liveLog]);
  const sessionStorageDiagnostics = useMemo(
    () => buildSessionStorageDiagnostics(campaignLibrary),
    [campaignLibrary],
  );
  const largestSessionStorageDiagnostic = sessionStorageDiagnostics[0] ?? null;
  const sessionStorageDiagnosticById = useMemo(
    () => new Map(sessionStorageDiagnostics.map((diagnostic) => [diagnostic.sessionId, diagnostic])),
    [sessionStorageDiagnostics],
  );
  const reviewQualityDiagnostics = useMemo(
    () => buildReviewQualityDiagnostics(campaignLibrary),
    [campaignLibrary],
  );
  const currentReviewQualityDiagnostic = reviewQualityDiagnostics.find(
    (diagnostic) => diagnostic.sessionId === currentSession.id,
  );
  const reviewQualityDebtCount = reviewQualityDiagnostics.reduce(
    (total, diagnostic) =>
      total +
      diagnostic.approvedInvalidCount +
      diagnostic.approvedDuplicateCount +
      diagnostic.pendingInvalidCount +
      diagnostic.pendingDuplicateCount,
    0,
  );
  const campaignOperationalRisks = buildCampaignOperationalRisks(
    sessionStorageDiagnostics,
    reviewQualityDiagnostics,
  );
  const sessionReviewDebtById = new Map(
    reviewQualityDiagnostics.map((diagnostic) => [
      diagnostic.sessionId,
      diagnostic.approvedInvalidCount +
        diagnostic.approvedDuplicateCount +
        diagnostic.pendingInvalidCount +
        diagnostic.pendingDuplicateCount,
    ]),
  );
  const visibleSessions = sortSessions(
    filteredSessions,
    sessionSortMode,
    sessionStorageDiagnosticById,
    sessionReviewDebtById,
  );
  const memoryItemCount = countChronicleItems(chronicle);
  const hiddenClueCount = chronicle.clues.filter((clue) => clue.status !== "known").length;
  const hasPrepContent = dynamicPrepNote.shortRecap.length > 0 || dynamicPrepNote.hooks.length > 0;
  const sideWorkspaceLabel =
    rightPanelMode === "settings"
      ? `補助パネル / 設定 / ${settingsPanelLabels[settingsPanelMode]}`
      : "補助パネル / セッション中";
  const activeWorkspaceLabel = useMemo(() => {
    const tabLabel = findOptionLabel(tabOptions, activeTab, "ホーム");

    if (activeTab === "log") {
      const workspaceLabel = findOptionLabel(logWorkspaceOptions, logWorkspaceMode, "ログ編集");
      return logWorkspaceMode === "editor"
        ? `${tabLabel} / ${workspaceLabel} / ${findOptionLabel(logInputOptions, logInputMode, "通常ログ")}`
        : `${tabLabel} / ${workspaceLabel}`;
    }

    if (activeTab === "review") {
      return `${tabLabel} / ${findOptionLabel(reviewWorkspaceOptions, reviewWorkspaceMode, "確認")}`;
    }

    if (activeTab === "chronicle") {
      const filterLabel =
        chronicleClueStatusFilter === "all"
          ? ""
          : ` / ${chronicleClueStatusFilter === "hidden" ? "GM秘密" : chronicleClueStatusFilter === "known" ? "PL既知" : "一部既知"}`;
      return `${tabLabel} / ${chronicleViewLabels[chronicleViewMode]}${filterLabel}`;
    }

    if (activeTab === "prep") {
      return `${tabLabel} / ${findOptionLabel(prepWorkspaceOptions, prepWorkspaceMode, "要約")}`;
    }

    return tabLabel;
  }, [
    activeTab,
    chronicleClueStatusFilter,
    chronicleViewMode,
    logInputMode,
    logWorkspaceMode,
    prepWorkspaceMode,
    reviewWorkspaceMode,
  ]);

  const progress = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }
    return Math.round((approvedCount / items.length) * 100);
  }, [approvedCount, items.length]);
  const storageUsagePercent = getStorageUsagePercent(storageHealth);
  const backupStatus = getBackupStatus(lastBackupAt);
  const activeSessionCount = campaignState.sessions.filter((session) => !session.archivedAt).length;

  const markBackupCreated = (): void => {
    const timestamp = new Date().toISOString();
    setLastBackupAt(timestamp);
    try {
      window.localStorage.setItem(LAST_BACKUP_STORAGE_KEY, timestamp);
    } catch {
      setStorageError("バックアップ日時をブラウザに保存できませんでした。");
    }
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(CAMPAIGN_LIBRARY_STORAGE_KEY, JSON.stringify(campaignLibrary));
      setStorageError(null);
    } catch {
      setStorageError("キャンペーン状態をブラウザに保存できませんでした。書き出しで退避してください。");
    }
  }, [campaignLibrary]);

  useEffect(() => {
    let isMounted = true;
    const serializedLibrary = JSON.stringify(campaignLibrary);
    const libraryBytes = new Blob([serializedLibrary]).size;

    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      setStorageHealth({
        libraryBytes,
        quotaBytes: null,
        usageBytes: null,
      });
      return;
    }

    void navigator.storage.estimate().then((estimate) => {
      if (!isMounted) {
        return;
      }

      setStorageHealth({
        libraryBytes,
        quotaBytes: typeof estimate.quota === "number" ? estimate.quota : null,
        usageBytes: typeof estimate.usage === "number" ? estimate.usage : null,
      });
    });

    return () => {
      isMounted = false;
    };
  }, [campaignLibrary]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PROVIDER_SECRETS_STORAGE_KEY,
        JSON.stringify(normalizeProviderSecretSettings(providerSecrets)),
      );
    } catch {
      setStorageError("Provider secrets をブラウザに保存できませんでした。");
    }
  }, [providerSecrets]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        UI_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          activeTab,
          chronicleClueStatusFilter,
          chronicleViewMode,
          isFocusMode,
          logInputMode,
          logWorkspaceMode,
          navigationPanelMode,
          prepWorkspaceMode,
          reviewSortMode,
          reviewWorkspaceMode,
          rightPanelMode,
          sessionArchiveFilter,
          sessionSortMode,
          sessionTranscriptionFilter,
          settingsPanelMode,
        } satisfies UiPreferences),
      );
    } catch {
      setStorageError("画面設定をブラウザに保存できませんでした。");
    }
  }, [
    activeTab,
    chronicleClueStatusFilter,
    chronicleViewMode,
    isFocusMode,
    logInputMode,
    logWorkspaceMode,
    navigationPanelMode,
    prepWorkspaceMode,
    reviewSortMode,
    reviewWorkspaceMode,
    rightPanelMode,
    sessionArchiveFilter,
    sessionSortMode,
    sessionTranscriptionFilter,
    settingsPanelMode,
  ]);

  const setActiveCampaignState = (updater: (current: CampaignState) => CampaignState): void => {
    setCampaignLibrary((currentLibrary) => {
      const activeCampaign = currentLibrary.campaigns.find(
        (campaign) => campaign.id === currentLibrary.activeCampaignId,
      );
      if (!activeCampaign) {
        return currentLibrary;
      }

      return {
        ...currentLibrary,
        campaigns: currentLibrary.campaigns.map((campaign) =>
          campaign.id === activeCampaign.id ? updater(campaign) : campaign,
        ),
      };
    });
  };

  const updateCampaignState = (updates: Partial<CampaignState>): void => {
    setActiveCampaignState((current) => ({ ...current, ...updates }));
  };

  const switchCampaign = (campaignId: string): void => {
    setCampaignLibrary((current) => ({
      ...current,
      activeCampaignId: current.campaigns.some((campaign) => campaign.id === campaignId)
        ? campaignId
        : current.activeCampaignId,
    }));
    setCampaignQuery("");
    setSessionQuery("");
    setLogInputMode("plain");
    setLogWorkspaceMode("editor");
    setActiveTab("log");
  };

  const addNewCampaign = (): void => {
    setCampaignLibrary((current) => {
      const nextCampaign = createNewCampaignState(current.campaigns.length + 1);

      return {
        campaigns: [...current.campaigns, nextCampaign],
        activeCampaignId: nextCampaign.id,
      };
    });
    setCampaignQuery("");
    setSessionQuery("");
    setLogInputMode("plain");
    setLogWorkspaceMode("editor");
    setActiveTab("log");
  };

  const duplicateCampaign = (campaignId: string): void => {
    setCampaignLibrary((current) => {
      const sourceCampaign = current.campaigns.find((campaign) => campaign.id === campaignId);
      if (!sourceCampaign) {
        return current;
      }

      const duplicatedCampaign = duplicateCampaignState(sourceCampaign);
      return {
        campaigns: [...current.campaigns, duplicatedCampaign],
        activeCampaignId: duplicatedCampaign.id,
      };
    });
    setCampaignQuery("");
    setSessionQuery("");
    setLogInputMode("plain");
    setLogWorkspaceMode("editor");
    setActiveTab("log");
  };

  const deleteCampaign = (campaignId: string): void => {
    const targetCampaign = campaignLibrary.campaigns.find((campaign) => campaign.id === campaignId);
    if (!targetCampaign || campaignLibrary.campaigns.length <= 1) {
      return;
    }

    setConfirmation({
      title: `${targetCampaign.campaignName}を削除しますか`,
      message: "キャンペーン内のセッション、記憶、抽出候補は元に戻せません。",
      confirmLabel: "削除する",
      onConfirm: () => {
        setCampaignLibrary((current) => {
          if (current.campaigns.length <= 1) {
            return current;
          }

          const targetIndex = current.campaigns.findIndex((campaign) => campaign.id === campaignId);
          if (targetIndex === -1) {
            return current;
          }

          const nextCampaigns = current.campaigns.filter((campaign) => campaign.id !== campaignId);
          const fallbackCampaign = nextCampaigns[Math.max(0, targetIndex - 1)] ?? nextCampaigns[0];

          return {
            campaigns: nextCampaigns,
            activeCampaignId:
              current.activeCampaignId === campaignId ? fallbackCampaign.id : current.activeCampaignId,
          };
        });
        setCampaignQuery("");
        setSessionQuery("");
        setLogInputMode("plain");
        setLogWorkspaceMode("editor");
        setActiveTab("log");
      },
    });
  };

  const exportCampaignState = (): void => {
    downloadJsonFile(sanitizeCampaignStateForExport(campaignState), createExportFileName(campaignName));
    markBackupCreated();
    setStorageError(null);
  };

  const exportCampaignMarkdown = (): void => {
    downloadTextFile(
      formatCampaignMarkdown(campaignState),
      `${createExportFileName(`${campaignName}-campaign-summary`).replace(/\.json$/, "")}.md`,
      "text/markdown;charset=utf-8",
    );
    setStorageError(null);
  };

  const exportCampaignLibrary = (): void => {
    downloadJsonFile(sanitizeCampaignLibraryStateForExport(campaignLibrary), createExportFileName("campaign-library"));
    markBackupCreated();
    setStorageError(null);
  };

  const exportCampaignLibraryMarkdown = (): void => {
    downloadTextFile(
      formatCampaignLibraryMarkdown(campaignLibrary),
      `${createExportFileName("campaign-library-index").replace(/\.json$/, "")}.md`,
      "text/markdown;charset=utf-8",
    );
    setStorageError(null);
  };

  const exportSupportDiagnostics = (): void => {
    downloadJsonFile(buildSupportDiagnostics({
      activeTab,
      backupStatus,
      campaignLibrary,
      campaignState,
      chronicleClueStatusFilter,
      chronicleViewMode,
      currentSession,
      currentSessionMetrics: {
        approvedCount,
        duplicateReviewItemCount,
        extractionPromptLength,
        invalidReviewItemCount,
        reviewItemCount: items.length,
        speakerIssueCount: currentSpeakerIssueCount,
      },
      extractionProvider,
      extractionProviderReady,
      isFocusMode,
      logInputMode,
      logWorkspaceMode,
      navigationPanelMode,
      prepWorkspaceMode,
      reviewSortMode,
      reviewWorkspaceMode,
      rightPanelMode,
      sessionArchiveFilter,
      sessionSortMode,
      sessionTranscriptionFilter,
      settingsPanelMode,
      storage: {
        ...storageHealth,
        usagePercent: storageUsagePercent,
      },
      transcriptionProviderId: transcriptionProvider.providerId,
      transcriptionProviderReadiness,
    }), createExportFileName("support-diagnostics"));
  };

  const exportTranscriptionDraftJson = (): void => {
    const drafts = liveLogToTranscriptionDrafts(currentSession.liveLog);

    downloadJsonFile({
      exportedAt: new Date().toISOString(),
      campaignName,
      campaignMode,
      sessionId: currentSession.id,
      sessionTitle: currentSession.title,
      segmentCount: drafts.length,
      transcriptionRun: currentSession.transcriptionRun,
      segments: drafts,
    }, createExportFileName(`${currentSession.title}-transcription-draft`));
    setTranscriptionImportError(null);
  };

  const exportSpeakerLogText = (): void => {
    const text = liveLogToPlainText(currentSession.liveLog);

    downloadTextFile(
      text,
      `${createExportFileName(`${currentSession.title}-speaker-log`).replace(/\.json$/, "")}.txt`,
      "text/plain;charset=utf-8",
    );
  };

  const exportSpeakerLogMarkdown = (): void => {
    downloadTextFile(
      formatSpeakerLogMarkdown(currentSession.liveLog, `${currentSession.title} 話者付きログ`),
      `${createExportFileName(`${currentSession.title}-speaker-log`).replace(/\.json$/, "")}.md`,
      "text/markdown;charset=utf-8",
    );
  };

  const exportSpeakerLogIssues = (): void => {
    const issues = getSpeakerLogIssues(currentSession.liveLog);

    downloadJsonFile({
      exportedAt: new Date().toISOString(),
      campaignName,
      campaignMode,
      sessionId: currentSession.id,
      sessionTitle: currentSession.title,
      issueCount: issues.length,
      issues,
    }, createExportFileName(`${currentSession.title}-speaker-log-issues`));
  };

  const exportVisibleSpeakerSegments = (
    segments: TranscriptSegment[],
    filters: Record<string, string | boolean> = {},
  ): void => {
    downloadJsonFile({
      exportedAt: new Date().toISOString(),
      campaignName,
      campaignMode,
      sessionTitle: currentSession.title,
      filters,
      ...buildSpeakerSegmentExport(currentSession.liveLog, segments),
    }, createExportFileName(`${currentSession.title}-visible-speaker-segments`));
  };

  const exportVisibleReviewItems = (): void => {
    downloadJsonFile({
      exportedAt: new Date().toISOString(),
      campaignName,
      campaignMode,
      sessionTitle: currentSession.title,
      filters: {
        kind: reviewKindFilter,
        visibility: reviewVisibilityFilter,
        query: reviewQuery.trim(),
        showApproved: showApprovedReviewItems,
        invalidOnly: showInvalidReviewItemsOnly,
        duplicateOnly: showDuplicateReviewItemsOnly,
        sort: reviewSortMode,
      },
      counts: {
        total: visibleReviewSummary.total,
        approved: visibleReviewSummary.approved,
        pending: visibleReviewSummary.pending,
        rejectable: visibleReviewSummary.pending,
        approvable: visibleReviewSummary.approvable,
        invalid: visibleReviewSummary.invalid,
        duplicate: visibleReviewSummary.duplicate,
        byKind: visibleReviewSummary.byKind,
        byVisibility: visibleReviewSummary.byVisibility,
      },
      items: reviewItems,
    }, createExportFileName(`${currentSession.title}-review-items`));
  };

  const exportVisibleReviewItemsMarkdown = (): void => {
    downloadTextFile(
      formatReviewItemsMarkdown(reviewItems, `${currentSession.title} 抽出候補`, approvedIds),
      `${createExportFileName(`${currentSession.title}-review-items`).replace(/\.json$/, "")}.md`,
      "text/markdown;charset=utf-8",
    );
  };

  const exportFilteredChronicle = (filteredChronicle: typeof chronicle): void => {
    downloadJsonFile({
      exportedAt: new Date().toISOString(),
      campaignName,
      campaignMode,
      itemCount: countChronicleItems(filteredChronicle),
      chronicle: filteredChronicle,
    }, createExportFileName(`${campaignName}-filtered-memory`));
  };

  const exportFilteredChronicleMarkdown = (filteredChronicle: typeof chronicle): void => {
    downloadTextFile(
      formatChronicleMarkdown(filteredChronicle, `${campaignName} キャンペーン記憶`),
      `${createExportFileName(`${campaignName}-filtered-memory`).replace(/\.json$/, "")}.md`,
      "text/markdown;charset=utf-8",
    );
  };

  const exportPrepNoteMarkdown = (): void => {
    const markdown = formatPrepNoteMarkdown(
      dynamicPrepNote,
      `${currentSession.title} 次回準備 (${findOptionLabel(campaignModeOptions, campaignMode, "調査")})`,
    );

    downloadTextFile(
      markdown,
      `${createExportFileName(`${currentSession.title}-prep-note`).replace(/\.json$/, "")}.md`,
      "text/markdown;charset=utf-8",
    );
  };

  const exportPrepNoteJson = (): void => {
    downloadJsonFile({
      exportedAt: new Date().toISOString(),
      campaignId: campaignState.id,
      campaignName,
      campaignMode,
      sessionId: currentSession.id,
      sessionTitle: currentSession.title,
      prepNote: dynamicPrepNote,
    }, createExportFileName(`${currentSession.title}-prep-note`));
  };

  const exportCurrentSessionMarkdown = (): void => {
    exportSessionMarkdown(currentSession);
  };

  const exportSessionJson = (session: SessionState): void => {
    downloadJsonFile({
      exportedAt: new Date().toISOString(),
      campaignName,
      campaignMode,
      session,
    }, createExportFileName(`${session.title}-session`));
  };

  const exportAndArchiveSession = (sessionId: string): void => {
    const targetSession = campaignState.sessions.find((session) => session.id === sessionId);
    if (!targetSession || targetSession.archivedAt || activeSessionCount <= 1) {
      return;
    }

    const sizeDiagnostic = sessionStorageDiagnosticById.get(sessionId);

    setConfirmation({
      title: `${targetSession.title}を書き出してアーカイブしますか`,
      message: [
        "セッションJSONを書き出したあと、このセッションをアーカイブします。",
        sizeDiagnostic ? `推定サイズは ${formatFileSize(sizeDiagnostic.totalBytes)} です。` : "",
        "アーカイブ後も検索と復元はできます。",
      ].filter(Boolean).join(" "),
      confirmLabel: "退避してアーカイブ",
      onConfirm: () => {
        exportSessionJson(targetSession);
        setSessionArchived(sessionId, true);
      },
    });
  };

  const exportSessionMarkdown = (session: SessionState): void => {
    const sessionPrepNote = generatePrepNote(chronicle, campaignState.sessions, session, campaignMode);

    downloadTextFile(
      formatSessionMarkdown(session, sessionPrepNote),
      `${createExportFileName(`${session.title}-session-summary`).replace(/\.json$/, "")}.md`,
      "text/markdown;charset=utf-8",
    );
  };

  const importCampaignState = async (file: File): Promise<void> => {
    try {
      const fileText = await file.text();
      const parsedState = JSON.parse(fileText);
      const importPreview = previewCampaignImport(parsedState);
      const maybeSession = readSessionImportPayload(parsedState);
      const isLibraryImport =
        typeof parsedState === "object" &&
        parsedState !== null &&
        Array.isArray((parsedState as { campaigns?: unknown }).campaigns);

      if (maybeSession) {
        const importedCampaign = normalizeCampaignState({
          sessions: [maybeSession],
        });
        const importedSession = {
          ...importedCampaign.sessions[0],
          id: createId("session"),
        };
        setConfirmation({
          title: "セッションを追加しますか",
          message: importPreview.message,
          confirmLabel: "追加する",
          onConfirm: () => {
            setActiveCampaignState((current) => ({
              ...current,
              sessions: [...current.sessions, importedSession],
              activeSessionId: importedSession.id,
            }));
            setStorageError(null);
            setSessionQuery("");
            setLogInputMode("speaker");
            setLogWorkspaceMode("editor");
            setActiveTab("log");
          },
        });
        return;
      }

      if (isLibraryImport) {
        const importedLibrary = normalizeCampaignLibraryState(parsedState);
        setConfirmation({
          title: "キャンペーンライブラリを置き換えますか",
          message: importPreview.message,
          confirmLabel: "全体を置き換える",
          onConfirm: () => {
            setCampaignLibrary(importedLibrary);
            setStorageError(null);
            setCampaignQuery("");
            setSessionQuery("");
            setLogInputMode("plain");
            setLogWorkspaceMode("editor");
            setActiveTab("log");
          },
        });
        return;
      }

      const importedState = normalizeCampaignState(parsedState);
      const importedLegacyApiKey = readLegacyProviderApiKey(parsedState);
      setConfirmation({
        title: "キャンペーンを置き換えますか",
        message: importPreview.message,
        confirmLabel: "置き換える",
        onConfirm: () => {
          setActiveCampaignState((current) => ({
            ...importedState,
            id: current.id,
          }));
          if (importedLegacyApiKey) {
            setProviderSecrets((current) => ({ ...current, openAiApiKey: importedLegacyApiKey }));
          }
          setStorageError(null);
          setSessionQuery("");
          setLogInputMode("plain");
          setLogWorkspaceMode("editor");
          setActiveTab("log");
        },
      });
    } catch {
      setStorageError("JSONを読み込めませんでした。Chronicle GMのエクスポートファイルか確認してください。");
    }
  };

  const updateActiveSession = (updater: (currentSession: SessionState) => SessionState): void => {
    setActiveCampaignState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === current.activeSessionId ? updater(session) : session,
      ),
    }));
  };

  const updateCurrentSession = (updates: Partial<SessionState>): void => {
    updateActiveSession((session) => ({
      ...session,
      ...updates,
    }));
  };

  const updateSessionById = (sessionId: string, updates: Partial<SessionState>): void => {
    setActiveCampaignState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === sessionId ? { ...session, ...updates } : session,
      ),
    }));
  };

  const updateLiveLog = (updater: (current: LiveLogSession) => LiveLogSession): void => {
    updateActiveSession((session) => ({
      ...session,
      liveLog: updater(session.liveLog),
    }));
  };

  const switchSession = (sessionId: string): void => {
    setActiveCampaignState((current) => ({
      ...current,
      activeSessionId: sessionId,
    }));
    setLogWorkspaceMode("editor");
    setActiveTab("log");
  };

  const addNewSession = (): void => {
    setActiveCampaignState((current) => {
      const nextSession = createNewSession(current.sessions.length + 1);

      return {
        ...current,
        sessions: [...current.sessions, nextSession],
        activeSessionId: nextSession.id,
      };
    });
    setSessionQuery("");
    setLogInputMode("plain");
    setLogWorkspaceMode("editor");
    setActiveTab("log");
  };

  const duplicateSession = (sessionId: string): void => {
    setActiveCampaignState((current) => {
      const sourceSession = current.sessions.find((session) => session.id === sessionId);
      if (!sourceSession) {
        return current;
      }

      const duplicatedSession = duplicateSessionState(sourceSession);

      return {
        ...current,
        sessions: [...current.sessions, duplicatedSession],
        activeSessionId: duplicatedSession.id,
      };
    });
    setSessionQuery("");
    setLogInputMode("speaker");
    setLogWorkspaceMode("editor");
    setActiveTab("log");
  };

  const setSessionArchived = (sessionId: string, archived: boolean): void => {
    updateSessionById(sessionId, {
      archivedAt: archived ? new Date().toISOString() : undefined,
    });

    if (archived && campaignState.activeSessionId === sessionId) {
      const fallbackSession = campaignState.sessions.find((session) => session.id !== sessionId && !session.archivedAt);
      if (fallbackSession) {
        switchSession(fallbackSession.id);
      }
    }
  };

  const deleteSession = (sessionId: string): void => {
    const targetSession = campaignState.sessions.find((session) => session.id === sessionId);
    if (!targetSession || campaignState.sessions.length <= 1) {
      return;
    }

    setConfirmation({
      title: `${targetSession.title}を削除しますか`,
      message: "ログと抽出候補は元に戻せません。",
      confirmLabel: "削除する",
      onConfirm: () => {
        setActiveCampaignState((current) => {
          if (current.sessions.length <= 1) {
            return current;
          }

          const targetIndex = current.sessions.findIndex((session) => session.id === sessionId);
          if (targetIndex === -1) {
            return current;
          }

          const nextSessions = current.sessions.filter((session) => session.id !== sessionId);
          const fallbackSession = nextSessions[Math.max(0, targetIndex - 1)] ?? nextSessions[0];

          return {
            ...current,
            sessions: nextSessions,
            activeSessionId: current.activeSessionId === sessionId ? fallbackSession.id : current.activeSessionId,
          };
        });
        setSessionQuery("");
        setLogInputMode("plain");
        setLogWorkspaceMode("editor");
        setActiveTab("log");
      },
    });
  };

  const resetCampaignState = (): void => {
    setConfirmation({
      title: "デモ初期化を実行しますか",
      message: "現在のキャンペーン状態は初期状態に戻ります。",
      confirmLabel: "初期化する",
      onConfirm: () => {
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        setActiveCampaignState((current) => ({
          ...createInitialCampaignState(),
          id: current.id,
        }));
        setLogWorkspaceMode("editor");
        setActiveTab("log");
      },
    });
  };

  const runExtractionPreview = async (): Promise<void> => {
    if (!canExtractLog) {
      return;
    }

    const targetSessionId = currentSession.id;
    setIsExtracting(true);
    try {
      const extractionResult = await runExtractionProvider({
        campaignMode,
        log,
        liveLog,
        secrets: providerSecrets,
        settings: extractionProvider,
        source: logInputMode,
      });

      updateSessionById(targetSessionId, {
        extractionItems: extractionResult.items,
        extractionRun: extractionResult.run,
        approvedIds: [],
      });
      setActiveCampaignState((current) =>
        current.activeSessionId === targetSessionId || !current.sessions.some((session) => session.id === targetSessionId)
          ? current
          : { ...current, activeSessionId: targetSessionId },
      );
      setShowInvalidReviewItemsOnly(false);
      setShowDuplicateReviewItemsOnly(false);
      setReviewWorkspaceMode("inspect");
      setActiveTab("review");
    } finally {
      setIsExtracting(false);
    }
  };

  const applyLiveLogToPlainLog = (): void => {
    updateCurrentSession({ log: liveLogToPlainText(liveLog) });
    setLogInputMode("plain");
  };

  const importPlainLogToLiveLog = (): void => {
    const importedLiveLog = parsePlainLogToLiveLog(log, `${campaignName} 取り込みログ`);
    if (!importedLiveLog) {
      return;
    }

    updateCurrentSession({ liveLog: importedLiveLog });
    setLogInputMode("speaker");
  };

  const restoreSampleLiveLog = (): void => {
    updateCurrentSession({ liveLog: cloneJson(sampleLiveLog) });
  };

  const mergeAdjacentSpeakerLogSegments = (): void => {
    updateLiveLog(mergeAdjacentTranscriptSegments);
  };

  const normalizeSpeakerLogTiming = (): void => {
    updateLiveLog(normalizeTranscriptSegmentTiming);
  };

  const normalizeSpeakerLogText = (): void => {
    updateLiveLog(normalizeTranscriptTextSpacing);
  };

  const clearTranscriptionRun = (): void => {
    updateCurrentSession({ transcriptionRun: null });
    setTranscriptionImportMessage("文字起こし履歴を解除しました。");
    setTranscriptionImportError(null);
  };

  const appendQuickResultToLog = (): void => {
    const text = quickResult.trim();
    if (!text) {
      return;
    }

    updateCurrentSession({
      log: currentSession.log.trim() ? `${currentSession.log.trim()}\nGM: ${text}` : `GM: ${text}`,
    });
    setLogInputMode("plain");
    setLogWorkspaceMode("editor");
    setActiveTab("log");
  };

  const appendQuickResultToSpeakerLog = (): void => {
    const text = quickResult.trim();
    if (!text) {
      return;
    }

    updateLiveLog((current) => {
      const gmSpeaker = current.speakers.find((speaker) => speaker.role === "GM") ?? current.speakers[0];
      const lastEndTimeSec = current.segments.reduce((max, segment) => Math.max(max, segment.endTimeSec), 0);

      return {
        ...current,
        segments: [
          ...current.segments,
          {
            id: createId("segment"),
            speakerId: gmSpeaker.id,
            startTimeSec: lastEndTimeSec + 1,
            endTimeSec: lastEndTimeSec + 7,
            text,
          },
        ],
      };
    });
    setLogInputMode("speaker");
    setLogWorkspaceMode("editor");
    setActiveTab("log");
  };

  const applyImportedTranscriptionDraftLog = (
    targetSessionId: string,
    liveLogFromDrafts: LiveLogSession,
    message = "話者付きログへ取り込みました。",
    transcriptionRun?: TranscriptionRun,
  ): void => {
    updateSessionById(targetSessionId, { liveLog: liveLogFromDrafts, ...(transcriptionRun ? { transcriptionRun } : {}) });
    setActiveCampaignState((current) =>
      current.activeSessionId === targetSessionId || !current.sessions.some((session) => session.id === targetSessionId)
        ? current
        : { ...current, activeSessionId: targetSessionId },
    );
    setTranscriptionAudioFile(null);
    setTranscriptionDraftJson("");
    setTranscriptionImportError(null);
    setTranscriptionImportMessage(message);
    setLogInputMode("speaker");
  };

  const importTranscriptionDraftsToLiveLog = (
    drafts: Parameters<typeof transcriptionDraftsToLiveLog>[0],
    message?: string,
    transcriptionRun?: TranscriptionRun,
    targetSession = currentSession,
  ): void => {
    const liveLogFromDrafts = transcriptionDraftsToLiveLog(
      drafts,
      `${targetSession.title} 文字起こし`,
    );
    if (!liveLogFromDrafts) {
      setTranscriptionImportError("取り込める発話本文がありません。");
      setTranscriptionImportMessage(null);
      return;
    }

    if (targetSession.liveLog.segments.some((segment) => segment.text.trim())) {
      setConfirmation({
        title: "話者ログを置き換えますか",
        message: "現在の話者ログを、文字起こしドラフトから作成したログで置き換えます。",
        confirmLabel: "置き換える",
        onConfirm: () => applyImportedTranscriptionDraftLog(targetSession.id, liveLogFromDrafts, message, transcriptionRun),
      });
      return;
    }

    applyImportedTranscriptionDraftLog(targetSession.id, liveLogFromDrafts, message, transcriptionRun);
  };

  const appendTranscriptionDraftJson = async (): Promise<void> => {
    const targetSession = currentSession;
    const providerResult = await runTranscriptionProvider({
      draftJson: transcriptionDraftJson,
      secrets: providerSecrets,
      settings: transcriptionProvider,
    });

    if (!providerResult.ok) {
      setTranscriptionImportError(providerResult.message || "追記できる発話ドラフトがありません。");
      setTranscriptionImportMessage(null);
      return;
    }

    const appendedLiveLog = appendTranscriptionDraftsToLiveLog(targetSession.liveLog, providerResult.drafts);
    if (!appendedLiveLog) {
      setTranscriptionImportError("追記できる発話本文がありません。");
      setTranscriptionImportMessage(null);
      return;
    }

    updateSessionById(targetSession.id, {
      liveLog: appendedLiveLog,
      transcriptionRun: {
        executedAt: new Date().toISOString(),
        providerId: transcriptionProvider.providerId,
        providerLabel: providerResult.providerLabel,
        segmentCount: providerResult.drafts.length,
        sourceType: "manual-json",
      },
    });
    setActiveCampaignState((current) =>
      current.activeSessionId === targetSession.id || !current.sessions.some((session) => session.id === targetSession.id)
        ? current
        : { ...current, activeSessionId: targetSession.id },
    );
    setTranscriptionDraftJson("");
    setTranscriptionImportError(null);
    setTranscriptionImportMessage(providerResult.message);
    setLogInputMode("speaker");
  };

  const importTranscriptionDraftJson = async (): Promise<void> => {
    const targetSession = currentSession;
    const providerResult = await runTranscriptionProvider({
      draftJson: transcriptionDraftJson,
      secrets: providerSecrets,
      settings: transcriptionProvider,
    });

    if (!providerResult.ok) {
      setTranscriptionImportError(providerResult.message || "文字起こしドラフトを読み込めません。");
      return;
    }

    importTranscriptionDraftsToLiveLog(providerResult.drafts, providerResult.message, {
      executedAt: new Date().toISOString(),
      providerId: transcriptionProvider.providerId,
      providerLabel: providerResult.providerLabel,
      segmentCount: providerResult.drafts.length,
      sourceType: "manual-json",
    }, targetSession);
  };

  const transcribeSelectedAudioFile = async (): Promise<void> => {
    if (!transcriptionAudioFile) {
      setTranscriptionImportError("音声ファイルを選択してください。");
      setTranscriptionImportMessage(null);
      return;
    }

    setIsExtracting(true);
    const targetSession = currentSession;
    const audioFile = transcriptionAudioFile;
    try {
      const providerResult = await runTranscriptionProvider({
        audioFile,
        secrets: providerSecrets,
        settings: transcriptionProvider,
      });

      if (!providerResult.ok) {
        setTranscriptionImportError(providerResult.message || "音声ファイルを文字起こしできません。");
        setTranscriptionImportMessage(null);
        return;
      }

      importTranscriptionDraftsToLiveLog(providerResult.drafts, providerResult.message, {
        executedAt: new Date().toISOString(),
        fileName: audioFile.name,
        providerId: transcriptionProvider.providerId,
        providerLabel: providerResult.providerLabel,
        segmentCount: providerResult.drafts.length,
        sourceType: "audio-file",
      }, targetSession);
    } finally {
      setIsExtracting(false);
    }
  };

  const importTranscriptionDraftFile = async (file: File): Promise<void> => {
    try {
      const fileText = await file.text();
      JSON.parse(fileText);
      setTranscriptionDraftJson(fileText);
      setTranscriptionImportError(null);
    } catch {
      setTranscriptionImportError("JSONファイルとして読み込めません。");
    }
  };

  const updateSpeakerName = (speakerId: string, name: string): void => {
    updateLiveLog((current) => ({
      ...current,
      speakers: current.speakers.map((speaker) => (speaker.id === speakerId ? { ...speaker, name } : speaker)),
    }));
  };

  const normalizeSpeakerName = (speakerId: string, name: string): void => {
    updateSpeakerName(speakerId, name.trim() || "話者不明");
  };

  const addSpeaker = (): void => {
    updateLiveLog((current) => ({
      ...current,
      speakers: [
        ...current.speakers,
        {
          id: createId("speaker"),
          name: `話者${current.speakers.length + 1}`,
          role: "PL",
        },
      ],
    }));
  };

  const deleteSpeaker = (speakerId: string): void => {
    updateLiveLog((current) => {
      const isSpeakerUsed = current.segments.some((segment) => segment.speakerId === speakerId);
      if (isSpeakerUsed || current.speakers.length <= 1) {
        return current;
      }

      return {
        ...current,
        speakers: current.speakers.filter((speaker) => speaker.id !== speakerId),
      };
    });
  };

  const updateSpeakerRole = (speakerId: string, role: SpeakerRole): void => {
    updateLiveLog((current) => ({
      ...current,
      speakers: current.speakers.map((speaker) => (speaker.id === speakerId ? { ...speaker, role } : speaker)),
    }));
  };

  const updateSegment = (segmentId: string, updates: Partial<TranscriptSegment>): void => {
    updateLiveLog((current) => ({
      ...current,
      segments: current.segments.map((segment) => {
        if (segment.id !== segmentId) {
          return segment;
        }

        const nextSegment = { ...segment, ...updates };
        const normalizedStartTimeSec = Number.isFinite(nextSegment.startTimeSec)
          ? nextSegment.startTimeSec
          : segment.startTimeSec;
        const normalizedEndTimeSec = Number.isFinite(nextSegment.endTimeSec)
          ? nextSegment.endTimeSec
          : segment.endTimeSec;
        const startTimeSec = Math.max(0, Math.round(normalizedStartTimeSec));
        const endTimeSec = Math.max(startTimeSec + 1, Math.round(normalizedEndTimeSec));

        return {
          ...nextSegment,
          startTimeSec,
          endTimeSec,
        };
      }),
    }));
  };

  const addSegment = (): void => {
    updateLiveLog((current) => {
      const sortedSegments = [...current.segments].sort((first, second) => first.endTimeSec - second.endTimeSec);
      const lastSegment = sortedSegments[sortedSegments.length - 1];
      const startTimeSec = lastSegment ? lastSegment.endTimeSec + 1 : 0;
      const fallbackSpeaker = {
        id: createId("speaker"),
        name: "GM",
        role: "GM" as SpeakerRole,
      };
      const speakers = current.speakers.length > 0 ? current.speakers : [fallbackSpeaker];

      return {
        ...current,
        speakers,
        segments: [
          ...current.segments,
          {
            id: createId("segment"),
            speakerId: speakers[0].id,
            startTimeSec,
            endTimeSec: startTimeSec + 5,
            text: "",
          },
        ],
      };
    });
  };

  const addSegmentAfter = (segmentId: string): void => {
    updateLiveLog((current) => {
      const targetSegment = current.segments.find((segment) => segment.id === segmentId);
      if (!targetSegment) {
        return current;
      }

      const newSegment: TranscriptSegment = {
        id: createId("segment"),
        speakerId: targetSegment.speakerId,
        startTimeSec: targetSegment.endTimeSec + 1,
        endTimeSec: targetSegment.endTimeSec + 6,
        text: "",
      };
      const targetIndex = current.segments.findIndex((segment) => segment.id === segmentId);

      return {
        ...current,
        segments: [
          ...current.segments.slice(0, targetIndex + 1),
          newSegment,
          ...current.segments.slice(targetIndex + 1),
        ],
      };
    });
  };

  const deleteSegment = (segmentId: string): void => {
    updateLiveLog((current) => ({
      ...current,
      segments: current.segments.filter((segment) => segment.id !== segmentId),
    }));
  };

  const deleteEmptySegments = (): void => {
    const emptyCount = currentSession.liveLog.segments.filter((segment) => segment.text.trim().length === 0).length;
    if (emptyCount === 0) {
      return;
    }

    setConfirmation({
      title: "未入力の発話を削除しますか",
      message: `${emptyCount}件の本文が空の発話を削除します。`,
      confirmLabel: "削除する",
      onConfirm: () => {
        updateLiveLog((current) => ({
          ...current,
          segments: current.segments.filter((segment) => segment.text.trim().length > 0),
        }));
      },
    });
  };

  const duplicateSegment = (segmentId: string): void => {
    updateLiveLog((current) => {
      const targetIndex = current.segments.findIndex((segment) => segment.id === segmentId);
      const targetSegment = current.segments[targetIndex];
      if (!targetSegment) {
        return current;
      }

      const duplicatedSegment: TranscriptSegment = {
        ...targetSegment,
        id: createId("segment"),
        startTimeSec: targetSegment.endTimeSec + 1,
        endTimeSec: targetSegment.endTimeSec + Math.max(1, targetSegment.endTimeSec - targetSegment.startTimeSec) + 1,
      };

      return {
        ...current,
        segments: [
          ...current.segments.slice(0, targetIndex + 1),
          duplicatedSegment,
          ...current.segments.slice(targetIndex + 1),
        ],
      };
    });
  };

  const splitSegment = (segmentId: string): void => {
    updateLiveLog((current) => splitTranscriptSegment(current, segmentId));
  };

  const approveItem = (item: ExtractionItem): void => {
    if (approvedIds.includes(item.id) || !item.title.trim() || !item.detail.trim()) {
      return;
    }
    setActiveCampaignState((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === current.activeSessionId
          ? {
              ...session,
              approvedIds: [...session.approvedIds, item.id],
            }
          : session,
      ),
      chronicle: applyExtraction(current.chronicle, item),
    }));
  };

  const approveRemainingItems = (targetItemIds?: Set<string>): void => {
    setActiveCampaignState((current) => {
      const session = current.sessions.find((candidate) => candidate.id === current.activeSessionId);
      if (!session) {
        return current;
      }

      const nextApprovedIds = [...session.approvedIds];
      let nextChronicle = current.chronicle;
      session.extractionItems.forEach((item) => {
        if (targetItemIds && !targetItemIds.has(item.id)) {
          return;
        }

        if (nextApprovedIds.includes(item.id) || !item.title.trim() || !item.detail.trim()) {
          return;
        }

        nextApprovedIds.push(item.id);
        nextChronicle = applyExtraction(nextChronicle, item);
      });

      return {
        ...current,
        chronicle: nextChronicle,
        sessions: current.sessions.map((candidate) =>
          candidate.id === session.id ? { ...session, approvedIds: nextApprovedIds } : candidate,
        ),
      };
    });
  };

  const rejectReviewItems = (targetIds: Set<string>, label: string): void => {
    const removedItems = buildReviewRemovalBatch(items, targetIds);
    if (removedItems.length === 0) {
      return;
    }

    setLastRejectedReviewBatch({ sessionId: currentSession.id, label, removedItems });
    updateActiveSession((session) => ({
      ...session,
      approvedIds: session.approvedIds,
      extractionItems: session.extractionItems.filter((item) => !targetIds.has(item.id)),
    }));
  };

  const restoreLastRejectedReviewBatch = (): void => {
    if (!activeRejectedReviewBatch) {
      return;
    }

    updateActiveSession((session) => ({
      ...session,
      extractionItems: restoreReviewItems(session.extractionItems, activeRejectedReviewBatch.removedItems),
    }));
    setLastRejectedReviewBatch(null);
  };

  const rejectItem = (itemId: string): void => {
    if (approvedIds.includes(itemId)) {
      return;
    }

    rejectReviewItems(new Set([itemId]), "候補1件");
  };

  const rejectVisibleItems = (): void => {
    const targetIds = new Set(reviewItems.filter((item) => !approvedIds.includes(item.id)).map((item) => item.id));
    if (targetIds.size === 0) {
      return;
    }

    setConfirmation({
      title: "表示中の候補を破棄しますか",
      message: `${targetIds.size}件の未採用候補を抽出候補から削除します。採用済みの候補は残します。`,
      confirmLabel: "破棄する",
      onConfirm: () => {
        rejectReviewItems(targetIds, `表示中の候補${targetIds.size}件`);
      },
    });
  };

  const rejectInvalidReviewItems = (): void => {
    const targetIds = new Set(
      items
        .filter((item) => !approvedIds.includes(item.id) && (!item.title.trim() || !item.detail.trim()))
        .map((item) => item.id),
    );
    if (targetIds.size === 0) {
      return;
    }

    setConfirmation({
      title: "未入力候補を破棄しますか",
      message: `${targetIds.size}件のタイトルまたは詳細が未入力の候補を削除します。採用済みの候補は残します。`,
      confirmLabel: "破棄する",
      onConfirm: () => {
        rejectReviewItems(targetIds, `未入力候補${targetIds.size}件`);
      },
    });
  };

  const rejectDuplicateReviewItems = (): void => {
    if (duplicateReviewItemIds.length === 0) {
      return;
    }

    setConfirmation({
      title: "重複候補を破棄しますか",
      message: `${duplicateReviewItemIds.length}件の未採用の重複候補を削除します。`,
      confirmLabel: "破棄する",
      onConfirm: () => {
        rejectReviewItems(new Set(duplicateReviewItemIds), `重複候補${duplicateReviewItemIds.length}件`);
      },
    });
  };

  const normalizeReviewItemText = (): void => {
    updateActiveSession((session) => ({
      ...session,
      extractionItems: session.extractionItems.map((item) =>
        session.approvedIds.includes(item.id) ? item : normalizeExtractionItemText(item),
      ),
    }));
  };

  const updateExtractionItem = (itemId: string, updates: Partial<ExtractionItem>): void => {
    updateActiveSession((session) => ({
      ...session,
      extractionItems: session.approvedIds.includes(itemId)
        ? session.extractionItems
        : session.extractionItems.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
    }));
  };

  const updateClueStatus = (clueIndex: number, status: ClueStatus): void => {
    setActiveCampaignState((current) => ({
      ...current,
      chronicle: {
        ...current.chronicle,
        clues: current.chronicle.clues.map((clue, index) =>
          index === clueIndex ? { ...clue, status } : clue,
        ),
      },
    }));
  };

  const updateNpcAttitude = (npcIndex: number, attitude: string): void => {
    setActiveCampaignState((current) => ({
      ...current,
      chronicle: {
        ...current.chronicle,
        npcs: current.chronicle.npcs.map((npc, index) =>
          index === npcIndex ? { ...npc, attitude } : npc,
        ),
      },
    }));
  };

  const updateThreadNextMove = (threadIndex: number, nextMove: string): void => {
    setActiveCampaignState((current) => ({
      ...current,
      chronicle: {
        ...current.chronicle,
        threads: current.chronicle.threads.map((thread, index) =>
          index === threadIndex ? { ...thread, nextMove } : thread,
        ),
      },
    }));
  };

  const resetUiPreferences = (): void => {
    setActiveTab(defaultUiPreferences.activeTab);
    setChronicleClueStatusFilter("all");
    setChronicleViewMode(defaultUiPreferences.chronicleViewMode);
    setIsFocusMode(defaultUiPreferences.isFocusMode);
    setLogInputMode(defaultUiPreferences.logInputMode);
    setLogWorkspaceMode(defaultUiPreferences.logWorkspaceMode);
    setNavigationPanelMode(defaultUiPreferences.navigationPanelMode);
    setPrepWorkspaceMode(defaultUiPreferences.prepWorkspaceMode);
    setReviewSortMode(defaultUiPreferences.reviewSortMode);
    setReviewWorkspaceMode(defaultUiPreferences.reviewWorkspaceMode);
    setRightPanelMode(defaultUiPreferences.rightPanelMode);
    setSessionArchiveFilter(defaultUiPreferences.sessionArchiveFilter);
    setSessionSortMode(defaultUiPreferences.sessionSortMode);
    setSessionTranscriptionFilter(defaultUiPreferences.sessionTranscriptionFilter);
    setSettingsPanelMode(defaultUiPreferences.settingsPanelMode);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div
        className={
          isFocusMode
            ? "grid min-h-screen grid-cols-1"
            : "grid min-h-screen grid-cols-[260px_1fr_320px] max-xl:grid-cols-[220px_1fr] max-lg:grid-cols-1"
        }
      >
        {!isFocusMode && (
        <aside className="border-r bg-sidebar px-4 py-5 max-lg:border-b max-lg:border-r-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Chronicle GM</p>
              <p className="text-xs text-muted-foreground">
                {findOptionLabel(campaignModeOptions, campaignMode, "調査")} mode
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Tabs
              ariaLabel="左ナビゲーション"
              value={navigationPanelMode}
              options={navigationPanelOptions}
              onChange={setNavigationPanelMode}
            />
          </div>

          {navigationPanelMode === "campaigns" && (
          <>
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground">キャンペーン一覧</p>
                {normalizedCampaignQuery && (
                  <Badge variant="muted">{visibleCampaigns.length}/{campaignLibrary.campaigns.length}</Badge>
                )}
              </div>
              <Button disabled={isExtracting} onClick={addNewCampaign} size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5" />
                新規
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="キャンペーンを検索"
                className="pl-8"
                disabled={isExtracting}
                placeholder="キャンペーン名・記憶で検索"
                value={campaignQuery}
                onChange={(event) => setCampaignQuery(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              {visibleCampaigns.map((campaign) => (
                (() => {
                  const stats = getCampaignSummaryStats(campaign);
                  const campaignRisk = campaignOperationalRisks.get(campaign.id);
                  const campaignStorageBytes = campaignRisk?.storageBytes ?? 0;
                  const campaignReviewDebt = campaignRisk?.reviewDebt ?? 0;

                  return (
                    <div
                      className={
                        campaign.id === campaignState.id
                          ? "flex items-center gap-1 rounded-md bg-primary px-2 py-2 text-sm text-primary-foreground"
                          : "flex items-center gap-1 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      }
                      key={campaign.id}
                    >
                      <button className="min-w-0 flex-1 text-left" onClick={() => switchCampaign(campaign.id)} type="button">
                        <span className="block truncate font-medium">{campaign.campaignName}</span>
                        <span
                          className={
                            campaign.id === campaignState.id
                              ? "block text-xs opacity-80"
                              : "block text-xs text-muted-foreground"
                          }
                        >
                          {stats.sessionCount}セッション / {stats.memoryCount}記憶 / {stats.candidateCount}候補 /{" "}
                          {stats.approvedCount}採用
                          {campaign.campaignMode === "fantasy" ? " / ファンタジー" : " / 調査"}
                          {stats.archivedSessionCount > 0 ? ` / アーカイブ${stats.archivedSessionCount}` : ""}
                          {stats.transcribedSessionCount > 0 ? ` / 文字起こし${stats.transcribedSessionCount}` : ""}
                          {stats.lowConfidenceSegmentCount > 0 ? ` / 要確認${stats.lowConfidenceSegmentCount}` : ""}
                          {campaignReviewDebt > 0 ? ` / レビュー品質${campaignReviewDebt}` : ""}
                          {campaignStorageBytes > 0 ? ` / ${formatFileSize(campaignStorageBytes)}` : ""}
                        </span>
                      </button>
                      <Button
                        aria-label={`${campaign.campaignName}を複製`}
                        disabled={isExtracting}
                        onClick={() => duplicateCampaign(campaign.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={`${campaign.campaignName}を削除`}
                        disabled={isExtracting || campaignLibrary.campaigns.length <= 1}
                        onClick={() => deleteCampaign(campaign.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })()
              ))}
              {visibleCampaigns.length === 0 && (
                <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  条件に一致するキャンペーンはありません。
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor={campaignNameInputId}>
              キャンペーン名
            </label>
            <Input
              disabled={isExtracting}
              id={campaignNameInputId}
              value={campaignName}
              onBlur={(event) => updateCampaignState({ campaignName: event.target.value.trim() || "無題キャンペーン" })}
              onChange={(event) => updateCampaignState({ campaignName: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              {campaignModeOptions.map((option) => (
                <Button
                  className="h-auto flex-col items-start gap-1 whitespace-normal px-3 py-2 text-left"
                  disabled={isExtracting}
                  key={option.value}
                  onClick={() => updateCampaignState({ campaignMode: option.value })}
                  size="sm"
                  variant={campaignMode === option.value ? "default" : "outline"}
                >
                  <span>{option.label}</span>
                  <span className="text-[11px] font-normal opacity-80">{option.description}</span>
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={exportCampaignState} size="sm" variant="outline">
                <Download className="h-3.5 w-3.5" />
                現在を書き出し
              </Button>
              <Button onClick={exportCampaignMarkdown} size="sm" variant="outline">
                <FileText className="h-3.5 w-3.5" />
                現在の要約
              </Button>
              <Button onClick={exportCampaignLibrary} size="sm" variant="outline">
                <Download className="h-3.5 w-3.5" />
                全体を書き出し
              </Button>
              <Button onClick={exportCampaignLibraryMarkdown} size="sm" variant="outline">
                <FileText className="h-3.5 w-3.5" />
                目録を書き出し
              </Button>
              <label
                className={
                  isExtracting
                    ? "inline-flex h-8 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium opacity-50"
                    : "inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                }
                htmlFor={campaignImportInputId}
              >
                <Upload className="h-3.5 w-3.5" />
                JSON読み込み
                <input
                  accept="application/json,.json"
                  className="sr-only"
                  disabled={isExtracting}
                  id={campaignImportInputId}
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) {
                      void importCampaignState(file);
                    }
                  }}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="muted">ローカル自動保存</Badge>
              <Badge variant={storageUsagePercent !== null && storageUsagePercent >= 80 ? "destructive" : "muted"}>
                保存 {formatFileSize(storageHealth.libraryBytes)}
                {storageUsagePercent !== null ? ` / ${storageUsagePercent}%` : ""}
              </Badge>
              <Badge variant={backupStatus.needsBackup ? "destructive" : "muted"}>{backupStatus.label}</Badge>
              {largestSessionStorageDiagnostic && (
                <Badge variant="outline">
                  最大セッション {formatFileSize(largestSessionStorageDiagnostic.totalBytes)}
                </Badge>
              )}
              <Badge variant="outline">APIキーは書き出し対象外</Badge>
            </div>
            {storageError ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                role="alert"
              >
                <p className="font-medium">保存状態を確認してください</p>
                <p className="mt-1 leading-relaxed">{storageError}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                この端末のブラウザに保存中。キャンペーン、ライブラリ、セッションJSONを読み込めます。
              </p>
            )}
          </div>
          </>
          )}

          {navigationPanelMode === "sessions" && (
          <>
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">セッション</label>
                {(normalizedSessionQuery || sessionTranscriptionFilter !== "all" || sessionArchiveFilter !== "active") && (
                  <Badge variant="muted">{visibleSessions.length}/{campaignState.sessions.length}</Badge>
                )}
              </div>
              <Button disabled={isExtracting} onClick={addNewSession} size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5" />
                追加
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="セッションを検索"
                className="pl-8"
                disabled={isExtracting}
                placeholder="タイトル・日付・ログで検索"
                value={sessionQuery}
                onChange={(event) => setSessionQuery(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {sessionArchiveOptions.map((option) => (
                <Button
                  disabled={isExtracting}
                  key={option.value}
                  onClick={() => setSessionArchiveFilter(option.value)}
                  size="sm"
                  variant={sessionArchiveFilter === option.value ? "default" : "outline"}
                >
                  {option.label}
                </Button>
              ))}
              {[
                { value: "all", label: "すべて" },
                { value: "transcribed", label: "文字起こし済み" },
                { value: "untranscribed", label: "未文字起こし" },
              ].map((option) => (
                <Button
                  disabled={isExtracting}
                  key={option.value}
                  onClick={() => setSessionTranscriptionFilter(option.value as SessionTranscriptionFilter)}
                  size="sm"
                  variant={sessionTranscriptionFilter === option.value ? "default" : "outline"}
                >
                  {option.label}
                </Button>
              ))}
              <select
                aria-label="セッションの並び順"
                className="h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={isExtracting}
                value={sessionSortMode}
                onChange={(event) => setSessionSortMode(event.target.value as SessionSortMode)}
              >
                {sessionSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    並び: {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              {visibleSessions.map((session) => (
                (() => {
                  const liveLogSummary = summarizeLiveLog(session.liveLog);
                  const speakerIssueCount = getSpeakerLogIssues(session.liveLog).length;
                  const sizeDiagnostic = sessionStorageDiagnosticById.get(session.id);

                  return (
                    <div
                      className={
                        session.id === campaignState.activeSessionId
                          ? "flex items-center gap-1 rounded-md bg-primary px-2 py-2 text-sm text-primary-foreground"
                          : "flex items-center gap-1 rounded-md px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      }
                      key={session.id}
                    >
                      <button className="min-w-0 flex-1 text-left" onClick={() => switchSession(session.id)} type="button">
                        <span className="block truncate font-medium">{session.title}</span>
                        <span
                          className={
                            session.id === campaignState.activeSessionId
                              ? "block text-xs opacity-80"
                              : "block text-xs text-muted-foreground"
                          }
                        >
                          {session.date} / {session.approvedIds.length}採用 / {session.extractionItems.length}候補 /{" "}
                          {liveLogSummary.nonEmptySegmentCount}発話
                          {liveLogSummary.averageConfidence !== null
                            ? ` / 平均${Math.round(liveLogSummary.averageConfidence * 100)}%`
                            : ""}
                          {liveLogSummary.lowConfidenceCount > 0 ? ` / 要確認${liveLogSummary.lowConfidenceCount}` : ""}
                          {speakerIssueCount > 0 ? ` / ログ確認${speakerIssueCount}` : ""}
                          {session.transcriptionRun ? ` / 文字起こし${session.transcriptionRun.segmentCount}` : ""}
                          {sizeDiagnostic ? ` / ${formatFileSize(sizeDiagnostic.totalBytes)}` : ""}
                          {session.archivedAt ? " / アーカイブ" : ""}
                        </span>
                        {sizeDiagnostic && (
                          <span
                            className={
                              session.id === campaignState.activeSessionId
                                ? "mt-1 block text-[11px] opacity-75"
                                : "mt-1 block text-[11px] text-muted-foreground"
                            }
                          >
                            通常 {formatFileSize(sizeDiagnostic.logBytes)} / 話者{" "}
                            {formatFileSize(sizeDiagnostic.speakerLogBytes)} / レビュー{" "}
                            {formatFileSize(sizeDiagnostic.reviewBytes)} / 文字起こし{" "}
                            {formatFileSize(sizeDiagnostic.transcriptionBytes)}
                          </span>
                        )}
                      </button>
                      <Button
                        aria-label={`${session.title}を書き出し`}
                        disabled={isExtracting}
                        onClick={() => exportSessionMarkdown(session)}
                        size="icon"
                        variant="ghost"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={`${session.title}をJSONで書き出し`}
                        disabled={isExtracting}
                        onClick={() => exportSessionJson(session)}
                        size="icon"
                        variant="ghost"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={`${session.title}を複製`}
                        disabled={isExtracting}
                        onClick={() => duplicateSession(session.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={session.archivedAt ? `${session.title}を有効化` : `${session.title}をアーカイブ`}
                        disabled={isExtracting || (!session.archivedAt && activeSessionCount <= 1)}
                        onClick={() => setSessionArchived(session.id, !session.archivedAt)}
                        size="icon"
                        variant="ghost"
                      >
                        {session.archivedAt ? <RotateCcw className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                      </Button>
                      {!session.archivedAt && (
                        <Button
                          aria-label={`${session.title}を書き出してアーカイブ`}
                          disabled={isExtracting || activeSessionCount <= 1}
                          onClick={() => exportAndArchiveSession(session.id)}
                          size="icon"
                          variant="ghost"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        aria-label={`${session.title}を削除`}
                        disabled={isExtracting || campaignState.sessions.length <= 1}
                        onClick={() => deleteSession(session.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })()
              ))}
              {visibleSessions.length === 0 && (
                <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                  条件に一致するセッションはありません。
                </p>
              )}
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {[
              { icon: Search, label: memoryNavLabels.clues, count: chronicle.clues.length, viewMode: "clues" },
              { icon: UserRound, label: "NPC", count: chronicle.npcs.length, viewMode: "npcs" },
              { icon: MapIcon, label: memoryNavLabels.locations, count: chronicle.locations.length, viewMode: "locations" },
              { icon: Clock3, label: "年表", count: chronicle.events.length, viewMode: "events" },
              { icon: Sparkles, label: memoryNavLabels.threads, count: chronicle.threads.length, viewMode: "threads" },
            ].map((item) => (
              <button
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                key={item.label}
                onClick={() => {
                  setChronicleClueStatusFilter("all");
                  setChronicleViewMode(item.viewMode as ChronicleViewMode);
                  setActiveTab("chronicle");
                }}
                type="button"
              >
                <span className="flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </span>
                <Badge variant="muted">{item.count}</Badge>
              </button>
            ))}
          </nav>

          <div className="mt-6 rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">承認進捗</span>
              <span className="text-muted-foreground">{items.length === 0 ? "未抽出" : `${progress}%`}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {approvedCount}件承認済み、{remainingCount}件が未処理です。
            </p>
          </div>
          </>
          )}
        </aside>
        )}

        <section className="min-w-0 px-6 py-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">{campaignName}</h1>
              <p className="text-sm text-muted-foreground">
                {campaignModeDescriptions[campaignMode]}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {findOptionLabel(campaignModeOptions, campaignMode, "調査")}
                </Badge>
                <Badge variant="outline">現在: {activeWorkspaceLabel}</Badge>
                {!isFocusMode && <Badge variant="muted">{sideWorkspaceLabel}</Badge>}
                {isFocusMode && <Badge variant="muted">集中表示</Badge>}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={sessionTitleInputId}>
                    今回のセッション
                  </label>
                  <Input
                    className="mt-1 w-44"
                    disabled={isExtracting}
                    id={sessionTitleInputId}
                    value={currentSession.title}
                    onBlur={(event) => updateCurrentSession({ title: event.target.value.trim() || "無題セッション" })}
                    onChange={(event) => updateCurrentSession({ title: event.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={sessionDateInputId}>
                    日付
                  </label>
                  <Input
                    className="mt-1 w-40"
                    disabled={isExtracting}
                    id={sessionDateInputId}
                    type="date"
                    value={currentSession.date}
                    onBlur={(event) =>
                      updateCurrentSession({ date: event.target.value || getLocalDateString() })
                    }
                    onChange={(event) => updateCurrentSession({ date: event.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tabs ariaLabel="ワークスペース" value={activeTab} options={tabOptions} onChange={setActiveTab} />
              <Button onClick={() => setIsFocusMode((current) => !current)} size="sm" variant="outline">
                {isFocusMode ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                {isFocusMode ? "通常表示" : "集中表示"}
              </Button>
              <Button onClick={resetUiPreferences} size="sm" variant="ghost">
                <RotateCcw className="h-4 w-4" />
                表示初期化
              </Button>
            </div>
          </header>

          <div className="mt-5">
            {activeTab === "home" && (
              <HomeDashboard
                approvedCount={approvedCount}
                canExtractLog={canExtractLog}
                campaignMode={campaignMode}
                currentLiveLogSummary={currentLiveLogSummary}
                currentSession={currentSession}
                currentSpeakerIssueCount={currentSpeakerIssueCount}
                duplicateReviewItemCount={duplicateReviewItemCount}
                extractionProviderReady={extractionProviderReady}
                extractionPromptLength={extractionPromptLength}
                hasPrepContent={hasPrepContent}
                hiddenClueCount={hiddenClueCount}
                invalidReviewItemCount={invalidReviewItemCount}
                isExtracting={isExtracting}
                memoryItemCount={memoryItemCount}
                remainingCount={remainingCount}
                reviewItemCount={items.length}
                reviewQualityDebtCount={reviewQualityDebtCount}
                sessionCount={campaignState.sessions.length}
                storageUsagePercent={storageUsagePercent}
                backupStatus={backupStatus}
                transcriptionProviderReady={transcriptionProviderReadiness.ok}
                onExtract={runExtractionPreview}
                onExportCurrentSessionMarkdown={exportCurrentSessionMarkdown}
                onLoadDemo={() => {
                  setIsFocusMode(false);
                  restoreSampleLiveLog();
                  setLogInputMode("speaker");
                  setLogWorkspaceMode("editor");
                  setActiveTab("log");
                }}
                onOpenExtractionProviderSettings={() => {
                  setIsFocusMode(false);
                  setRightPanelMode("settings");
                  setSettingsPanelMode("extraction");
                }}
                onOpenTranscriptionProviderSettings={() => {
                  setIsFocusMode(false);
                  setRightPanelMode("settings");
                  setSettingsPanelMode("transcription");
                }}
                onOpenLogEditor={() => {
                  setLogWorkspaceMode("editor");
                  setActiveTab("log");
                }}
                onOpenTranscriptionImport={() => {
                  setLogInputMode("speaker");
                  setLogWorkspaceMode("transcription");
                  setActiveTab("log");
                }}
                onOpenPrepHooks={() => {
                  setPrepWorkspaceMode("hooks");
                  setActiveTab("prep");
                }}
                onOpenReviewInspect={() => {
                  setReviewWorkspaceMode("inspect");
                  setActiveTab("review");
                }}
                onOpenReviewQuality={() => {
                  if (currentReviewQualityDiagnostic) {
                    setShowInvalidReviewItemsOnly(currentReviewQualityDiagnostic.pendingInvalidCount > 0);
                    setShowDuplicateReviewItemsOnly(
                      currentReviewQualityDiagnostic.pendingInvalidCount === 0 &&
                        currentReviewQualityDiagnostic.pendingDuplicateCount > 0,
                    );
                    setReviewWorkspaceMode("manage");
                    setActiveTab("review");
                    return;
                  }

                  setIsFocusMode(false);
                  setNavigationPanelMode("sessions");
                }}
                onOpenDuplicateReviewItems={() => {
                  setShowDuplicateReviewItemsOnly(true);
                  setShowInvalidReviewItemsOnly(false);
                  setReviewWorkspaceMode("manage");
                  setActiveTab("review");
                }}
                onOpenInvalidReviewItems={() => {
                  setShowDuplicateReviewItemsOnly(false);
                  setShowInvalidReviewItemsOnly(true);
                  setReviewWorkspaceMode("manage");
                  setActiveTab("review");
                }}
                onOpenSpeakerLogIssues={() => {
                  setLogInputMode("speaker");
                  setLogWorkspaceMode("editor");
                  setActiveTab("log");
                }}
                onOpenHiddenClues={() => {
                  setChronicleClueStatusFilter("hidden");
                  setChronicleViewMode("clues");
                  setActiveTab("chronicle");
                }}
                onOpenChronicleOverview={() => {
                  setChronicleClueStatusFilter("all");
                  setChronicleViewMode("overview");
                  setActiveTab("chronicle");
                }}
                onOpenSessionList={() => {
                  setIsFocusMode(false);
                  setNavigationPanelMode("sessions");
                }}
                onOpenStorageSettings={() => {
                  setIsFocusMode(false);
                  setNavigationPanelMode("campaigns");
                  setRightPanelMode("settings");
                  setSettingsPanelMode("roadmap");
                }}
              />
            )}

            {activeTab === "log" && (
              <div className="grid gap-4">
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">ログ作業</p>
                      <p className="text-xs text-muted-foreground">
                        セッションログの整備と文字起こし取り込みを分けて扱います。
                      </p>
                    </div>
                    <Tabs
                      ariaLabel="ログ作業"
                      value={logWorkspaceMode}
                      options={logWorkspaceOptions}
                      onChange={setLogWorkspaceMode}
                    />
                  </CardContent>
                </Card>

                {logWorkspaceMode === "editor" && (
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          セッションログ
                        </CardTitle>
                        <CardDescription className="mt-2">
                          初期MVPでは貼り付け入力に絞ります。ココフォリアやDiscordログの取り込みは後から足せます。
                        </CardDescription>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant={logInputMode === "speaker" ? "default" : "outline"}>
                            {logInputMode === "speaker" ? "抽出元: 話者付きログ" : "抽出元: 通常ログ"}
                          </Badge>
                          <Badge variant={extractionPromptLength > 30000 ? "destructive" : "muted"}>
                            prompt {extractionPromptLength.toLocaleString()}文字
                          </Badge>
                          {logInputMode === "speaker" && (
                            <Badge variant="muted">{summarizeLiveLog(liveLog).nonEmptySegmentCount}発話</Badge>
                          )}
                        </div>
                      </div>
                      <Tabs ariaLabel="ログ入力方式" value={logInputMode} options={logInputOptions} onChange={setLogInputMode} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {logInputMode === "plain" ? (
                      <PlainLogEditor
                        canExtract={canExtractLog}
                        isExtracting={isExtracting}
                        log={log}
                        onChange={(nextLog) => updateCurrentSession({ log: nextLog })}
                        onExtract={runExtractionPreview}
                        onImportToSpeakerLog={importPlainLogToLiveLog}
                        onReset={resetCampaignState}
                      />
                    ) : (
                      <SpeakerLogEditor
                        canExtract={canExtractLog}
                        isExtracting={isExtracting}
                        liveLog={liveLog}
                        onAddSegment={addSegment}
                        onAddSegmentAfter={addSegmentAfter}
                        onAddSpeaker={addSpeaker}
                        onApplyToPlainLog={applyLiveLogToPlainLog}
                        onDeleteSpeaker={deleteSpeaker}
                        onDeleteEmptySegments={deleteEmptySegments}
                        onDeleteSegment={deleteSegment}
                        onDuplicateSegment={duplicateSegment}
                        onExtract={runExtractionPreview}
                        onExportIssues={exportSpeakerLogIssues}
                        onExportVisibleSegments={exportVisibleSpeakerSegments}
                        onMergeAdjacentSegments={mergeAdjacentSpeakerLogSegments}
                        onNormalizeText={normalizeSpeakerLogText}
                        onNormalizeTiming={normalizeSpeakerLogTiming}
                        onReset={resetCampaignState}
                        onRestoreSample={restoreSampleLiveLog}
                        onSplitSegment={splitSegment}
                        onUpdateSegment={updateSegment}
                        onNormalizeSpeakerName={normalizeSpeakerName}
                        onUpdateSpeakerName={updateSpeakerName}
                        onUpdateSpeakerRole={updateSpeakerRole}
                      />
                    )}
                  </CardContent>
                </Card>
                )}

                {logWorkspaceMode === "transcription" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4" />
                      文字起こしドラフト取り込み
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Provider実装前の検証用に、発話配列JSONまたはsegments配列を持つJSONを話者付きログへ変換します。
                    </CardDescription>
                    {transcriptionRun && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{transcriptionRun.providerLabel}</Badge>
                        <Badge variant="muted">{transcriptionRun.segmentCount}発話</Badge>
                        <Badge variant="muted">
                          {transcriptionRun.sourceType === "audio-file" ? "音声ファイル" : "手動JSON"}
                        </Badge>
                        <Badge variant="muted">{formatRunTimestamp(transcriptionRun.executedAt)}</Badge>
                        {transcriptionRun.fileName && <Badge variant="muted">{transcriptionRun.fileName}</Badge>}
                        <Button disabled={isExtracting} onClick={clearTranscriptionRun} size="sm" variant="ghost">
                          <Trash2 className="h-4 w-4" />
                          履歴解除
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-3">
                      <label
                        className={
                          isExtracting
                            ? "inline-flex h-8 cursor-not-allowed items-center justify-center gap-2 rounded-md px-3 text-xs font-medium opacity-50"
                            : "inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                        }
                        htmlFor={transcriptionAudioInputId}
                      >
                        <Upload className="h-4 w-4" />
                        音声ファイル
                        <input
                          accept="audio/*,.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
                          className="sr-only"
                          disabled={isExtracting}
                          id={transcriptionAudioInputId}
                          type="file"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setTranscriptionAudioFile(file);
                            const validation = file ? validateTranscriptionAudioFile(file) : null;
                            setTranscriptionImportError(validation && !validation.ok ? validation.message : null);
                            setTranscriptionImportMessage(null);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      {transcriptionAudioFile && (
                        <>
                          <Badge
                            variant={
                              transcriptionAudioFileValidation?.ok === false ? "destructive" : "muted"
                            }
                          >
                            {transcriptionAudioFile.name} / {formatFileSize(transcriptionAudioFile.size)}
                          </Badge>
                          <Button
                            disabled={isExtracting}
                            onClick={() => {
                              setTranscriptionAudioFile(null);
                              setTranscriptionImportError(null);
                              setTranscriptionImportMessage(null);
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            <Trash2 className="h-4 w-4" />
                            音声を解除
                          </Button>
                        </>
                      )}
                      <Button
                        disabled={!canRunAudioTranscription}
                        onClick={transcribeSelectedAudioFile}
                        size="sm"
                        variant="outline"
                      >
                        <Wand2 className="h-4 w-4" />
                        OpenAIで文字起こし
                      </Button>
                    </div>
                    <Textarea
                      aria-label="文字起こしドラフトJSON"
                      className="min-h-[120px] font-mono text-xs"
                      placeholder='[{"speakerName":"GM","startTimeSec":0,"endTimeSec":6,"text":"扉の奥から足音が聞こえる","confidence":0.92}]'
                      value={transcriptionDraftJson}
                      onChange={(event) => setTranscriptionDraftJson(event.target.value)}
                    />
                    {transcriptionDraftPreview.status !== "empty" && (
                      <div className="flex flex-wrap gap-2">
                        {transcriptionDraftPreview.status === "valid" ? (
                          <>
                            <Badge variant="outline">読み取り可能 {transcriptionDraftPreview.segmentCount}発話</Badge>
                            <Badge variant="muted">{transcriptionDraftPreview.speakerCount}話者</Badge>
                            <Badge variant="muted">合計 {Math.round(transcriptionDraftPreview.totalDurationSec)}秒</Badge>
                            {transcriptionDraftPreview.missingTimingCount > 0 && (
                              <Badge variant="secondary">時刻なし {transcriptionDraftPreview.missingTimingCount}</Badge>
                            )}
                            {transcriptionDraftPreview.lowConfidenceCount > 0 && (
                              <Badge variant="destructive">要確認 {transcriptionDraftPreview.lowConfidenceCount}</Badge>
                            )}
                          </>
                        ) : (
                          <Badge variant="destructive">
                            {transcriptionDraftPreview.status === "invalid-json"
                              ? "JSONエラー"
                              : transcriptionDraftPreview.status === "empty-segments"
                                ? "有効発話0件"
                                : "形式エラー"}
                          </Badge>
                        )}
                      </div>
                    )}
                    {transcriptionImportError && (
                      <p className="text-xs text-destructive" role="alert">
                        {transcriptionImportError}
                      </p>
                    )}
                    {transcriptionImportMessage && (
                      <p className="text-xs text-muted-foreground" role="status">
                        {transcriptionImportMessage}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label
                        className={
                          isExtracting
                            ? "inline-flex h-8 cursor-not-allowed items-center justify-center gap-2 rounded-md px-3 text-xs font-medium opacity-50"
                            : "inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                        }
                        htmlFor={transcriptionDraftImportInputId}
                      >
                        <Upload className="h-4 w-4" />
                        JSONファイル
                        <input
                          accept="application/json,.json"
                          className="sr-only"
                          disabled={isExtracting}
                          id={transcriptionDraftImportInputId}
                          type="file"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) {
                              void importTranscriptionDraftFile(file);
                            }
                          }}
                        />
                      </label>
                      <Button
                        onClick={() => {
                          setTranscriptionDraftJson(sampleTranscriptionDraftJson);
                          setTranscriptionImportError(null);
                          setTranscriptionImportMessage(null);
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <FileText className="h-4 w-4" />
                        サンプルを入れる
                      </Button>
                      <Button
                        disabled={!transcriptionDraftJson.trim() || isExtracting}
                        onClick={() => {
                          setTranscriptionDraftJson("");
                          setTranscriptionImportError(null);
                          setTranscriptionImportMessage(null);
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                        入力をクリア
                      </Button>
                      <Button
                        disabled={!canApplyTranscriptionDraft}
                        onClick={importTranscriptionDraftJson}
                        size="sm"
                        variant="outline"
                      >
                        <Upload className="h-4 w-4" />
                        話者付きログへ取り込み
                      </Button>
                      <Button
                        disabled={!canApplyTranscriptionDraft}
                        onClick={appendTranscriptionDraftJson}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="h-4 w-4" />
                        現在の話者ログへ追記
                      </Button>
                      <Button
                        disabled={isExtracting || currentSession.liveLog.segments.every((segment) => !segment.text.trim())}
                        onClick={exportTranscriptionDraftJson}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="h-4 w-4" />
                        現在の話者ログを書き出し
                      </Button>
                      <Button
                        disabled={isExtracting || currentSession.liveLog.segments.every((segment) => !segment.text.trim())}
                        onClick={exportSpeakerLogText}
                        size="sm"
                        variant="outline"
                      >
                        <FileText className="h-4 w-4" />
                        テキスト書き出し
                      </Button>
                      <Button
                        disabled={isExtracting || currentSession.liveLog.segments.every((segment) => !segment.text.trim())}
                        onClick={exportSpeakerLogMarkdown}
                        size="sm"
                        variant="outline"
                      >
                        <FileText className="h-4 w-4" />
                        Markdown
                      </Button>
                      <Badge variant="muted">draft-v1</Badge>
                    </div>
                  </CardContent>
                </Card>
                )}
              </div>
            )}

            {activeTab === "review" && (
              <div className="grid gap-4">
                {extractionRun && (
                  <Card>
                    <CardContent className="space-y-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={extractionRun.fallbackUsed ? "secondary" : "default"}>
                            {extractionRun.fallbackUsed ? "フォールバック" : "Provider実行"}
                          </Badge>
                          <Badge variant={extractionRun.sourceType === "fallback" ? "secondary" : "outline"}>
                            {extractionSourceLabels[extractionRun.sourceType]}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {extractionRun.itemCount}件の抽出候補を確認中
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {extractionRun.providerLabel} → {extractionRun.executedProviderLabel}
                        </span>
                      </div>

                      <div className="grid gap-2 text-xs text-muted-foreground">
                        <p>{extractionRun.note}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="muted">{extractionRun.promptVersion ?? "extraction-v1"}</Badge>
                          <Badge variant="muted">
                            prompt {extractionRun.promptLength.toLocaleString()}文字
                          </Badge>
                          {extractionRun.validationErrors && extractionRun.validationErrors.length > 0 && (
                            <Badge variant="destructive">
                              検証エラー {extractionRun.validationErrors.length}件
                            </Badge>
                          )}
                        </div>
                      </div>

                      {extractionRun.failureReason && (
                        <p className="text-xs text-destructive" role="alert">
                          失敗理由: {extractionRun.failureReason}
                        </p>
                      )}
                      {extractionRun.validationErrors && extractionRun.validationErrors.length > 0 && (
                        <details className="text-xs text-destructive" role="alert">
                          <summary className="cursor-pointer">検証メモを表示</summary>
                          <ul className="mt-2 grid gap-1">
                            {extractionRun.validationErrors.map((error, index) => (
                              <li key={`${error}-${index}`}>{error}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                )}
                {items.length === 0 ? (
                  <EmptyState
                    extractionRun={extractionRun}
                    onStart={() => {
                      setLogWorkspaceMode("editor");
                      setActiveTab("log");
                    }}
                  />
                ) : (
                  <>
                    <Card>
                      <CardContent className="grid gap-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="muted">{approvedCount}採用済み</Badge>
                            <Badge variant="muted">{remainingCount}未確認</Badge>
                            {approvableRemainingCount !== remainingCount && (
                              <Badge variant="outline">{approvableRemainingCount}件採用可能</Badge>
                            )}
                            {invalidReviewItemCount > 0 && (
                              <Badge variant="destructive">未入力 {invalidReviewItemCount}</Badge>
                            )}
                            {duplicateReviewItemCount > 0 && (
                              <Badge variant="destructive">重複 {duplicateReviewItemCount}</Badge>
                            )}
                            {showDuplicateReviewItemsOnly && (
                              <Badge variant="secondary">重複のみ</Badge>
                            )}
                            {hasReviewFilter && (
                              <Badge variant="outline">{reviewItems.length}件を表示中</Badge>
                            )}
                            {hasReviewFilter && approvableVisibleReviewCount > 0 && (
                              <Badge variant="muted">表示中の採用可能 {approvableVisibleReviewCount}</Badge>
                            )}
                            {hasReviewFilter && rejectableVisibleReviewCount > 0 && (
                              <Badge variant="muted">表示中の破棄可能 {rejectableVisibleReviewCount}</Badge>
                            )}
                            {reviewVisibilityFilter !== "all" && (
                              <Badge variant="secondary">公開範囲: {reviewVisibilityFilter}</Badge>
                            )}
                            {reviewSortMode !== "original" && (
                              <Badge variant="secondary">
                                並び: {findOptionLabel(reviewSortOptions, reviewSortMode, "抽出順")}
                              </Badge>
                            )}
                            {activeRejectedReviewBatch && (
                              <Badge variant="outline">
                                復元可: {activeRejectedReviewBatch.label}
                              </Badge>
                            )}
                            {normalizedReviewQuery && <Badge variant="secondary">検索: {reviewQuery.trim()}</Badge>}
                          </div>
                          <Tabs
                            ariaLabel="承認作業"
                            value={reviewWorkspaceMode}
                            options={reviewWorkspaceOptions}
                            onChange={setReviewWorkspaceMode}
                          />
                        </div>

                        {reviewWorkspaceMode === "inspect" && (
                          <div className="flex flex-wrap gap-2">
                            <Input
                              aria-label="抽出候補を検索"
                              className="h-9 w-48"
                              placeholder="候補を検索"
                              value={reviewQuery}
                              onChange={(event) => setReviewQuery(event.target.value)}
                            />
                            <select
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={reviewKindFilter}
                              onChange={(event) => setReviewKindFilter(event.target.value as ReviewKindFilter)}
                            >
                              {reviewKindOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label} ({reviewKindCounts[option.value]})
                                </option>
                              ))}
                            </select>
                            <select
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={reviewVisibilityFilter}
                              onChange={(event) => setReviewVisibilityFilter(event.target.value as ReviewVisibilityFilter)}
                            >
                              {reviewVisibilityOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label} ({reviewVisibilityCounts[option.value]})
                                </option>
                              ))}
                            </select>
                            <select
                              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              value={reviewSortMode}
                              onChange={(event) => setReviewSortMode(event.target.value as ReviewSortMode)}
                            >
                              {reviewSortOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  並び: {option.label}
                                </option>
                              ))}
                            </select>
                            <Button
                              onClick={() => setShowApprovedReviewItems((current) => !current)}
                              size="sm"
                              variant="outline"
                            >
                              {showApprovedReviewItems ? "採用済みを隠す" : "採用済みも表示"}
                            </Button>
                            <Button
                              disabled={invalidReviewItemCount === 0}
                              onClick={() => {
                                setShowDuplicateReviewItemsOnly(false);
                                setShowInvalidReviewItemsOnly((current) => !current);
                              }}
                              size="sm"
                              variant={showInvalidReviewItemsOnly ? "default" : "outline"}
                            >
                              未入力のみ
                            </Button>
                            <Button
                              disabled={duplicateReviewItemCount === 0}
                              onClick={() => {
                                setShowInvalidReviewItemsOnly(false);
                                setShowDuplicateReviewItemsOnly((current) => !current);
                              }}
                              size="sm"
                              variant={showDuplicateReviewItemsOnly ? "default" : "outline"}
                            >
                              重複のみ
                            </Button>
                            <Button
                              disabled={!hasReviewFilter}
                              onClick={() => {
                                setReviewKindFilter("all");
                                setReviewVisibilityFilter("all");
                                setReviewQuery("");
                                setShowDuplicateReviewItemsOnly(false);
                                setShowApprovedReviewItems(true);
                                setShowInvalidReviewItemsOnly(false);
                                setReviewSortMode(defaultUiPreferences.reviewSortMode);
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              <RotateCcw className="h-4 w-4" />
                              条件解除
                            </Button>
                          </div>
                        )}

                        {reviewWorkspaceMode === "manage" && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              disabled={invalidReviewItemCount === 0}
                              onClick={rejectInvalidReviewItems}
                              size="sm"
                              variant="outline"
                            >
                              <Trash2 className="h-4 w-4" />
                              未入力を破棄
                            </Button>
                            <Button
                              disabled={duplicateReviewItemCount === 0}
                              onClick={rejectDuplicateReviewItems}
                              size="sm"
                              variant="outline"
                            >
                              <Trash2 className="h-4 w-4" />
                              重複を破棄
                            </Button>
                            <Button disabled={items.length === 0} onClick={normalizeReviewItemText} size="sm" variant="outline">
                              <RotateCcw className="h-4 w-4" />
                              空白整理
                            </Button>
                            {activeRejectedReviewBatch && (
                              <Button onClick={restoreLastRejectedReviewBatch} size="sm" variant="outline">
                                <RotateCcw className="h-4 w-4" />
                                直前の破棄を戻す
                              </Button>
                            )}
                            <Button
                              disabled={(hasReviewFilter ? approvableVisibleReviewCount : approvableRemainingCount) === 0}
                              onClick={() =>
                                approveRemainingItems(
                                  hasReviewFilter ? new Set(reviewItems.map((item) => item.id)) : undefined,
                                )
                              }
                              size="sm"
                            >
                              <ShieldCheck className="h-4 w-4" />
                              {hasReviewFilter ? "表示中をまとめて採用" : "残りをまとめて採用"}
                            </Button>
                            <Button
                              disabled={rejectableVisibleReviewCount === 0}
                              onClick={rejectVisibleItems}
                              size="sm"
                              variant="outline"
                            >
                              <Trash2 className="h-4 w-4" />
                              表示中を破棄
                            </Button>
                            <Button disabled={reviewItems.length === 0} onClick={exportVisibleReviewItems} size="sm" variant="outline">
                              <Download className="h-4 w-4" />
                              表示中を書き出し
                            </Button>
                            <Button
                              disabled={reviewItems.length === 0}
                              onClick={exportVisibleReviewItemsMarkdown}
                              size="sm"
                              variant="outline"
                            >
                              <FileText className="h-4 w-4" />
                              Markdown
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    {reviewItems.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-md border border-border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">表示中</p>
                          <p className="mt-1 text-lg font-semibold">{visibleReviewSummary.total}件</p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">未承認 / 採用可能</p>
                          <p className="mt-1 text-lg font-semibold">
                            {visibleReviewSummary.pending} / {visibleReviewSummary.approvable}
                          </p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">要整理</p>
                          <p className="mt-1 text-lg font-semibold">
                            {visibleReviewSummary.invalid}未入力 / {visibleReviewSummary.duplicate}重複
                          </p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 p-3">
                          <p className="text-xs text-muted-foreground">GM向け非公開</p>
                          <p className="mt-1 text-lg font-semibold">
                            {visibleReviewSummary.byVisibility.GMのみ + visibleReviewSummary.byVisibility.未開示候補}件
                          </p>
                        </div>
                      </div>
                    )}
                    {reviewItems.length > 0 && (
                      <div className="rounded-md border border-border bg-muted/20 p-3">
                        <p className="text-xs text-muted-foreground">表示中を採用した場合</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="outline">出来事 +{visibleReviewMemoryPreview.newEvents}</Badge>
                          <Badge variant="outline">NPC +{visibleReviewMemoryPreview.newNpcs}</Badge>
                          <Badge variant="outline">記憶 +{visibleReviewMemoryPreview.newClues}</Badge>
                          <Badge variant="outline">伏線 +{visibleReviewMemoryPreview.newThreads}</Badge>
                          {visibleReviewMemoryPreview.skippedCandidates > 0 && (
                            <Badge variant="secondary">重複/未入力 {visibleReviewMemoryPreview.skippedCandidates}</Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {reviewItems.length === 0 ? (
                      <Card>
                        <CardContent className="space-y-3 py-6 text-center">
                          <p className="text-sm font-medium">条件に一致する抽出候補はありません</p>
                          <p className="text-xs text-muted-foreground">
                            フィルタを外すと、採用済みまたは別種別の候補を確認できます。
                          </p>
                          <div className="mt-3 flex flex-wrap justify-center gap-2">
                            {!showApprovedReviewItems && (
                              <Button
                                onClick={() => setShowApprovedReviewItems(true)}
                                size="sm"
                                variant="outline"
                              >
                                採用済みも表示
                              </Button>
                            )}
                            {reviewKindFilter !== "all" && (
                              <Button onClick={() => setReviewKindFilter("all")} size="sm" variant="outline">
                                種別フィルタを解除
                              </Button>
                            )}
                            {reviewVisibilityFilter !== "all" && (
                              <Button onClick={() => setReviewVisibilityFilter("all")} size="sm" variant="outline">
                                公開範囲フィルタを解除
                              </Button>
                            )}
                            {showInvalidReviewItemsOnly && (
                              <Button
                                onClick={() => setShowInvalidReviewItemsOnly(false)}
                                size="sm"
                                variant="outline"
                              >
                                未入力フィルタを解除
                              </Button>
                            )}
                            {showDuplicateReviewItemsOnly && (
                              <Button
                                onClick={() => setShowDuplicateReviewItemsOnly(false)}
                                size="sm"
                                variant="outline"
                              >
                                重複フィルタを解除
                              </Button>
                            )}
                            {normalizedReviewQuery && (
                              <Button onClick={() => setReviewQuery("")} size="sm" variant="outline">
                                検索を解除
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      reviewItems.map((item) => {
                        const isApproved = approvedIds.includes(item.id);

                        return (
                          <ExtractionReviewCard
                            isApproved={isApproved}
                            item={item}
                            key={item.id}
                            onApprove={approveItem}
                            onReject={rejectItem}
                            onUpdate={updateExtractionItem}
                          />
                        );
                      })
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === "chronicle" && (
              <ChronicleView
                campaignMode={campaignMode}
                chronicle={chronicle}
                clueStatusFilter={chronicleClueStatusFilter}
                viewMode={chronicleViewMode}
                onClueStatusFilterChange={setChronicleClueStatusFilter}
                onViewModeChange={setChronicleViewMode}
                onExportFilteredChronicle={exportFilteredChronicle}
                onExportFilteredChronicleMarkdown={exportFilteredChronicleMarkdown}
                onUpdateClueStatus={updateClueStatus}
                onUpdateNpcAttitude={updateNpcAttitude}
                onUpdateThreadNextMove={updateThreadNextMove}
              />
            )}

            {activeTab === "prep" && (
              <div className="grid gap-4">
                <Card>
                  <CardContent className="grid gap-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{currentSession.title} から次回準備</p>
                        <p className="text-xs text-muted-foreground">
                          承認済み記憶と現在のセッション状態から自動で組み立てています。
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{campaignState.sessions.length}セッション</Badge>
                        <Button onClick={exportPrepNoteMarkdown} size="sm" variant="outline">
                          <Download className="h-4 w-4" />
                          Markdown
                        </Button>
                        <Button onClick={exportPrepNoteJson} size="sm" variant="outline">
                          <Download className="h-4 w-4" />
                          JSON
                        </Button>
                        <Button onClick={exportCurrentSessionMarkdown} size="sm" variant="outline">
                          <FileText className="h-4 w-4" />
                          セッション
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="muted">{prepLabels.recap} {dynamicPrepNote.shortRecap.length}</Badge>
                        <Badge variant="muted">{prepLabels.hooks} {dynamicPrepNote.hooks.length}</Badge>
                        <Badge variant="muted">{prepLabels.questions} {dynamicPrepNote.openQuestions.length}</Badge>
                        <Badge variant="muted">{prepLabels.reminders} {dynamicPrepNote.reminders.length}</Badge>
                      </div>
                      <Tabs
                        ariaLabel="次回準備カテゴリ"
                        value={prepWorkspaceMode}
                        options={prepWorkspaceOptions}
                        onChange={setPrepWorkspaceMode}
                      />
                    </div>
                  </CardContent>
                </Card>
                {prepWorkspaceMode === "recap" && (
                  <PrepSection title={prepLabels.recap} items={dynamicPrepNote.shortRecap} icon={FileText} />
                )}
                {prepWorkspaceMode === "hooks" && (
                  <PrepSection title={prepLabels.hooks} items={dynamicPrepNote.hooks} icon={Compass} />
                )}
                {prepWorkspaceMode === "questions" && (
                  <PrepSection title={prepLabels.questions} items={dynamicPrepNote.openQuestions} icon={Search} />
                )}
                {prepWorkspaceMode === "reminders" && (
                  <PrepSection title={prepLabels.reminders} items={dynamicPrepNote.reminders} icon={KeyRound} />
                )}
              </div>
            )}
          </div>
        </section>

        {!isFocusMode && (
        <aside className="border-l bg-panel px-4 py-5 max-xl:col-span-2 max-xl:border-l-0 max-xl:border-t max-lg:col-span-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold">
                {rightPanelMode === "settings" ? <Settings2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                補助パネル
              </p>
              <p className="text-xs text-muted-foreground">
                {rightPanelMode === "rescue" ? "セッション中の即応ツール" : "Providerと将来拡張"}
              </p>
            </div>
            <Tabs
              ariaLabel="補助パネル"
              value={rightPanelMode}
              options={rightPanelOptions}
              onChange={setRightPanelMode}
            />
          </div>

          {rightPanelMode === "rescue" && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">即興レスキュー</p>
              <p className="text-xs text-muted-foreground">セッション中に使う短い候補</p>
            </div>
            <Badge variant="muted">{quickPrompts.length}種</Badge>
          </div>

          <div className="mt-4 grid gap-2">
            {quickPrompts.map((prompt) => (
              <Button
                className="justify-start"
                key={prompt.title}
                onClick={() => updateCampaignState({ quickResult: prompt.result })}
                variant="outline"
              >
                <prompt.icon className="h-4 w-4" />
                {prompt.title}
              </Button>
            ))}
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                候補
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-6">{quickResult}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!quickResult.trim() || isExtracting} onClick={appendQuickResultToLog} size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                  通常ログへ追記
                </Button>
                <Button
                  disabled={!quickResult.trim() || isExtracting}
                  onClick={appendQuickResultToSpeakerLog}
                  size="sm"
                  variant="outline"
                >
                  <MessageSquareText className="h-4 w-4" />
                  話者ログへ追記
                </Button>
              </div>
            </CardContent>
          </Card>
            </div>
          )}

          {rightPanelMode === "settings" && (
            <div className="mt-4 grid gap-4">
              <Tabs
                ariaLabel="設定カテゴリ"
                value={settingsPanelMode}
                options={settingsPanelOptions}
                onChange={setSettingsPanelMode}
              />
          {settingsPanelMode === "extraction" && (
          <div>
            <ProviderSettingsCard
              isLocked={isExtracting}
              secrets={providerSecrets}
              settings={extractionProvider}
              onChangeSecrets={setProviderSecrets}
              onChange={(nextSettings) => updateCampaignState({ extractionProvider: nextSettings })}
            />
          </div>
          )}

          {settingsPanelMode === "transcription" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-4 w-4" />
                文字起こしProvider
              </CardTitle>
              <CardDescription className="mt-2">
                音声入力を話者付きログへ流し込むための準備設定です。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
                <Badge variant={selectedTranscriptionProvider.status === "available" ? "default" : "secondary"}>
                  {selectedTranscriptionProvider.status === "available" ? "利用可能" : "計画中"}
                </Badge>
                <Badge variant={transcriptionProviderReadiness.ok ? "default" : "destructive"}>
                  {transcriptionProviderReadiness.ok ? "準備OK" : "要設定"}
                </Badge>
                <Badge variant="outline">{selectedTranscriptionProvider.label}</Badge>
                <Badge variant="muted">言語 {transcriptionProvider.language}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{transcriptionProviderReadiness.message}</p>
              <Button
                disabled={isExtracting}
                onClick={() =>
                  updateCampaignState({
                    transcriptionProvider: {
                      providerId: selectedTranscriptionProvider.id,
                      model: selectedTranscriptionProvider.defaultModel,
                      endpoint: selectedTranscriptionProvider.defaultEndpoint,
                      language: transcriptionProvider.language.trim() || "ja",
                    },
                  })
                }
                size="sm"
                variant="ghost"
              >
                <RotateCcw className="h-4 w-4" />
                既定値に戻す
              </Button>
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="transcription-provider-select">
                  Provider
                </label>
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isExtracting}
                  id="transcription-provider-select"
                  value={transcriptionProvider.providerId}
                  onChange={(event) => {
                    const provider = getTranscriptionProvider(event.target.value as typeof transcriptionProvider.providerId);
                    updateCampaignState({
                      transcriptionProvider: {
                        providerId: provider.id,
                        model: provider.defaultModel,
                        endpoint: provider.defaultEndpoint,
                        language: transcriptionProvider.language,
                      },
                    });
                  }}
                >
                  {transcriptionProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="transcription-language">
                  言語
                </label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {transcriptionLanguageOptions.map((option) => (
                    <Button
                      key={option.value}
                      disabled={isExtracting}
                      onClick={() =>
                        updateCampaignState({
                          transcriptionProvider: {
                            ...transcriptionProvider,
                            language: option.value,
                          },
                        })
                      }
                      size="sm"
                      variant={transcriptionProvider.language === option.value ? "default" : "outline"}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <Input
                  className="mt-1"
                  disabled={isExtracting}
                  id="transcription-language"
                  value={transcriptionProvider.language}
                  onBlur={(event) =>
                    updateCampaignState({
                      transcriptionProvider: {
                        ...transcriptionProvider,
                        language: event.target.value.trim() || "ja",
                      },
                    })
                  }
                  onChange={(event) =>
                    updateCampaignState({
                      transcriptionProvider: {
                        ...transcriptionProvider,
                        language: event.target.value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="transcription-model">
                  Model
                </label>
                <Input
                  className="mt-1"
                  disabled={isExtracting}
                  id="transcription-model"
                  value={transcriptionProvider.model}
                  onBlur={(event) =>
                    updateCampaignState({
                      transcriptionProvider: {
                        ...transcriptionProvider,
                        model: event.target.value.trim() || selectedTranscriptionProvider.defaultModel,
                      },
                    })
                  }
                  onChange={(event) =>
                    updateCampaignState({
                      transcriptionProvider: {
                        ...transcriptionProvider,
                        model: event.target.value,
                      },
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor="transcription-endpoint">
                  Endpoint
                </label>
                <Input
                  className="mt-1"
                  disabled={isExtracting}
                  id="transcription-endpoint"
                  placeholder="Provider endpoint"
                  value={transcriptionProvider.endpoint}
                  onBlur={(event) =>
                    updateCampaignState({
                      transcriptionProvider: {
                        ...transcriptionProvider,
                        endpoint: event.target.value.trim() || selectedTranscriptionProvider.defaultEndpoint,
                      },
                    })
                  }
                  onChange={(event) =>
                    updateCampaignState({
                      transcriptionProvider: {
                        ...transcriptionProvider,
                        endpoint: event.target.value,
                      },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
          )}

          {settingsPanelMode === "roadmap" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="h-4 w-4" />
                拡張予定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>ファンタジーモードでは、手がかりをクエスト、秘密を勢力事情、伏線を世界変化へ置き換えます。</p>
              <p>AI接続はユーザーAPIキー方式にして、ローカル保存を基本にします。</p>
              {largestSessionStorageDiagnostic && (
                <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
                  <p className="font-medium text-foreground">保存サイズ最大セッション</p>
                  <p className="mt-1">
                    {largestSessionStorageDiagnostic.campaignName} / {largestSessionStorageDiagnostic.sessionTitle}
                  </p>
                  <p className="mt-1">
                    合計 {formatFileSize(largestSessionStorageDiagnostic.totalBytes)}、ログ{" "}
                    {formatFileSize(largestSessionStorageDiagnostic.logBytes)}、話者ログ{" "}
                    {formatFileSize(largestSessionStorageDiagnostic.speakerLogBytes)}
                  </p>
                </div>
              )}
              <Button onClick={exportSupportDiagnostics} size="sm" variant="outline">
                <Download className="h-4 w-4" />
                診断JSONを書き出し
              </Button>
            </CardContent>
          </Card>
          )}
            </div>
          )}
        </aside>
        )}
      </div>
      {confirmation && (
        <ConfirmationDialog
          request={confirmation}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            confirmation.onConfirm();
            setConfirmation(null);
          }}
        />
      )}
    </main>
  );
}

function HomeDashboard({
  approvedCount,
  canExtractLog,
  campaignMode,
  backupStatus,
  currentLiveLogSummary,
  currentSession,
  currentSpeakerIssueCount,
  duplicateReviewItemCount,
  extractionProviderReady,
  extractionPromptLength,
  hasPrepContent,
  hiddenClueCount,
  invalidReviewItemCount,
  isExtracting,
  memoryItemCount,
  onExtract,
  onExportCurrentSessionMarkdown,
  onLoadDemo,
  onOpenChronicleOverview,
  onOpenDuplicateReviewItems,
  onOpenExtractionProviderSettings,
  onOpenLogEditor,
  onOpenPrepHooks,
  onOpenHiddenClues,
  onOpenInvalidReviewItems,
  onOpenReviewInspect,
  onOpenReviewQuality,
  onOpenSessionList,
  onOpenSpeakerLogIssues,
  onOpenStorageSettings,
  onOpenTranscriptionImport,
  onOpenTranscriptionProviderSettings,
  remainingCount,
  reviewItemCount,
  reviewQualityDebtCount,
  sessionCount,
  storageUsagePercent,
  transcriptionProviderReady,
}: {
  approvedCount: number;
  backupStatus: ReturnType<typeof getBackupStatus>;
  canExtractLog: boolean;
  campaignMode: CampaignMode;
  currentLiveLogSummary: ReturnType<typeof summarizeLiveLog>;
  currentSession: SessionState;
  currentSpeakerIssueCount: number;
  duplicateReviewItemCount: number;
  extractionProviderReady: boolean;
  extractionPromptLength: number;
  hasPrepContent: boolean;
  hiddenClueCount: number;
  invalidReviewItemCount: number;
  isExtracting: boolean;
  memoryItemCount: number;
  onExtract: () => void | Promise<void>;
  onExportCurrentSessionMarkdown: () => void;
  onLoadDemo: () => void;
  onOpenChronicleOverview: () => void;
  onOpenDuplicateReviewItems: () => void;
  onOpenExtractionProviderSettings: () => void;
  onOpenHiddenClues: () => void;
  onOpenInvalidReviewItems: () => void;
  onOpenLogEditor: () => void;
  onOpenPrepHooks: () => void;
  onOpenReviewInspect: () => void;
  onOpenReviewQuality: () => void;
  onOpenSessionList: () => void;
  onOpenSpeakerLogIssues: () => void;
  onOpenStorageSettings: () => void;
  onOpenTranscriptionImport: () => void;
  onOpenTranscriptionProviderSettings: () => void;
  remainingCount: number;
  reviewItemCount: number;
  reviewQualityDebtCount: number;
  sessionCount: number;
  storageUsagePercent: number | null;
  transcriptionProviderReady: boolean;
}) {
  const logReady = canExtractLog;
  const reviewReady = reviewItemCount > 0;
  const memoryReady = memoryItemCount > 0;
  const prepReady = hasPrepContent;
  const needsFirstLog = !logReady && reviewItemCount === 0 && memoryItemCount === 0;
  const extractionTargetLabel =
    campaignMode === "fantasy" ? "クエスト、勢力事情、世界変化" : "手がかり、秘密、伏線";
  const priorityAlerts = [
    invalidReviewItemCount > 0
      ? { label: `${invalidReviewItemCount}件の未入力候補`, onOpen: onOpenInvalidReviewItems }
      : null,
    duplicateReviewItemCount > 0
      ? { label: `${duplicateReviewItemCount}件の重複候補`, onOpen: onOpenDuplicateReviewItems }
      : null,
    reviewQualityDebtCount > 0
      ? { label: `全体でレビュー品質 ${reviewQualityDebtCount}件`, onOpen: onOpenReviewQuality }
      : null,
    currentSpeakerIssueCount > 0
      ? { label: `${currentSpeakerIssueCount}件のログ確認`, onOpen: onOpenSpeakerLogIssues }
      : null,
    extractionPromptLength > 30000
      ? { label: `抽出prompt ${extractionPromptLength.toLocaleString()}文字`, onOpen: onOpenLogEditor }
      : null,
    hiddenClueCount > 0
      ? { label: `${hiddenClueCount}件の未開示手がかり`, onOpen: onOpenHiddenClues }
      : null,
    !extractionProviderReady
      ? { label: "抽出Provider要設定", onOpen: onOpenExtractionProviderSettings }
      : null,
    !transcriptionProviderReady
      ? { label: "文字起こしProvider要設定", onOpen: onOpenTranscriptionProviderSettings }
      : null,
    storageUsagePercent !== null && storageUsagePercent >= 80
      ? { label: `保存容量 ${storageUsagePercent}%`, onOpen: onOpenStorageSettings }
      : null,
    backupStatus.needsBackup
      ? { label: backupStatus.label, onOpen: onOpenStorageSettings }
      : null,
  ].filter((alert): alert is { label: string; onOpen: () => void } => alert !== null);

  const workflowSteps = [
    {
      actionLabel: logReady ? "抽出へ進む" : "ログを整える",
      description:
        currentLiveLogSummary.nonEmptySegmentCount > 0
          ? `${currentLiveLogSummary.nonEmptySegmentCount}発話を抽出元として使えます。`
          : "通常ログまたは話者付きログを入力します。",
      icon: FileText,
      isDone: reviewReady,
      isReady: logReady,
      label: "ログ作成",
      onOpen: onOpenLogEditor,
    },
    {
      actionLabel: reviewReady ? "候補を確認" : "抽出待ち",
      description:
        reviewItemCount > 0
          ? `${remainingCount}件が未確認、${approvedCount}件が採用済みです。`
          : "抽出プレビュー後に、GM承認フローへ進みます。",
      icon: ShieldCheck,
      isDone: memoryReady,
      isReady: reviewReady,
      label: "承認",
      onOpen: onOpenReviewInspect,
    },
    {
      actionLabel: memoryReady ? "記憶を見る" : "承認待ち",
      description:
        memoryItemCount > 0
          ? `${memoryItemCount}件のキャンペーン記憶を利用できます。`
          : "採用した候補だけがキャンペーン記憶になります。",
      icon: BookOpen,
      isDone: prepReady,
      isReady: memoryReady,
      label: "記憶化",
      onOpen: onOpenChronicleOverview,
    },
    {
      actionLabel: prepReady ? "準備を開く" : "記憶待ち",
      description: prepReady
        ? "承認済み記憶から次回準備メモを生成済みです。"
        : "記憶が増えると導入案と確認メモが厚くなります。",
      icon: Compass,
      isDone: false,
      isReady: prepReady,
      label: "次回準備",
      onOpen: onOpenPrepHooks,
    },
  ];
  const recommendedAction = !logReady
    ? { label: "ログ入力を完了", detail: "通常ログか話者付きログを入れると抽出プレビューへ進めます。", onOpen: onOpenLogEditor }
    : reviewItemCount === 0
      ? { label: "抽出プレビューを実行", detail: `ログから${extractionTargetLabel}の候補を作ります。`, onOpen: onExtract }
      : remainingCount > 0
        ? { label: "未承認候補を確認", detail: `${remainingCount}件の候補がGM承認待ちです。`, onOpen: onOpenReviewInspect }
        : memoryItemCount === 0
          ? { label: "採用候補を記憶化", detail: "承認した候補をキャンペーン記憶へ反映します。", onOpen: onOpenReviewInspect }
          : { label: "次回準備を確認", detail: "承認済み記憶から次回導入案を確認します。", onOpen: onOpenPrepHooks };

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{currentSession.title} の進行状況</p>
              <p className="mt-1 text-xs text-muted-foreground">
                ログ、承認、記憶、次回準備を1つの導線で確認します。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!canExtractLog || isExtracting} onClick={onExtract}>
                <Wand2 className="h-4 w-4" />
                {isExtracting ? "抽出中" : "抽出プレビュー"}
              </Button>
              <Button onClick={onExportCurrentSessionMarkdown} variant="outline">
                <FileText className="h-4 w-4" />
                セッション出力
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
            <MetricTile
              label="セッション"
              value={`${sessionCount}`}
              detail={currentSession.date}
              onOpen={onOpenSessionList}
            />
            <MetricTile
              label="発話ログ"
              value={`${currentLiveLogSummary.nonEmptySegmentCount}`}
              detail={
                currentLiveLogSummary.lowConfidenceCount > 0
                  ? `要確認 ${currentLiveLogSummary.lowConfidenceCount}`
                  : "本文あり"
              }
              onOpen={onOpenLogEditor}
              tone={currentSpeakerIssueCount > 0 ? "warning" : "default"}
            />
            <MetricTile
              label="承認候補"
              value={`${reviewItemCount}`}
              detail={`${approvedCount}採用 / ${remainingCount}未確認`}
              onOpen={remainingCount > 0 ? onOpenReviewInspect : onOpenDuplicateReviewItems}
              tone={remainingCount > 0 ? "warning" : "default"}
            />
            <MetricTile
              label="キャンペーン記憶"
              value={`${memoryItemCount}`}
              detail={hiddenClueCount > 0 ? `未開示 ${hiddenClueCount}` : "公開整理済み"}
              onOpen={hiddenClueCount > 0 ? onOpenHiddenClues : onOpenChronicleOverview}
            />
          </div>

          {priorityAlerts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">要確認</span>
              {priorityAlerts.map((alert) => (
                <Button key={alert.label} onClick={alert.onOpen} size="sm" variant="destructive">
                  {alert.label}
                </Button>
              ))}
            </div>
          )}

          {needsFirstLog && (
            <div className="grid gap-3 rounded-md border border-dashed bg-background p-3">
              <div>
                <p className="text-sm font-medium">最初のセッションログを用意</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  サンプルで流れを確認するか、実セッションの文字起こし/ログ入力から始められます。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={onLoadDemo} size="sm">
                  <RotateCcw className="h-4 w-4" />
                  サンプルで試す
                </Button>
                <Button onClick={onOpenLogEditor} size="sm" variant="outline">
                  <FileText className="h-4 w-4" />
                  ログを入力
                </Button>
                <Button onClick={onOpenTranscriptionImport} size="sm" variant="outline">
                  <Upload className="h-4 w-4" />
                  文字起こしを取り込む
                </Button>
              </div>
            </div>
          )}

          {!needsFirstLog && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium">おすすめの次アクション: {recommendedAction.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{recommendedAction.detail}</p>
              </div>
              <Button disabled={isExtracting} onClick={recommendedAction.onOpen} size="sm">
                開く
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
        {workflowSteps.map((step, index) => (
          <Card key={step.label}>
            <CardContent className="grid h-full gap-3 py-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{index + 1}. {step.label}</p>
                    <Badge variant={step.isDone ? "default" : step.isReady ? "outline" : "muted"}>
                      {step.isDone ? "完了" : step.isReady ? "着手可" : "待機"}
                    </Badge>
                  </div>
                </div>
                {step.isDone && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
              <Button
                disabled={!step.isReady && step.label !== "ログ作成"}
                onClick={step.onOpen}
                size="sm"
                variant={step.isReady ? "default" : "outline"}
              >
                {step.actionLabel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function MetricTile({
  detail,
  label,
  onOpen,
  tone = "default",
  value,
}: {
  detail: string;
  label: string;
  onOpen?: () => void;
  tone?: "default" | "warning";
  value: string;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {onOpen && <Badge variant="muted">開く</Badge>}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
      <p className={tone === "warning" ? "mt-1 text-xs text-destructive" : "mt-1 text-xs text-muted-foreground"}>
        {detail}
      </p>
    </>
  );

  if (onOpen) {
    return (
      <button
        className="rounded-md border bg-background p-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onOpen}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-md border bg-background p-3">
      {content}
    </div>
  );
}

function ConfirmationDialog({
  onCancel,
  onConfirm,
  request,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  request: ConfirmationRequest;
}) {
  const titleId = "confirmation-dialog-title";
  const descriptionId = "confirmation-dialog-description";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-4 backdrop-blur-sm" role="presentation">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-sm rounded-md border bg-card p-4 shadow-lg"
        role="dialog"
      >
        <div className="space-y-2">
          <h2 className="text-base font-semibold" id={titleId}>{request.title}</h2>
          <p className="text-sm leading-6 text-muted-foreground" id={descriptionId}>{request.message}</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={onCancel} variant="outline">
            キャンセル
          </Button>
          <Button onClick={onConfirm} variant="destructive">
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ extractionRun, onStart }: { extractionRun: ExtractionRun | null; onStart: () => void }) {
  const hasRun = extractionRun !== null;
  const hasValidationErrors = Boolean(extractionRun?.validationErrors && extractionRun.validationErrors.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasRun ? "抽出候補は見つかりませんでした" : "抽出結果はまだありません"}</CardTitle>
        <CardDescription>
          {hasRun
            ? "この実行では採用できる候補が0件でした。ログの発言量やProvider設定を確認して、もう一度抽出してください。"
            : "ログを貼り付けて抽出プレビューを実行すると、候補をここで確認できます。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {extractionRun && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{extractionRun.sourceType === "fallback" ? "フォールバック由来" : "0件"}</Badge>
            {extractionRun.fallbackUsed && <Badge variant="secondary">フォールバック済み</Badge>}
            {hasValidationErrors && (
              <Badge variant="destructive">検証エラー {extractionRun.validationErrors?.length}件</Badge>
            )}
          </div>
        )}
        <Button onClick={onStart}>ログへ戻る</Button>
      </CardContent>
    </Card>
  );
}
