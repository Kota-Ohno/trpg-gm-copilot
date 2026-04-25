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

export async function runExtractionProvider({
  log,
  liveLog,
  settings,
  source,
}: ExtractionRequest): Promise<ExtractionResult> {
  const provider = getExtractionProvider(settings.providerId);
  const extractionLines = buildExtractionInput(log, liveLog, source);
  const generatedItems = runRuleBasedExtraction(extractionLines);
  const items = generatedItems.length > 0 ? generatedItems : mockExtraction;
  const sourceType = generatedItems.length > 0 ? source : "fallback";
  const note =
    provider.status === "available"
      ? "ルールベース抽出です。採用前に内容を調整してください。"
      : `${provider.label}連携は未接続です。現在は同じ抽出インターフェースでルールベース抽出にフォールバックしています。`;

  return {
    items,
    run: {
      sourceType,
      providerId: provider.id,
      providerLabel: provider.label,
      itemCount: items.length,
      note,
    },
  };
}
