import { afterEach, describe, expect, it, vi } from "vitest";
import { checkTranscriptionProviderReadiness, hasWebSpeechRecognitionSupport, runTranscriptionProvider } from "./transcription-providers";

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe("runTranscriptionProvider", () => {
  it("parses manual draft JSON through the provider interface", async () => {
    await expect(runTranscriptionProvider({
      draftJson: JSON.stringify([{ speaker: "GM", start: 0, end: 3, transcript: "導入" }]),
      secrets: { openAiApiKey: "" },
      settings: { providerId: "manual", model: "manual-transcript", endpoint: "", language: "ja" },
    })).resolves.toEqual({
      drafts: [{ speakerName: "GM", startTimeSec: 0, endTimeSec: 3, text: "導入" }],
      message: "1件の手動文字起こしを読み取りました。",
      ok: true,
      providerLabel: "手動入力",
    });
  });

  it("reports unsupported automatic transcription execution without secrets", async () => {
    await expect(runTranscriptionProvider({
      secrets: { openAiApiKey: "" },
      settings: {
        providerId: "openai",
        model: "gpt-4o-mini-transcribe",
        endpoint: "https://api.openai.com/v1",
        language: "ja",
      },
    })).resolves.toMatchObject({
      drafts: [],
      message: "OpenAI文字起こしにはAPI keyが必要です。",
      ok: false,
      providerLabel: "OpenAI",
    });
  });

  it("calls OpenAI transcription endpoint and normalizes text responses", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: " 灯台へ向かう " }), {
      headers: { "content-type": "application/json" },
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runTranscriptionProvider({
      audioFile: new File(["audio"], "session.webm", { type: "audio/webm" }),
      secrets: { openAiApiKey: "sk-test" },
      settings: {
        providerId: "openai",
        model: "gpt-4o-mini-transcribe",
        endpoint: "https://api.openai.com/v1/",
        language: "ja",
      },
    })).resolves.toEqual({
      drafts: [{ text: "灯台へ向かう" }],
      message: "1件のOpenAI文字起こしを読み取りました。",
      ok: true,
      providerLabel: "OpenAI",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/transcriptions",
      expect.objectContaining({
        headers: { Authorization: "Bearer sk-test" },
        method: "POST",
      }),
    );
  });

  it("rejects OpenAI audio files over 25 MB before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(runTranscriptionProvider({
      audioFile: new File([new Blob([new Uint8Array(25 * 1024 * 1024 + 1)])], "large.wav"),
      secrets: { openAiApiKey: "sk-test" },
      settings: {
        providerId: "openai",
        model: "gpt-4o-mini-transcribe",
        endpoint: "https://api.openai.com/v1",
        language: "ja",
      },
    })).resolves.toMatchObject({
      drafts: [],
      message: "OpenAI文字起こしの音声ファイルは25MB以下にしてください。",
      ok: false,
      providerLabel: "OpenAI",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
