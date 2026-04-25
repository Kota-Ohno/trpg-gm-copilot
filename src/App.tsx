import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Clock3,
  Compass,
  FileText,
  KeyRound,
  Lightbulb,
  Map as MapIcon,
  MessageSquareText,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Swords,
  Trash2,
  UserRound,
  Wand2,
  X,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Tabs } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { initialChronicle, mockExtraction, prepNote, sampleLiveLog, sampleLog } from "./data/sample";
import type {
  CampaignState,
  Chronicle,
  ExtractionRun,
  ExtractionItem,
  LiveLogSession,
  SpeakerRole,
  Speaker,
  TranscriptSegment,
  WorkspaceTab,
} from "./types";

const STORAGE_KEY = "chronicle-gm.campaign-state.v1";

type LogInputMode = "plain" | "speaker";
type ExtractionSource = "plain" | "speaker";

type ExtractionInputLine = {
  role?: SpeakerRole;
  speakerName?: string;
  text: string;
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

const initialCampaignState: CampaignState = {
  campaignName: "灰ヶ浦異聞",
  log: sampleLog,
  liveLog: sampleLiveLog,
  extractionItems: [],
  extractionRun: null,
  approvedIds: [],
  chronicle: initialChronicle,
  quickResult: quickPrompts[0].result,
};

const statusLabels = {
  known: "PL既知",
  partial: "一部既知",
  hidden: "GM秘密",
};

const speakerRoleLabels: Record<SpeakerRole, string> = {
  GM: "GM",
  PL: "PL",
  unknown: "不明",
};

const logInputOptions: Array<{ value: LogInputMode; label: string }> = [
  { value: "plain", label: "通常ログ" },
  { value: "speaker", label: "話者付きログ" },
];

const extractionKindOptions: ExtractionItem["kind"][] = ["出来事", "NPC", "手がかり", "GM秘密", "伏線"];
const extractionVisibilityOptions: ExtractionItem["visibility"][] = ["PL既知", "GMのみ", "未開示候補"];
const npcNamePattern = /(?:女将|村長|灯台守|船長|医師|司祭|娘|甥|少女|少年|老人|男|女)(?:の)?([ァ-ヶー一-龠々]{1,8})|([ァ-ヶー一-龠々]{1,8})(?:は|が).*(?:話|言|証言)/;
const extractionSourceLabels: Record<ExtractionRun["sourceType"], string> = {
  plain: "通常ログ由来",
  speaker: "話者付きログ由来",
  fallback: "サンプル抽出",
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
    const parsedState = JSON.parse(savedState) as Partial<CampaignState>;

    return {
      ...initialCampaignState,
      ...parsedState,
      liveLog: parsedState.liveLog ?? initialCampaignState.liveLog,
    };
  } catch {
    return initialCampaignState;
  }
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

function liveLogToPlainText(liveLog: LiveLogSession): string {
  return [...liveLog.segments]
    .sort((first, second) => first.startTimeSec - second.startTimeSec)
    .map((segment) => {
      const speaker = liveLog.speakers.find((candidate) => candidate.id === segment.speakerId);
      return `${speaker?.name ?? "話者不明"}: ${segment.text}`;
    })
    .join("\n");
}

function liveLogToExtractionLines(liveLog: LiveLogSession): ExtractionInputLine[] {
  return [...liveLog.segments]
    .sort((first, second) => first.startTimeSec - second.startTimeSec)
    .map((segment) => {
      const speaker = liveLog.speakers.find((candidate) => candidate.id === segment.speakerId);

      return {
        role: speaker?.role,
        speakerName: speaker?.name,
        text: segment.text,
      };
    });
}

function plainLogToExtractionLines(log: string): ExtractionInputLine[] {
  const lines: ExtractionInputLine[] = [];

  log.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const match = line.match(/^(?:\[[^\]]+\]\s*)?([^:：]{1,32})[:：]\s*(.+)$/);
    if (!match) {
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        lastLine.text = `${lastLine.text}\n${line}`;
      }
      return;
    }

    const speakerName = match[1].trim();
    lines.push({
      role: inferSpeakerRole(speakerName),
      speakerName,
      text: match[2].trim(),
    });
  });

  return lines;
}

