import { describe, expect, it } from "vitest";
import { buildExtractionPrompt } from "./extraction-prompt";

describe("buildExtractionPrompt", () => {
  it("includes source metadata and escapes transcript XML", () => {
    const prompt = buildExtractionPrompt({
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
    expect(prompt).toContain('<line index="1" speaker="GM &lt;keeper&gt;" role="GM">扉の奥に &amp; 印がある</line>');
    expect(prompt).toContain('"items"');
  });
});
