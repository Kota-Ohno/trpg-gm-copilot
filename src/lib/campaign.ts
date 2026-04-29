import { initialChronicle, sampleLiveLog, sampleLog } from "../data/sample";
import type {
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

function getLocalDateTimeString(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${getLocalDateString(date)}T${hours}-${minutes}-${seconds}`;
}

export const initialCampaignState: CampaignState = {
  id: "campaign-haigaura",
  campaignName: "灰ヶ浦異聞",
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
    endpoint: typeof settings.endpoint === "string" ? settings.endpoint.trim() : provider.defaultEndpoint,
  };
}

function normalizeTranscriptionProviderSettings(rawSettings: unknown): TranscriptionProviderSettings {
  const settings = readRecord<TranscriptionProviderSettings>(rawSettings);
  const providerId = (settings.providerId ?? defaultTranscriptionProviderSettings.providerId) as TranscriptionProviderId;
  const provider = getTranscriptionProvider(providerId);

  return {
    providerId: provider.id,
    model: readString(settings.model, provider.defaultModel),
    endpoint: typeof settings.endpoint === "string" ? settings.endpoint.trim() : provider.defaultEndpoint,
    language: readString(settings.language, defaultTranscriptionProviderSettings.language),
  };
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
    approvedIds: approvedIds.filter((id) => extractionItemIds.has(id)),
    extractionItems,
    liveLog: normalizeLiveLog(session.liveLog ?? defaultSession.liveLog, title),
    extractionRun: normalizeExtractionRun(session.extractionRun, extractionItems.length),
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
    approvedIds: [],
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
      const endTimeSec = Math.max(startTimeSec, readNumber(segmentRecord.endTimeSec, startTimeSec));
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

export function generatePrepNote(chronicle: Chronicle, sessions: SessionState[], activeSession: SessionState): PrepNote {
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
    hooks: hooks.length > 0 ? hooks : ["承認済みの手がかりや伏線が増えると、次回導入案がここに出ます。"],
    openQuestions:
      openQuestions.length > 0
        ? openQuestions
        : ["未解決の問いは、伏線や一部既知/GM秘密の手がかりから生成されます。"],
    reminders: uniqueItems([
      `${sessions.length}セッション分のログをキャンペーン記憶に積み上げ中。`,
      ...hiddenClues,
      ...approvedSecrets,
      ...chronicle.locations.slice(-2).map((location) => `${location.name}: 場面に出すなら ${location.detail}`),
      ...chronicle.npcs.slice(-2).map((npc) => `${npc.name}: ${npc.attitude}`),
    ]).slice(0, 4),
  };
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
