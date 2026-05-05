import { describe, expect, it } from "vitest";
import { buildExtractionPrompt } from "./extraction-prompt";

describe("buildExtractionPrompt", () => {
  it("includes source metadata and escapes transcript XML", () => {
    const prompt = buildExtractionPrompt({
      campaignMode: "investigation",
      source: "speaker",
      lines: [
        {
          role: "GM",
          speakerName: "GM <keeper>",
          text: "扉の奥に & 印がある",
        },
      ],
    });

    expect(prompt).toContain('<input_summary source="話者付きログ" line_count="1" />');
    expect(prompt).toContain("キャンペーン種別: 調査シナリオ");
    expect(prompt).toContain('<line index="1" speaker="GM &lt;keeper&gt;" role="GM">扉の奥に &amp; 印がある</line>');
    expect(prompt).toContain('"items"');
  });

  it("adds fantasy campaign extraction guidance", () => {
    const prompt = buildExtractionPrompt({
      campaignMode: "fantasy",
      source: "plain",
      lines: [{ text: "騎士団が北門の防衛を依頼した" }],
    });

    expect(prompt).toContain("キャンペーン種別: ファンタジーキャンペーン");
    expect(prompt).toContain("クエスト、NPC、拠点、勢力、アイテム、移動履歴、世界変化");
  });
});
