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

export type WorkspaceTab = "home" | "log" | "review" | "chronicle" | "prep";

export type ExtractionSourceType = "plain" | "speaker" | "fallback";

export type ExtractionProviderId = "rule-based" | "openai" | "ollama";
export type TranscriptionProviderId = "manual" | "openai" | "web-speech";

export type ExtractionProviderSettings = {
  providerId: ExtractionProviderId;
  model: string;
  endpoint: string;
};

export type TranscriptionProviderSettings = {
  providerId: TranscriptionProviderId;
  model: string;
  endpoint: string;
  language: string;
};

export type ProviderSecretSettings = {
  openAiApiKey: string;
};

export type ExtractionRun = {
  sourceType: ExtractionSourceType;
  providerId: ExtractionProviderId;
  providerLabel: string;
  executedProviderId: ExtractionProviderId;
  executedProviderLabel: string;
  fallbackUsed: boolean;
  failureReason?: string;
  itemCount: number;
  note?: string;
  promptLength: number;
  promptVersion?: string;
  validationErrors?: string[];
};

export type TranscriptionRun = {
  executedAt: string;
  fileName?: string;
  providerId: TranscriptionProviderId;
  providerLabel: string;
  segmentCount: number;
  sourceType: "manual-json" | "audio-file";
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

export type TranscriptionSegmentDraft = {
  speakerName?: string;
  startTimeSec?: number;
  endTimeSec?: number;
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
  archivedAt?: string;
  id: string;
  title: string;
  date: string;
  log: string;
  liveLog: LiveLogSession;
  extractionItems: ExtractionItem[];
  extractionRun: ExtractionRun | null;
  transcriptionRun: TranscriptionRun | null;
  approvedIds: string[];
};

export type CampaignState = {
  id: string;
  campaignName: string;
  extractionProvider: ExtractionProviderSettings;
  transcriptionProvider: TranscriptionProviderSettings;
  sessions: SessionState[];
  activeSessionId: string;
  chronicle: Chronicle;
  quickResult: string;
};

export type CampaignLibraryState = {
  campaigns: CampaignState[];
  activeCampaignId: string;
};
