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
  Plus,
  Search,
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
import { sampleLiveLog } from "./data/sample";
import {
  applyExtraction,
  createExportFileName,
  createId,
  createNewSession,
  generatePrepNote,
  initialCampaignState,
  normalizeCampaignState,
} from "./lib/campaign";
import {
  liveLogToPlainText,
  parsePlainLogToLiveLog,
} from "./lib/extraction";
import { defaultProviderSecretSettings } from "./lib/extraction-provider-settings";
import { runExtractionProvider } from "./lib/extraction-providers";
import type {
  CampaignState,
  ExtractionRun,
  ExtractionItem,
  LiveLogSession,
  ProviderSecretSettings,
  SessionState,
  SpeakerRole,
  TranscriptSegment,
  WorkspaceTab,
} from "./types";

const STORAGE_KEY = "chronicle-gm.campaign-state.v1";
const PROVIDER_SECRETS_STORAGE_KEY = "chronicle-gm.provider-secrets.v1";

type LogInputMode = "plain" | "speaker";

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

const logInputOptions: Array<{ value: LogInputMode; label: string }> = [
  { value: "plain", label: "通常ログ" },
  { value: "speaker", label: "話者付きログ" },
];

const extractionSourceLabels: Record<ExtractionRun["sourceType"], string> = {
  plain: "通常ログ由来",
  speaker: "話者付きログ由来",
  fallback: "フォールバック",
};

