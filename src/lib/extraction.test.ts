import { describe, expect, it } from "vitest";
import { normalizeTranscriptionDrafts, transcriptionDraftsToLiveLog } from "./extraction";

describe("normalizeTranscriptionDrafts", () => {
  it("rejects non-array draft input", () => {
    expect(normalizeTranscriptionDrafts({ text: "単発" })).toBeNull();
  });

  it("keeps only valid segment draft fields", () => {
    expect(normalizeTranscriptionDrafts([
      null,
      { speakerName: "GM", startTimeSec: 0, endTimeSec: 6, text: "開始", confidence: 0.9, extra: "ignored" },
      { speakerName: 12, text: "名前なし", confidence: "high" },
      { speakerName: "PL" },
    ])).toEqual([
      { speakerName: "GM", startTimeSec: 0, endTimeSec: 6, text: "開始", confidence: 0.9 },
      { text: "名前なし" },
    ]);
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
