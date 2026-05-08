import { initialChronicle, sampleLiveLog, sampleLog } from "../data/sample";
import type {
  CampaignMode,
  CampaignLibraryState,
  CampaignState,
  Chronicle,
  Clue,
  ExtractionItem,
  ExtractionProviderId,
  ExtractionProviderSettings,
  ExtractionRun,
  LiveLogSession,
  Location,
  Npc,
  PrepNote,
  Speaker,
  SpeakerRole,
  SessionState,
  Thread,
  TranscriptionRun,
  TranscriptionProviderId,
  TranscriptionProviderSettings,
  TranscriptSegment,
  TranscriptSourceType,
} from "../types";
import {
  defaultExtractionProviderSettings,
  defaultTranscriptionProviderSettings,
  getExtractionProvider,
  getTranscriptionProvider,
} from "./extraction-provider-settings";

export const blankLiveLog: LiveLogSession = {
  id: "live-log-empty",
  title: "新しいセッション",
  sourceType: "manual",
  speakers: [
    {
      id: "speaker-gm",
      name: "GM",
      role: "GM",
    },
  ],
  segments: [],
};

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function countChronicleItems(chronicle: Chronicle): number {
  return (
    chronicle.events.length +
    chronicle.clues.length +
    chronicle.npcs.length +
    chronicle.locations.length +
    chronicle.threads.length
  );
}

export type CampaignSummaryStats = {
  archivedSessionCount: number;
  approvedCount: number;
  candidateCount: number;
  lowConfidenceSegmentCount: number;
  memoryCount: number;
  nonEmptySegmentCount: number;
  sessionCount: number;
  transcribedSessionCount: number;
};

export type ContinuityQueueItem = {
  count?: number;
  detail: string;
  id: string;
  priority: "high" | "medium" | "low";
  target: "log" | "review" | "memory" | "prep" | "sessions";
  title: string;
};

export type SessionWrapUpChecklistItem = {
  detail: string;
  id: string;
  label: string;
  status: "done" | "todo";
  target: "log" | "review" | "memory" | "prep" | "share" | "sessions";
};

export type PlayerHandoutSafetyWarning = {
  id: string;
  label: string;
  leakedText: string;
  source: "gm-secret" | "hidden-clue" | "partial-clue" | "thread";
};

export type PlayerHandoutShareStatus = {
  canShare: boolean;
  message: string;
  warningCount: number;
};

export type CampaignStarterTemplateId = "investigation-demo" | "fantasy-campaign";

export type CampaignStarterTemplate = {
  description: string;
  id: CampaignStarterTemplateId;
  label: string;
  mode: CampaignMode;
};

export const campaignStarterTemplates: CampaignStarterTemplate[] = [
  {
    description: "PL既知、GM秘密、未開示手がかりの流れを試せる調査卓。",
    id: "investigation-demo",
    label: "調査サンプル",
    mode: "investigation",
  },
  {
    description: "依頼、勢力事情、世界変化を継続管理する長期キャンペーン。",
    id: "fantasy-campaign",
    label: "ファンタジー雛形",
    mode: "fantasy",
  },
];

export function getCampaignSummaryStats(campaign: CampaignState): CampaignSummaryStats {
  return {
    archivedSessionCount: campaign.sessions.filter((session) => Boolean(session.archivedAt)).length,
    approvedCount: campaign.sessions.reduce((total, session) => total + session.approvedIds.length, 0),
    candidateCount: campaign.sessions.reduce((total, session) => total + session.extractionItems.length, 0),
    lowConfidenceSegmentCount: campaign.sessions.reduce(
      (total, session) =>
        total +
        session.liveLog.segments.filter(
          (segment) => typeof segment.confidence === "number" && Number.isFinite(segment.confidence) && segment.confidence < 0.85,
        ).length,
      0,
    ),
    memoryCount: countChronicleItems(campaign.chronicle),
    nonEmptySegmentCount: campaign.sessions.reduce(
      (total, session) => total + session.liveLog.segments.filter((segment) => segment.text.trim().length > 0).length,
      0,
    ),
    sessionCount: campaign.sessions.length,
    transcribedSessionCount: campaign.sessions.filter((session) => session.transcriptionRun !== null).length,
  };
}

