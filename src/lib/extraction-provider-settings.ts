import type { ExtractionProviderId, ExtractionProviderSettings } from "../types";

type ProviderDefinition = {
  id: ExtractionProviderId;
  label: string;
  defaultModel: string;
  defaultEndpoint: string;
  status: "available" | "planned";
};

export const extractionProviders: ProviderDefinition[] = [
  {
    id: "rule-based",
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

export const defaultExtractionProviderSettings: ExtractionProviderSettings = {
  providerId: "rule-based",
  model: "local-rules-v1",
  apiKey: "",
  endpoint: "",
};

export function getExtractionProvider(providerId: ExtractionProviderId): ProviderDefinition {
  return extractionProviders.find((provider) => provider.id === providerId) ?? extractionProviders[0];
}
