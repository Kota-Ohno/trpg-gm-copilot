import type { ExtractionItem } from "../types";

export type ReviewSortMode = "original" | "status" | "kind" | "visibility";

const kindOrder: ExtractionItem["kind"][] = ["出来事", "NPC", "手がかり", "GM秘密", "伏線"];
const visibilityOrder: ExtractionItem["visibility"][] = ["PL既知", "未開示候補", "GMのみ"];

function indexInOrder<T extends string>(order: T[], value: T): number {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

export function sortReviewItems(
  items: ExtractionItem[],
  approvedIds: string[],
  mode: ReviewSortMode,
): ExtractionItem[] {
  if (mode === "original") {
    return [...items];
  }

  const approvedIdSet = new Set(approvedIds);

  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (mode === "status") {
        const leftApproved = approvedIdSet.has(left.item.id);
        const rightApproved = approvedIdSet.has(right.item.id);

        if (leftApproved !== rightApproved) {
          return leftApproved ? 1 : -1;
        }
      }

      if (mode === "kind") {
        const kindDiff =
          indexInOrder(kindOrder, left.item.kind) - indexInOrder(kindOrder, right.item.kind);

        if (kindDiff !== 0) {
          return kindDiff;
        }
      }

      if (mode === "visibility") {
        const visibilityDiff =
          indexInOrder(visibilityOrder, left.item.visibility) -
          indexInOrder(visibilityOrder, right.item.visibility);

        if (visibilityDiff !== 0) {
          return visibilityDiff;
        }
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}
