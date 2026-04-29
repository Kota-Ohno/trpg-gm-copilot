import { describe, expect, it } from "vitest";
import {
  appendTranscriptionDraftsToLiveLog,
  liveLogToPlainText,
  liveLogToTranscriptionDrafts,
  normalizeTranscriptionDrafts,
  parsePlainLogToLiveLog,
  previewTranscriptionDraftPayload,
  summarizeLiveLog,
  transcriptionDraftsToLiveLog,
} from "./extraction";

const summaryLiveLog = {
  id: "live-log-1",
  title: "ログ",
  sourceType: "manual" as const,
  speakers: [
    { id: "speaker-gm", name: "GM", role: "GM" as const },
    { id: "speaker-pl", name: "アキラ", role: "PL" as const },
  ],
  segments: [
    {
      id: "segment-2",
      speakerId: "speaker-pl",
      startTimeSec: 8,
      endTimeSec: 12,
      text: "調べます",
      confidence: 0.88,
    },
    {
      id: "segment-empty",
      speakerId: "speaker-pl",
      startTimeSec: 4,
      endTimeSec: 6,
      text: " ",
    },
    {
      id: "segment-1",
      speakerId: "speaker-gm",
      startTimeSec: 0,
      endTimeSec: 5,
      text: "足音が聞こえる",
      confidence: 0.7,
    },
  ],
};

describe("normalizeTranscriptionDrafts", () => {
  it("rejects non-array draft input", () => {
    expect(normalizeTranscriptionDrafts({ text: "単発" })).toBeNull();
  });

  it("keeps only valid segment draft fields", () => {
    expect(normalizeTranscriptionDrafts([
      null,
      { speakerName: " GM ", startTimeSec: 0, endTimeSec: 6, text: " 開始 ", confidence: 0.9, extra: "ignored" },
      { speakerName: 12, text: "名前なし", confidence: "high" },
      { speakerName: "PL" },
      { speakerName: "PL", text: "   " },
    ])).toEqual([
      { speakerName: "GM", startTimeSec: 0, endTimeSec: 6, text: "開始", confidence: 0.9 },
      { text: "名前なし" },
    ]);
  });

  it("accepts provider-style objects with a segments array", () => {
    expect(normalizeTranscriptionDrafts({
      provider: "example",
      segments: [
        { speakerName: "GM", text: "足音が近づく", confidence: 0.82 },
      ],
    })).toEqual([
      { speakerName: "GM", text: "足音が近づく", confidence: 0.82 },
    ]);
  });
});

describe("previewTranscriptionDraftPayload", () => {
  it("reports empty, malformed, invalid shape, and valid payload states", () => {
    expect(previewTranscriptionDraftPayload(" ")).toEqual({ status: "empty" });
    expect(previewTranscriptionDraftPayload("{")).toEqual({ status: "invalid-json" });
    expect(previewTranscriptionDraftPayload("{}")).toEqual({ status: "invalid-shape" });
    expect(previewTranscriptionDraftPayload(JSON.stringify([{ text: " " }]))).toEqual({ status: "empty-segments" });
    expect(previewTranscriptionDraftPayload(JSON.stringify({
      segments: [
        { speakerName: "GM", text: "安全", confidence: 0.95 },
        { speakerName: "PL", text: "不明瞭", confidence: 0.4 },
      ],
    }))).toEqual({
      status: "valid",
      segmentCount: 2,
      lowConfidenceCount: 1,
    });
  });
});

describe("transcriptionDraftsToLiveLog", () => {
  it("builds speakers and clamps confidence into transcript segments", () => {
    const liveLog = transcriptionDraftsToLiveLog(
      [
        { speakerName: "GM", startTimeSec: 0, endTimeSec: 5, text: "足音が聞こえる", confidence: 1.4 },
        { speakerName: "GM", startTimeSec: 6, endTimeSec: 9, text: "扉が開く", confidence: -0.2 },
        { speakerName: "アキラ", text: "調べます" },
      ],
      "テスト文字起こし",
    );

    expect(liveLog).not.toBeNull();
    expect(liveLog?.title).toBe("テスト文字起こし");
    expect(liveLog?.sourceType).toBe("imported");
    expect(liveLog?.speakers.map((speaker) => speaker.name)).toEqual(["GM", "アキラ"]);
    expect(liveLog?.speakers[0]?.role).toBe("GM");
    expect(liveLog?.speakers[1]?.role).toBe("PL");
    expect(liveLog?.segments.map((segment) => segment.confidence)).toEqual([1, 0, undefined]);
    expect(liveLog?.segments[2]?.startTimeSec).toBeGreaterThan(liveLog?.segments[1]?.startTimeSec ?? 0);
  });

  it("returns null when every draft text is blank", () => {
    expect(transcriptionDraftsToLiveLog([{ speakerName: "GM", text: "   " }], "空ログ")).toBeNull();
  });
});

