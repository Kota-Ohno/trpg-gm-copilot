export type ClueStatus = "known" | "partial" | "hidden";

export type Npc = {
  name: string;
  role: string;
  publicKnowledge: string;
  gmSecret: string;
  attitude: string;
};

export type Clue = {
  title: string;
  detail: string;
  status: ClueStatus;
};

export type Location = {
  name: string;
  detail: string;
};

export type Thread = {
  title: string;
  detail: string;
  nextMove: string;
};

export type Chronicle = {
  events: string[];
  npcs: Npc[];
  clues: Clue[];
  locations: Location[];
  threads: Thread[];
};

export type ExtractionItem = {
  id: string;
  kind: "出来事" | "NPC" | "手がかり" | "GM秘密" | "伏線";
  title: string;
  detail: string;
  visibility: "PL既知" | "GMのみ" | "未開示候補";
};

export type PrepNote = {
  shortRecap: string[];
  hooks: string[];
  openQuestions: string[];
  reminders: string[];
};

export type WorkspaceTab = "log" | "review" | "chronicle" | "prep";

export type ExtractionSourceType = "plain" | "speaker" | "fallback";

export type ExtractionProviderId = "rule-based" | "openai" | "ollama";

export type ExtractionProviderSettings = {
  providerId: ExtractionProviderId;
  model: string;
  apiKey: string;
  endpoint: string;
};

export type ExtractionRun = {
  sourceType: ExtractionSourceType;
  providerId: ExtractionProviderId;
  providerLabel: string;
  itemCount: number;
  note?: string;
};

export type SpeakerRole = "GM" | "PL" | "unknown";

export type TranscriptSourceType = "manual" | "sample" | "imported";

export type Speaker = {
  id: string;
  name: string;
  role: SpeakerRole;
};

export type TranscriptSegment = {
  id: string;
  speakerId: string;
  startTimeSec: number;
  endTimeSec: number;
  text: string;
  confidence?: number;
};

export type LiveLogSession = {
  id: string;
  title: string;
  sourceType: TranscriptSourceType;
  speakers: Speaker[];
  segments: TranscriptSegment[];
};

export type SessionState = {
  id: string;
  title: string;
  date: string;
  log: string;
  liveLog: LiveLogSession;
  extractionItems: ExtractionItem[];
  extractionRun: ExtractionRun | null;
  approvedIds: string[];
};

export type CampaignState = {
  campaignName: string;
  extractionProvider: ExtractionProviderSettings;
  sessions: SessionState[];
  activeSessionId: string;
  chronicle: Chronicle;
  quickResult: string;
};
