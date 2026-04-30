import { describe, expect, it } from "vitest";
import { checkTranscriptionProviderReadiness, hasWebSpeechRecognitionSupport } from "./transcription-providers";

describe("checkTranscriptionProviderReadiness", () => {
  it("marks manual transcription as ready", () => {
    expect(checkTranscriptionProviderReadiness(
      { providerId: "manual", model: "manual-transcript", endpoint: "", language: "ja" },
      { openAiApiKey: "" },
    )).toEqual({
      ok: true,
      message: "手動入力は追加設定なしで利用できます。",
    });
  });

  it("requires an OpenAI API key for OpenAI transcription", () => {
    expect(checkTranscriptionProviderReadiness(
      { providerId: "openai", model: "gpt-4o-mini-transcribe", endpoint: "https://api.openai.com/v1", language: "ja" },
      { openAiApiKey: "" },
    ).ok).toBe(false);

    expect(checkTranscriptionProviderReadiness(
      { providerId: "openai", model: "gpt-4o-mini-transcribe", endpoint: "https://api.openai.com/v1", language: "ja" },
      { openAiApiKey: "sk-test" },
    ).ok).toBe(true);
  });

  it("uses the default OpenAI transcription model when settings are blank", () => {
    expect(checkTranscriptionProviderReadiness(
      { providerId: "openai", model: "", endpoint: "https://api.openai.com/v1", language: "ja" },
      { openAiApiKey: "sk-test" },
    )).toEqual({
      ok: true,
      message: "OpenAI文字起こし設定を利用できます。model: gpt-4o-mini-transcribe",
    });
  });

  it("reports Web Speech as unavailable outside supported browsers", () => {
    expect(checkTranscriptionProviderReadiness(
      { providerId: "web-speech", model: "browser-speech-recognition", endpoint: "", language: "ja" },
      { openAiApiKey: "" },
    )).toEqual({
      ok: false,
      message: "このブラウザではWeb Speech APIを検出できません。",
    });
  });
});

describe("hasWebSpeechRecognitionSupport", () => {
  it("detects standard and webkit speech recognition constructors", () => {
    expect(hasWebSpeechRecognitionSupport({ SpeechRecognition: function SpeechRecognition() {} })).toBe(true);
    expect(hasWebSpeechRecognitionSupport({ webkitSpeechRecognition: function SpeechRecognition() {} })).toBe(true);
    expect(hasWebSpeechRecognitionSupport({})).toBe(false);
    expect(hasWebSpeechRecognitionSupport(null)).toBe(false);
  });
});
