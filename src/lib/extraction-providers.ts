import type {
  ExtractionItem,
  ExtractionProviderSettings,
  ExtractionRun,
  LiveLogSession,
  ProviderSecretSettings,
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
  secrets: ProviderSecretSettings;
  source: ExtractionSource;
  settings: ExtractionProviderSettings;
};

export type ExtractionResult = {
  items: ExtractionItem[];
  run: ExtractionRun;
};

export type ProviderConnectionTestRequest = {
  secrets: ProviderSecretSettings;
  settings: ExtractionProviderSettings;
};

export type ProviderConnectionTestResult = {
  ok: boolean;
  message: string;
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

type JsonResponseBody<T> = T & {
  error?: string | {
    message?: string;
  };
};

const connectionTestJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["ok"],
  properties: {
    ok: {
      type: "boolean",
    },
  },
} as const;

const EXTRACTION_TIMEOUT_MS = 45_000;
const CONNECTION_TEST_TIMEOUT_MS = 12_000;

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

function parseConnectionTestResponse(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { ok?: unknown };
    return parsed.ok === true;
  } catch {
    return false;
  }
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ body: JsonResponseBody<T>; response: Response }> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const responseText = await response.text();
    let body: JsonResponseBody<T>;
    try {
      body = (responseText ? JSON.parse(responseText) : {}) as JsonResponseBody<T>;
    } catch {
      if (response.ok) {
        throw new Error("Provider がJSONではない応答を返しました。");
      }
      body = { error: responseText.trim() || `HTTP ${response.status}` } as JsonResponseBody<T>;
    }

    return { body, response };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getResponseErrorMessage(responseBody: JsonResponseBody<unknown>, response: Response): string {
  if (typeof responseBody.error === "string" && responseBody.error.trim()) {
    return responseBody.error.trim();
  }

  if (responseBody.error && typeof responseBody.error === "object" && responseBody.error.message?.trim()) {
    return responseBody.error.message.trim();
  }

  return `HTTP ${response.status}`;
}

function getProviderErrorMessage(error: unknown, providerLabel: string, timeoutMs: number): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return `${providerLabel} API が${Math.round(timeoutMs / 1000)}秒以内に応答しませんでした。`;
  }

  return error instanceof Error ? error.message : `${providerLabel} API 呼び出しに失敗しました。`;
}

function normalizeValidationErrors(validationErrors: string[], failureReason?: string): string[] {
  return [...validationErrors, failureReason]
    .filter((error): error is string => typeof error === "string" && error.trim().length > 0)
    .map((error) => error.trim())
    .filter((error, index, errors) => errors.indexOf(error) === index);
}

function buildFallbackNote(note: string, context: ProviderContext, hasGeneratedItems: boolean): string {
  const providerContext =
    context.providerLabel === "ルールベース"
      ? ""
      : ` (${context.providerLabel} → ルールベース)`;
  const baseNote = `${note}${providerContext}`;

  return hasGeneratedItems
    ? baseNote
    : `${baseNote} ルールベース抽出でも候補は見つかりませんでした。`;
}

function buildRuleBasedFallback(
  request: ExtractionRequest,
  context: ProviderContext,
  note: string,
  validationErrors: string[] = [],
  failureReason?: string,
): ExtractionResult {
  const generatedItems = runRuleBasedExtraction(context.extractionLines);
  const normalizedValidationErrors = normalizeValidationErrors(validationErrors, failureReason);

  return {
    items: generatedItems,
    run: {
      sourceType: request.source,
      providerId: request.settings.providerId,
      providerLabel: context.providerLabel,
      executedProviderId: "rule-based",
      executedProviderLabel: "ルールベース",
      fallbackUsed: request.settings.providerId !== "rule-based",
      failureReason,
      itemCount: generatedItems.length,
      note: buildFallbackNote(note, context, generatedItems.length > 0),
      promptLength: context.prompt.length,
      promptVersion: "extraction-v1",
      validationErrors: normalizedValidationErrors,
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
      executedProviderId: provider.id,
      executedProviderLabel: provider.label,
      fallbackUsed: false,
      itemCount: normalizedResponse.items.length,
      note:
        normalizedResponse.errors.length > 0
          ? "LLMレスポンスを読み取りましたが、一部の候補を検証で除外しました。"
          : "LLMレスポンスをJSONスキーマに沿って正規化しました。",
      promptLength: 0,
      promptVersion: "extraction-v1",
      validationErrors: normalizedResponse.errors,
    },
  };
}

async function runOpenAiExtraction(request: ExtractionRequest, context: ProviderContext): Promise<ExtractionResult> {
  const apiKey = request.secrets.openAiApiKey.trim();
  if (!apiKey) {
    return buildRuleBasedFallback(
      request,
      context,
      "OpenAI API key が未入力のため、ルールベース抽出にフォールバックしました。",
      [],
      "OpenAI API key が未入力です。",
    );
  }

  try {
    const endpoint = normalizeEndpoint(request.settings.endpoint, "https://api.openai.com/v1");
    const { body: responseBody, response } = await fetchJsonWithTimeout<OpenAiResponseBody>(joinEndpoint(endpoint, "responses"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
    }, EXTRACTION_TIMEOUT_MS);
    if (!response.ok) {
      const message = getResponseErrorMessage(responseBody, response);
      return buildRuleBasedFallback(
        request,
        context,
        `OpenAI API エラーのため、ルールベース抽出にフォールバックしました。`,
        [message],
        message,
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
        result.run.validationErrors?.[0] ?? "OpenAI レスポンスから抽出候補を作れませんでした。",
      );
    }

    return {
      ...result,
      run: {
        ...result.run,
        note: "OpenAI レスポンスをJSONスキーマに沿って正規化しました。",
        promptLength: context.prompt.length,
        promptVersion: "extraction-v1",
      },
    };
  } catch (error) {
    const message = getProviderErrorMessage(error, "OpenAI", EXTRACTION_TIMEOUT_MS);

    return buildRuleBasedFallback(
      request,
      context,
      "OpenAI API 呼び出しに失敗したため、ルールベース抽出にフォールバックしました。",
      [message],
      message,
    );
  }
}

