import { initialChronicle, sampleLiveLog, sampleLog } from "../data/sample";
import type { CampaignState, Chronicle, ExtractionItem, LiveLogSession, PrepNote, SessionState } from "../types";
import { defaultExtractionProviderSettings, getExtractionProvider } from "./extraction-provider-settings";

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
  campaignName: "灰ヶ浦異聞",
  extractionProvider: defaultExtractionProviderSettings,
  sessions: [
    {
      id: "session-haigaura-01",
      title: "第1夜",
      date: "2026-04-25",
      log: sampleLog,
      liveLog: sampleLiveLog,
      extractionItems: [],
      extractionRun: null,
      approvedIds: [],
    },
  ],
  activeSessionId: "session-haigaura-01",
  chronicle: initialChronicle,
  quickResult: "潮見レン。灯台守の甥。怖がりだが、夜だけ灯台の鐘が鳴ることを知っている。",
};

const initialSession = initialCampaignState.sessions[0];

export function normalizeCampaignState(rawState: unknown): CampaignState {
  if (!rawState || typeof rawState !== "object") {
    return initialCampaignState;
  }

  const parsedState = rawState as Partial<CampaignState> & Partial<SessionState>;
  const legacyState = parsedState as Partial<CampaignState> & {
    currentSession?: SessionState;
  } & Partial<SessionState>;
  const migratedSession = legacyState.currentSession ?? {
    ...initialSession,
    log: legacyState.log ?? initialSession.log,
    liveLog: legacyState.liveLog ?? initialSession.liveLog,
    extractionItems: legacyState.extractionItems ?? initialSession.extractionItems,
    extractionRun: legacyState.extractionRun ?? initialSession.extractionRun,
    approvedIds: legacyState.approvedIds ?? initialSession.approvedIds,
  };
  const sessions = parsedState.sessions && parsedState.sessions.length > 0 ? parsedState.sessions : [migratedSession];
  const activeSessionId = parsedState.activeSessionId ?? sessions[0].id;
  const parsedExtractionProvider = parsedState.extractionProvider ?? defaultExtractionProviderSettings;
  const provider = getExtractionProvider(parsedExtractionProvider.providerId ?? defaultExtractionProviderSettings.providerId);
  const providerModel = parsedExtractionProvider.model?.trim();
  const providerEndpoint = parsedExtractionProvider.endpoint?.trim();

  return {
    ...initialCampaignState,
    ...parsedState,
    campaignName: parsedState.campaignName?.trim() || "無題キャンペーン",
    extractionProvider: {
      providerId: provider.id,
      model: providerModel || provider.defaultModel,
      endpoint: providerEndpoint ?? provider.defaultEndpoint,
    },
    sessions: sessions.map((session) => {
      const extractionItems = normalizeExtractionItems(session.extractionItems ?? initialSession.extractionItems);
      const extractionItemIds = new Set(extractionItems.map((item) => item.id));
      const runProvider = session.extractionRun
        ? getExtractionProvider(session.extractionRun.providerId ?? "rule-based")
        : null;
      const executedProvider = session.extractionRun
        ? getExtractionProvider(session.extractionRun.executedProviderId ?? session.extractionRun.providerId ?? "rule-based")
        : null;

      return {
        ...initialSession,
        ...session,
        title: session.title?.trim() || "無題セッション",
        date: session.date || getLocalDateString(),
        approvedIds: (session.approvedIds ?? initialSession.approvedIds).filter((id) => extractionItemIds.has(id)),
        extractionItems,
        liveLog: normalizeLiveLog(session.liveLog ?? initialSession.liveLog),
        extractionRun: session.extractionRun
          ? {
              ...session.extractionRun,
              sourceType: normalizeExtractionSourceType(session.extractionRun.sourceType),
              providerId: runProvider?.id ?? "rule-based",
              providerLabel: runProvider?.label ?? "ルールベース",
              executedProviderId: executedProvider?.id ?? "rule-based",
              executedProviderLabel: executedProvider?.label ?? "ルールベース",
              fallbackUsed:
                session.extractionRun.fallbackUsed ?? session.extractionRun.sourceType === "fallback",
              itemCount: extractionItems.length,
              promptLength: session.extractionRun.promptLength ?? 0,
              validationErrors: Array.isArray(session.extractionRun.validationErrors)
                ? session.extractionRun.validationErrors
                : [],
            }
          : null,
      };
    }),
    activeSessionId: sessions.some((session) => session.id === activeSessionId) ? activeSessionId : sessions[0].id,
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

  return {
    id: sessionId,
    title: `第${index}夜`,
    date: getLocalDateString(),
    log: "",
    liveLog: {
      ...blankLiveLog,
      id: createId("live-log"),
      title: `第${index}夜`,
      speakers: blankLiveLog.speakers.map((speaker) => ({
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

function getApprovedItems(session: SessionState): ExtractionItem[] {
  return session.extractionItems.filter((item) => session.approvedIds.includes(item.id));
}

function normalizeExtractionItems(items: ExtractionItem[]): ExtractionItem[] {
  const seenIds = new Set<string>();

  return items.map((item, index) => {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      return item;
    }

    const nextItem = {
      ...item,
      id: `${item.id}-${index + 1}`,
    };
    seenIds.add(nextItem.id);
    return nextItem;
  });
}

function normalizeLiveLog(liveLog: LiveLogSession): LiveLogSession {
  const rawSpeakers =
    liveLog.speakers.length > 0
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
    const speakerId = speaker.id && !seenSpeakerIds.has(speaker.id) ? speaker.id : createId("speaker");
    seenSpeakerIds.add(speakerId);

    return {
      ...speaker,
      id: speakerId,
      name: speaker.name.trim() || `話者${index + 1}`,
    };
  });

  const speakerIds = new Set(speakers.map((speaker) => speaker.id));
  const fallbackSpeakerId = speakers[0].id;

  return {
    ...liveLog,
    speakers,
    segments: liveLog.segments.map((segment) => {
      const startTimeSec = Math.max(0, segment.startTimeSec);
      const endTimeSec = Math.max(startTimeSec, segment.endTimeSec);

      return {
        ...segment,
        endTimeSec,
        id: segment.id || createId("segment"),
        speakerId: speakerIds.has(segment.speakerId) ? segment.speakerId : fallbackSpeakerId,
        startTimeSec,
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
  const clueHooks = chronicle.clues.slice(-3).map((clue) => `${clue.title}: ${clue.detail}`);
  const threadHooks = chronicle.threads.slice(-3).map((thread) => `${thread.title}: ${thread.nextMove}`);
  const hooks = uniqueItems([...threadHooks, ...clueHooks]).slice(0, 4);
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
      ...chronicle.npcs.slice(-2).map((npc) => `${npc.name}: ${npc.attitude}`),
    ]).slice(0, 4),
  };
}

export function applyExtraction(chronicle: Chronicle, item: ExtractionItem): Chronicle {
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
