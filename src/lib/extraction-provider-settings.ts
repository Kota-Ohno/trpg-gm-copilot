import type { ExtractionProviderId, ExtractionProviderSettings, ProviderSecretSettings } from "../types";

type ProviderDefinition = {
  id: ExtractionProviderId;
  label: string;
  defaultModel: string;
  defaultEndpoint: string;
  status: "available" | "planned";
};

const defaultExtractionProviderId: ExtractionProviderId = "rule-based";

export const extractionProviders: ProviderDefinition[] = [
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
) as Record<ExtractionProviderId, ProviderDefinition>;

const defaultExtractionProvider = extractionProviderById[defaultExtractionProviderId];

export const defaultExtractionProviderSettings: ExtractionProviderSettings = {
  providerId: defaultExtractionProvider.id,
  model: defaultExtractionProvider.defaultModel,
  endpoint: defaultExtractionProvider.defaultEndpoint,
};

export const defaultProviderSecretSettings: ProviderSecretSettings = {
  openAiApiKey: "",
};

export function getExtractionProvider(providerId: ExtractionProviderId): ProviderDefinition {
  return extractionProviderById[providerId] ?? defaultExtractionProvider;
}