function lineToDetail(line: ExtractionInputLine): string {
  const prefix = line.speakerName ? `${line.speakerName}: ` : "";
  return `${prefix}${line.text}`;
}

function findNpcName(text: string): string | null {
  const match = text.match(npcNamePattern);
  return match?.[1] ?? match?.[2] ?? null;
}

function addExtractionCandidate(
  candidates: ExtractionItem[],
  item: Omit<ExtractionItem, "id">,
  seenKeys: Set<string>,
): void {
  const key = `${item.kind}:${item.title}:${item.detail}`;
  if (seenKeys.has(key)) {
    return;
  }

  seenKeys.add(key);
  candidates.push({
    id: `generated-${candidates.length + 1}`,
    ...item,
  });
}

function buildExtractionInput(log: string, liveLog: LiveLogSession, source: ExtractionSource): ExtractionInputLine[] {
  if (source === "speaker") {
    return liveLogToExtractionLines(liveLog);
  }

  return plainLogToExtractionLines(log);
}

function runRuleBasedExtraction(lines: ExtractionInputLine[]): ExtractionItem[] {
  const candidates: ExtractionItem[] = [];
  const seenKeys = new Set<string>();

  lines.forEach((line) => {
    const text = line.text;
    const detail = lineToDetail(line);

    if (/(到着|向か|入る|移動|調べ|探索|聞き|行く)/.test(text)) {
      addExtractionCandidate(
        candidates,
        {
          kind: "出来事",
          title: text.replace(/[。.!！?？].*$/, "").slice(0, 28),
          detail,
          visibility: "PL既知",
        },
        seenKeys,
      );
    }

    if (/(見つ|発見|残って|刻ま|書か|目撃|証言|噂|手がかり|泥|鍵|扉|紋章|光)/.test(text)) {
      addExtractionCandidate(
        candidates,
        {
          kind: "手がかり",
          title: text.replace(/[。.!！?？].*$/, "").slice(0, 28),
          detail,
          visibility: "PL既知",
        },
        seenKeys,
      );
    }

    if (/(近づくな|封じ|怪物ではない|秘密|隠|口を閉ざ|警告|開けるな|真相|儀式)/.test(text)) {
      addExtractionCandidate(
        candidates,
        {
          kind: "GM秘密",
          title: text.replace(/[。.!！?？].*$/, "").slice(0, 28),
          detail,
          visibility: line.role === "GM" ? "GMのみ" : "未開示候補",
        },
        seenKeys,
      );
    }

    if (/(伏線|後で|次回|まだ|未解決|謎|月|封印|過去|娘|行方不明)/.test(text)) {
      addExtractionCandidate(
        candidates,
        {
          kind: "伏線",
          title: text.replace(/[。.!！?？].*$/, "").slice(0, 28),
          detail,
          visibility: line.role === "GM" ? "未開示候補" : "PL既知",
        },
        seenKeys,
      );
    }

    const npcName = findNpcName(text);
    if (npcName) {
      addExtractionCandidate(
        candidates,
        {
          kind: "NPC",
          title: npcName,
          detail,
          visibility: line.role === "GM" ? "未開示候補" : "PL既知",
        },
        seenKeys,
      );
    }
  });

  return candidates.slice(0, 8);
}

function inferSpeakerRole(name: string): SpeakerRole {
  const normalizedName = name.trim().toLowerCase();

  if (["gm", "kp", "dm", "keeper", "ゲームマスター", "キーパー"].includes(normalizedName)) {
    return "GM";
  }

  return "PL";
}

