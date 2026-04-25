import type { ExtractionItem } from "../types";

const extractionKinds: ExtractionItem["kind"][] = ["出来事", "NPC", "手がかり", "GM秘密", "伏線"];
const extractionVisibilities: ExtractionItem["visibility"][] = ["PL既知", "GMのみ", "未開示候補"];

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
        maxItems: 12,
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

function extractJsonObject(text: string): string {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return text;
  }

  return text.slice(firstBrace, lastBrace + 1);
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

  rawResponse.items.slice(0, 12).forEach((rawItem, index) => {
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
      return;
    }

    seenKeys.add(key);
    items.push({
      id: typeof rawItem.id === "string" && rawItem.id.trim() ? rawItem.id.trim() : `llm-${index + 1}`,
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
