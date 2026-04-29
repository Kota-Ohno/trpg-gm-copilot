import { describe, expect, it } from "vitest";
import { normalizeCampaignLibraryState, normalizeCampaignState } from "./campaign";

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
    expect(campaign.transcriptionProvider.providerId).toBe("web-speech");
    expect(campaign.transcriptionProvider.language).toBe("ja-JP");
    expect(session.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(session.liveLog.title).toBe("ログ検証");
    expect(session.liveLog.sourceType).toBe("imported");
    expect(secondSpeaker.id).not.toBe(firstSpeaker.id);
    expect(secondSpeaker.role).toBe("unknown");
    expect(segment.speakerId).toBe(firstSpeaker.id);
    expect(segment.startTimeSec).toBe(0);
    expect(segment.endTimeSec).toBe(0);
    expect(segment.text).toBe("");
    expect(segment.confidence).toBe(1);
    expect(lowConfidenceSegment.confidence).toBe(0);
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