function parsePlainLogToLiveLog(log: string, title: string): LiveLogSession | null {
  const speakersByName = new Map<string, Speaker>();
  const segments: TranscriptSegment[] = [];
  let activeSegment: TranscriptSegment | null = null;

  log.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const match = line.match(/^(?:\[[^\]]+\]\s*)?([^:：]{1,32})[:：]\s*(.+)$/);
    if (!match) {
      if (activeSegment) {
        activeSegment.text = `${activeSegment.text}\n${line}`;
      }
      return;
    }

    const speakerName = match[1].trim();
    const text = match[2].trim();
    let speaker = speakersByName.get(speakerName);

    if (!speaker) {
      speaker = {
        id: createId("speaker"),
        name: speakerName,
        role: inferSpeakerRole(speakerName),
      };
      speakersByName.set(speakerName, speaker);
    }

    const startTimeSec = segments.length * 8;
    activeSegment = {
      id: createId("segment"),
      speakerId: speaker.id,
      startTimeSec,
      endTimeSec: startTimeSec + 6,
      text,
    };
    segments.push(activeSegment);
  });

  if (segments.length === 0) {
    return null;
  }

  return {
    id: createId("session"),
    title,
    sourceType: "imported",
    speakers: Array.from(speakersByName.values()),
    segments,
  };
}

function applyExtraction(chronicle: Chronicle, item: ExtractionItem): Chronicle {
  if (item.kind === "NPC") {
    return {
      ...chronicle,
      npcs: [
        ...chronicle.npcs,
        {
          name: item.title,
          role: "セッションログから抽出",
          publicKnowledge: item.detail,
          gmSecret: item.visibility === "GMのみ" ? item.detail : "未設定",
          attitude: "未設定",
        },
      ],
    };
  }

  if (item.kind === "手がかり" || item.kind === "GM秘密") {
    return {
      ...chronicle,
      clues: [
        ...chronicle.clues,
        {
          title: item.title,
          detail: item.detail,
          status: item.visibility === "GMのみ" ? "hidden" : "known",
        },
      ],
    };
  }

  if (item.kind === "伏線") {
    return {
      ...chronicle,
      threads: [
        ...chronicle.threads,
        {
          title: item.title,
          detail: item.detail,
          nextMove: "次回準備で使う候補として保持する。",
        },
      ],
    };
  }

  return {
    ...chronicle,
    events: [...chronicle.events, `${item.title}: ${item.detail}`],
  };
}

