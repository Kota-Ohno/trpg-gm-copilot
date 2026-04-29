import type {
  ExtractionItem,
  LiveLogSession,
  Speaker,
  SpeakerRole,
  TranscriptionSegmentDraft,
  TranscriptSegment,
} from "../types";
import { createId } from "./campaign";

export type ExtractionSource = "plain" | "speaker";

export type ExtractionInputLine = {
  role?: SpeakerRole;
  speakerName?: string;
  text: string;
};

export const lowConfidenceThreshold = 0.85;

export type LiveLogSummary = {
  emptySegmentCount: number;
  lowConfidenceCount: number;
  nonEmptySegmentCount: number;
  totalDurationSec: number;
  totalSegmentCount: number;
  usedSpeakerCount: number;
};

const npcNamePattern = /(?:女将|村長|灯台守|船長|医師|司祭|娘|甥|少女|少年|老人|男|女)(?:の)?([ァ-ヶー一-龠々]{1,8})|([ァ-ヶー一-龠々]{1,8})(?:は|が).*(?:話|言|証言)/;
const plainLogLinePattern = /^(?:\[\s*([0-9０-９:.：\s]+)\s*\]\s*)?([^:：]{1,32})[:：]\s*(.+)$/;

export function inferSpeakerRole(name: string): SpeakerRole {
  const normalizedName = name.trim().toLowerCase();

  if (["gm", "kp", "dm", "keeper", "ゲームマスター", "キーパー"].includes(normalizedName)) {
    return "GM";
  }

  return "PL";
}

export function liveLogToPlainText(liveLog: LiveLogSession): string {
  return [...liveLog.segments]
    .sort((first, second) => first.startTimeSec - second.startTimeSec)
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => {
      const speaker = liveLog.speakers.find((candidate) => candidate.id === segment.speakerId);
      return `[${formatTimestamp(segment.startTimeSec)}] ${speaker?.name ?? "話者不明"}: ${segment.text.trim()}`;
    })
    .join("\n");
}

export function summarizeLiveLog(liveLog: LiveLogSession): LiveLogSummary {
  return {
    emptySegmentCount: liveLog.segments.filter((segment) => segment.text.trim().length === 0).length,
    lowConfidenceCount: liveLog.segments.filter(
      (segment) =>
        typeof segment.confidence === "number" &&
        Number.isFinite(segment.confidence) &&
        segment.confidence < lowConfidenceThreshold,
    ).length,
    nonEmptySegmentCount: liveLog.segments.filter((segment) => segment.text.trim().length > 0).length,
    totalDurationSec: liveLog.segments.reduce(
      (total, segment) => total + Math.max(0, segment.endTimeSec - segment.startTimeSec),
      0,
    ),
    totalSegmentCount: liveLog.segments.length,
    usedSpeakerCount: new Set(liveLog.segments.map((segment) => segment.speakerId)).size,
  };
}

function formatTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, "0");

  return hours > 0 ? `${hours}:${minutes}:${remainingSeconds}` : `${minutes}:${remainingSeconds}`;
}

function parseTimestampSeconds(rawTimestamp: string | undefined): number | null {
  if (!rawTimestamp) {
    return null;
  }

  const normalizedTimestamp = rawTimestamp
    .trim()
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/：/g, ":")
    .replace(/\s+/g, "");
  if (!/^\d+(?::\d+){1,2}$/.test(normalizedTimestamp)) {
    return null;
  }

  const parts = normalizedTimestamp.split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if (minutes >= 60 || seconds >= 60) {
    return null;
  }

  return (hours * 60 + minutes) * 60 + seconds;
}

function liveLogToExtractionLines(liveLog: LiveLogSession): ExtractionInputLine[] {
  return [...liveLog.segments]
    .sort((first, second) => first.startTimeSec - second.startTimeSec)
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => {
      const speaker = liveLog.speakers.find((candidate) => candidate.id === segment.speakerId);

      return {
        role: speaker?.role,
        speakerName: speaker?.name,
        text: segment.text.trim(),
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

    const match = line.match(plainLogLinePattern);
    if (!match) {
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        lastLine.text = `${lastLine.text}\n${line}`;
      }
      return;
    }

    const speakerName = match[2].trim();
    lines.push({
      role: inferSpeakerRole(speakerName),
      speakerName,
      text: match[3].trim(),
    });
  });

  return lines.map((line) => ({
    ...line,
    text: line.text.trim(),
  }));
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

export function buildExtractionInput(log: string, liveLog: LiveLogSession, source: ExtractionSource): ExtractionInputLine[] {
  if (source === "speaker") {
    return liveLogToExtractionLines(liveLog);
  }

  return plainLogToExtractionLines(log);
}

