import { describe, expect, it } from "vitest";
import { checkTranscriptionProviderReadiness } from "./transcription-providers";

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
});