export function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("log");
  const [logInputMode, setLogInputMode] = useState<LogInputMode>("plain");
  const [campaignState, setCampaignState] = useState<CampaignState>(loadCampaignState);

  const {
    approvedIds,
    campaignName,
    chronicle,
    extractionItems: items,
    extractionRun,
    liveLog,
    log,
    quickResult,
  } = campaignState;

  const approvedCount = approvedIds.length;
  const remainingCount = items.length - approvedCount;

  const progress = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }
    return Math.round((approvedCount / items.length) * 100);
  }, [approvedCount, items.length]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaignState));
  }, [campaignState]);

  const updateCampaignState = (updates: Partial<CampaignState>): void => {
    setCampaignState((current) => ({ ...current, ...updates }));
  };

  const updateLiveLog = (updater: (current: LiveLogSession) => LiveLogSession): void => {
    setCampaignState((current) => ({
      ...current,
      liveLog: updater(current.liveLog),
    }));
  };

  const resetCampaignState = (): void => {
    window.localStorage.removeItem(STORAGE_KEY);
    setCampaignState(initialCampaignState);
    setActiveTab("log");
  };

  const runExtractionPreview = (): void => {
    const extractionLines = buildExtractionInput(log, liveLog, logInputMode);
    const generatedItems = runRuleBasedExtraction(extractionLines);
    const nextItems = generatedItems.length > 0 ? generatedItems : mockExtraction;

    updateCampaignState({
      extractionItems: nextItems,
      extractionRun: {
        sourceType: generatedItems.length > 0 ? logInputMode : "fallback",
        itemCount: nextItems.length,
      },
      approvedIds: [],
    });
    setActiveTab("review");
  };

  const applyLiveLogToPlainLog = (): void => {
    updateCampaignState({ log: liveLogToPlainText(liveLog) });
    setLogInputMode("plain");
  };

  const importPlainLogToLiveLog = (): void => {
    const importedLiveLog = parsePlainLogToLiveLog(log, `${campaignName} 取り込みログ`);
    if (!importedLiveLog) {
      return;
    }

    updateCampaignState({ liveLog: importedLiveLog });
    setLogInputMode("speaker");
  };

  const restoreSampleLiveLog = (): void => {
    updateCampaignState({ liveLog: sampleLiveLog });
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

      return {
        ...current,
        segments: [
          ...current.segments,
          {
            id: createId("segment"),
            speakerId: current.speakers[0]?.id ?? "",
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
    if (approvedIds.includes(item.id)) {
      return;
    }
    setCampaignState((current) => ({
      ...current,
      approvedIds: [...current.approvedIds, item.id],
      chronicle: applyExtraction(current.chronicle, item),
    }));
  };

  const rejectItem = (itemId: string): void => {
    setCampaignState((current) => ({
      ...current,
      approvedIds: current.approvedIds.filter((id) => id !== itemId),
      extractionItems: current.extractionItems.filter((item) => item.id !== itemId),
    }));
  };

  const updateExtractionItem = (itemId: string, updates: Partial<ExtractionItem>): void => {
    setCampaignState((current) => ({
      ...current,
      extractionItems: current.extractionItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
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
              value={campaignName}
              onChange={(event) => updateCampaignState({ campaignName: event.target.value })}
            />
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
              <span className="text-muted-foreground">{progress}%</span>
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
                        log={log}
                        onChange={(nextLog) => updateCampaignState({ log: nextLog })}
                        onExtract={runExtractionPreview}
                        onImportToSpeakerLog={importPlainLogToLiveLog}
                        onReset={resetCampaignState}
                      />
                    ) : (
                      <SpeakerLogEditor
                        liveLog={liveLog}
                        onAddSegment={addSegment}
                        onApplyToPlainLog={applyLiveLogToPlainLog}
                        onDeleteSegment={deleteSegment}
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
                {items.length === 0 ? (
                  <EmptyState onStart={() => setActiveTab("log")} />
                ) : (
                  <>
                    {extractionRun && (
                      <Card>
                        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={extractionRun.sourceType === "fallback" ? "secondary" : "outline"}>
                              {extractionSourceLabels[extractionRun.sourceType]}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {extractionRun.itemCount}件の抽出候補を確認中
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            ルールベース抽出です。採用前に内容を調整してください。
                          </span>
                        </CardContent>
                      </Card>
                    )}
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
                <PrepSection title="3行あらすじ" items={prepNote.shortRecap} icon={FileText} />
                <PrepSection title="次回導入案" items={prepNote.hooks} icon={Compass} />
                <PrepSection title="未解決の問い" items={prepNote.openQuestions} icon={Search} />
                <PrepSection title="GM確認メモ" items={prepNote.reminders} icon={KeyRound} />
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

function PlainLogEditor({
  log,
  onChange,
  onExtract,
  onImportToSpeakerLog,
  onReset,
}: {
  log: string;
  onChange: (log: string) => void;
  onExtract: () => void;
  onImportToSpeakerLog: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <Textarea
        className="min-h-[420px] resize-y font-mono text-sm leading-6"
        value={log}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{log.length.toLocaleString()}文字</p>
          <Badge variant="outline">ローカル自動保存</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onReset} variant="outline">
            <RotateCcw className="h-4 w-4" />
            デモ初期化
          </Button>
          <Button onClick={onImportToSpeakerLog} variant="outline">
            <MessageSquareText className="h-4 w-4" />
            話者付きログ化
          </Button>
          <Button onClick={onExtract}>
            <Wand2 className="h-4 w-4" />
            抽出プレビュー
          </Button>
        </div>
      </div>
    </>
  );
}

function SpeakerLogEditor({
  liveLog,
  onAddSegment,
  onApplyToPlainLog,
  onDeleteSegment,
  onReset,
  onRestoreSample,
  onUpdateSegment,
  onUpdateSpeakerName,
  onUpdateSpeakerRole,
}: {
  liveLog: LiveLogSession;
  onAddSegment: () => void;
  onApplyToPlainLog: () => void;
  onDeleteSegment: (segmentId: string) => void;
  onReset: () => void;
  onRestoreSample: () => void;
  onUpdateSegment: (segmentId: string, updates: Partial<TranscriptSegment>) => void;
  onUpdateSpeakerName: (speakerId: string, name: string) => void;
  onUpdateSpeakerRole: (speakerId: string, role: SpeakerRole) => void;
}) {
  const sortedSegments = [...liveLog.segments].sort((first, second) => first.startTimeSec - second.startTimeSec);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {liveLog.sourceType === "sample" ? "サンプル" : liveLog.sourceType === "imported" ? "取り込み" : "手動"}
            </Badge>
            <Badge variant="muted">{liveLog.segments.length}発話</Badge>
            <Badge variant="muted">{liveLog.speakers.length}話者</Badge>
          </div>
          <p className="mt-2 text-sm font-medium">{liveLog.title}</p>
          <p className="text-xs text-muted-foreground">
            音声連携前の検証用です。話者付き発話を通常ログへ反映して、既存の抽出フローに渡します。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRestoreSample} variant="outline">
            <RotateCcw className="h-4 w-4" />
            サンプル復元
          </Button>
          <Button onClick={onReset} variant="outline">
            <RotateCcw className="h-4 w-4" />
            デモ初期化
          </Button>
          <Button onClick={onApplyToPlainLog}>
            <FileText className="h-4 w-4" />
            通常ログへ反映
          </Button>
        </div>
      </div>

      <section className="grid gap-3">
        <div className="flex items-center gap-2">
          <UserRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">話者</h2>
        </div>
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          {liveLog.speakers.map((speaker) => (
            <div className="rounded-md border bg-background p-3" key={speaker.id}>
              <label className="text-xs font-medium text-muted-foreground">名前</label>
              <Input
                className="mt-1"
                value={speaker.name}
                onChange={(event) => onUpdateSpeakerName(speaker.id, event.target.value)}
              />
              <label className="mt-3 block text-xs font-medium text-muted-foreground">ロール</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={speaker.role}
                onChange={(event) => onUpdateSpeakerRole(speaker.id, event.target.value as SpeakerRole)}
              >
                {Object.entries(speakerRoleLabels).map(([role, label]) => (
                  <option key={role} value={role}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">発話ログ</h2>
          </div>
          <Button onClick={onAddSegment} size="sm" variant="outline">
            <Plus className="h-4 w-4" />
            発話を追加
          </Button>
        </div>

        <div className="grid gap-3">
          {sortedSegments.map((segment) => {
            const speaker = liveLog.speakers.find((candidate) => candidate.id === segment.speakerId);

            return (
              <div className="grid grid-cols-[120px_160px_1fr_40px] gap-3 rounded-md border bg-background p-3 max-lg:grid-cols-1" key={segment.id}>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">時刻</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <Input
                      aria-label="開始秒"
                      min={0}
                      type="number"
                      value={segment.startTimeSec}
                      onChange={(event) =>
                        onUpdateSegment(segment.id, { startTimeSec: Number(event.target.value) || 0 })
                      }
                    />
                    <Input
                      aria-label="終了秒"
                      min={0}
                      type="number"
                      value={segment.endTimeSec}
                      onChange={(event) =>
                        onUpdateSegment(segment.id, { endTimeSec: Number(event.target.value) || 0 })
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatTimestamp(segment.startTimeSec)} - {formatTimestamp(segment.endTimeSec)}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">話者</label>
                  <select
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={segment.speakerId}
                    onChange={(event) => onUpdateSegment(segment.id, { speakerId: event.target.value })}
                  >
                    {liveLog.speakers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} / {speakerRoleLabels[candidate.role]}
                      </option>
                    ))}
                  </select>
                  {speaker && (
                    <Badge className="mt-2" variant={speaker.role === "GM" ? "secondary" : "outline"}>
                      {speakerRoleLabels[speaker.role]}
                    </Badge>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">発話</label>
                  <Textarea
                    className="mt-1 min-h-[84px] resize-y text-sm leading-6"
                    value={segment.text}
                    onChange={(event) => onUpdateSegment(segment.id, { text: event.target.value })}
                  />
                </div>

                <div className="flex items-start justify-end">
                  <Button aria-label="発話を削除" onClick={() => onDeleteSegment(segment.id)} size="icon" variant="outline">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ExtractionReviewCard({
  isApproved,
  item,
  onApprove,
  onReject,
  onUpdate,
}: {
  isApproved: boolean;
  item: ExtractionItem;
  onApprove: (item: ExtractionItem) => void;
  onReject: (itemId: string) => void;
  onUpdate: (itemId: string, updates: Partial<ExtractionItem>) => void;
}) {
  return (
    <Card className={isApproved ? "border-primary/40 bg-primary/5" : ""}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge>{item.kind}</Badge>
              <Badge variant={item.visibility === "GMのみ" ? "secondary" : "outline"}>{item.visibility}</Badge>
              {isApproved && <Badge variant="muted">採用済み</Badge>}
            </div>
            <CardTitle>{item.title || "無題の抽出候補"}</CardTitle>
            <CardDescription className="mt-2 leading-6">
              GMが確認して、必要なら直してから採用します。
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              aria-label="採用"
              disabled={isApproved}
              onClick={() => onApprove(item)}
              size="icon"
              variant={isApproved ? "secondary" : "default"}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button aria-label="破棄" onClick={() => onReject(item.id)} size="icon" variant="outline">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <div>
            <label className="text-xs font-medium text-muted-foreground">種別</label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isApproved}
              value={item.kind}
              onChange={(event) => onUpdate(item.id, { kind: event.target.value as ExtractionItem["kind"] })}
            >
              {extractionKindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">公開範囲</label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isApproved}
              value={item.visibility}
              onChange={(event) =>
                onUpdate(item.id, { visibility: event.target.value as ExtractionItem["visibility"] })
              }
            >
              {extractionVisibilityOptions.map((visibility) => (
                <option key={visibility} value={visibility}>
                  {visibility}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">タイトル</label>
          <Input
            className="mt-1"
            disabled={isApproved}
            value={item.title}
            onChange={(event) => onUpdate(item.id, { title: event.target.value })}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">本文</label>
          <Textarea
            className="mt-1 min-h-[116px] resize-y text-sm leading-6 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApproved}
            value={item.detail}
            onChange={(event) => onUpdate(item.id, { detail: event.target.value })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>抽出結果はまだありません</CardTitle>
        <CardDescription>ログを貼り付けて抽出プレビューを実行してください。</CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onStart}>ログへ戻る</Button>
      </CardContent>
    </Card>
  );
}

function ChronicleView({ chronicle }: { chronicle: Chronicle }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>手がかり</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {chronicle.clues.map((clue) => (
            <div className="rounded-md border p-3" key={`${clue.title}-${clue.detail}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{clue.title}</p>
                <Badge variant={clue.status === "hidden" ? "secondary" : "outline"}>{statusLabels[clue.status]}</Badge>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{clue.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>NPC</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chronicle.npcs.map((npc) => (
              <div className="rounded-md border p-3" key={npc.name}>
                <p className="font-medium">{npc.name}</p>
                <p className="text-sm text-muted-foreground">{npc.role}</p>
                <p className="mt-2 text-sm leading-6">{npc.publicKnowledge}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>伏線</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chronicle.threads.map((thread) => (
              <div className="rounded-md border p-3" key={thread.title}>
                <p className="font-medium">{thread.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{thread.detail}</p>
                <p className="mt-2 text-sm leading-6">{thread.nextMove}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PrepSection({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: typeof FileText;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item) => (
            <li className="rounded-md border bg-background px-3 py-2 text-sm leading-6" key={item}>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
