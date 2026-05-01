import type { ProviderSecretSettings, TranscriptionProviderSettings } from "../types";
import { getTranscriptionProvider } from "./extraction-provider-settings";
import { normalizeTranscriptionDrafts } from "./extraction";
import type { TranscriptionSegmentDraft } from "../types";

export type TranscriptionProviderCheckResult = {
  ok: boolean;
  message: string;
};

export type TranscriptionProviderRequest = {
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

  return {
    drafts: [],
    message: `${provider.label} の自動実行はまだ未接続です。手動JSON取り込みを利用してください。`,
    ok: false,
    providerLabel: provider.label,
  };
}
