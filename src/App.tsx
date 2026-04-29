import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Clock3,
  Compass,
  Download,
  FileText,
  Upload,
  KeyRound,
  Lightbulb,
  Map as MapIcon,
  MessageSquareText,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  UserRound,
} from "lucide-react";
import { ChronicleView } from "./components/chronicle-view";
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
import {
  applyExtraction,
  cloneJson,
  createExportFileName,
  createInitialCampaignState,
  createId,
  createNewCampaignState,
  createNewSession,
  generatePrepNote,
  getLocalDateString,
  normalizeCampaignLibraryState,
  normalizeCampaignState,
} from "./lib/campaign";
import {
  liveLogToTranscriptionDrafts,
  liveLogToPlainText,
  normalizeTranscriptionDrafts,
  parsePlainLogToLiveLog,
  previewTranscriptionDraftPayload,
  summarizeLiveLog,
  transcriptionDraftsToLiveLog,
} from "./lib/extraction";
import {
  defaultProviderSecretSettings,
  getTranscriptionProvider,
  normalizeProviderSecretSettings,
  transcriptionProviders,
} from "./lib/extraction-provider-settings";
import { runExtractionProvider } from "./lib/extraction-providers";
import type {
  CampaignState,
  CampaignLibraryState,
  ExtractionRun,
  ExtractionItem,
  LiveLogSession,
  ProviderSecretSettings,
  SessionState,
  ClueStatus,
  SpeakerRole,
  TranscriptSegment,
  WorkspaceTab,
} from "./types";

const LEGACY_STORAGE_KEY = "chronicle-gm.campaign-state.v1";
const CAMPAIGN_LIBRARY_STORAGE_KEY = "chronicle-gm.campaign-library.v1";
const PROVIDER_SECRETS_STORAGE_KEY = "chronicle-gm.provider-secrets.v1";
const campaignNameInputId = "campaign-name";
const campaignImportInputId = "campaign-json-import";
const transcriptionDraftImportInputId = "transcription-draft-json-import";
const sessionTitleInputId = "active-session-title";
const sessionDateInputId = "active-session-date";

type LogInputMode = "plain" | "speaker";
type ReviewKindFilter = "all" | ExtractionItem["kind"];
type ConfirmationRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

const tabOptions: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "log", label: "ログ" },
  { value: "review", label: "承認" },
  { value: "chronicle", label: "記憶" },
  { value: "prep", label: "次回準備" },
];

const quickPrompts = [
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
];

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

const reviewKindOptions: Array<{ value: ReviewKindFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "出来事", label: "出来事" },
  { value: "NPC", label: "NPC" },
  { value: "手がかり", label: "手がかり" },
  { value: "GM秘密", label: "GM秘密" },
  { value: "伏線", label: "伏線" },
];

const extractionSourceLabels: Record<ExtractionRun["sourceType"], string> = {
  plain: "通常ログ由来",
  speaker: "話者付きログ由来",
  fallback: "フォールバック",
};

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

