import type { ExtractionItem, LiveLogSession, Speaker, SpeakerRole, TranscriptSegment } from "../types";
import { createId } from "./campaign";

export type ExtractionSource = "plain" | "speaker";

export type ExtractionInputLine = {
  role?: SpeakerRole;
  speakerName?: string;
  text: string;
};

const npcNamePattern = /(?:女将|村長|灯台守|船長|医師|司祭|娘|甥|少女|少年|老人|男|女)(?:の)?([ァ-ヶー一-龠々]{1,8})|([ァ-ヶー一-龠々]{1,8})(?:は|が).*(?:話|言|証言)/;

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
      return `${speaker?.name ?? "話者不明"}: ${segment.text.trim()}`;
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

export function parsePlainLogToLiveLog(log: string, title: string): LiveLogSession | null {
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
