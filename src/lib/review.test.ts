import { describe, expect, it } from "vitest";
import type { ExtractionItem } from "../types";
import { sortReviewItems, summarizeReviewItems } from "./review";

const item = (
  id: string,
  kind: ExtractionItem["kind"],
  visibility: ExtractionItem["visibility"],
): ExtractionItem => ({
  id,
  kind,
  visibility,
  title: id,
  detail: `${id} detail`,
});

const reviewItems: ExtractionItem[] = [
  item("thread", "伏線", "GMのみ"),
  item("event", "出来事", "未開示候補"),
  item("npc", "NPC", "PL既知"),
  item("secret", "GM秘密", "GMのみ"),
  item("clue", "手がかり", "PL既知"),
];

describe("sortReviewItems", () => {
  it("keeps original order when requested", () => {
    expect(sortReviewItems(reviewItems, ["event"], "original").map((candidate) => candidate.id)).toEqual([
      "thread",
      "event",
      "npc",
      "secret",
      "clue",
    ]);
  });

  it("puts unapproved items before approved items without changing each group order", () => {
    expect(sortReviewItems(reviewItems, ["event", "secret"], "status").map((candidate) => candidate.id)).toEqual([
      "thread",
      "npc",
      "clue",
      "event",
      "secret",
    ]);
  });

  it("sorts by review kind in GM workflow order", () => {
    expect(sortReviewItems(reviewItems, [], "kind").map((candidate) => candidate.id)).toEqual([
      "event",
      "npc",
      "clue",
      "secret",
      "thread",
    ]);
  });

  it("sorts by visibility from public to hidden", () => {
    expect(sortReviewItems(reviewItems, [], "visibility").map((candidate) => candidate.id)).toEqual([
      "npc",
      "clue",
      "event",
      "thread",
      "secret",
    ]);
  });
});

describe("summarizeReviewItems", () => {
  it("counts approval, validity, duplicate, kind, and visibility totals", () => {
    const summary = summarizeReviewItems(
      [
        reviewItems[0],
        { ...reviewItems[1], detail: " " },
        reviewItems[2],
        reviewItems[3],
      ],
      ["npc"],
      ["thread", "secret"],
    );

    expect(summary).toEqual({
      total: 4,
      approved: 1,
      pending: 3,
      approvable: 2,
      invalid: 1,
      duplicate: 2,
      byKind: {
        出来事: 1,
        NPC: 1,
        手がかり: 0,
        GM秘密: 1,
        伏線: 1,
      },
      byVisibility: {
        PL既知: 1,
        GMのみ: 2,
        未開示候補: 1,
      },
    });
  });
});
