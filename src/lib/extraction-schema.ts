import type { ExtractionItem } from "../types";

const extractionKinds: ExtractionItem["kind"][] = ["出来事", "NPC", "手がかり", "GM秘密", "伏線"];
const extractionVisibilities: ExtractionItem["visibility"][] = ["PL既知", "GMのみ", "未開示候補"];
const maxExtractionItems = 12;
const maxExtractionIdLength = 80;

export const extractionResponseJsonSchema = {
  name: "trpg_log_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["items"],
    properties: {
      items: {
        type: "array",
        maxItems: maxExtractionItems,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "title", "detail", "visibility"],
          properties: {
            kind: {
              type: "string",
              enum: extractionKinds,
            },
            title: {
              type: "string",
              minLength: 1,
              maxLength: 48,
            },
            detail: {
              type: "string",
              minLength: 1,
              maxLength: 320,
            },
            visibility: {
              type: "string",
              enum: extractionVisibilities,
            },
          },
        },
      },
    },
  },
} as const;

export type NormalizedExtractionResponse = {
  items: ExtractionItem[];
  errors: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExtractionKind(value: unknown): value is ExtractionItem["kind"] {
  return typeof value === "string" && extractionKinds.includes(value as ExtractionItem["kind"]);
}

function isExtractionVisibility(value: unknown): value is ExtractionItem["visibility"] {
  return typeof value === "string" && extractionVisibilities.includes(value as ExtractionItem["visibility"]);
}

function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  return trimmedValue.slice(0, maxLength);
}

function extractBalancedJsonObject(text: string): string | null {
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) {
    return null;
  }

  let depth = 0;
  let isInString = false;
  let isEscaped = false;

  for (let index = firstBrace; index < text.length; index += 1) {
    const character = text[index];

    if (isInString) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === "\"") {
        isInString = false;
      }
      continue;
    }

    if (character === "\"") {
      isInString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(firstBrace, index + 1);
      }
    }
  }

  return null;
}

function extractJsonObject(text: string): string {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    const fencedText = fencedMatch[1].trim();
    return extractBalancedJsonObject(fencedText) ?? fencedText;
  }

  return extractBalancedJsonObject(text) ?? text;
}

function createFallbackId(index: number, seenIds: Set<string>): string {
  const baseId = `llm-${index + 1}`;
  let candidateId = baseId;
  let suffix = 2;

  while (seenIds.has(candidateId)) {
    candidateId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return candidateId;
}

function normalizeExtractionId(value: unknown, index: number, seenIds: Set<string>, errors: string[]): string {
  if (typeof value !== "string") {
    return createFallbackId(index, seenIds);
  }

  const id = value.trim();
  if (!id) {
    return createFallbackId(index, seenIds);
  }

  if (id.length > maxExtractionIdLength) {
    errors.push(`items[${index}].id が長すぎるため自動IDに置き換えました。`);
    return createFallbackId(index, seenIds);
  }

  if (seenIds.has(id)) {
    errors.push(`items[${index}].id が重複しているため自動IDに置き換えました。`);
    return createFallbackId(index, seenIds);
  }

  return id;
}

export function normalizeExtractionResponse(rawResponse: unknown): NormalizedExtractionResponse {
  const errors: string[] = [];

  if (!isRecord(rawResponse)) {
    return {
      items: [],
      errors: ["レスポンス全体がJSON objectではありません。"],
    };
  }

  if (!Array.isArray(rawResponse.items)) {
    return {
      items: [],
      errors: ["items配列がありません。"],
    };
  }

  const items: ExtractionItem[] = [];
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();

  if (rawResponse.items.length > maxExtractionItems) {
    errors.push(`items配列が${maxExtractionItems}件を超えたため、超過分を無視しました。`);
  }

  rawResponse.items.slice(0, maxExtractionItems).forEach((rawItem, index) => {
    if (!isRecord(rawItem)) {
      errors.push(`items[${index}] がobjectではありません。`);
      return;
    }

    if (!isExtractionKind(rawItem.kind)) {
      errors.push(`items[${index}].kind が許可値ではありません。`);
      return;
    }

    if (!isExtractionVisibility(rawItem.visibility)) {
      errors.push(`items[${index}].visibility が許可値ではありません。`);
      return;
    }

    const title = sanitizeText(rawItem.title, 48);
    const detail = sanitizeText(rawItem.detail, 320);
    if (!title || !detail) {
      errors.push(`items[${index}] のtitle/detailが空です。`);
      return;
    }

    const key = `${rawItem.kind}:${title}:${detail}:${rawItem.visibility}`;
    if (seenKeys.has(key)) {
      errors.push(`items[${index}] は重複する抽出項目のため無視しました。`);
      return;
    }

    seenKeys.add(key);
    const id = normalizeExtractionId(rawItem.id, index, seenIds, errors);
    seenIds.add(id);

    items.push({
      id,
      kind: rawItem.kind,
      title,
      detail,
      visibility: rawItem.visibility,
    });
  });

  return { items, errors };
}

export function parseExtractionJson(text: string): NormalizedExtractionResponse {
  try {
    return normalizeExtractionResponse(JSON.parse(extractJsonObject(text)));
  } catch {
    return {
      items: [],
      errors: ["JSONとしてパースできません。"],
    };
  }
}
