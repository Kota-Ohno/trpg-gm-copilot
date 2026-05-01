import type { ProviderSecretSettings, TranscriptionProviderSettings } from "../types";
import { getTranscriptionProvider } from "./extraction-provider-settings";
import { normalizeTranscriptionDrafts } from "./extraction";
import type { TranscriptionSegmentDraft } from "../types";

export const maxTranscriptionAudioFileSizeBytes = 25 * 1024 * 1024;
const supportedTranscriptionAudioExtensions = new Set(["flac", "m4a", "mp3", "mp4", "mpeg", "mpga", "oga", "ogg", "wav", "webm"]);

export type TranscriptionProviderCheckResult = {
  ok: boolean;
  message: string;
};

export type TranscriptionProviderRequest = {
  audioFile?: File;
  draftJson?: string;
  secrets: ProviderSecretSettings;
  settings: TranscriptionProviderSettings;
};

export type TranscriptionProviderResult = {
  drafts: TranscriptionSegmentDraft[];
  message: string;
  ok: boolean;
  providerLabel: string;
};

export type TranscriptionAudioFileValidationResult = {
  ok: boolean;
  message: string;
};

export function validateTranscriptionAudioFile(file: File): TranscriptionAudioFileValidationResult {
  if (file.size > maxTranscriptionAudioFileSizeBytes) {
    return {
      ok: false,
      message: "OpenAI文字起こしの音声ファイルは25MB以下にしてください。",
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const hasAudioMimeType = file.type.startsWith("audio/");
  if (!supportedTranscriptionAudioExtensions.has(extension) && !hasAudioMimeType) {
    return {
      ok: false,
      message: "対応形式は flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm です。",
    };
  }

  return {
    ok: true,
    message: "音声ファイルを利用できます。",
  };
}

function normalizeTranscriptionResponse(value: unknown): TranscriptionSegmentDraft[] {
  const normalizedDrafts = normalizeTranscriptionDrafts(value);
  if (normalizedDrafts) {
    return normalizedDrafts;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const text = (value as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) {
      return [{ text: text.trim() }];
    }
  }

  return [];
}

async function readTranscriptionErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  const fallbackMessage = `OpenAI文字起こしAPIが失敗しました。status: ${response.status}`;

  if (contentType.includes("application/json")) {
    try {
      const payload = await response.json() as unknown;
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const error = (payload as { error?: unknown }).error;
        if (error && typeof error === "object" && !Array.isArray(error)) {
          const message = (error as { message?: unknown }).message;
          if (typeof message === "string" && message.trim()) {
            return message.trim();
          }
        }
      }
    } catch {
      return fallbackMessage;
    }
  }

  const errorText = await response.text();
  return errorText.trim() || fallbackMessage;
}

export function hasWebSpeechRecognitionSupport(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    ("SpeechRecognition" in value || "webkitSpeechRecognition" in value)
  );
}

export function checkTranscriptionProviderReadiness(
  settings: TranscriptionProviderSettings,
  secrets: ProviderSecretSettings,
): TranscriptionProviderCheckResult {
  const provider = getTranscriptionProvider(settings.providerId);

  if (provider.id === "manual") {
    return {
      ok: true,
      message: "手動入力は追加設定なしで利用できます。",
    };
  }

  if (provider.id === "web-speech") {
    const hasBrowserSupport = typeof window !== "undefined" && hasWebSpeechRecognitionSupport(window);

    return {
      ok: hasBrowserSupport,
      message: hasBrowserSupport
        ? "このブラウザはWeb Speech APIを利用できます。"
        : "このブラウザではWeb Speech APIを検出できません。",
    };
  }

  if (provider.id === "openai") {
    return {
      ok: Boolean(secrets.openAiApiKey.trim()),
      message: secrets.openAiApiKey.trim()
        ? `OpenAI文字起こし設定を利用できます。model: ${settings.model || provider.defaultModel}`
        : "OpenAI文字起こしにはAPI keyが必要です。",
    };
  }

  return {
    ok: false,
    message: `${provider.label} はまだ接続確認に対応していません。`,
  };
}

