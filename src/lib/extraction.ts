import type {
  ExtractionItem,
  LiveLogSession,
  PrepNote,
  SessionState,
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
  averageConfidence: number | null;
  emptySegmentCount: number;
  lowConfidenceCount: number;
  nonEmptySegmentCount: number;
  totalDurationSec: number;
  totalSegmentCount: number;
  usedSpeakerCount: number;
};

export type TranscriptionDraftPreview =
  | { status: "empty" }
  | { status: "empty-segments" }
  | { status: "invalid-json" }
  | { status: "invalid-shape" }
  | {
      status: "valid";
      segmentCount: number;
      speakerCount: number;
      totalDurationSec: number;
      lowConfidenceCount: number;
      missingTimingCount: number;
    };

export type SpeakerSegmentExport = {
  segmentCount: number;
  segments: Array<{
    confidence?: number;
    endTimeSec: number;
    speakerName: string;
    speakerRole: SpeakerRole;
    startTimeSec: number;
    text: string;
  }>;
};

export type PlainLogSummary = {
  characterCount: number;
  nonEmptyLineCount: number;
  speakerLineCount: number;
  speakerLineRatio: number;
};

export type SpeakerUsageSummary = {
  segmentCount: number;
  speakerId: string;
  speakerName: string;
  speakerRole: SpeakerRole;
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

export function formatSpeakerLogMarkdown(liveLog: LiveLogSession, title: string): string {
  const summary = summarizeLiveLog(liveLog);
  const speakerUsage = summarizeSpeakerUsage(liveLog);
  const lines = [...liveLog.segments]
    .sort((first, second) => first.startTimeSec - second.startTimeSec)
    .filter((segment) => segment.text.trim().length > 0)
    .map((segment) => {
      const speaker = liveLog.speakers.find((candidate) => candidate.id === segment.speakerId);
      const confidence =
        typeof segment.confidence === "number" && Number.isFinite(segment.confidence)
          ? ` / 信頼度 ${Math.round(Math.max(0, Math.min(1, segment.confidence)) * 100)}%`
          : "";

      return `- [${formatTimestamp(segment.startTimeSec)}] **${speaker?.name ?? "話者不明"}**: ${segment.text.trim()}${confidence}`;
    });

  return [
    `# ${title.trim() || liveLog.title || "話者付きログ"}`,
    "",
    `- 発話: ${summary.nonEmptySegmentCount}`,
    `- 話者: ${summary.usedSpeakerCount}`,
    `- 合計時間: ${formatTimestamp(summary.totalDurationSec)}`,
    ...(summary.averageConfidence !== null ? [`- 平均信頼度: ${Math.round(summary.averageConfidence * 100)}%`] : []),
    "",
    "## 話者",
    "",
    ...(speakerUsage.length > 0
      ? speakerUsage.map((speaker) => `- ${speaker.speakerName} (${speaker.speakerRole}): ${speaker.segmentCount}発話`)
      : ["- 話者はありません。"]),
    "",
    "## 発話",
    "",
    ...(lines.length > 0 ? lines : ["- 発話はありません。"]),
  ].join("\n").trimEnd();
}

export function summarizeSpeakerUsage(liveLog: LiveLogSession): SpeakerUsageSummary[] {
  return liveLog.speakers.map((speaker) => ({
    segmentCount: liveLog.segments.filter(
      (segment) => segment.speakerId === speaker.id && segment.text.trim().length > 0,
    ).length,
    speakerId: speaker.id,
    speakerName: speaker.name,
    speakerRole: speaker.role,
  }));
}

export function formatReviewItemsMarkdown(items: ExtractionItem[], title: string, approvedIds: string[] = []): string {
  const visibleItems = items.filter((item) => item.title.trim() || item.detail.trim());
  const approvedIdSet = new Set(approvedIds);

  return [
    `# ${title.trim() || "抽出候補"}`,
    "",
    ...(visibleItems.length > 0
      ? visibleItems.flatMap((item, index) => [
          `## ${index + 1}. ${item.title.trim() || "無題の候補"}`,
          "",
          `- 種別: ${item.kind}`,
          `- 公開範囲: ${item.visibility}`,
          `- 状態: ${approvedIdSet.has(item.id) ? "採用済み" : "未確認"}`,
          `- 詳細: ${item.detail.trim() || "未入力"}`,
          "",
        ])
      : ["- 表示中の抽出候補はありません。"]),
  ].join("\n").trimEnd();
}

export function findDuplicateExtractionItemIds(items: ExtractionItem[], protectedIds: string[] = []): string[] {
  const protectedIdSet = new Set(protectedIds);
  const seenKeys = new Set<string>();
  const duplicateIds: string[] = [];

  items.forEach((item) => {
    const key = [item.kind, item.title.trim(), item.detail.trim(), item.visibility].join("\u0000");
    if (!key.trim()) {
      return;
    }

    if (seenKeys.has(key) && !protectedIdSet.has(item.id)) {
      duplicateIds.push(item.id);
      return;
    }

    seenKeys.add(key);
  });

  return duplicateIds;
}

export function normalizeExtractionItemText(item: ExtractionItem): ExtractionItem {
  return {
    ...item,
    detail: item.detail.trim().replace(/\s+/g, " "),
    title: item.title.trim().replace(/\s+/g, " "),
  };
}

export function formatSessionMarkdown(session: SessionState, prepNote?: PrepNote): string {
  const speakerLogText = liveLogToPlainText(session.liveLog);
  const reviewMarkdown = formatReviewItemsMarkdown(session.extractionItems, "抽出候補", session.approvedIds)
    .replace(/^# /m, "## ")
    .replace(/^## /gm, "### ");
  const prepSections: Array<[string, string[]]> = prepNote
    ? [
        ["3行あらすじ", prepNote.shortRecap],
        ["次回導入案", prepNote.hooks],
        ["未解決の問い", prepNote.openQuestions],
        ["GM確認メモ", prepNote.reminders],
      ]
    : [];

  return [
    `# ${session.title.trim() || "セッション"}`,
    "",
    `- 日付: ${session.date}`,
    `- 抽出候補: ${session.extractionItems.length}`,
    `- 採用済み: ${session.approvedIds.length}`,
    ...(session.extractionRun
      ? [
          `- 抽出Provider: ${session.extractionRun.executedProviderLabel}`,
          `- フォールバック: ${session.extractionRun.fallbackUsed ? "あり" : "なし"}`,
          ...(session.extractionRun.note ? [`- 抽出メモ: ${session.extractionRun.note}`] : []),
        ]
      : []),
    "",
    "## 通常ログ",
    "",
    session.log.trim() ? "```text\n" + session.log.trim() + "\n```" : "通常ログはありません。",
    "",
    "## 話者付きログ",
    "",
    speakerLogText ? "```text\n" + speakerLogText + "\n```" : "話者付きログはありません。",
    "",
    reviewMarkdown.replace(/^### 抽出候補$/m, "## 抽出候補"),
    "",
    ...prepSections.flatMap(([title, items]) => {
      const visibleItems = items.map((item) => item.trim()).filter(Boolean);

      return [
        `## ${title}`,
        "",
        ...(visibleItems.length > 0
          ? visibleItems.map((item, index) => `${index + 1}. ${item}`)
          : ["- 生成された準備項目はありません。"]),
        "",
      ];
    }),
  ].join("\n").trimEnd();
}

export function summarizePlainLog(log: string): PlainLogSummary {
  const nonEmptyLines = log.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const speakerLineCount = nonEmptyLines.filter((line) => plainLogLinePattern.test(line.trim())).length;

  return {
    characterCount: log.length,
    nonEmptyLineCount: nonEmptyLines.length,
    speakerLineCount,
    speakerLineRatio: nonEmptyLines.length > 0 ? Math.round((speakerLineCount / nonEmptyLines.length) * 100) : 0,
  };
}

export function summarizeLiveLog(liveLog: LiveLogSession): LiveLogSummary {
  const confidenceValues = liveLog.segments
    .map((segment) => segment.confidence)
    .filter((confidence): confidence is number => typeof confidence === "number" && Number.isFinite(confidence));

  return {
    averageConfidence: confidenceValues.length > 0
      ? confidenceValues.reduce((total, confidence) => total + Math.max(0, Math.min(1, confidence)), 0) / confidenceValues.length
      : null,
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

export function mergeAdjacentTranscriptSegments(liveLog: LiveLogSession): LiveLogSession {
  const sortedSegments = [...liveLog.segments].sort((first, second) => first.startTimeSec - second.startTimeSec);
  const mergedSegments: TranscriptSegment[] = [];

  sortedSegments.forEach((segment) => {
    const previousSegment = mergedSegments[mergedSegments.length - 1];
    if (!previousSegment || previousSegment.speakerId !== segment.speakerId) {
      mergedSegments.push({ ...segment });
      return;
    }

    previousSegment.endTimeSec = Math.max(previousSegment.endTimeSec, segment.endTimeSec);
    previousSegment.text = [previousSegment.text.trim(), segment.text.trim()].filter(Boolean).join("\n");
    if (typeof previousSegment.confidence === "number" || typeof segment.confidence === "number") {
      previousSegment.confidence = Math.min(previousSegment.confidence ?? 1, segment.confidence ?? 1);
    }
  });

  return {
    ...liveLog,
    segments: mergedSegments,
  };
}

export function normalizeTranscriptSegmentTiming(liveLog: LiveLogSession): LiveLogSession {
  let nextStartTimeSec = 0;

  return {
    ...liveLog,
    segments: [...liveLog.segments]
      .sort((first, second) => first.startTimeSec - second.startTimeSec)
      .map((segment) => {
        const durationSec = Math.max(1, segment.endTimeSec - segment.startTimeSec);
        const startTimeSec = Math.max(nextStartTimeSec, Math.round(segment.startTimeSec));
        const endTimeSec = startTimeSec + durationSec;
        nextStartTimeSec = endTimeSec + 1;

        return {
          ...segment,
          startTimeSec,
          endTimeSec,
        };
      }),
  };
}

export function splitTranscriptSegment(liveLog: LiveLogSession, segmentId: string): LiveLogSession {
  const targetIndex = liveLog.segments.findIndex((segment) => segment.id === segmentId);
  const targetSegment = liveLog.segments[targetIndex];
  if (!targetSegment) {
    return liveLog;
  }

  const text = targetSegment.text.trim();
  if (text.length < 2) {
    return liveLog;
  }

  const midpointIndex = text.length > 1 ? Math.ceil(text.length / 2) : text.length;
  const preferredSplitIndex = findPreferredTextSplitIndex(text, midpointIndex);
  const splitIndex = preferredSplitIndex ?? midpointIndex;
  const firstText = text.slice(0, splitIndex).trim();
  const secondText = text.slice(splitIndex).trim();
  const durationSec = Math.max(2, targetSegment.endTimeSec - targetSegment.startTimeSec);
  const midpointSec = targetSegment.startTimeSec + Math.ceil(durationSec / 2);

  const firstSegment: TranscriptSegment = {
    ...targetSegment,
    endTimeSec: midpointSec,
    text: firstText || targetSegment.text,
  };
  const secondSegment: TranscriptSegment = {
    ...targetSegment,
    id: createId("segment"),
    startTimeSec: midpointSec + 1,
    endTimeSec: Math.max(midpointSec + 2, targetSegment.endTimeSec),
    text: secondText,
  };

  return {
    ...liveLog,
    segments: [
      ...liveLog.segments.slice(0, targetIndex),
      firstSegment,
      secondSegment,
      ...liveLog.segments.slice(targetIndex + 1),
    ],
  };
}

function findPreferredTextSplitIndex(text: string, midpointIndex: number): number | null {
  const splitCharacters = ["\n", "。", "！", "？", "、", ",", " "];
  const candidates = splitCharacters.flatMap((character) => {
    const before = text.lastIndexOf(character, midpointIndex);
    const after = text.indexOf(character, midpointIndex);

    return [before >= 1 ? before + character.length : null, after >= 1 ? after + character.length : null];
  }).filter((index): index is number => index !== null && index > 0 && index < text.length);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort(
    (first, second) => Math.abs(first - midpointIndex) - Math.abs(second - midpointIndex),
  )[0];
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

    const text = draft.text.trim();
    if (!text) {
      return [];
    }
    const speakerName = typeof draft.speakerName === "string" ? draft.speakerName.trim() : "";

    return [{
      ...(speakerName ? { speakerName } : {}),
      ...(typeof draft.startTimeSec === "number" ? { startTimeSec: draft.startTimeSec } : {}),
      ...(typeof draft.endTimeSec === "number" ? { endTimeSec: draft.endTimeSec } : {}),
      text,
      ...(typeof draft.confidence === "number" ? { confidence: draft.confidence } : {}),
    }];
  });
}

export function previewTranscriptionDraftPayload(payload: string): TranscriptionDraftPreview {
  if (!payload.trim()) {
    return { status: "empty" };
  }

  try {
    const parsedDrafts = JSON.parse(payload) as unknown;
    const normalizedDrafts = normalizeTranscriptionDrafts(parsedDrafts);
    if (!normalizedDrafts) {
      return { status: "invalid-shape" };
    }
    if (normalizedDrafts.length === 0) {
      return { status: "empty-segments" };
    }

    return {
      status: "valid",
      segmentCount: normalizedDrafts.length,
      speakerCount: new Set(normalizedDrafts.map((draft) => draft.speakerName?.trim() || "話者不明")).size,
      totalDurationSec: normalizedDrafts.reduce((total, draft) => {
        const startTimeSec = typeof draft.startTimeSec === "number" && Number.isFinite(draft.startTimeSec)
          ? draft.startTimeSec
          : 0;
        const endTimeSec = typeof draft.endTimeSec === "number" && Number.isFinite(draft.endTimeSec)
          ? draft.endTimeSec
          : startTimeSec;

        return total + Math.max(0, endTimeSec - startTimeSec);
      }, 0),
      lowConfidenceCount: normalizedDrafts.filter(
        (draft) =>
          typeof draft.confidence === "number" &&
          Number.isFinite(draft.confidence) &&
          draft.confidence < lowConfidenceThreshold,
      ).length,
      missingTimingCount: normalizedDrafts.filter(
        (draft) =>
          typeof draft.startTimeSec !== "number" ||
          !Number.isFinite(draft.startTimeSec) ||
          typeof draft.endTimeSec !== "number" ||
          !Number.isFinite(draft.endTimeSec),
      ).length,
    };
  } catch {
    return { status: "invalid-json" };
  }
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
    const startTimeSec = Math.max(previousSegment ? previousSegment.endTimeSec + 1 : 0, Math.round(rawStartTimeSec));
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

export function appendTranscriptionDraftsToLiveLog(
  liveLog: LiveLogSession,
  drafts: TranscriptionSegmentDraft[],
): LiveLogSession | null {
  const importedLiveLog = transcriptionDraftsToLiveLog(drafts, liveLog.title);
  if (!importedLiveLog) {
    return null;
  }

  const speakersByName = new Map(liveLog.speakers.map((speaker) => [speaker.name.trim(), speaker]));
  const speakers = [...liveLog.speakers];
  const speakerIdMap = new Map<string, string>();

  importedLiveLog.speakers.forEach((speaker) => {
    const existingSpeaker = speakersByName.get(speaker.name.trim());
    if (existingSpeaker) {
      speakerIdMap.set(speaker.id, existingSpeaker.id);
      return;
    }

    speakers.push(speaker);
    speakersByName.set(speaker.name.trim(), speaker);
    speakerIdMap.set(speaker.id, speaker.id);
  });

  const lastEndTimeSec = liveLog.segments.reduce((max, segment) => Math.max(max, segment.endTimeSec), 0);
  const firstImportedStartTimeSec = importedLiveLog.segments[0]?.startTimeSec ?? 0;
  const offsetSec = liveLog.segments.length > 0 && firstImportedStartTimeSec <= lastEndTimeSec
    ? lastEndTimeSec - firstImportedStartTimeSec + 1
    : 0;

  return {
    ...liveLog,
    speakers,
    segments: [
      ...liveLog.segments,
      ...importedLiveLog.segments.map((segment) => ({
        ...segment,
        speakerId: speakerIdMap.get(segment.speakerId) ?? speakers[0].id,
        startTimeSec: segment.startTimeSec + offsetSec,
        endTimeSec: segment.endTimeSec + offsetSec,
      })),
    ],
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

export function buildSpeakerSegmentExport(
  liveLog: LiveLogSession,
  segments: TranscriptSegment[],
): SpeakerSegmentExport {
  const speakersById = new Map(liveLog.speakers.map((speaker) => [speaker.id, speaker]));

  return {
    segmentCount: segments.length,
    segments: segments.map((segment) => {
      const speaker = speakersById.get(segment.speakerId);

      return {
        speakerName: speaker?.name ?? "話者不明",
        speakerRole: speaker?.role ?? "unknown",
        startTimeSec: segment.startTimeSec,
        endTimeSec: segment.endTimeSec,
        text: segment.text,
        ...(typeof segment.confidence === "number" && Number.isFinite(segment.confidence)
          ? { confidence: Math.max(0, Math.min(1, segment.confidence)) }
          : {}),
      };
    }),
  };
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
    const startTimeSec = previousSegment ? Math.max(rawStartTimeSec, previousSegment.endTimeSec + 1) : rawStartTimeSec;
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
    id: createId("live-log"),
    title,
    sourceType: "imported",
    speakers: Array.from(speakersByName.values()),
    segments,
  };
}
