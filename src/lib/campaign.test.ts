import { describe, expect, it } from "vitest";
import {
  applyExtraction,
  countChronicleItems,
  duplicateCampaignState,
  duplicateSessionState,
  createExportFileName,
  formatChronicleMarkdown,
  formatPrepNoteMarkdown,
  generatePrepNote,
  getCampaignSearchText,
  getSessionSearchText,
  normalizeCampaignLibraryState,
  normalizeCampaignState,
} from "./campaign";

describe("normalizeCampaignState", () => {
  it("migrates a legacy single-session state into the session list", () => {
    const campaign = normalizeCampaignState({
      id: "campaign-legacy",
      campaignName: "  旧キャンペーン  ",
      activeSessionId: "missing-session",
      title: "  第2夜  ",
      date: "2026-04-29T21:00:00",
      log: "GM: 開始します",
      extractionItems: [
        { id: "item-1", kind: "手がかり", title: "鍵", detail: "古い鍵", visibility: "PL既知" },
      ],
      approvedIds: ["item-1", "missing-item", "item-1"],
    });

    expect(campaign.id).toBe("campaign-legacy");
    expect(campaign.campaignName).toBe("旧キャンペーン");
    expect(campaign.sessions).toHaveLength(1);
    expect(campaign.sessions[0]?.title).toBe("第2夜");
    expect(campaign.sessions[0]?.date).toBe("2026-04-29");
    expect(campaign.sessions[0]?.approvedIds).toEqual(["item-1"]);
    expect(campaign.activeSessionId).toBe(campaign.sessions[0]?.id);
  });

  it("normalizes provider settings and live log references", () => {
    const campaign = normalizeCampaignState({
      campaignName: "Provider検証",
      extractionProvider: {
        providerId: "unknown",
        model: "",
        endpoint: "  ",
      },
      transcriptionProvider: {
        providerId: "web-speech",
        model: "",
        endpoint: "  ",
        language: "  ja-JP  ",
      },
      sessions: [
        {
          id: "session-1",
          title: "ログ検証",
          date: "bad-date",
          log: "",
          liveLog: {
            id: "",
            title: "",
            sourceType: "bad-source",
            speakers: [
              { id: "speaker-1", name: "GM", role: "GM" },
              { id: "speaker-1", name: "PL", role: "bad-role" },
            ],
            segments: [
              {
                id: "segment-1",
                speakerId: "missing-speaker",
                startTimeSec: -5,
                endTimeSec: -1,
                text: 123,
                confidence: 1.7,
              },
              {
                id: "segment-2",
                speakerId: "speaker-1",
                startTimeSec: 4,
                endTimeSec: 2,
                text: "低信頼",
                confidence: -0.4,
              },
            ],
          },
          extractionItems: [],
          extractionRun: null,
          approvedIds: [],
        },
      ],
    });

    const [session] = campaign.sessions;
    const [firstSpeaker, secondSpeaker] = session.liveLog.speakers;
    const [segment, lowConfidenceSegment] = session.liveLog.segments;

    expect(campaign.extractionProvider.providerId).toBe("rule-based");
    expect(campaign.extractionProvider.model).toBe("local-rules-v1");
    expect(campaign.extractionProvider.endpoint).toBe("");
    expect(campaign.transcriptionProvider.providerId).toBe("web-speech");
    expect(campaign.transcriptionProvider.model).toBe("browser-speech-recognition");
    expect(campaign.transcriptionProvider.endpoint).toBe("");
    expect(campaign.transcriptionProvider.language).toBe("ja-JP");
    expect(session.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(session.liveLog.title).toBe("ログ検証");
    expect(session.liveLog.sourceType).toBe("imported");
    expect(secondSpeaker.id).not.toBe(firstSpeaker.id);
    expect(secondSpeaker.role).toBe("unknown");
    expect(segment.speakerId).toBe(firstSpeaker.id);
    expect(segment.startTimeSec).toBe(0);
    expect(segment.endTimeSec).toBe(1);
    expect(segment.text).toBe("");
    expect(segment.confidence).toBe(1);
    expect(lowConfidenceSegment.confidence).toBe(0);
  });

  it("restores default endpoints when provider endpoint settings are blank", () => {
    const campaign = normalizeCampaignState({
      extractionProvider: {
        providerId: "openai",
        model: "  ",
        endpoint: "  ",
      },
      transcriptionProvider: {
        providerId: "openai",
        model: "  ",
        endpoint: "  ",
        language: "",
      },
    });

    expect(campaign.extractionProvider).toEqual({
      providerId: "openai",
      model: "gpt-4.1-mini",
      endpoint: "https://api.openai.com/v1",
    });
    expect(campaign.transcriptionProvider).toEqual({
      providerId: "openai",
      model: "gpt-4o-mini-transcribe",
      endpoint: "https://api.openai.com/v1",
      language: "ja",
    });
  });
});

describe("countChronicleItems", () => {
  it("counts every campaign memory category", () => {
    expect(countChronicleItems({
      events: ["a"],
      npcs: [{ name: "n", role: "r", publicKnowledge: "p", gmSecret: "g", attitude: "a" }],
      clues: [{ title: "c", detail: "d", status: "known" }],
      locations: [{ name: "l", detail: "d" }],
      threads: [{ title: "t", detail: "d", nextMove: "n" }],
    })).toBe(5);
  });
});

describe("createExportFileName", () => {
  it("keeps safe Japanese campaign names and removes unsafe punctuation", () => {
    const fileName = createExportFileName(" 灰ヶ浦/第1夜? ");

    expect(fileName).toMatch(/^chronicle-gm-灰ヶ浦-第1夜-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
  });
});

describe("search text helpers", () => {
  it("includes session log and speaker content", () => {
    const session = normalizeCampaignState({
      sessions: [
        {
          title: "第3夜",
          date: "2026-04-30",
          log: "GM: 港へ向かう",
          liveLog: {
            title: "話者ログ",
            speakers: [{ id: "speaker-1", name: "アキラ", role: "PL" }],
            segments: [{ id: "segment-1", speakerId: "speaker-1", startTimeSec: 0, endTimeSec: 5, text: "灯台を調べる" }],
          },
          extractionItems: [
            { id: "item-1", kind: "GM秘密", title: "海底洞窟", detail: "干潮時だけ入れる", visibility: "GMのみ" },
          ],
          approvedIds: [],
        },
      ],
    }).sessions[0];

    expect(getSessionSearchText(session)).toContain("第3夜");
    expect(getSessionSearchText(session)).toContain("アキラ");
    expect(getSessionSearchText(session)).toContain("灯台を調べる");
    expect(getSessionSearchText(session)).toContain("海底洞窟");
    expect(getSessionSearchText(session)).toContain("干潮時だけ入れる");
  });

  it("includes campaign memory content", () => {
    const campaign = normalizeCampaignState({
      campaignName: "灰ヶ浦",
      sessions: [
        {
          title: "第4夜",
          date: "2026-05-01",
          log: "GM: 海鳴りが強い",
          extractionItems: [
            { id: "item-1", kind: "手がかり", title: "潮位表", detail: "干潮は深夜", visibility: "PL既知" },
          ],
          approvedIds: [],
        },
      ],
      chronicle: {
        events: ["港に到着"],
        npcs: [{ name: "潮見レン", role: "灯台守の甥", publicKnowledge: "鐘を知る", gmSecret: "秘密", attitude: "協力的" }],
        clues: [{ title: "古い鍵", detail: "倉庫で見つかる", status: "known" }],
        locations: [{ name: "灯台", detail: "岬に立つ" }],
        threads: [{ title: "月の鐘", detail: "まだ鳴らない", nextMove: "次回鳴る" }],
      },
    });

    expect(getCampaignSearchText(campaign)).toContain("灰ヶ浦");
    expect(getCampaignSearchText(campaign)).toContain("潮見レン");
    expect(getCampaignSearchText(campaign)).toContain("月の鐘");
    expect(getCampaignSearchText(campaign)).toContain("潮位表");
    expect(getCampaignSearchText(campaign)).toContain("海鳴りが強い");
  });
});

describe("normalizeCampaignLibraryState", () => {
  it("deduplicates campaign ids and preserves a valid active campaign", () => {
    const library = normalizeCampaignLibraryState({
      activeCampaignId: "campaign-1",
      campaigns: [
        { id: "campaign-1", campaignName: "A" },
        { id: "campaign-1", campaignName: "B" },
      ],
    });

    expect(library.campaigns).toHaveLength(2);
    expect(library.campaigns[0]?.id).toBe("campaign-1");
    expect(library.campaigns[1]?.id).not.toBe("campaign-1");
    expect(library.activeCampaignId).toBe("campaign-1");
  });
});

describe("duplicateSessionState", () => {
  it("copies session content while resetting ids and approval state", () => {
    const source = normalizeCampaignState({
      sessions: [
        {
          id: "session-1",
          title: "第1夜",
          date: "2026-04-29",
          log: "GM: 開始",
          liveLog: {
            id: "live-log-1",
            title: "第1夜",
            sourceType: "manual",
            speakers: [{ id: "speaker-1", name: "GM", role: "GM" }],
            segments: [{ id: "segment-1", speakerId: "speaker-1", startTimeSec: 0, endTimeSec: 5, text: "開始" }],
          },
          extractionItems: [{ id: "item-1", kind: "出来事", title: "開始", detail: "GM: 開始", visibility: "PL既知" }],
          extractionRun: {
            sourceType: "plain",
            providerId: "rule-based",
            providerLabel: "ルールベース",
            executedProviderId: "rule-based",
            executedProviderLabel: "ルールベース",
            fallbackUsed: false,
            itemCount: 1,
            promptLength: 0,
          },
          approvedIds: ["item-1"],
        },
      ],
    }).sessions[0];

    const duplicated = duplicateSessionState(source);

    expect(duplicated.id).not.toBe(source.id);
    expect(duplicated.title).toBe("第1夜 コピー");
    expect(duplicated.liveLog.title).toBe("第1夜 コピー");
    expect(duplicated.log).toBe(source.log);
    expect(duplicated.approvedIds).toEqual([]);
    expect(duplicated.extractionRun).toBeNull();
    expect(duplicated.liveLog.id).not.toBe(source.liveLog.id);
    expect(duplicated.liveLog.speakers[0]?.id).not.toBe(source.liveLog.speakers[0]?.id);
    expect(duplicated.liveLog.segments[0]?.id).not.toBe(source.liveLog.segments[0]?.id);
    expect(duplicated.liveLog.segments[0]?.speakerId).toBe(duplicated.liveLog.speakers[0]?.id);
  });
});

describe("duplicateCampaignState", () => {
  it("copies campaign memory and regenerates campaign/session identity", () => {
    const source = normalizeCampaignState({
      id: "campaign-1",
      campaignName: "灰ヶ浦",
      activeSessionId: "session-2",
      chronicle: {
        events: ["港に到着"],
        npcs: [],
        clues: [],
        locations: [],
        threads: [],
      },
      sessions: [
        { id: "session-1", title: "第1夜", date: "2026-04-28", log: "", extractionItems: [], approvedIds: [] },
        { id: "session-2", title: "第2夜", date: "2026-04-29", log: "", extractionItems: [], approvedIds: [] },
      ],
    });

    const duplicated = duplicateCampaignState(source);

    expect(duplicated.id).not.toBe(source.id);
    expect(duplicated.campaignName).toBe("灰ヶ浦 コピー");
    expect(duplicated.chronicle.events).toEqual(["港に到着"]);
    expect(duplicated.sessions).toHaveLength(2);
    expect(duplicated.sessions.map((session) => session.id)).not.toEqual(source.sessions.map((session) => session.id));
    expect(duplicated.activeSessionId).toBe(duplicated.sessions[1]?.id);
  });
});

describe("applyExtraction", () => {
  it("adds approved items to the right campaign memory buckets", () => {
    const chronicle = {
      events: [],
      npcs: [],
      clues: [],
      locations: [],
      threads: [],
    };

    const withNpc = applyExtraction(chronicle, {
      id: "npc-1",
      kind: "NPC",
      title: "潮見レン",
      detail: "灯台守の甥",
      visibility: "PL既知",
    });
    const withSecret = applyExtraction(withNpc, {
      id: "secret-1",
      kind: "GM秘密",
      title: "月の鐘",
      detail: "満潮で鳴る",
      visibility: "GMのみ",
    });
    const withThread = applyExtraction(withSecret, {
      id: "thread-1",
      kind: "伏線",
      title: "封じられた灯台",
      detail: "次回開く",
      visibility: "未開示候補",
    });
    const withEvent = applyExtraction(withThread, {
      id: "event-1",
      kind: "出来事",
      title: "港に到着",
      detail: "探索者が灰ヶ浦へ着いた",
      visibility: "PL既知",
    });

    expect(withEvent.npcs).toMatchObject([{ name: "潮見レン", publicKnowledge: "灯台守の甥" }]);
    expect(withEvent.clues).toMatchObject([{ title: "月の鐘", status: "hidden" }]);
    expect(withEvent.threads).toMatchObject([{ title: "封じられた灯台", nextMove: "次回準備で使う候補として保持する。" }]);
    expect(withEvent.events).toEqual(["港に到着: 探索者が灰ヶ浦へ着いた"]);
  });

  it("does not add duplicate memory items after whitespace normalization", () => {
    const chronicle = {
      events: ["港に到着: 探索者が灰ヶ浦へ着いた"],
      npcs: [],
      clues: [{ title: "月の鐘", detail: "満潮で鳴る", status: "hidden" as const }],
      locations: [],
      threads: [],
    };

    const withDuplicateClue = applyExtraction(chronicle, {
      id: "secret-1",
      kind: "GM秘密",
      title: " 月の鐘 ",
      detail: "満潮で鳴る",
      visibility: "GMのみ",
    });
    const withDuplicateEvent = applyExtraction(withDuplicateClue, {
      id: "event-1",
      kind: "出来事",
      title: "港に到着",
      detail: "探索者が灰ヶ浦へ着いた",
      visibility: "PL既知",
    });

    expect(withDuplicateEvent).toBe(chronicle);
  });
});

describe("generatePrepNote", () => {
  it("combines approved session events with campaign memory hooks", () => {
    const campaign = normalizeCampaignState({
      chronicle: {
        events: ["前回: 港で聞き込みをした"],
        npcs: [{ name: "潮見レン", role: "灯台守の甥", publicKnowledge: "鐘を知る", gmSecret: "秘密", attitude: "協力的" }],
        clues: [{ title: "月の鐘", detail: "満潮で鳴る", status: "partial" }],
        locations: [{ name: "灯台", detail: "岬の古い建物" }],
        threads: [{ title: "封じられた灯台", detail: "まだ開かない", nextMove: "次回、扉が反応する" }],
      },
      sessions: [
        {
          id: "session-1",
          title: "第1夜",
          date: "2026-04-29",
          log: "",
          extractionItems: [
            { id: "item-1", kind: "出来事", title: "鐘が鳴る", detail: "遠くで鐘が一度鳴った", visibility: "PL既知" },
            { id: "item-2", kind: "GM秘密", title: "月の鐘", detail: "満潮で鳴る", visibility: "GMのみ" },
          ],
          approvedIds: ["item-1", "item-2"],
        },
      ],
    });

    const prep = generatePrepNote(campaign.chronicle, campaign.sessions, campaign.sessions[0]);

    expect(prep.shortRecap).toContain("遠くで鐘が一度鳴った");
    expect(prep.hooks).toEqual(expect.arrayContaining([
      "月の鐘: 次に開示するなら 満潮で鳴る",
      "封じられた灯台: 次回、扉が反応する",
    ]));
    expect(prep.openQuestions).toContain("封じられた灯台: まだ開かない");
    expect(prep.reminders).toEqual(expect.arrayContaining([
      "1セッション分のログをキャンペーン記憶に積み上げ中。",
      "月の鐘をどこまで開示するか決める。",
      "月の鐘はPLに出す前に意図を確認する。",
    ]));
  });
});

describe("formatPrepNoteMarkdown", () => {
  it("formats prep notes as portable markdown", () => {
    expect(formatPrepNoteMarkdown({
      shortRecap: [" 前回の要点 "],
      hooks: ["導入案"],
      openQuestions: [],
      reminders: ["確認メモ"],
    }, " 第2夜 準備 ")).toBe([
      "# 第2夜 準備",
      "",
      "## 3行あらすじ",
      "",
      "1. 前回の要点",
      "",
      "## 次回導入案",
      "",
      "1. 導入案",
      "",
      "## 未解決の問い",
      "",
      "- 生成された準備項目はありません。",
      "",
      "## GM確認メモ",
      "",
      "1. 確認メモ",
    ].join("\n"));
  });
});

describe("formatChronicleMarkdown", () => {
  it("formats campaign memory as readable markdown", () => {
    expect(formatChronicleMarkdown({
      events: ["港に到着"],
      npcs: [{ name: "潮見レン", role: "灯台守の甥", publicKnowledge: "鐘を知る", gmSecret: "秘密", attitude: "協力的" }],
      clues: [{ title: "月の鐘", detail: "満潮で鳴る", status: "partial" }],
      locations: [],
      threads: [{ title: "封じられた灯台", detail: "まだ開かない", nextMove: "扉が反応する" }],
    }, " 灰ヶ浦 記憶 ")).toContain("- 月の鐘 [一部既知]: 満潮で鳴る");
  });
});