export async function runTranscriptionProvider(
  request: TranscriptionProviderRequest,
): Promise<TranscriptionProviderResult> {
  const provider = getTranscriptionProvider(request.settings.providerId);

  if (provider.id === "manual") {
    if (!request.draftJson?.trim()) {
      return {
        drafts: [],
        message: "手動文字起こしJSONが空です。",
        ok: false,
        providerLabel: provider.label,
      };
    }

    try {
      const normalizedDrafts = normalizeTranscriptionDrafts(JSON.parse(request.draftJson));

      return normalizedDrafts && normalizedDrafts.length > 0
        ? {
            drafts: normalizedDrafts,
            message: `${normalizedDrafts.length}件の手動文字起こしを読み取りました。`,
            ok: true,
            providerLabel: provider.label,
          }
        : {
            drafts: [],
            message: "手動文字起こしJSONに有効な発話がありません。",
            ok: false,
            providerLabel: provider.label,
          };
    } catch {
      return {
        drafts: [],
        message: "手動文字起こしJSONを解析できません。",
        ok: false,
        providerLabel: provider.label,
      };
    }
  }

  if (provider.id === "openai" && !request.secrets.openAiApiKey.trim()) {
    return {
      drafts: [],
      message: "OpenAI文字起こしにはAPI keyが必要です。",
      ok: false,
      providerLabel: provider.label,
    };
  }

  if (provider.id === "openai") {
    if (!request.audioFile) {
      return {
        drafts: [],
        message: "OpenAI文字起こしには音声ファイルが必要です。",
        ok: false,
        providerLabel: provider.label,
      };
    }

    const audioFileValidation = validateTranscriptionAudioFile(request.audioFile);
    if (!audioFileValidation.ok) {
      return {
        drafts: [],
        message: audioFileValidation.message,
        ok: false,
        providerLabel: provider.label,
      };
    }

    try {
      const endpoint = (request.settings.endpoint || provider.defaultEndpoint).replace(/\/+$/, "");
      const model = request.settings.model.trim() || provider.defaultModel;
      const formData = new FormData();
      formData.append("file", request.audioFile);
      formData.append("model", model);
      formData.append("response_format", model.includes("diarize") ? "diarized_json" : "json");
      if (request.settings.language.trim()) {
        formData.append("language", request.settings.language.trim());
      }

      const response = await fetch(`${endpoint}/audio/transcriptions`, {
        body: formData,
        headers: {
          Authorization: `Bearer ${request.secrets.openAiApiKey.trim()}`,
        },
        method: "POST",
      });

      if (!response.ok) {
        return {
          drafts: [],
          message: await readTranscriptionErrorMessage(response),
          ok: false,
          providerLabel: provider.label,
        };
      }

      const contentType = response.headers.get("content-type") ?? "";
      const responsePayload = contentType.includes("application/json")
        ? await response.json()
        : { text: await response.text() };
      const drafts = normalizeTranscriptionResponse(responsePayload);

      return drafts.length > 0
        ? {
            drafts,
            message: `${drafts.length}件のOpenAI文字起こしを読み取りました。`,
            ok: true,
            providerLabel: provider.label,
          }
        : {
            drafts: [],
            message: "OpenAI文字起こしAPIの応答に有効な発話がありません。",
            ok: false,
            providerLabel: provider.label,
          };
    } catch (error) {
      return {
        drafts: [],
        message: error instanceof Error ? error.message : "OpenAI文字起こしAPI呼び出しに失敗しました。",
        ok: false,
        providerLabel: provider.label,
      };
    }
  }

  return {
    drafts: [],
    message: `${provider.label} の自動実行はまだ未接続です。手動JSON取り込みを利用してください。`,
    ok: false,
    providerLabel: provider.label,
  };
}