async function runOllamaExtraction(request: ExtractionRequest, context: ProviderContext): Promise<ExtractionResult> {
  try {
    const endpoint = normalizeEndpoint(request.settings.endpoint, "http://localhost:11434");
    const { body: responseBody, response } = await fetchJsonWithTimeout<OllamaResponseBody>(joinEndpoint(endpoint, "api/generate"), {
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
    }, EXTRACTION_TIMEOUT_MS);
    if (!response.ok) {
      const message = getResponseErrorMessage(responseBody, response);
      return buildRuleBasedFallback(
        request,
        context,
        "Ollama API エラーのため、ルールベース抽出にフォールバックしました。",
        [message],
        message,
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
        result.run.validationErrors?.[0] ?? "Ollama レスポンスから抽出候補を作れませんでした。",
      );
    }

    return {
      ...result,
      run: {
        ...result.run,
        note: "Ollama レスポンスをJSONスキーマに沿って正規化しました。",
        promptLength: context.prompt.length,
        promptVersion: "extraction-v1",
      },
    };
  } catch (error) {
    const message = getProviderErrorMessage(error, "Ollama", EXTRACTION_TIMEOUT_MS);

    return buildRuleBasedFallback(
      request,
      context,
      "Ollama API 呼び出しに失敗したため、ルールベース抽出にフォールバックしました。",
      [message],
      message,
    );
  }
}

export async function runExtractionProvider({
  log,
  liveLog,
  secrets,
  settings,
  source,
}: ExtractionRequest): Promise<ExtractionResult> {
  const provider = getExtractionProvider(settings.providerId);
  const extractionLines = buildExtractionInput(log, liveLog, source);
  const prompt = buildExtractionPrompt({ lines: extractionLines, source });
  const request = { log, liveLog, secrets, settings, source };
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

export async function testExtractionProviderConnection({
  secrets,
  settings,
}: ProviderConnectionTestRequest): Promise<ProviderConnectionTestResult> {
  const provider = getExtractionProvider(settings.providerId);

  if (provider.id === "rule-based") {
    return {
      ok: true,
      message: "ルールベースProviderはローカルで利用できます。model: local-rules-v1",
    };
  }

  if (provider.id === "openai") {
    const apiKey = secrets.openAiApiKey.trim();
    const model = settings.model.trim() || "gpt-4.1-mini";
    if (!apiKey) {
      return {
        ok: false,
        message: `OpenAI API key が未入力です。model: ${model}`,
      };
    }

    try {
      const endpoint = normalizeEndpoint(settings.endpoint, "https://api.openai.com/v1");
      const { body: responseBody, response } = await fetchJsonWithTimeout<OpenAiResponseBody>(joinEndpoint(endpoint, "responses"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.model.trim() || "gpt-4.1-mini",
          input: "接続テストです。JSONで {\"ok\": true} を返してください。",
          text: {
            format: {
              type: "json_schema",
              name: "provider_connection_test",
              strict: true,
              schema: connectionTestJsonSchema,
            },
          },
        }),
      }, CONNECTION_TEST_TIMEOUT_MS);

      if (!response.ok) {
        return {
          ok: false,
          message: getResponseErrorMessage(responseBody, response),
        };
      }

      const responseText = extractOpenAiText(responseBody);
      const isConnectionOk = parseConnectionTestResponse(responseText);
      return {
        ok: isConnectionOk,
        message: isConnectionOk
          ? `OpenAI Provider に接続できました。model: ${model}`
          : `OpenAI の応答をJSONとして確認できませんでした。model: ${model}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: getProviderErrorMessage(error, "OpenAI", CONNECTION_TEST_TIMEOUT_MS),
      };
    }
  }

  if (provider.id === "ollama") {
    const model = settings.model.trim() || "llama3.1";
    try {
      const endpoint = normalizeEndpoint(settings.endpoint, "http://localhost:11434");
      const { body: responseBody, response } = await fetchJsonWithTimeout<OllamaResponseBody>(joinEndpoint(endpoint, "api/generate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.model.trim() || "llama3.1",
          prompt: "接続テストです。JSONで {\"ok\": true} を返してください。",
          stream: false,
          format: connectionTestJsonSchema,
        }),
      }, CONNECTION_TEST_TIMEOUT_MS);

      if (!response.ok) {
        return {
          ok: false,
          message: getResponseErrorMessage(responseBody, response),
        };
      }

      const responseText = typeof responseBody.response === "string" ? responseBody.response : "";
      const isConnectionOk = parseConnectionTestResponse(responseText);
      return {
        ok: isConnectionOk,
        message: isConnectionOk
          ? `Ollama Provider に接続できました。model: ${model}`
          : `Ollama の応答をJSONとして確認できませんでした。model: ${model}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: getProviderErrorMessage(error, "Ollama", CONNECTION_TEST_TIMEOUT_MS),
      };
    }
  }

  return {
    ok: false,
    message: `${provider.label} は未対応です。`,
  };
}
