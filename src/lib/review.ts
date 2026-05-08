import type { ExtractionItem } from "../types";

export type ReviewSortMode = "original" | "status" | "kind" | "visibility";

const kindOrder: ExtractionItem["kind"][] = ["出来事", "NPC", "手がかり", "GM秘密", "伏線"];
const visibilityOrder: ExtractionItem["visibility"][] = ["PL既知", "未開示候補", "GMのみ"];

export type ReviewItemSummary = {
  total: number;
  approved: number;
  pending: number;
  approvable: number;
  invalid: number;
  duplicate: number;
  byKind: Record<ExtractionItem["kind"], number>;
  byVisibility: Record<ExtractionItem["visibility"], number>;
};

export type RemovedReviewItem = {
  item: ExtractionItem;
  index: number;
};

function indexInOrder<T extends string>(order: T[], value: T): number {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

export function buildReviewRemovalBatch(
  items: ExtractionItem[],
  targetIds: Set<string>,
): RemovedReviewItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => targetIds.has(item.id));
}

export function restoreReviewItems(
  items: ExtractionItem[],
  removedItems: RemovedReviewItem[],
): ExtractionItem[] {
  const existingIds = new Set(items.map((item) => item.id));
  const restoredItems = [...items];

  [...removedItems]
    .sort((left, right) => left.index - right.index)
    .forEach(({ item, index }) => {
      if (existingIds.has(item.id)) {
        return;
      }

      restoredItems.splice(Math.min(index, restoredItems.length), 0, item);
      existingIds.add(item.id);
    });

  return restoredItems;
}

export function summarizeReviewItems(
  items: ExtractionItem[],
  approvedIds: string[],
  duplicateIds: string[] = [],
): ReviewItemSummary {
  const approvedIdSet = new Set(approvedIds);
  const duplicateIdSet = new Set(duplicateIds);

  return items.reduce<ReviewItemSummary>(
    (summary, item) => {
      const isApproved = approvedIdSet.has(item.id);
      const isValid = Boolean(item.title.trim() && item.detail.trim());

      return {
        total: summary.total + 1,
        approved: summary.approved + (isApproved ? 1 : 0),
        pending: summary.pending + (isApproved ? 0 : 1),
        approvable: summary.approvable + (!isApproved && isValid ? 1 : 0),
        invalid: summary.invalid + (isValid ? 0 : 1),
        duplicate: summary.duplicate + (duplicateIdSet.has(item.id) ? 1 : 0),
        byKind: {
          ...summary.byKind,
          [item.kind]: summary.byKind[item.kind] + 1,
        },
        byVisibility: {
          ...summary.byVisibility,
          [item.visibility]: summary.byVisibility[item.visibility] + 1,
        },
      };
    },
    {
      total: 0,
      approved: 0,
      pending: 0,
      approvable: 0,
      invalid: 0,
      duplicate: 0,
      byKind: {
        出来事: 0,
        NPC: 0,
        手がかり: 0,
        GM秘密: 0,
        伏線: 0,
      },
      byVisibility: {
        PL既知: 0,
        GMのみ: 0,
        未開示候補: 0,
      },
    },
  );
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
