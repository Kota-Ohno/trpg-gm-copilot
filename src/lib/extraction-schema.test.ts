import { describe, expect, it } from "vitest";
import { normalizeExtractionResponse, parseExtractionJson } from "./extraction-schema";

describe("normalizeExtractionResponse", () => {
  it("normalizes valid extraction items and replaces duplicate ids", () => {
    const result = normalizeExtractionResponse({
      items: [
        {
          id: "same-id",
          kind: "手がかり",
          title: "  古い鍵  ",
          detail: " 倉庫の床下から見つかった ",
          visibility: "PL既知",
        },
        {
          id: "same-id",
          kind: "伏線",
          title: "月の鐘",
          detail: "次回、灯台で三度鳴る",
          visibility: "未開示候補",
        },
      ],
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      id: "same-id",
      title: "古い鍵",
      detail: "倉庫の床下から見つかった",
    });
    expect(result.items[1]?.id).toBe("llm-2");
    expect(result.errors).toContain("items[1].id が重複しているため自動IDに置き換えました。");
  });

  it("drops invalid and duplicated items with validation errors", () => {
    const result = normalizeExtractionResponse({
      items: [
        { kind: "不明", title: "x", detail: "x", visibility: "PL既知" },
        { kind: "NPC", title: "潮見レン", detail: "灯台守の甥", visibility: "PL既知" },
        { kind: "NPC", title: "潮見レン", detail: "灯台守の甥", visibility: "PL既知" },
        { kind: "手がかり", title: "", detail: "空タイトル", visibility: "PL既知" },
      ],
    });

    expect(result.items).toEqual([
      {
        id: "llm-2",
        kind: "NPC",
        title: "潮見レン",
        detail: "灯台守の甥",
        visibility: "PL既知",
      },
    ]);
    expect(result.errors).toEqual([
      "items[0].kind が許可値ではありません。",
      "items[2] は重複する抽出項目のため無視しました。",
      "items[3] のtitle/detailが空です。",
    ]);
  });
});

describe("parseExtractionJson", () => {
  it("extracts fenced JSON from provider prose", () => {
    const result = parseExtractionJson(`
      以下です。
      \`\`\`json
      {
        "items": [
          {
            "kind": "出来事",
            "title": "港に到着",
            "detail": "探索者たちは雨の港へ着いた",
            "visibility": "PL既知"
          }
        ]
      }
      \`\`\`
    `);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe("港に到着");
    expect(result.errors).toEqual([]);
  });

  it("returns a parse error for non-json text", () => {
    expect(parseExtractionJson("候補はありません").errors).toEqual(["JSONとしてパースできません。"]);
  });
});