export function runRuleBasedExtraction(lines: ExtractionInputLine[]): ExtractionItem[] {
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

export function normalizeTranscriptionDrafts(value: unknown): TranscriptionSegmentDraft[] | null {
  const draftItems = Array.isArray(value)
    ? value
    : value && typeof value === "object" && !Array.isArray(value) && Array.isArray((value as { segments?: unknown }).segments)
      ? (value as { segments: unknown[] }).segments
      : null;

  if (!draftItems) {
    return null;
  }

  return draftItems.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const draft = item as Partial<Record<keyof TranscriptionSegmentDraft, unknown>>;
    if (typeof draft.text !== "string") {
      return [];
    }

    return [{
      ...(typeof draft.speakerName === "string" ? { speakerName: draft.speakerName } : {}),
      ...(typeof draft.startTimeSec === "number" ? { startTimeSec: draft.startTimeSec } : {}),
      ...(typeof draft.endTimeSec === "number" ? { endTimeSec: draft.endTimeSec } : {}),
      text: draft.text,
      ...(typeof draft.confidence === "number" ? { confidence: draft.confidence } : {}),
    }];
  });
}

export function transcriptionDraftsToLiveLog(
  drafts: TranscriptionSegmentDraft[],
  title: string,
): LiveLogSession | null {
  const speakersByName = new Map<string, Speaker>();
  const segments: TranscriptSegment[] = [];

  drafts.forEach((draft, index) => {
    const text = draft.text.trim();
    if (!text) {
      return;
    }

    const speakerName = draft.speakerName?.trim() || "話者不明";
    let speaker = speakersByName.get(speakerName);
    if (!speaker) {
      speaker = {
        id: createId("speaker"),
        name: speakerName,
        role: inferSpeakerRole(speakerName),
      };
      speakersByName.set(speakerName, speaker);
    }

    const previousSegment = segments[segments.length - 1];
    const fallbackStartTimeSec = previousSegment ? previousSegment.endTimeSec + 1 : index * 8;
    const rawStartTimeSec =
      typeof draft.startTimeSec === "number" && Number.isFinite(draft.startTimeSec)
        ? draft.startTimeSec
        : fallbackStartTimeSec;
    const startTimeSec = Math.max(previousSegment ? previousSegment.startTimeSec + 1 : 0, Math.round(rawStartTimeSec));
    const rawEndTimeSec =
      typeof draft.endTimeSec === "number" && Number.isFinite(draft.endTimeSec)
        ? draft.endTimeSec
        : startTimeSec + 6;
    const endTimeSec = Math.max(startTimeSec + 1, Math.round(rawEndTimeSec));

    segments.push({
      id: createId("segment"),
      speakerId: speaker.id,
      startTimeSec,
      endTimeSec,
      text,
      ...(typeof draft.confidence === "number" && Number.isFinite(draft.confidence)
        ? { confidence: Math.max(0, Math.min(1, draft.confidence)) }
        : {}),
    });
  });

  if (segments.length === 0) {
    return null;
  }

  return {
    id: createId("live-log"),
    title,
    sourceType: "imported",
    speakers: Array.from(speakersByName.values()),
    segments,
  };
}

export function liveLogToTranscriptionDrafts(liveLog: LiveLogSession): TranscriptionSegmentDraft[] {
  return [...liveLog.segments]
    .sort((first, second) => first.startTimeSec - second.startTimeSec)
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => {
      const speaker = liveLog.speakers.find((candidate) => candidate.id === segment.speakerId);

      return {
        speakerName: speaker?.name ?? "話者不明",
        startTimeSec: segment.startTimeSec,
        endTimeSec: segment.endTimeSec,
        text: segment.text,
        ...(typeof segment.confidence === "number" && Number.isFinite(segment.confidence)
          ? { confidence: Math.max(0, Math.min(1, segment.confidence)) }
          : {}),
      };
    });
}

export function parsePlainLogToLiveLog(log: string, title: string): LiveLogSession | null {
  const speakersByName = new Map<string, Speaker>();
  const segments: TranscriptSegment[] = [];
  let activeSegment: TranscriptSegment | null = null;

  log.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const match = line.match(plainLogLinePattern);
    if (!match) {
      if (activeSegment) {
        activeSegment.text = `${activeSegment.text}\n${line}`;
      }
      return;
    }

    const parsedStartTimeSec = parseTimestampSeconds(match[1]);
    const speakerName = match[2].trim();
    const text = match[3].trim();
    let speaker = speakersByName.get(speakerName);

    if (!speaker) {
      speaker = {
        id: createId("speaker"),
        name: speakerName,
        role: inferSpeakerRole(speakerName),
      };
      speakersByName.set(speakerName, speaker);
    }

    const previousSegment = segments[segments.length - 1];
    const rawStartTimeSec = parsedStartTimeSec ?? segments.length * 8;
    const startTimeSec = previousSegment ? Math.max(rawStartTimeSec, previousSegment.startTimeSec + 1) : rawStartTimeSec;
    if (previousSegment) {
      previousSegment.endTimeSec = Math.max(
        previousSegment.startTimeSec + 1,
        Math.min(previousSegment.endTimeSec, startTimeSec),
      );
    }
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