describe("appendTranscriptionDraftsToLiveLog", () => {
  it("reuses speakers and offsets appended segments after the existing log", () => {
    const appended = appendTranscriptionDraftsToLiveLog(summaryLiveLog, [
      { speakerName: "GM", startTimeSec: 0, endTimeSec: 3, text: "続きです" },
      { speakerName: "新PL", startTimeSec: 4, endTimeSec: 7, text: "参加します" },
    ]);

    expect(appended).not.toBeNull();
    expect(appended?.speakers.map((speaker) => speaker.name)).toEqual(["GM", "アキラ", "新PL"]);
    expect(appended?.segments).toHaveLength(5);
    expect(appended?.segments[3]?.speakerId).toBe(appended?.speakers[0]?.id);
    expect(appended?.segments[3]?.startTimeSec).toBe(13);
    expect(appended?.segments[4]?.speakerId).toBe(appended?.speakers[2]?.id);
    expect(appended?.segments[4]?.startTimeSec).toBe(17);
  });
});

describe("liveLogToTranscriptionDrafts", () => {
  it("exports sorted non-empty transcript segments with speaker names", () => {
    expect(liveLogToTranscriptionDrafts(summaryLiveLog)).toEqual([
      {
        speakerName: "GM",
        startTimeSec: 0,
        endTimeSec: 5,
        text: "足音が聞こえる",
        confidence: 0.7,
      },
      {
        speakerName: "アキラ",
        startTimeSec: 8,
        endTimeSec: 12,
        text: "調べます",
        confidence: 0.88,
      },
    ]);
  });
});

describe("liveLogToPlainText", () => {
  it("exports sorted non-empty speaker lines", () => {
    expect(liveLogToPlainText(summaryLiveLog)).toBe([
      "[00:00] GM: 足音が聞こえる",
      "[00:08] アキラ: 調べます",
    ].join("\n"));
  });
});

describe("summarizeLiveLog", () => {
  it("counts transcript health and duration", () => {
    expect(summarizeLiveLog(summaryLiveLog)).toEqual({
      emptySegmentCount: 1,
      lowConfidenceCount: 1,
      nonEmptySegmentCount: 2,
      totalDurationSec: 11,
      totalSegmentCount: 3,
      usedSpeakerCount: 2,
    });
  });
});

describe("parsePlainLogToLiveLog", () => {
  it("parses timestamped speaker lines and continuation text", () => {
    const liveLog = parsePlainLogToLiveLog(
      `
      [00:05] GM: 扉の奥から足音が聞こえる
      低く引きずるような音も混じっている
      [00:14] アキラ: 聞き耳を立てます
      `,
      "通常ログ取り込み",
    );

    expect(liveLog).not.toBeNull();
    expect(liveLog?.id.startsWith("live-log-")).toBe(true);
    expect(liveLog?.title).toBe("通常ログ取り込み");
    expect(liveLog?.speakers.map((speaker) => [speaker.name, speaker.role])).toEqual([
      ["GM", "GM"],
      ["アキラ", "PL"],
    ]);
    expect(liveLog?.segments.map((segment) => ({
      startTimeSec: segment.startTimeSec,
      endTimeSec: segment.endTimeSec,
      text: segment.text,
    }))).toEqual([
      {
        startTimeSec: 5,
        endTimeSec: 11,
        text: "扉の奥から足音が聞こえる\n低く引きずるような音も混じっている",
      },
      {
        startTimeSec: 14,
        endTimeSec: 20,
        text: "聞き耳を立てます",
      },
    ]);
  });

  it("returns null when no speaker lines are found", () => {
    expect(parsePlainLogToLiveLog("ただのメモ\n続き", "空")).toBeNull();
  });
});
