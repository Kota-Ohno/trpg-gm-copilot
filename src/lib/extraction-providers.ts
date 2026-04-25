import { mockExtraction } from "../data/sample";
import type {
  ExtractionItem,
  ExtractionProviderSettings,
  ExtractionRun,
  LiveLogSession,
} from "../types";
import {
  buildExtractionInput,
  type ExtractionSource,
  runRuleBasedExtraction,
} from "./extraction";
import { getExtractionProvider } from "./extraction-provider-settings";
import { buildExtractionPrompt } from "./extraction-prompt";
import { parseExtractionJson } from "./extraction-schema";

export type ExtractionRequest = {
  log: string;
  liveLog: LiveLogSession;
  source: ExtractionSource;
  settings: ExtractionProviderSettings;
};

export type ExtractionResult = {
  items: ExtractionItem[];
  run: ExtractionRun;
};

export function buildLlmExtractionResult(
  responseText: string,
  request: ExtractionRequest,
): ExtractionResult {
  const provider = getExtractionProvider(request.settings.providerId);
  const normalizedResponse = parseExtractionJson(responseText);

  return {
    items: normalizedResponse.items,
    run: {
      sourceType: request.source,
      providerId: provider.id,
      providerLabel: provider.label,
      itemCount: normalizedResponse.items.length,
      note:
        normalizedResponse.errors.length > 0
          ? "LLMレスポンスを読み取りましたが、一部の候補を検証で除外しました。"
          : "LLMレスポンスをJSONスキーマに沿って正規化しました。",
      promptVersion: "extraction-v1",
      validationErrors: normalizedResponse.errors,
    },
  };
}

export async function runExtractionProvider({
  log,
  liveLog,
  settings,
  source,
}: ExtractionRequest): Promise<ExtractionResult> {
  const provider = getExtractionProvider(settings.providerId);
  const extractionLines = buildExtractionInput(log, liveLog, source);
  const prompt = buildExtractionPrompt({ lines: extractionLines, source });
  const generatedItems = runRuleBasedExtraction(extractionLines);
  const items = generatedItems.length > 0 ? generatedItems : mockExtraction;
  const sourceType = generatedItems.length > 0 ? source : "fallback";
  const note =
    provider.status === "available"
      ? "ルールベース抽出です。採用前に内容を調整してください。"
      : `${provider.label}連携は未接続です。抽出プロンプトv1を生成し、現在はルールベース抽出にフォールバックしています。`;

  return {
    items,
    run: {
      sourceType,
      providerId: provider.id,
      providerLabel: provider.label,
      itemCount: items.length,
      note,
      promptVersion: `extraction-v1:${prompt.length}`,
      validationErrors: [],
    },
  };
}
