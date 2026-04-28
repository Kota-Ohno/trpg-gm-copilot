import type {
  ExtractionProviderId,
  ExtractionProviderSettings,
  ProviderSecretSettings,
  TranscriptionProviderId,
  TranscriptionProviderSettings,
} from "../types";

type ProviderDefinition<TProviderId extends string> = {
  id: TProviderId;
  label: string;
  defaultModel: string;
  defaultEndpoint: string;
  status: "available" | "planned";
};

const defaultExtractionProviderId: ExtractionProviderId = "rule-based";
const defaultTranscriptionProviderId: TranscriptionProviderId = "manual";

export const extractionProviders: Array<ProviderDefinition<ExtractionProviderId>> = [
  {
    id: defaultExtractionProviderId,
    label: "ルールベース",
    defaultModel: "local-rules-v1",
    defaultEndpoint: "",
    status: "available",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4.1-mini",
    defaultEndpoint: "https://api.openai.com/v1",
    status: "available",
  },
  {
    id: "ollama",
    label: "Ollama",
    defaultModel: "llama3.1",
    defaultEndpoint: "http://localhost:11434",
    status: "available",
  },
];

const extractionProviderById = Object.fromEntries(
  extractionProviders.map((provider) => [provider.id, provider]),
) as Record<ExtractionProviderId, ProviderDefinition<ExtractionProviderId>>;

const defaultExtractionProvider = extractionProviderById[defaultExtractionProviderId];

export const transcriptionProviders: Array<ProviderDefinition<TranscriptionProviderId>> = [
  {
    id: defaultTranscriptionProviderId,
    label: "手動入力",
    defaultModel: "manual-transcript",
    defaultEndpoint: "",
    status: "available",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini-transcribe",
    defaultEndpoint: "https://api.openai.com/v1",
    status: "planned",
  },
  {
    id: "web-speech",
    label: "Web Speech",
    defaultModel: "browser-speech-recognition",
    defaultEndpoint: "",
    status: "planned",
  },
];

const transcriptionProviderById = Object.fromEntries(
  transcriptionProviders.map((provider) => [provider.id, provider]),
) as Record<TranscriptionProviderId, ProviderDefinition<TranscriptionProviderId>>;

const defaultTranscriptionProvider = transcriptionProviderById[defaultTranscriptionProviderId];

export const defaultExtractionProviderSettings: ExtractionProviderSettings = {
  providerId: defaultExtractionProvider.id,
  model: defaultExtractionProvider.defaultModel,
  endpoint: defaultExtractionProvider.defaultEndpoint,
};

export const defaultTranscriptionProviderSettings: TranscriptionProviderSettings = {
  providerId: defaultTranscriptionProvider.id,
  model: defaultTranscriptionProvider.defaultModel,
  endpoint: defaultTranscriptionProvider.defaultEndpoint,
  language: "ja",
};

export const defaultProviderSecretSettings: ProviderSecretSettings = {
  openAiApiKey: "",
};

export function getExtractionProvider(providerId: ExtractionProviderId): ProviderDefinition<ExtractionProviderId> {
  return extractionProviderById[providerId] ?? defaultExtractionProvider;
}

export function getTranscriptionProvider(
  providerId: TranscriptionProviderId,
): ProviderDefinition<TranscriptionProviderId> {
  return transcriptionProviderById[providerId] ?? defaultTranscriptionProvider;
}

export function normalizeProviderSecretSettings(value: unknown): ProviderSecretSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultProviderSecretSettings;
  }

  const maybeSecrets = value as Partial<Record<keyof ProviderSecretSettings, unknown>>;

  return {
    openAiApiKey:
      typeof maybeSecrets.openAiApiKey === "string"
        ? maybeSecrets.openAiApiKey.trim()
        : defaultProviderSecretSettings.openAiApiKey,
  };
}