export function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("log");
  const [isExtracting, setIsExtracting] = useState(false);
  const [logInputMode, setLogInputMode] = useState<LogInputMode>("plain");
  const [campaignLibrary, setCampaignLibrary] = useState<CampaignLibraryState>(loadCampaignLibraryState);
  const [showApprovedReviewItems, setShowApprovedReviewItems] = useState(true);
  const [reviewKindFilter, setReviewKindFilter] = useState<ReviewKindFilter>("all");
  const [reviewQuery, setReviewQuery] = useState("");
  const [campaignQuery, setCampaignQuery] = useState("");
  const [sessionQuery, setSessionQuery] = useState("");
  const [transcriptionDraftJson, setTranscriptionDraftJson] = useState("");
  const [transcriptionImportError, setTranscriptionImportError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [providerSecrets, setProviderSecrets] = useState<ProviderSecretSettings>(loadProviderSecrets);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);

  const campaignState =
    campaignLibrary.campaigns.find((campaign) => campaign.id === campaignLibrary.activeCampaignId) ??
    campaignLibrary.campaigns[0];
  const currentSession =
    campaignState.sessions.find((session) => session.id === campaignState.activeSessionId) ?? campaignState.sessions[0];
  const {
    approvedIds,
    extractionItems: items,
    extractionRun,
    liveLog,
    log,
  } = currentSession;
  const {
    campaignName,
    chronicle,
    extractionProvider,
    quickResult,
    transcriptionProvider,
  } = campaignState;
  const selectedTranscriptionProvider = getTranscriptionProvider(transcriptionProvider.providerId);
  const transcriptionDraftPreview = useMemo(
    () => previewTranscriptionDraftPayload(transcriptionDraftJson),
    [transcriptionDraftJson],
  );

  const approvedCount = approvedIds.length;
  const remainingCount = items.length - approvedCount;
  const approvableRemainingCount = items.filter(
    (item) => !approvedIds.includes(item.id) && item.title.trim() && item.detail.trim(),
  ).length;
  const normalizedReviewQuery = reviewQuery.trim().toLowerCase();
  const reviewItems = items.filter((item) => {
    if (!showApprovedReviewItems && approvedIds.includes(item.id)) {
      return false;
    }

    if (reviewKindFilter !== "all" && item.kind !== reviewKindFilter) {
      return false;
    }

    return (
      !normalizedReviewQuery ||
      [item.title, item.detail, item.kind, item.visibility].some((value) =>
        value.toLowerCase().includes(normalizedReviewQuery),
      )
    );
  });
  const hasReviewFilter = reviewKindFilter !== "all" || !showApprovedReviewItems || normalizedReviewQuery.length > 0;
  const approvableVisibleReviewCount = reviewItems.filter(
    (item) => !approvedIds.includes(item.id) && item.title.trim() && item.detail.trim(),
  ).length;
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
  const normalizedCampaignQuery = campaignQuery.trim().toLowerCase();
  const visibleCampaigns = normalizedCampaignQuery
    ? campaignLibrary.campaigns.filter((campaign) =>
        campaign.campaignName.toLowerCase().includes(normalizedCampaignQuery),
      )
    : campaignLibrary.campaigns;
  const normalizedSessionQuery = sessionQuery.trim().toLowerCase();
  const visibleSessions = normalizedSessionQuery
    ? campaignState.sessions.filter((session) =>
        [session.title, session.date].some((value) => value.toLowerCase().includes(normalizedSessionQuery)),
      )
    : campaignState.sessions;
  const canExtractLog =
    logInputMode === "plain"
      ? log.trim().length > 0
      : liveLog.segments.some((segment) => segment.text.trim().length > 0);
  const dynamicPrepNote = useMemo(
    () => generatePrepNote(chronicle, campaignState.sessions, currentSession),
    [campaignState.sessions, chronicle, currentSession],
  );

  const progress = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }
    return Math.round((approvedCount / items.length) * 100);
  }, [approvedCount, items.length]);

  useEffect(() => {
    try {
      window.localStorage.setItem(CAMPAIGN_LIBRARY_STORAGE_KEY, JSON.stringify(campaignLibrary));
      setStorageError(null);
    } catch {
      setStorageError("キャンペーン状態をブラウザに保存できませんでした。書き出しで退避してください。");
    }
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
        setActiveTab("log");
      },
    });
  };

  const exportCampaignState = (): void => {
    const blob = new Blob([JSON.stringify(sanitizeCampaignStateForExport(campaignState), null, 2)], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = createExportFileName(campaignName);
    link.click();
    URL.revokeObjectURL(objectUrl);
    setStorageError(null);
  };

  const exportCampaignLibrary = (): void => {
    const blob = new Blob([JSON.stringify(sanitizeCampaignLibraryStateForExport(campaignLibrary), null, 2)], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = createExportFileName("campaign-library");
    link.click();
    URL.revokeObjectURL(objectUrl);
    setStorageError(null);
  };

  const exportTranscriptionDraftJson = (): void => {
    const drafts = liveLogToTranscriptionDrafts(currentSession.liveLog);
    const blob = new Blob([JSON.stringify({ segments: drafts }, null, 2)], {
      type: "application/json",
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = createExportFileName(`${currentSession.title}-transcription-draft`);
    link.click();
    URL.revokeObjectURL(objectUrl);
    setTranscriptionImportError(null);
  };

  const importCampaignState = async (file: File): Promise<void> => {
    try {
      const fileText = await file.text();
      const parsedState = JSON.parse(fileText);
      const isLibraryImport =
        typeof parsedState === "object" &&
        parsedState !== null &&
        Array.isArray((parsedState as { campaigns?: unknown }).campaigns);

      if (isLibraryImport) {
        const importedLibrary = normalizeCampaignLibraryState(parsedState);
        setConfirmation({
          title: "キャンペーンライブラリを置き換えますか",
          message: "現在の全キャンペーンをインポート内容で置き換えます。",
          confirmLabel: "全体を置き換える",
          onConfirm: () => {
            setCampaignLibrary(importedLibrary);
            setStorageError(null);
            setCampaignQuery("");
            setSessionQuery("");
            setLogInputMode("plain");
            setActiveTab("log");
          },
        });
        return;
      }

      const importedState = normalizeCampaignState(parsedState);
      const importedLegacyApiKey = readLegacyProviderApiKey(parsedState);
      setConfirmation({
        title: "キャンペーンを置き換えますか",
        message: "現在のキャンペーン状態をインポート内容で置き換えます。",
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
    setActiveTab("log");
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

  const importTranscriptionDraftJson = (): void => {
    try {
      const parsedDrafts = JSON.parse(transcriptionDraftJson) as unknown;
      const normalizedDrafts = normalizeTranscriptionDrafts(parsedDrafts);
      if (!normalizedDrafts) {
        setTranscriptionImportError("文字起こしドラフトは配列JSON、またはsegments配列を持つJSONで入力してください。");
        return;
      }

      if (normalizedDrafts.length === 0) {
        setTranscriptionImportError("textを持つ発話ドラフトがありません。");
        return;
      }

      const liveLogFromDrafts = transcriptionDraftsToLiveLog(
        normalizedDrafts,
        `${currentSession.title} 文字起こし`,
      );
      if (!liveLogFromDrafts) {
        setTranscriptionImportError("取り込める発話本文がありません。");
        return;
      }

      updateCurrentSession({ liveLog: liveLogFromDrafts });
      setTranscriptionDraftJson("");
      setTranscriptionImportError(null);
      setLogInputMode("speaker");
    } catch {
      setTranscriptionImportError("JSONとして読み込めません。");
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
        const endTimeSec = Math.max(startTimeSec, Math.round(normalizedEndTimeSec));

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

  const rejectItem = (itemId: string): void => {
    updateActiveSession((session) => ({
      ...session,
      approvedIds: session.approvedIds,
      extractionItems: session.approvedIds.includes(itemId)
        ? session.extractionItems
        : session.extractionItems.filter((item) => item.id !== itemId),
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-[260px_1fr_320px] max-xl:grid-cols-[220px_1fr] max-lg:grid-cols-1">
        <aside className="border-r bg-sidebar px-4 py-5 max-lg:border-b max-lg:border-r-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Chronicle GM</p>
              <p className="text-xs text-muted-foreground">Investigation mode</p>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">キャンペーン一覧</p>
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
                placeholder="キャンペーン名で検索"
                value={campaignQuery}
                onChange={(event) => setCampaignQuery(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              {visibleCampaigns.map((campaign) => (
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
                      {campaign.sessions.length}セッション / {campaign.chronicle.events.length + campaign.chronicle.clues.length}記憶
                    </span>
                  </button>
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
              <Button onClick={exportCampaignState} size="sm" variant="outline">
                <Download className="h-3.5 w-3.5" />
                現在を書き出し
              </Button>
              <Button onClick={exportCampaignLibrary} size="sm" variant="outline">
                <Download className="h-3.5 w-3.5" />
                全体を書き出し
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
              <p className="text-xs text-muted-foreground">この端末のブラウザに保存中。JSONでバックアップできます。</p>
            )}
          </div>

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-muted-foreground">セッション</label>
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
                placeholder="タイトル・日付で検索"
                value={sessionQuery}
                onChange={(event) => setSessionQuery(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              {visibleSessions.map((session) => (
                (() => {
                  const liveLogSummary = summarizeLiveLog(session.liveLog);

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
                          {liveLogSummary.lowConfidenceCount > 0 ? ` / 要確認${liveLogSummary.lowConfidenceCount}` : ""}
                        </span>
                      </button>
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
              { icon: Search, label: "調査ボード", count: chronicle.clues.length },
              { icon: UserRound, label: "NPC", count: chronicle.npcs.length },
              { icon: MapIcon, label: "場所", count: chronicle.locations.length },
              { icon: Clock3, label: "年表", count: chronicle.events.length },
              { icon: Sparkles, label: "伏線", count: chronicle.threads.length },
            ].map((item) => (
              <button
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                key={item.label}
                onClick={() => setActiveTab("chronicle")}
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
        </aside>

        <section className="min-w-0 px-6 py-5">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">{campaignName}</h1>
              <p className="text-sm text-muted-foreground">
                セッションログから手がかり、秘密、伏線を抽出して次回準備へつなげます。
              </p>
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
            <Tabs ariaLabel="ワークスペース" value={activeTab} options={tabOptions} onChange={setActiveTab} />
          </header>

          <div className="mt-5">
            {activeTab === "log" && (
              <div className="grid gap-4">
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
                        onDeleteSegment={deleteSegment}
                        onExtract={runExtractionPreview}
                        onReset={resetCampaignState}
                        onRestoreSample={restoreSampleLiveLog}
                        onUpdateSegment={updateSegment}
                        onNormalizeSpeakerName={normalizeSpeakerName}
                        onUpdateSpeakerName={updateSpeakerName}
                        onUpdateSpeakerRole={updateSpeakerRole}
                      />
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4" />
                      文字起こしドラフト取り込み
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Provider実装前の検証用に、発話配列JSONまたはsegments配列を持つJSONを話者付きログへ変換します。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
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
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4" />
                        入力をクリア
                      </Button>
                      <Button
                        disabled={!transcriptionDraftJson.trim() || isExtracting}
                        onClick={importTranscriptionDraftJson}
                        size="sm"
                        variant="outline"
                      >
                        <Upload className="h-4 w-4" />
                        話者付きログへ取り込み
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
                      <Badge variant="muted">draft-v1</Badge>
                    </div>
                  </CardContent>
                </Card>
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
                  <EmptyState extractionRun={extractionRun} onStart={() => setActiveTab("log")} />
                ) : (
                  <>
                    <Card>
                      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="muted">{approvedCount}採用済み</Badge>
                          <Badge variant="muted">{remainingCount}未確認</Badge>
                          {approvableRemainingCount !== remainingCount && (
                            <Badge variant="outline">{approvableRemainingCount}件採用可能</Badge>
                          )}
                          {hasReviewFilter && (
                            <Badge variant="outline">{reviewItems.length}件を表示中</Badge>
                          )}
                          {normalizedReviewQuery && <Badge variant="secondary">検索: {reviewQuery.trim()}</Badge>}
                        </div>
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
                          <Button
                            onClick={() => setShowApprovedReviewItems((current) => !current)}
                            size="sm"
                            variant="outline"
                          >
                            {showApprovedReviewItems ? "採用済みを隠す" : "採用済みも表示"}
                          </Button>
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
                        </div>
                      </CardContent>
                    </Card>
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
                chronicle={chronicle}
                onUpdateClueStatus={updateClueStatus}
                onUpdateNpcAttitude={updateNpcAttitude}
                onUpdateThreadNextMove={updateThreadNextMove}
              />
            )}

            {activeTab === "prep" && (
              <div className="grid gap-4">
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{currentSession.title} から次回準備</p>
                      <p className="text-xs text-muted-foreground">
                        承認済み記憶と現在のセッション状態から自動で組み立てています。
                      </p>
                    </div>
                    <Badge variant="outline">{campaignState.sessions.length}セッション</Badge>
                  </CardContent>
                </Card>
                <PrepSection title="3行あらすじ" items={dynamicPrepNote.shortRecap} icon={FileText} />
                <PrepSection title="次回導入案" items={dynamicPrepNote.hooks} icon={Compass} />
                <PrepSection title="未解決の問い" items={dynamicPrepNote.openQuestions} icon={Search} />
                <PrepSection title="GM確認メモ" items={dynamicPrepNote.reminders} icon={KeyRound} />
              </div>
            )}
          </div>
        </section>

        <aside className="border-l bg-panel px-4 py-5 max-xl:col-span-2 max-xl:border-l-0 max-xl:border-t max-lg:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">即興レスキュー</p>
              <p className="text-xs text-muted-foreground">セッション中に使う短い候補</p>
            </div>
            <Button size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
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
            <CardContent>
              <p className="text-sm leading-6">{quickResult}</p>
            </CardContent>
          </Card>

          <div className="mt-4">
            <ProviderSettingsCard
              isLocked={isExtracting}
              secrets={providerSecrets}
              settings={extractionProvider}
              onChangeSecrets={setProviderSecrets}
              onChange={(nextSettings) => updateCampaignState({ extractionProvider: nextSettings })}
            />
          </div>

          <Card className="mt-4">
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
                <Badge variant="outline">{selectedTranscriptionProvider.label}</Badge>
                <Badge variant="muted">言語 {transcriptionProvider.language}</Badge>
              </div>
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
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="h-4 w-4" />
                拡張予定
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>ファンタジーモードでは、手がかりをクエスト、秘密を勢力事情、伏線を世界変化へ置き換えます。</p>
              <p>AI接続はユーザーAPIキー方式にして、ローカル保存を基本にします。</p>
            </CardContent>
          </Card>
        </aside>
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
