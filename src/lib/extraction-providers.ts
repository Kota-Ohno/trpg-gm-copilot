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
import { extractionResponseJsonSchema, parseExtractionJson } from "./extraction-schema";

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

type ProviderContext = {
  extractionLines: ReturnType<typeof buildExtractionInput>;
  prompt: string;
  providerLabel: string;
};

type OpenAiResponseContent = {
  type?: string;
  text?: unknown;
};

type OpenAiResponseOutput = {
  type?: string;
  content?: OpenAiResponseContent[];
};

type OpenAiResponseBody = {
  output_text?: unknown;
  output?: OpenAiResponseOutput[];
  error?: {
    message?: string;
  };
};

type OllamaResponseBody = {
  response?: unknown;
  error?: string;
};

function normalizeEndpoint(endpoint: string, fallbackEndpoint: string): string {
  return (endpoint.trim() || fallbackEndpoint).replace(/\/+$/, "");
}

function joinEndpoint(endpoint: string, path: string): string {
  const normalizedEndpoint = endpoint.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");

  return `${normalizedEndpoint}/${normalizedPath}`;
}

function extractOpenAiText(responseBody: OpenAiResponseBody): string {
  if (typeof responseBody.output_text === "string") {
    return responseBody.output_text;
  }

  return (
    responseBody.output
      ?.flatMap((output) => output.content ?? [])
      .filter((content) => content.type === "output_text" && typeof content.text === "string")
      .map((content) => content.text as string)
      .join("\n") ?? ""
  );
}

function buildRuleBasedFallback(
  request: ExtractionRequest,
  context: ProviderContext,
  note: string,
  validationErrors: string[] = [],
): ExtractionResult {
  const generatedItems = runRuleBasedExtraction(context.extractionLines);
  const items = generatedItems.length > 0 ? generatedItems : mockExtraction;

  return {
    items,
    run: {
      sourceType: generatedItems.length > 0 ? request.source : "fallback",
      providerId: request.settings.providerId,
      providerLabel: context.providerLabel,
      itemCount: items.length,
      note,
      promptVersion: `extraction-v1:${context.prompt.length}`,
      validationErrors,
    },
  };
}

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

async function runOpenAiExtraction(request: ExtractionRequest, context: ProviderContext): Promise<ExtractionResult> {
  if (!request.settings.apiKey.trim()) {
    return buildRuleBasedFallback(
      request,
      context,
      "OpenAI API key が未入力のため、ルールベース抽出にフォールバックしました。",
    );
  }

  try {
    const endpoint = normalizeEndpoint(request.settings.endpoint, "https://api.openai.com/v1");
    const response = await fetch(joinEndpoint(endpoint, "responses"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.settings.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.settings.model.trim() || "gpt-4.1-mini",
        input: context.prompt,
        text: {
          format: {
            type: "json_schema",
            ...extractionResponseJsonSchema,
          },
        },
      }),
    });

    const responseBody = (await response.json()) as OpenAiResponseBody;
    if (!response.ok) {
      return buildRuleBasedFallback(
        request,
        context,
        `OpenAI API エラーのため、ルールベース抽出にフォールバックしました。`,
        [responseBody.error?.message ?? `HTTP ${response.status}`],
      );
    }

    const responseText = extractOpenAiText(responseBody);
    const result = buildLlmExtractionResult(responseText, request);
    if (result.items.length === 0) {
      return buildRuleBasedFallback(
        request,
        context,
        "OpenAI レスポンスから抽出候補を作れなかったため、ルールベース抽出にフォールバックしました。",
        result.run.validationErrors,
      );
    }

    return {
      ...result,
      run: {
        ...result.run,
        note: "OpenAI レスポンスをJSONスキーマに沿って正規化しました。",
        promptVersion: `extraction-v1:${context.prompt.length}`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI API 呼び出しに失敗しました。";

    return buildRuleBasedFallback(
      request,
      context,
      "OpenAI API 呼び出しに失敗したため、ルールベース抽出にフォールバックしました。",
      [message],
    );
  }
}

async function runOllamaExtraction(request: ExtractionRequest, context: ProviderContext): Promise<ExtractionResult> {
  try {
    const endpoint = normalizeEndpoint(request.settings.endpoint, "http://localhost:11434");
    const response = await fetch(joinEndpoint(endpoint, "api/generate"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.settings.model.trim() || "llama3.1",
        prompt: context.prompt,
        stream: false,
        format: extractionResponseJsonSchema.schema,
      }),
    });

    const responseBody = (await response.json()) as OllamaResponseBody;
    if (!response.ok) {
      return buildRuleBasedFallback(
        request,
        context,
        "Ollama API エラーのため、ルールベース抽出にフォールバックしました。",
        [responseBody.error ?? `HTTP ${response.status}`],
      );
    }

    const responseText = typeof responseBody.response === "string" ? responseBody.response : "";
    const result = buildLlmExtractionResult(responseText, request);
    if (result.items.length === 0) {
      return buildRuleBasedFallback(
        request,
        context,
        "Ollama レスポンスから抽出候補を作れなかったため、ルールベース抽出にフォールバックしました。",
        result.run.validationErrors,
      );
    }

    return {
      ...result,
      run: {
        ...result.run,
        note: "Ollama レスポンスをJSONスキーマに沿って正規化しました。",
        promptVersion: `extraction-v1:${context.prompt.length}`,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ollama API 呼び出しに失敗しました。";

    return buildRuleBasedFallback(
      request,
      context,
      "Ollama API 呼び出しに失敗したため、ルールベース抽出にフォールバックしました。",
      [message],
    );
  }
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
  const request = { log, liveLog, settings, source };
  const context = {
    extractionLines,
    prompt,
    providerLabel: provider.label,
  };

  if (provider.id === "openai") {
    return runOpenAiExtraction(request, context);
  }

  if (provider.id === "ollama") {
    return runOllamaExtraction(request, context);
  }

  const note =
    provider.status === "available"
      ? "ルールベース抽出です。採用前に内容を調整してください。"
      : `${provider.label}連携は未接続です。抽出プロンプトv1を生成し、現在はルールベース抽出にフォールバックしています。`;

  return buildRuleBasedFallback(request, context, note);
}
