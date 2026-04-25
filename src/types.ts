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

export type SpeakerRole = "GM" | "PL" | "unknown";

export type TranscriptSourceType = "manual" | "sample";

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

export type CampaignState = {
  campaignName: string;
  log: string;
  liveLog: LiveLogSession;
  extractionItems: ExtractionItem[];
  approvedIds: string[];
  chronicle: Chronicle;
  quickResult: string;
};
