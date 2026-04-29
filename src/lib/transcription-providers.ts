import type { ProviderSecretSettings, TranscriptionProviderSettings } from "../types";
import { getTranscriptionProvider } from "./extraction-provider-settings";

export type TranscriptionProviderCheckResult = {
  ok: boolean;
  message: string;
};

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
    const hasBrowserSupport =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

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