function getDateAgeInDays(dateText: string, today: Date): number | null {
  const date = new Date(`${dateText}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sessionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const ageMs = todayDate.getTime() - sessionDate.getTime();

  return Math.floor(ageMs / 86_400_000);
}

export function buildContinuityQueue(
  campaign: CampaignState,
  activeSession: SessionState,
  prepNote: PrepNote,
  today = new Date(),
): ContinuityQueueItem[] {
  const sessionHasLog =
    activeSession.log.trim().length > 0 ||
    activeSession.liveLog.segments.some((segment) => segment.text.trim().length > 0);
  const pendingReviewCount = activeSession.extractionItems.filter(
    (item) => !activeSession.approvedIds.includes(item.id),
  ).length;
  const hiddenClueCount = campaign.chronicle.clues.filter((clue) => clue.status !== "known").length;
  const threadNextMoveCount = campaign.chronicle.threads.filter((thread) => thread.nextMove.trim().length > 0).length;
  const prepItemCount =
    prepNote.shortRecap.length + prepNote.hooks.length + prepNote.openQuestions.length + prepNote.reminders.length;
  const handoutWarningCount = buildPlayerHandoutSafetyWarnings(campaign).length;
  const activeSessionAge = getDateAgeInDays(activeSession.date, today);
  const openSessionCount = campaign.sessions.filter((session) => !session.archivedAt).length;
  const archivedSessionCount = campaign.sessions.length - openSessionCount;
  const queue: ContinuityQueueItem[] = [];

  if (!sessionHasLog) {
    queue.push({
      detail: "通常ログか話者付きログを入れると、承認候補と次回準備へ進めます。",
      id: "log-input",
      priority: "high",
      target: "log",
      title: "セッションログを用意",
    });
  }

  if (pendingReviewCount > 0) {
    queue.push({
      count: pendingReviewCount,
      detail: "未確認候補を採用、修正、破棄してからキャンペーン記憶へ反映します。",
      id: "pending-review",
      priority: "high",
      target: "review",
      title: "GM承認待ちを片付ける",
    });
  }

  if (hiddenClueCount > 0) {
    queue.push({
      count: hiddenClueCount,
      detail: campaign.campaignMode === "fantasy"
        ? "未開示のクエスト/勢力事情を次に動かす候補として確認します。"
        : "一部既知またはGM秘密の手がかりを、次回どこまで出すか確認します。",
      id: "hidden-memory",
      priority: pendingReviewCount > 0 ? "medium" : "high",
      target: "memory",
      title: campaign.campaignMode === "fantasy" ? "未開示情報を確認" : "未開示手がかりを確認",
    });
  }

  if (threadNextMoveCount > 0) {
    queue.push({
      count: threadNextMoveCount,
      detail: campaign.campaignMode === "fantasy"
        ? "世界変化の次の動きを次回の場面や依頼に接続します。"
        : "未回収の伏線に次の出し方が設定されています。",
      id: "thread-next-move",
      priority: "medium",
      target: "memory",
      title: campaign.campaignMode === "fantasy" ? "世界変化の次手を使う" : "伏線の次手を使う",
    });
  }

  if (handoutWarningCount > 0) {
    queue.push({
      count: handoutWarningCount,
      detail: "PL共有メモに秘密由来テキスト候補があります。共有前に確認してください。",
      id: "player-handout-warning",
      priority: "high",
      target: "prep",
      title: "PL共有メモを確認",
    });
  }

  if (prepItemCount > 0) {
    queue.push({
      count: prepItemCount,
      detail: "あらすじ、導入案、未解決事項、GM確認メモをセッション前に確認できます。",
      id: "prep-note",
      priority: pendingReviewCount > 0 ? "low" : "medium",
      target: "prep",
      title: "次回準備メモを確認",
    });
  }

  if (
    activeSessionAge !== null &&
    activeSessionAge >= 14 &&
    sessionHasLog &&
    (activeSession.approvedIds.length === 0 || pendingReviewCount > 0)
  ) {
    queue.push({
      detail: `${activeSession.date} のログが未採用のまま残っています。記憶化するか、不要ならアーカイブします。`,
      id: "stale-session",
      priority: "medium",
      target: "sessions",
      title: "古いセッションを整理",
    });
  }

  if (archivedSessionCount > 0 && openSessionCount > 4) {
    queue.push({
      count: openSessionCount,
      detail: "終わった回をアーカイブすると、進行中セッションに集中しやすくなります。",
      id: "session-housekeeping",
      priority: "low",
      target: "sessions",
      title: "セッション一覧を整理",
    });
  }

  return queue.slice(0, 5);
}

export function buildSessionWrapUpChecklist(
  campaign: CampaignState,
  activeSession: SessionState,
  prepNote: PrepNote,
): SessionWrapUpChecklistItem[] {
  const sessionHasLog =
    activeSession.log.trim().length > 0 ||
    activeSession.liveLog.segments.some((segment) => segment.text.trim().length > 0);
  const pendingReviewCount = activeSession.extractionItems.filter(
    (item) => !activeSession.approvedIds.includes(item.id),
  ).length;
  const hasExtractionCandidates = activeSession.extractionItems.length > 0;
  const hasApprovedMemory = countChronicleItems(campaign.chronicle) > 0;
  const prepItemCount =
    prepNote.shortRecap.length + prepNote.hooks.length + prepNote.openQuestions.length + prepNote.reminders.length;
  const playerSafeItemCount =
    campaign.chronicle.events.length +
    campaign.chronicle.clues.filter((clue) => clue.status === "known").length +
    campaign.chronicle.npcs.length +
    campaign.chronicle.locations.length;
  const handoutShareStatus = buildPlayerHandoutShareStatus(campaign);

  return [
    {
      detail: sessionHasLog
        ? "セッションログは保存されています。"
        : "通常ログまたは話者付きログを残してください。",
      id: "log-captured",
      label: "ログを残す",
      status: sessionHasLog ? "done" : "todo",
      target: "log",
    },
    {
      detail: hasExtractionCandidates
        ? `${activeSession.extractionItems.length}件の抽出候補があります。`
        : "ログから承認候補を抽出してください。",
      id: "extract-candidates",
      label: "候補を抽出",
      status: hasExtractionCandidates ? "done" : "todo",
      target: "log",
    },
    {
      detail: pendingReviewCount > 0
        ? `${pendingReviewCount}件がGM承認待ちです。`
        : "未承認候補は残っていません。",
      id: "review-cleared",
      label: "GM承認を終える",
      status: hasExtractionCandidates && pendingReviewCount === 0 ? "done" : "todo",
      target: "review",
    },
    {
      detail: hasApprovedMemory
        ? "承認済み情報がキャンペーン記憶に入っています。"
        : "採用した候補をキャンペーン記憶へ反映してください。",
      id: "memory-updated",
      label: "記憶を更新",
      status: hasApprovedMemory ? "done" : "todo",
      target: "memory",
    },
    {
      detail: prepItemCount > 0
        ? `${prepItemCount}件の次回準備項目があります。`
        : "次回準備メモを確認できる状態にしてください。",
      id: "prep-ready",
      label: "次回準備を確認",
      status: prepItemCount > 0 ? "done" : "todo",
      target: "prep",
    },
    {
      detail:
        playerSafeItemCount === 0
          ? "PLに共有できる公開情報はまだありません。"
          : handoutShareStatus.canShare
            ? "PL共有メモに出せる公開情報があります。"
            : handoutShareStatus.message,
      id: "player-handout-ready",
      label: "PL共有を確認",
      status: playerSafeItemCount > 0 && handoutShareStatus.canShare ? "done" : "todo",
      target: "share",
    },
    {
      detail: activeSession.archivedAt
        ? "このセッションはアーカイブ済みです。"
        : "終わった回は書き出してからアーカイブできます。",
      id: "archive-session",
      label: "必要ならアーカイブ",
      status: activeSession.archivedAt ? "done" : "todo",
      target: "sessions",
    },
  ];
}

export function getSessionSearchText(session: SessionState): string {
  return [
    session.title,
    session.date,
    session.archivedAt ? "archived アーカイブ" : "active",
    session.log,
    ...session.liveLog.speakers.map((speaker) => speaker.name),
    ...session.liveLog.segments.map((segment) => segment.text),
    ...session.extractionItems.flatMap((item) => [item.kind, item.title, item.detail, item.visibility]),
    ...(session.transcriptionRun
      ? [
          session.transcriptionRun.providerLabel,
          session.transcriptionRun.sourceType,
          session.transcriptionRun.fileName ?? "",
        ]
      : []),
  ].join("\n");
}

export function getCampaignSearchText(campaign: CampaignState): string {
  return [
    campaign.campaignName,
    campaign.campaignMode,
    ...campaign.sessions.map(getSessionSearchText),
    ...campaign.chronicle.events,
    ...campaign.chronicle.clues.flatMap((clue) => [clue.title, clue.detail]),
    ...campaign.chronicle.npcs.flatMap((npc) => [npc.name, npc.role, npc.publicKnowledge, npc.gmSecret]),
    ...campaign.chronicle.locations.flatMap((location) => [location.name, location.detail]),
    ...campaign.chronicle.threads.flatMap((thread) => [thread.title, thread.detail, thread.nextMove]),
  ].join("\n");
}

function getLocalDateTimeString(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${getLocalDateString(date)}T${hours}-${minutes}-${seconds}`;
}

export const initialCampaignState: CampaignState = {
  id: "campaign-haigaura",
  campaignName: "灰ヶ浦異聞",
  campaignMode: "investigation",
  extractionProvider: defaultExtractionProviderSettings,
  transcriptionProvider: defaultTranscriptionProviderSettings,
  sessions: [
    {
      id: "session-haigaura-01",
      title: "第1夜",
      date: "2026-04-25",
      log: sampleLog,
      liveLog: cloneJson(sampleLiveLog),
      extractionItems: [],
      extractionRun: null,
      transcriptionRun: null,
      approvedIds: [],
    },
  ],
  activeSessionId: "session-haigaura-01",
  chronicle: initialChronicle,
  quickResult: "潮見レン。灯台守の甥。怖がりだが、夜だけ灯台の鐘が鳴ることを知っている。",
};

export function createInitialCampaignState(): CampaignState {
  return cloneJson(initialCampaignState);
}

export function createNewCampaignState(index: number): CampaignState {
  const campaign = createInitialCampaignState();
  const session = createNewSession(1);

  return {
    ...campaign,
    id: createId("campaign"),
    campaignName: `新しいキャンペーン ${index}`,
    sessions: [session],
    activeSessionId: session.id,
    chronicle: {
      events: [],
      npcs: [],
      clues: [],
      locations: [],
      threads: [],
    },
    quickResult: "",
  };
}

export function createCampaignFromTemplate(templateId: CampaignStarterTemplateId, index: number): CampaignState {
  if (templateId === "investigation-demo") {
    const campaign = createInitialCampaignState();
    const sessions = campaign.sessions.map(duplicateSessionState);
    const activeSession = sessions[0] ?? createNewSession(1);

    return {
      ...campaign,
      id: createId("campaign"),
      campaignName: `${campaign.campaignName} ${index}`,
      sessions,
      activeSessionId: activeSession.id,
    };
  }

  const session = createNewSession(1);
  const fantasyLog = [
    "GM: 辺境都市セレストの鐘が、予定より三日早く鳴りました。",
    "リオ: まず冒険者ギルドで依頼を確認します。",
    "GM: ギルド長は、北砦からの補給隊が戻らないと告げます。",
    "エルナ: 商会の動きも気になります。補給路を押さえられたら街が危ない。",
    "GM: 黒鷲商会は支援を申し出ていますが、代わりに古い鉱山の採掘権を要求しています。",
    "リオ: 北砦へ向かう前に、商会の倉庫を調べたいです。",
  ].join("\n");

  return {
    ...createInitialCampaignState(),
    id: createId("campaign"),
    campaignName: `セレスト辺境譚 ${index}`,
    campaignMode: "fantasy",
    sessions: [
      {
        ...session,
        title: "第1話",
        log: fantasyLog,
        liveLog: {
          ...session.liveLog,
          title: "セレスト辺境譚 第1話",
        },
      },
    ],
    activeSessionId: session.id,
    chronicle: {
      events: [
        "辺境都市セレストで、北砦からの補給隊が戻らない問題が起きた。",
        "黒鷲商会が街への支援と引き換えに、古い鉱山の採掘権を求めている。",
      ],
      npcs: [
        {
          name: "ギルド長マレク",
          role: "セレスト冒険者ギルドの責任者",
          publicKnowledge: "北砦の補給路を取り戻せる冒険者を探している。",
          gmSecret: "領主家と黒鷲商会の取引に疑念を持っている。",
          attitude: "PCを試しつつ、街を守る実力者として期待している。",
        },
      ],
      clues: [
        {
          title: "北砦の補給路",
          detail: "補給隊が戻らず、街の食料と防衛に影響が出始めている。",
          status: "known",
        },
        {
          title: "黒鷲商会の採掘権要求",
          detail: "商会は支援の見返りに、古い鉱山の権利を求めている。",
          status: "partial",
        },
        {
          title: "古い鉱山の封印",
          detail: "鉱山の奥には、旧王国時代の地下門が封じられている。",
          status: "hidden",
        },
      ],
      locations: [
        {
          name: "セレスト",
          detail: "山道と交易路の分岐にある辺境都市。北砦と古い鉱山に依存している。",
        },
        {
          name: "北砦",
          detail: "魔物の進行を防ぐ前線拠点。補給が途絶えると街道全体が危うい。",
        },
      ],
      threads: [
        {
          title: "黒鷲商会の狙い",
          detail: "商会は補給危機を利用して、鉱山と地下門に近づこうとしている。",
          nextMove: "補給隊の救出後、商会の護衛が鉱山方面へ動く場面を入れる。",
        },
      ],
    },
    quickResult: "北砦から逃げ延びた若い伝令。凍傷を負っており、補給隊を襲ったのは魔物だけではないと訴える。",
  };
}

export function duplicateCampaignState(sourceCampaign: CampaignState): CampaignState {
  const duplicatedCampaign = cloneJson(sourceCampaign);
  const duplicatedSessions = duplicatedCampaign.sessions.map(duplicateSessionState);
  const sessions = duplicatedSessions.length > 0 ? duplicatedSessions : [createNewSession(1)];
  const activeSessionIndex = sourceCampaign.sessions.findIndex((session) => session.id === sourceCampaign.activeSessionId);
  const activeSession = sessions[Math.max(0, activeSessionIndex)];

  return {
    ...duplicatedCampaign,
    id: createId("campaign"),
    campaignName: `${sourceCampaign.campaignName} コピー`,
    sessions,
    activeSessionId: activeSession?.id ?? sessions[0].id,
  };
}

const initialSession = initialCampaignState.sessions[0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecord<T>(value: unknown): Partial<T> {
  return isRecord(value) ? (value as Partial<T>) : {};
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeSessionDate(value: unknown): string {
  if (typeof value !== "string") {
    return getLocalDateString();
  }

  const trimmedDate = value.trim();
  const dateMatch = trimmedDate.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);

  if (dateMatch) {
    return dateMatch[1];
  }

  return getLocalDateString();
}

function normalizeNpc(value: unknown): Npc {
  const npc = readRecord<Npc>(value);

  return {
    name: readString(npc.name, "無名NPC"),
    role: readString(npc.role, "役割未設定"),
    publicKnowledge: readString(npc.publicKnowledge, "公開情報未設定"),
    gmSecret: readString(npc.gmSecret, "GM秘密未設定"),
    attitude: readString(npc.attitude, "態度未設定"),
  };
}

function normalizeClue(value: unknown): Clue {
  const clue = readRecord<Clue>(value);
  const status = clue.status === "known" || clue.status === "partial" || clue.status === "hidden" ? clue.status : "partial";

  return {
    title: readString(clue.title, "無題の手がかり"),
    detail: readString(clue.detail, "詳細未設定"),
    status,
  };
}

function normalizeLocation(value: unknown): Location {
  const location = readRecord<Location>(value);

  return {
    name: readString(location.name, "無名の場所"),
    detail: readString(location.detail, "詳細未設定"),
  };
}

function normalizeThread(value: unknown): Thread {
  const thread = readRecord<Thread>(value);

  return {
    title: readString(thread.title, "無題の伏線"),
    detail: readString(thread.detail, "詳細未設定"),
    nextMove: readString(thread.nextMove, "次の一手未設定"),
  };
}

function normalizeChronicle(rawChronicle: unknown): Chronicle {
  const chronicle = readRecord<Chronicle>(rawChronicle);

  return {
    events: normalizeStringArray(chronicle.events, initialChronicle.events),
    npcs: Array.isArray(chronicle.npcs) ? chronicle.npcs.map(normalizeNpc) : initialChronicle.npcs,
    clues: Array.isArray(chronicle.clues) ? chronicle.clues.map(normalizeClue) : initialChronicle.clues,
    locations: Array.isArray(chronicle.locations) ? chronicle.locations.map(normalizeLocation) : initialChronicle.locations,
    threads: Array.isArray(chronicle.threads) ? chronicle.threads.map(normalizeThread) : initialChronicle.threads,
  };
}

function normalizeExtractionProviderSettings(rawSettings: unknown): ExtractionProviderSettings {
  const settings = readRecord<ExtractionProviderSettings>(rawSettings);
  const providerId = (settings.providerId ?? defaultExtractionProviderSettings.providerId) as ExtractionProviderId;
  const provider = getExtractionProvider(providerId);

  return {
    providerId: provider.id,
    model: readString(settings.model, provider.defaultModel),
    endpoint: readString(settings.endpoint, provider.defaultEndpoint),
  };
}

function normalizeTranscriptionProviderSettings(rawSettings: unknown): TranscriptionProviderSettings {
  const settings = readRecord<TranscriptionProviderSettings>(rawSettings);
  const providerId = (settings.providerId ?? defaultTranscriptionProviderSettings.providerId) as TranscriptionProviderId;
  const provider = getTranscriptionProvider(providerId);

  return {
    providerId: provider.id,
    model: readString(settings.model, provider.defaultModel),
    endpoint: readString(settings.endpoint, provider.defaultEndpoint),
    language: readString(settings.language, defaultTranscriptionProviderSettings.language),
  };
}

function normalizeCampaignMode(value: unknown): CampaignMode {
  return value === "fantasy" ? "fantasy" : "investigation";
}

function normalizeExtractionRun(rawRun: unknown, itemCount: number): ExtractionRun | null {
  if (!isRecord(rawRun)) {
    return null;
  }

  const run = readRecord<ExtractionRun>(rawRun);
  const runProvider = getExtractionProvider((run.providerId ?? "rule-based") as ExtractionProviderId);
  const executedProvider = getExtractionProvider((run.executedProviderId ?? run.providerId ?? "rule-based") as ExtractionProviderId);

  const validationErrors = Array.isArray(run.validationErrors)
    ? Array.from(
        new Set(
          run.validationErrors
            .filter((error): error is string => typeof error === "string")
            .map((error) => error.trim())
            .filter(Boolean),
        ),
      )
    : [];

  return {
    ...run,
    campaignMode: normalizeCampaignMode(run.campaignMode),
    sourceType: normalizeExtractionSourceType(run.sourceType),
    providerId: runProvider.id,
    providerLabel: runProvider.label,
    executedProviderId: executedProvider.id,
    executedProviderLabel: executedProvider.label,
    fallbackUsed: typeof run.fallbackUsed === "boolean" ? run.fallbackUsed : run.sourceType === "fallback",
    failureReason: typeof run.failureReason === "string" && run.failureReason.trim() ? run.failureReason.trim() : undefined,
    itemCount,
    note: typeof run.note === "string" && run.note.trim() ? run.note.trim() : undefined,
    promptLength: readNumber(run.promptLength, 0),
    promptVersion: typeof run.promptVersion === "string" && run.promptVersion.trim() ? run.promptVersion.trim() : undefined,
    validationErrors,
  };
}

function normalizeTranscriptionRun(rawRun: unknown): TranscriptionRun | null {
  if (!isRecord(rawRun)) {
    return null;
  }

  const provider = getTranscriptionProvider((rawRun.providerId ?? "manual") as TranscriptionProviderId);
  const sourceType = rawRun.sourceType === "audio-file" ? "audio-file" : "manual-json";

  return {
    executedAt: readString(rawRun.executedAt, ""),
    ...(typeof rawRun.fileName === "string" && rawRun.fileName.trim() ? { fileName: rawRun.fileName.trim() } : {}),
    providerId: provider.id,
    providerLabel: readString(rawRun.providerLabel, provider.label),
    segmentCount: readNumber(rawRun.segmentCount, 0),
    sourceType,
  };
}

function normalizeSessionState(
  session: SessionState,
  defaultSession: SessionState,
  seenSessionIds: Set<string>,
): SessionState {
  const rawExtractionItems = Array.isArray(session.extractionItems)
    ? session.extractionItems
    : defaultSession.extractionItems;
  const rawApprovedIds = Array.isArray(session.approvedIds)
    ? session.approvedIds.filter((id): id is string => typeof id === "string")
    : defaultSession.approvedIds;
  const approvedIds = Array.from(new Set(rawApprovedIds.map((id) => id.trim()).filter(Boolean)));
  const extractionItems = normalizeExtractionItems(rawExtractionItems);
  const extractionItemIds = new Set(extractionItems.map((item) => item.id));
  const rawSessionId = readString(session.id, createId("session"));
  const sessionId = !seenSessionIds.has(rawSessionId) ? rawSessionId : createId("session");
  const title = session.title?.trim() || "無題セッション";
  seenSessionIds.add(sessionId);

  return {
    ...defaultSession,
    ...session,
    id: sessionId,
    title,
    date: normalizeSessionDate(session.date),
    archivedAt: typeof session.archivedAt === "string" && session.archivedAt.trim() ? session.archivedAt.trim() : undefined,
    approvedIds: approvedIds.filter((id) => extractionItemIds.has(id)),
    extractionItems,
    liveLog: normalizeLiveLog(session.liveLog ?? defaultSession.liveLog, title),
    extractionRun: normalizeExtractionRun(session.extractionRun, extractionItems.length),
    transcriptionRun: normalizeTranscriptionRun(session.transcriptionRun),
  };
}

export function normalizeCampaignState(rawState: unknown): CampaignState {
  if (!isRecord(rawState)) {
    return createInitialCampaignState();
  }

  const parsedState = rawState as Partial<CampaignState> & Partial<SessionState>;
  const defaultSession = cloneJson(initialSession);
  const legacyState = parsedState as Partial<CampaignState> & {
    currentSession?: SessionState;
  } & Partial<SessionState>;
  const migratedSession = legacyState.currentSession ?? {
    ...defaultSession,
    id: legacyState.id ?? defaultSession.id,
    title: legacyState.title ?? defaultSession.title,
    date: legacyState.date ?? defaultSession.date,
    log: legacyState.log ?? defaultSession.log,
    liveLog: legacyState.liveLog ?? defaultSession.liveLog,
    extractionItems: legacyState.extractionItems ?? defaultSession.extractionItems,
    extractionRun: legacyState.extractionRun ?? defaultSession.extractionRun,
    transcriptionRun: legacyState.transcriptionRun ?? defaultSession.transcriptionRun,
    approvedIds: legacyState.approvedIds ?? defaultSession.approvedIds,
  };
  const sessions = Array.isArray(parsedState.sessions) && parsedState.sessions.length > 0 ? parsedState.sessions : [migratedSession];
  const seenSessionIds = new Set<string>();
  const normalizedSessions = sessions.map((session) => normalizeSessionState(session, defaultSession, seenSessionIds));
  const activeSessionId = readString(parsedState.activeSessionId, normalizedSessions[0].id);
  const campaignId = readString(parsedState.id, createId("campaign"));

  return {
    ...initialCampaignState,
    ...parsedState,
    id: campaignId,
    campaignName: parsedState.campaignName?.trim() || "無題キャンペーン",
    campaignMode: normalizeCampaignMode(parsedState.campaignMode),
    chronicle: normalizeChronicle(parsedState.chronicle),
    quickResult: readString(parsedState.quickResult, initialCampaignState.quickResult),
    extractionProvider: normalizeExtractionProviderSettings(parsedState.extractionProvider),
    transcriptionProvider: normalizeTranscriptionProviderSettings(parsedState.transcriptionProvider),
    sessions: normalizedSessions,
    activeSessionId: normalizedSessions.some((session) => session.id === activeSessionId)
      ? activeSessionId
      : normalizedSessions[0].id,
  };
}

export function normalizeCampaignLibraryState(rawState: unknown): CampaignLibraryState {
  if (!isRecord(rawState)) {
    const campaign = createInitialCampaignState();
    return {
      campaigns: [campaign],
      activeCampaignId: campaign.id,
    };
  }

  const rawCampaigns = Array.isArray(rawState.campaigns) && rawState.campaigns.length > 0
    ? rawState.campaigns
    : [rawState];
  const seenCampaignIds = new Set<string>();
  const campaigns = rawCampaigns.map((rawCampaign) => {
    const campaign = normalizeCampaignState(rawCampaign);
    const campaignId = !seenCampaignIds.has(campaign.id) ? campaign.id : createId("campaign");
    seenCampaignIds.add(campaignId);

    return {
      ...campaign,
      id: campaignId,
    };
  });
  const requestedActiveCampaignId = readString(rawState.activeCampaignId, campaigns[0].id);

  return {
    campaigns,
    activeCampaignId: campaigns.some((campaign) => campaign.id === requestedActiveCampaignId)
      ? requestedActiveCampaignId
      : campaigns[0].id,
  };
}

export function sanitizeCampaignStateForExport(campaign: CampaignState): CampaignState {
  return {
    ...campaign,
    extractionProvider: {
      endpoint: campaign.extractionProvider.endpoint,
      model: campaign.extractionProvider.model,
      providerId: campaign.extractionProvider.providerId,
    },
  };
}

export function sanitizeCampaignLibraryStateForExport(campaignLibrary: CampaignLibraryState): CampaignLibraryState {
  return {
    ...campaignLibrary,
    campaigns: campaignLibrary.campaigns.map(sanitizeCampaignStateForExport),
  };
}

export type ImportPreview =
  | {
      approvedCount: number;
      candidateCount: number;
      campaignMode: CampaignMode;
      kind: "campaign";
      message: string;
      sessionCount: number;
      storageBytes: number;
      title: string;
    }
  | {
      campaignCount: number;
      candidateCount: number;
      kind: "library";
      message: string;
      modeCounts: Record<CampaignMode, number>;
      storageBytes: number;
      sessionCount: number;
      title: string;
    }
  | {
      approvedCount: number;
      candidateCount: number;
      campaignMode: CampaignMode;
      kind: "session";
      message: string;
      storageBytes: number;
      title: string;
    };

function estimateJsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

export function readSessionImportPayload(parsedState: unknown): unknown | null {
  if (!isRecord(parsedState)) {
    return null;
  }

  if (Array.isArray(parsedState.campaigns) || Array.isArray(parsedState.sessions)) {
    return null;
  }

  if (isRecord(parsedState.session)) {
    return parsedState.session;
  }

  if ("log" in parsedState || "liveLog" in parsedState || "extractionItems" in parsedState) {
    return parsedState;
  }

  return null;
}

export function previewCampaignImport(parsedState: unknown): ImportPreview {
  const sessionPayload = readSessionImportPayload(parsedState);
  if (sessionPayload) {
    const importedCampaign = normalizeCampaignState({ sessions: [sessionPayload] });
    const importedSession = importedCampaign.sessions[0];
    return {
      approvedCount: importedSession.approvedIds.length,
      candidateCount: importedSession.extractionItems.length,
      campaignMode: importedCampaign.campaignMode,
      kind: "session",
      message: `${importedSession.title}を現在のキャンペーンに追加します。候補 ${importedSession.extractionItems.length} / 採用 ${importedSession.approvedIds.length}。`,
      storageBytes: estimateJsonBytes(importedSession),
      title: importedSession.title,
    };
  }

  if (isRecord(parsedState) && Array.isArray(parsedState.campaigns)) {
    const importedLibrary = normalizeCampaignLibraryState(parsedState);
    const sessionCount = importedLibrary.campaigns.reduce((total, campaign) => total + campaign.sessions.length, 0);
    const candidateCount = importedLibrary.campaigns.reduce(
      (total, campaign) =>
        total + campaign.sessions.reduce((sessionTotal, session) => sessionTotal + session.extractionItems.length, 0),
      0,
    );
    const modeCounts = importedLibrary.campaigns.reduce<Record<CampaignMode, number>>(
      (counts, campaign) => ({
        ...counts,
        [campaign.campaignMode]: counts[campaign.campaignMode] + 1,
      }),
      { investigation: 0, fantasy: 0 },
    );
    return {
      campaignCount: importedLibrary.campaigns.length,
      candidateCount,
      kind: "library",
      message: `${importedLibrary.campaigns.length}キャンペーン / ${sessionCount}セッション / ${candidateCount}候補で全体を置き換えます。`,
      modeCounts,
      storageBytes: estimateJsonBytes(importedLibrary),
      sessionCount,
      title: "キャンペーンライブラリ",
    };
  }

  const importedCampaign = normalizeCampaignState(parsedState);
  const stats = getCampaignSummaryStats(importedCampaign);
  return {
    approvedCount: stats.approvedCount,
    candidateCount: stats.candidateCount,
    campaignMode: importedCampaign.campaignMode,
    kind: "campaign",
    message: `${importedCampaign.campaignName} (${stats.sessionCount}セッション / ${stats.candidateCount}候補 / ${stats.approvedCount}採用) で現在のキャンペーンを置き換えます。`,
    sessionCount: importedCampaign.sessions.length,
    storageBytes: estimateJsonBytes(importedCampaign),
    title: importedCampaign.campaignName,
  };
}

export function formatCampaignLibraryMarkdown(campaignLibrary: CampaignLibraryState): string {
  return [
    "# キャンペーンライブラリ",
    "",
    ...campaignLibrary.campaigns.flatMap((campaign, index) => {
      const isActive = campaign.id === campaignLibrary.activeCampaignId;
      const stats = getCampaignSummaryStats(campaign);
      const activeSession = campaign.sessions.find((session) => session.id === campaign.activeSessionId) ?? campaign.sessions[0];
      const prepNote = generatePrepNote(campaign.chronicle, campaign.sessions, activeSession, campaign.campaignMode);
      const nextContinuityItem = buildContinuityQueue(campaign, activeSession, prepNote)[0] ?? null;
      const sessionLines = campaign.sessions.map(
        (session) =>
          `  - ${session.title} (${session.date}) / 候補 ${session.extractionItems.length} / 採用 ${session.approvedIds.length}`,
      );

      return [
        `## ${index + 1}. ${campaign.campaignName}${isActive ? " [選択中]" : ""}`,
        "",
        `- セッション: ${stats.sessionCount}`,
        ...(stats.archivedSessionCount > 0 ? [`- アーカイブ: ${stats.archivedSessionCount}`] : []),
        `- 記憶: ${stats.memoryCount}`,
        `- 候補: ${stats.candidateCount}`,
        `- 採用済み: ${stats.approvedCount}`,
        `- 文字起こし済み: ${stats.transcribedSessionCount}`,
        ...(nextContinuityItem ? [`- 次アクション: ${nextContinuityItem.title} - ${nextContinuityItem.detail}`] : []),
        "",
        ...sessionLines,
        "",
      ];
    }),
  ].join("\n").trimEnd();
}

export function formatCampaignMarkdown(campaign: CampaignState): string {
  const stats = getCampaignSummaryStats(campaign);
  const activeSession = campaign.sessions.find((session) => session.id === campaign.activeSessionId) ?? campaign.sessions[0];
  const prepNote = activeSession
    ? generatePrepNote(campaign.chronicle, campaign.sessions, activeSession, campaign.campaignMode)
    : { hooks: [], openQuestions: [], reminders: [], shortRecap: [] };
  const continuityQueue = activeSession ? buildContinuityQueue(campaign, activeSession, prepNote) : [];

  return [
    `# ${campaign.campaignName.trim() || "キャンペーン"}`,
    "",
    `- キャンペーン種別: ${campaign.campaignMode === "fantasy" ? "ファンタジー" : "調査"}`,
    `- セッション: ${stats.sessionCount}`,
    ...(stats.archivedSessionCount > 0 ? [`- アーカイブ: ${stats.archivedSessionCount}`] : []),
    `- 記憶: ${stats.memoryCount}`,
    `- 候補: ${stats.candidateCount}`,
    `- 採用済み: ${stats.approvedCount}`,
    `- 文字起こし済み: ${stats.transcribedSessionCount}`,
    `- 話者付き発話: ${stats.nonEmptySegmentCount}`,
    `- 要確認発話: ${stats.lowConfidenceSegmentCount}`,
    "",
    "## セッション",
    "",
    ...campaign.sessions.flatMap((session) => [
      `### ${session.title}`,
      "",
      `- 日付: ${session.date}`,
      ...(session.archivedAt ? [`- 状態: アーカイブ (${session.archivedAt})`] : []),
      `- 抽出候補: ${session.extractionItems.length}`,
      `- 採用済み: ${session.approvedIds.length}`,
      ...(session.transcriptionRun ? [`- 文字起こし: ${session.transcriptionRun.providerLabel} / ${session.transcriptionRun.segmentCount}発話`] : []),
      "",
    ]),
    ...(continuityQueue.length > 0
      ? [
          "## 継続運用キュー",
          "",
          ...continuityQueue.map((item) => {
            const countLabel = typeof item.count === "number" ? ` / ${item.count}件` : "";
            return `- [${item.priority}] ${item.title}${countLabel}: ${item.detail}`;
          }),
          "",
        ]
      : []),
    formatChronicleMarkdown(campaign.chronicle, "キャンペーン記憶").replace(/^# /m, "## "),
  ].join("\n").trimEnd();
}

export function formatPlayerHandoutMarkdown(campaign: CampaignState): string {
  const activeSession = campaign.sessions.find((session) => session.id === campaign.activeSessionId) ?? campaign.sessions[0];
  const prepNote = activeSession
    ? generatePrepNote(campaign.chronicle, campaign.sessions, activeSession, campaign.campaignMode)
    : { hooks: [], openQuestions: [], reminders: [], shortRecap: [] };
  const knownClues = campaign.chronicle.clues.filter((clue) => clue.status === "known");
  const publicNpcs = campaign.chronicle.npcs.map((npc) => `${npc.name}: ${npc.publicKnowledge}`);
  const sections: Array<[string, string[]]> = [
    ["前回までのあらすじ", prepNote.shortRecap],
    ["共有済みの出来事", campaign.chronicle.events],
    ["共有済みの手がかり", knownClues.map((clue) => `${clue.title}: ${clue.detail}`)],
    ["NPCメモ", publicNpcs],
    ["場所メモ", campaign.chronicle.locations.map((location) => `${location.name}: ${location.detail}`)],
  ];

  return [
    `# ${campaign.campaignName.trim() || "キャンペーン"} PL共有メモ`,
    "",
    activeSession ? `- 対象セッション: ${activeSession.title} (${activeSession.date})` : "- 対象セッション: 未設定",
    "- GM秘密、未開示候補、伏線の次手は含めていません。",
    "",
    ...sections.flatMap(([sectionTitle, items]) => {
      const visibleItems = items.map((item) => item.trim()).filter(Boolean);

      return [
        `## ${sectionTitle}`,
        "",
        ...(visibleItems.length > 0
          ? visibleItems.map((item) => `- ${item}`)
          : ["- 共有できる記録はありません。"]),
        "",
      ];
    }),
  ].join("\n").trimEnd();
}

function getLeakProbeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isUsefulLeakProbe(value: string): boolean {
  const normalized = getLeakProbeText(value);
  return normalized.length >= 6;
}

export function buildPlayerHandoutSafetyWarnings(
  campaign: CampaignState,
  handoutMarkdown = formatPlayerHandoutMarkdown(campaign),
): PlayerHandoutSafetyWarning[] {
  const handoutText = getLeakProbeText(handoutMarkdown);
  const warningCandidates: PlayerHandoutSafetyWarning[] = [
    ...campaign.chronicle.npcs.flatMap((npc, index) => [
      {
        id: `npc-secret:${index}:role`,
        label: `${npc.name} / GM秘密`,
        leakedText: npc.gmSecret,
        source: "gm-secret" as const,
      },
      {
        id: `npc-secret:${index}:attitude`,
        label: `${npc.name} / 態度`,
        leakedText: npc.attitude,
        source: "gm-secret" as const,
      },
    ]),
    ...campaign.chronicle.clues
      .filter((clue) => clue.status !== "known")
      .flatMap((clue, index) => [
        {
          id: `clue:${clue.status}:${index}:title`,
          label: clue.title,
          leakedText: clue.title,
          source: clue.status === "hidden" ? "hidden-clue" as const : "partial-clue" as const,
        },
        {
          id: `clue:${clue.status}:${index}:detail`,
          label: clue.title,
          leakedText: clue.detail,
          source: clue.status === "hidden" ? "hidden-clue" as const : "partial-clue" as const,
        },
      ]),
    ...campaign.chronicle.threads.flatMap((thread, index) => [
      {
        id: `thread:${index}:detail`,
        label: thread.title,
        leakedText: thread.detail,
        source: "thread" as const,
      },
      {
        id: `thread:${index}:next`,
        label: `${thread.title} / 次手`,
        leakedText: thread.nextMove,
        source: "thread" as const,
      },
    ]),
  ];
  const seenTexts = new Set<string>();

  return warningCandidates.filter((candidate) => {
    const probe = getLeakProbeText(candidate.leakedText);
    if (!isUsefulLeakProbe(probe) || seenTexts.has(probe)) {
      return false;
    }
    seenTexts.add(probe);

    return handoutText.includes(probe);
  });
}

export function buildPlayerHandoutShareStatus(
  campaign: CampaignState,
  handoutMarkdown = formatPlayerHandoutMarkdown(campaign),
): PlayerHandoutShareStatus {
  const warningCount = buildPlayerHandoutSafetyWarnings(campaign, handoutMarkdown).length;

  if (!handoutMarkdown.trim()) {
    return {
      canShare: false,
      message: "PL共有メモを生成できませんでした。",
      warningCount,
    };
  }

  if (warningCount > 0) {
    return {
      canShare: false,
      message: "PL共有メモに要確認項目があります。共有前に内容を確認してください。",
      warningCount,
    };
  }

  return {
    canShare: true,
    message: "PL共有メモは共有できます。",
    warningCount,
  };
}

export function formatSessionWrapUpMarkdown(
  campaign: CampaignState,
  activeSession: SessionState,
  prepNote: PrepNote,
): string {
  const checklist = buildSessionWrapUpChecklist(campaign, activeSession, prepNote);
  const completedCount = checklist.filter((item) => item.status === "done").length;
  const continuityQueue = buildContinuityQueue(campaign, activeSession, prepNote);
  const handoutWarnings = buildPlayerHandoutSafetyWarnings(campaign);

  return [
    `# ${activeSession.title} セッション締めメモ`,
    "",
    `- キャンペーン: ${campaign.campaignName}`,
    `- 日付: ${activeSession.date}`,
    `- 締め進捗: ${completedCount}/${checklist.length}`,
    "",
    "## 締めチェック",
    "",
    ...checklist.map((item) => `- [${item.status === "done" ? "x" : " "}] ${item.label}: ${item.detail}`),
    "",
    "## 次アクション",
    "",
    ...(continuityQueue.length > 0
      ? continuityQueue.map((item) => {
          const countLabel = typeof item.count === "number" ? ` / ${item.count}件` : "";
          return `- [${item.priority}] ${item.title}${countLabel}: ${item.detail}`;
        })
      : ["- 次アクションはありません。"]),
    "",
    "## PL共有安全性",
    "",
    ...(handoutWarnings.length > 0
      ? handoutWarnings.map((warning) => `- [要確認] ${warning.label}: ${warning.leakedText}`)
      : ["- PL共有メモに秘密由来テキスト候補は検出されていません。"]),
    "",
    "## 次回準備",
    "",
    "### あらすじ",
    "",
    ...(prepNote.shortRecap.length > 0 ? prepNote.shortRecap.map((item) => `- ${item}`) : ["- 記録はありません。"]),
    "",
    "### 導入案",
    "",
    ...(prepNote.hooks.length > 0 ? prepNote.hooks.map((item) => `- ${item}`) : ["- 記録はありません。"]),
    "",
    "### 未解決",
    "",
    ...(prepNote.openQuestions.length > 0 ? prepNote.openQuestions.map((item) => `- ${item}`) : ["- 記録はありません。"]),
    "",
    "### GM確認メモ",
    "",
    ...(prepNote.reminders.length > 0 ? prepNote.reminders.map((item) => `- ${item}`) : ["- 記録はありません。"]),
  ].join("\n").trimEnd();
}

export function createExportFileName(campaignName: string): string {
  const safeName = campaignName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-龠ぁ-んァ-ヶー]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  const date = getLocalDateTimeString();

  return `chronicle-gm-${safeName || "campaign"}-${date}.json`;
}

export function createNewSession(index: number): SessionState {
  const sessionId = createId("session");
  const liveLog = cloneJson(blankLiveLog);

  return {
    id: sessionId,
    archivedAt: undefined,
    title: `第${index}夜`,
    date: getLocalDateString(),
    log: "",
    liveLog: {
      ...liveLog,
      id: createId("live-log"),
      title: `第${index}夜`,
      speakers: liveLog.speakers.map((speaker) => ({
        ...speaker,
        id: createId("speaker"),
      })),
    },
    extractionItems: [],
    extractionRun: null,
    transcriptionRun: null,
    approvedIds: [],
  };
}

export function duplicateSessionState(sourceSession: SessionState): SessionState {
  const duplicatedSession = cloneJson(sourceSession);
  const speakerIdMap = new Map(duplicatedSession.liveLog.speakers.map((speaker) => [speaker.id, createId("speaker")]));
  const fallbackSpeakerId = duplicatedSession.liveLog.speakers[0]?.id;
  const title = `${sourceSession.title} コピー`;

  return {
    ...duplicatedSession,
    id: createId("session"),
    archivedAt: undefined,
    title,
    approvedIds: [],
    extractionRun: null,
    transcriptionRun: null,
    liveLog: {
      ...duplicatedSession.liveLog,
      id: createId("live-log"),
      title,
      speakers: duplicatedSession.liveLog.speakers.map((speaker) => ({
        ...speaker,
        id: speakerIdMap.get(speaker.id) ?? createId("speaker"),
      })),
      segments: duplicatedSession.liveLog.segments.map((segment) => ({
        ...segment,
        id: createId("segment"),
        speakerId: speakerIdMap.get(segment.speakerId) ?? speakerIdMap.get(fallbackSpeakerId ?? "") ?? segment.speakerId,
      })),
    },
  };
}

function uniqueItems(items: string[]): string[] {
  return Array.from(new Set(items.filter((item) => item.trim().length > 0)));
}

function normalizeMemoryKey(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function getApprovedItems(session: SessionState): ExtractionItem[] {
  return session.extractionItems.filter((item) => session.approvedIds.includes(item.id));
}

function normalizeExtractionItems(items: unknown[]): ExtractionItem[] {
  const seenIds = new Set<string>();
  const validKinds: ExtractionItem["kind"][] = ["出来事", "NPC", "手がかり", "GM秘密", "伏線"];
  const validVisibilities: ExtractionItem["visibility"][] = ["PL既知", "GMのみ", "未開示候補"];

  return items.map((item, index) => {
    const itemRecord = readRecord<ExtractionItem>(item);
    const rawId = readString(itemRecord.id, "item");
    const itemId = !seenIds.has(rawId) ? rawId : `${rawId}-${index + 1}`;
    seenIds.add(itemId);

    return {
      ...itemRecord,
      id: itemId,
      detail: readString(itemRecord.detail, "詳細未設定"),
      kind: itemRecord.kind && validKinds.includes(itemRecord.kind) ? itemRecord.kind : "出来事",
      title: readString(itemRecord.title, "無題の抽出候補"),
      visibility:
        itemRecord.visibility && validVisibilities.includes(itemRecord.visibility)
          ? itemRecord.visibility
          : "PL既知",
    };
  });
}

function normalizeLiveLog(rawLiveLog: unknown, fallbackTitle: string): LiveLogSession {
  const liveLog = readRecord<LiveLogSession>(rawLiveLog);
  const validRoles = new Set<SpeakerRole>(["GM", "PL", "unknown"]);
  const validSourceTypes = new Set<TranscriptSourceType>(["manual", "sample", "imported"]);
  const rawSegments = Array.isArray(liveLog.segments) ? liveLog.segments : [];
  const rawSpeakers =
    Array.isArray(liveLog.speakers) && liveLog.speakers.length > 0
      ? liveLog.speakers
      : [
          {
            id: createId("speaker"),
            name: "GM",
            role: "GM" as const,
          },
        ];
  const seenSpeakerIds = new Set<string>();
  const speakers = rawSpeakers.map((speaker, index) => {
    const speakerRecord = readRecord<Speaker>(speaker);
    const speakerId =
      typeof speakerRecord.id === "string" && !seenSpeakerIds.has(speakerRecord.id)
        ? speakerRecord.id
        : createId("speaker");
    seenSpeakerIds.add(speakerId);

    return {
      ...speakerRecord,
      id: speakerId,
      name: readString(speakerRecord.name, `話者${index + 1}`),
      role: speakerRecord.role && validRoles.has(speakerRecord.role) ? speakerRecord.role : "unknown",
    };
  });

  const speakerIds = new Set(speakers.map((speaker) => speaker.id));
  const fallbackSpeakerId = speakers[0].id;

  return {
    ...liveLog,
    id: readString(liveLog.id, createId("live-log")),
    sourceType: liveLog.sourceType && validSourceTypes.has(liveLog.sourceType) ? liveLog.sourceType : "imported",
    title: readString(liveLog.title, fallbackTitle),
    speakers,
    segments: rawSegments.map((segment) => {
      const segmentRecord = readRecord<TranscriptSegment>(segment);
      const startTimeSec = Math.max(0, readNumber(segmentRecord.startTimeSec, 0));
      const endTimeSec = Math.max(startTimeSec + 1, readNumber(segmentRecord.endTimeSec, startTimeSec + 1));
      const confidence = readNumber(segmentRecord.confidence, Number.NaN);

      return {
        ...segmentRecord,
        endTimeSec,
        id: readString(segmentRecord.id, createId("segment")),
        speakerId:
          typeof segmentRecord.speakerId === "string" && speakerIds.has(segmentRecord.speakerId)
            ? segmentRecord.speakerId
            : fallbackSpeakerId,
        startTimeSec,
        text: typeof segmentRecord.text === "string" ? segmentRecord.text : "",
        ...(Number.isNaN(confidence) ? {} : { confidence: Math.max(0, Math.min(1, confidence)) }),
      };
    }),
  };
}

function normalizeExtractionSourceType(sourceType: unknown): "plain" | "speaker" | "fallback" {
  return sourceType === "plain" || sourceType === "speaker" || sourceType === "fallback" ? sourceType : "fallback";
}

export function generatePrepNote(
  chronicle: Chronicle,
  sessions: SessionState[],
  activeSession: SessionState,
  campaignMode: CampaignMode = "investigation",
): PrepNote {
  const approvedItems = getApprovedItems(activeSession);
  const latestEvents = uniqueItems([
    ...approvedItems.filter((item) => item.kind === "出来事").map((item) => item.detail),
    ...chronicle.events.slice(-3),
  ]).slice(0, 3);
  const unrevealedClueHooks = chronicle.clues
    .filter((clue) => clue.status !== "known")
    .slice(-3)
    .map((clue) => `${clue.title}: 次に開示するなら ${clue.detail}`);
  const clueHooks = chronicle.clues.slice(-3).map((clue) => `${clue.title}: ${clue.detail}`);
  const threadHooks = chronicle.threads.slice(-3).map((thread) => `${thread.title}: ${thread.nextMove}`);
  const locationHooks = chronicle.locations.slice(-2).map((location) => `${location.name}: ${location.detail}`);
  const npcHooks = chronicle.npcs.slice(-2).map((npc) => `${npc.name}: ${npc.publicKnowledge}`);
  const hooks = uniqueItems([...unrevealedClueHooks, ...threadHooks, ...clueHooks, ...locationHooks, ...npcHooks]).slice(0, 4);
  const openQuestions = uniqueItems([
    ...chronicle.threads.map((thread) => `${thread.title}: ${thread.detail}`),
    ...chronicle.clues
      .filter((clue) => clue.status !== "known")
      .map((clue) => `${clue.title}: まだ全貌がPLに見えていない。`),
  ]).slice(0, 4);
  const hiddenClues = chronicle.clues
    .filter((clue) => clue.status === "hidden" || clue.status === "partial")
    .map((clue) => `${clue.title}をどこまで開示するか決める。`);
  const approvedSecrets = approvedItems
    .filter((item) => item.visibility !== "PL既知")
    .map((item) => `${item.title}はPLに出す前に意図を確認する。`);

  return {
    shortRecap:
      latestEvents.length > 0
        ? latestEvents
        : [`${activeSession.title}のログを整理して、採用する出来事を承認してください。`],
    hooks: hooks.length > 0
      ? hooks
      : [
          campaignMode === "fantasy"
            ? "承認済みのクエスト、勢力事情、世界変化が増えると、次のクエスト候補がここに出ます。"
            : "承認済みの手がかりや伏線が増えると、次回導入案がここに出ます。",
        ],
    openQuestions:
      openQuestions.length > 0
        ? openQuestions
        : [
            campaignMode === "fantasy"
              ? "未解決の依頼や勢力事情は、伏線や一部既知/GM秘密の情報から生成されます。"
              : "未解決の問いは、伏線や一部既知/GM秘密の手がかりから生成されます。",
          ],
    reminders: uniqueItems([
      `${sessions.length}セッション分のログをキャンペーン記憶に積み上げ中。`,
      ...hiddenClues,
      ...approvedSecrets,
      ...chronicle.locations.slice(-2).map((location) => `${location.name}: 場面に出すなら ${location.detail}`),
      ...chronicle.npcs.slice(-2).map((npc) => `${npc.name}: ${npc.attitude}`),
    ]).slice(0, 4),
  };
}

export function formatPrepNoteMarkdown(prepNote: PrepNote, title: string): string {
  const sections: Array<[string, string[]]> = [
    ["3行あらすじ", prepNote.shortRecap],
    ["次回導入案", prepNote.hooks],
    ["未解決の問い", prepNote.openQuestions],
    ["GM確認メモ", prepNote.reminders],
  ];

  return [
    `# ${title.trim() || "次回準備"}`,
    "",
    ...sections.flatMap(([sectionTitle, items]) => {
      const visibleItems = items.map((item) => item.trim()).filter(Boolean);

      return [
        `## ${sectionTitle}`,
        "",
        ...(visibleItems.length > 0
          ? visibleItems.map((item, index) => `${index + 1}. ${item}`)
          : ["- 生成された準備項目はありません。"]),
        "",
      ];
    }),
  ].join("\n").trimEnd();
}

export function formatChronicleMarkdown(chronicle: Chronicle, title: string): string {
  const clueStatusLabels: Record<Clue["status"], string> = {
    hidden: "GM秘密",
    known: "PL既知",
    partial: "一部既知",
  };
  const sections: Array<[string, string[]]> = [
    ["出来事", chronicle.events],
    [
      "手がかり",
      chronicle.clues.map((clue) => `${clue.title} [${clueStatusLabels[clue.status]}]: ${clue.detail}`),
    ],
    [
      "NPC",
      chronicle.npcs.map((npc) => `${npc.name}: ${npc.publicKnowledge} / 態度: ${npc.attitude}`),
    ],
    [
      "場所",
      chronicle.locations.map((location) => `${location.name}: ${location.detail}`),
    ],
    [
      "伏線",
      chronicle.threads.map((thread) => `${thread.title}: ${thread.detail} / 次: ${thread.nextMove}`),
    ],
  ];

  return [
    `# ${title.trim() || "キャンペーン記憶"}`,
    "",
    ...sections.flatMap(([sectionTitle, items]) => {
      const visibleItems = items.map((item) => item.trim()).filter(Boolean);

      return [
        `## ${sectionTitle}`,
        "",
        ...(visibleItems.length > 0
          ? visibleItems.map((item) => `- ${item}`)
          : ["- 記録はありません。"]),
        "",
      ];
    }),
  ].join("\n").trimEnd();
}

export function applyExtraction(chronicle: Chronicle, item: ExtractionItem): Chronicle {
  const titleKey = normalizeMemoryKey(item.title);
  const detailKey = normalizeMemoryKey(item.detail);

  if (item.kind === "NPC") {
    if (
      chronicle.npcs.some(
        (npc) => normalizeMemoryKey(npc.name) === titleKey && normalizeMemoryKey(npc.publicKnowledge) === detailKey,
      )
    ) {
      return chronicle;
    }

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
    if (
      chronicle.clues.some(
        (clue) => normalizeMemoryKey(clue.title) === titleKey && normalizeMemoryKey(clue.detail) === detailKey,
      )
    ) {
      return chronicle;
    }

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
    if (
      chronicle.threads.some(
        (thread) => normalizeMemoryKey(thread.title) === titleKey && normalizeMemoryKey(thread.detail) === detailKey,
      )
    ) {
      return chronicle;
    }

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

  const event = `${item.title}: ${item.detail}`;
  if (chronicle.events.some((currentEvent) => normalizeMemoryKey(currentEvent) === normalizeMemoryKey(event))) {
    return chronicle;
  }

  return {
    ...chronicle,
    events: [...chronicle.events, event],
  };
}

export type ExtractionApplicationPreview = {
  approvedCandidates: number;
  newEvents: number;
  newNpcs: number;
  newClues: number;
  newThreads: number;
  skippedCandidates: number;
};

export function previewExtractionApplication(
  chronicle: Chronicle,
  items: ExtractionItem[],
): ExtractionApplicationPreview {
  let nextChronicle = chronicle;
  const startCounts = {
    events: chronicle.events.length,
    npcs: chronicle.npcs.length,
    clues: chronicle.clues.length,
    threads: chronicle.threads.length,
  };
  let approvedCandidates = 0;
  let skippedCandidates = 0;

  items.forEach((item) => {
    if (!item.title.trim() || !item.detail.trim()) {
      skippedCandidates += 1;
      return;
    }

    approvedCandidates += 1;
    nextChronicle = applyExtraction(nextChronicle, item);
  });

  const createdCount =
    nextChronicle.events.length - startCounts.events +
    nextChronicle.npcs.length - startCounts.npcs +
    nextChronicle.clues.length - startCounts.clues +
    nextChronicle.threads.length - startCounts.threads;

  return {
    approvedCandidates,
    newEvents: nextChronicle.events.length - startCounts.events,
    newNpcs: nextChronicle.npcs.length - startCounts.npcs,
    newClues: nextChronicle.clues.length - startCounts.clues,
    newThreads: nextChronicle.threads.length - startCounts.threads,
    skippedCandidates: skippedCandidates + approvedCandidates - createdCount,
  };
}