function loadCampaignState(): CampaignState {
  if (typeof window === "undefined") {
    return initialCampaignState;
  }

  const savedState = window.localStorage.getItem(STORAGE_KEY);
  if (!savedState) {
    return initialCampaignState;
  }

  try {
    return normalizeCampaignState(JSON.parse(savedState));
  } catch {
    return initialCampaignState;
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
      return {
        ...defaultProviderSecretSettings,
        ...JSON.parse(savedSecrets),
      };
    } catch {
      return defaultProviderSecretSettings;
    }
  }

  const savedState = window.localStorage.getItem(STORAGE_KEY);
  if (!savedState) {
    return defaultProviderSecretSettings;
  }

  try {
    return {
      ...defaultProviderSecretSettings,
      openAiApiKey: readLegacyProviderApiKey(JSON.parse(savedState)),
    };
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

export function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("log");
  const [isExtracting, setIsExtracting] = useState(false);
  const [logInputMode, setLogInputMode] = useState<LogInputMode>("plain");
  const [campaignState, setCampaignState] = useState<CampaignState>(loadCampaignState);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [providerSecrets, setProviderSecrets] = useState<ProviderSecretSettings>(loadProviderSecrets);

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
  } = campaignState;

  const approvedCount = approvedIds.length;
  const remainingCount = items.length - approvedCount;
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaignState));
      setStorageError(null);
    } catch {
      setStorageError("キャンペーン状態をブラウザに保存できませんでした。書き出しで退避してください。");
    }
  }, [campaignState]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PROVIDER_SECRETS_STORAGE_KEY, JSON.stringify(providerSecrets));
    } catch {
      setStorageError("Provider secrets をブラウザに保存できませんでした。");
    }
  }, [providerSecrets]);

  const updateCampaignState = (updates: Partial<CampaignState>): void => {
    setCampaignState((current) => ({ ...current, ...updates }));
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

  const importCampaignState = async (file: File): Promise<void> => {
    try {
      const fileText = await file.text();
      const parsedState = JSON.parse(fileText);
      const importedState = normalizeCampaignState(parsedState);
      const importedLegacyApiKey = readLegacyProviderApiKey(parsedState);
      const confirmed = window.confirm("現在のキャンペーン状態をインポート内容で置き換えます。続行しますか？");
      if (!confirmed) {
        return;
      }

      setCampaignState(importedState);
      if (importedLegacyApiKey) {
        setProviderSecrets((current) => ({ ...current, openAiApiKey: importedLegacyApiKey }));
      }
      setStorageError(null);
      setLogInputMode("plain");
      setActiveTab("log");
    } catch {
      window.alert("JSONを読み込めませんでした。Chronicle GMのエクスポートファイルか確認してください。");
    }
  };

  const updateActiveSession = (updater: (currentSession: SessionState) => SessionState): void => {
    setCampaignState((current) => ({
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
    setCampaignState((current) => ({
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
    setCampaignState((current) => ({
      ...current,
      activeSessionId: sessionId,
    }));
    setActiveTab("log");
  };

  const addNewSession = (): void => {
    setCampaignState((current) => {
      const nextSession = createNewSession(current.sessions.length + 1);

      return {
        ...current,
        sessions: [...current.sessions, nextSession],
        activeSessionId: nextSession.id,
      };
    });
    setLogInputMode("plain");
    setActiveTab("log");
  };

  const deleteSession = (sessionId: string): void => {
    const targetSession = campaignState.sessions.find((session) => session.id === sessionId);
    if (!targetSession || campaignState.sessions.length <= 1) {
      return;
    }

    const confirmed = window.confirm(`${targetSession.title}を削除します。ログと抽出候補は元に戻せません。`);
    if (!confirmed) {
      return;
    }

    setCampaignState((current) => {
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
    setLogInputMode("plain");
    setActiveTab("log");
  };

  const resetCampaignState = (): void => {
    window.localStorage.removeItem(STORAGE_KEY);
    setCampaignState(initialCampaignState);
    setActiveTab("log");
  };

  const runExtractionPreview = async (): Promise<void> => {
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
      setCampaignState((current) =>
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
    updateCurrentSession({ liveLog: sampleLiveLog });
  };

  const updateSpeakerName = (speakerId: string, name: string): void => {
    updateLiveLog((current) => ({
      ...current,
      speakers: current.speakers.map((speaker) => (speaker.id === speakerId ? { ...speaker, name } : speaker)),
    }));
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
      segments: current.segments.map((segment) =>
        segment.id === segmentId ? { ...segment, ...updates } : segment,
      ),
    }));
  };

  const addSegment = (): void => {
    updateLiveLog((current) => {
      const lastSegment = current.segments[current.segments.length - 1];
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
    setCampaignState((current) => ({
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
      extractionItems: session.extractionItems.map((item) => (item.id === itemId ? { ...item, ...updates } : item)),
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
            <label className="text-xs font-medium text-muted-foreground">キャンペーン</label>
            <Input
              disabled={isExtracting}
              value={campaignName}
              onChange={(event) => updateCampaignState({ campaignName: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={exportCampaignState} size="sm" variant="outline">
                <Download className="h-3.5 w-3.5" />
                書き出し
              </Button>
              <label
                className={
                  isExtracting
                    ? "inline-flex h-8 cursor-not-allowed items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium opacity-50"
                    : "inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                }
              >
                <Upload className="h-3.5 w-3.5" />
                読み込み
                <input
                  accept="application/json,.json"
                  className="sr-only"
                  disabled={isExtracting}
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
            {storageError ? (
              <p className="text-xs text-destructive">{storageError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">ブラウザにローカル自動保存中</p>
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
            <div className="space-y-1">
              {campaignState.sessions.map((session) => (
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
                      {session.date} / {session.extractionItems.length}候補
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
              ))}
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
                  <label className="text-xs font-medium text-muted-foreground">今回のセッション</label>
                  <Input
                    className="mt-1 w-44"
                    disabled={isExtracting}
                    value={currentSession.title}
                    onChange={(event) => updateCurrentSession({ title: event.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">日付</label>
                  <Input
                    className="mt-1 w-40"
                    disabled={isExtracting}
                    type="date"
                    value={currentSession.date}
                    onChange={(event) => updateCurrentSession({ date: event.target.value })}
                  />
                </div>
              </div>
            </div>
            <Tabs value={activeTab} options={tabOptions} onChange={setActiveTab} />
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
                      <Tabs value={logInputMode} options={logInputOptions} onChange={setLogInputMode} />
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
                        onApplyToPlainLog={applyLiveLogToPlainLog}
                        onDeleteSegment={deleteSegment}
                        onExtract={runExtractionPreview}
                        onReset={resetCampaignState}
                        onRestoreSample={restoreSampleLiveLog}
                        onUpdateSegment={updateSegment}
                        onUpdateSpeakerName={updateSpeakerName}
                        onUpdateSpeakerRole={updateSpeakerRole}
                      />
                    )}
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
                            <Badge variant="secondary">
                              検証エラー {extractionRun.validationErrors.length}件
                            </Badge>
                          )}
                        </div>
                      </div>

                      {extractionRun.failureReason && (
                        <p className="text-xs text-destructive">失敗理由: {extractionRun.failureReason}</p>
                      )}
                      {extractionRun.validationErrors && extractionRun.validationErrors.length > 0 && (
                        <details className="text-xs text-destructive">
                          <summary className="cursor-pointer">検証メモを表示</summary>
                          <ul className="mt-2 grid gap-1">
                            {extractionRun.validationErrors.map((error) => (
                              <li key={error}>{error}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                )}
                {items.length === 0 ? (
                  <EmptyState hasRun={extractionRun !== null} onStart={() => setActiveTab("log")} />
                ) : (
                  <>
                    {items.map((item) => {
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
                    })}
                  </>
                )}
              </div>
            )}

            {activeTab === "chronicle" && <ChronicleView chronicle={chronicle} />}

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
    </main>
  );
}

function EmptyState({ hasRun, onStart }: { hasRun: boolean; onStart: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasRun ? "抽出候補は見つかりませんでした" : "抽出結果はまだありません"}</CardTitle>
        <CardDescription>
          {hasRun ? "ログの内容を調整するか、Provider設定を確認してもう一度実行してください。" : "ログを貼り付けて抽出プレビューを実行してください。"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onStart}>ログへ戻る</Button>
      </CardContent>
    </Card>
  );
}
