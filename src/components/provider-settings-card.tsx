import { Bot, KeyRound, Server } from "lucide-react";
import { extractionProviders, getExtractionProvider } from "../lib/extraction-provider-settings";
import type { ExtractionProviderId, ExtractionProviderSettings, ProviderSecretSettings } from "../types";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

type ProviderSettingsCardProps = {
  secrets: ProviderSecretSettings;
  settings: ExtractionProviderSettings;
  onChangeSecrets: (settings: ProviderSecretSettings) => void;
  onChange: (settings: ExtractionProviderSettings) => void;
};

export function ProviderSettingsCard({
  secrets,
  settings,
  onChange,
  onChangeSecrets,
}: ProviderSettingsCardProps) {
  const selectedProvider = getExtractionProvider(settings.providerId);
  const needsApiKey = settings.providerId === "openai";

  const updateSettings = (updates: Partial<ExtractionProviderSettings>): void => {
    onChange({
      ...settings,
      ...updates,
    });
  };

  const selectProvider = (providerId: ExtractionProviderId): void => {
    const provider = getExtractionProvider(providerId);
    onChange({
      providerId,
      model: provider.defaultModel,
      endpoint: provider.defaultEndpoint,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              抽出Provider
            </CardTitle>
            <CardDescription className="mt-2">
              ログ抽出の実装を差し替えるための設定です。
            </CardDescription>
          </div>
          <Badge variant={selectedProvider.status === "available" ? "default" : "secondary"}>
            {selectedProvider.status === "available" ? "利用中" : "未接続"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Provider</label>
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) => selectProvider(event.target.value as ExtractionProviderId)}
            value={settings.providerId}
          >
            {extractionProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground">Model</label>
          <Input
            className="mt-1"
            onChange={(event) => updateSettings({ model: event.target.value })}
            value={settings.model}
          />
        </div>

        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Server className="h-3 w-3" />
            Endpoint
          </label>
          <Input
            className="mt-1"
            onChange={(event) => updateSettings({ endpoint: event.target.value })}
            placeholder="Provider endpoint"
            value={settings.endpoint}
          />
        </div>

        {needsApiKey && (
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              API key
            </label>
            <Input
              className="mt-1"
              onChange={(event) => onChangeSecrets({ ...secrets, openAiApiKey: event.target.value })}
              placeholder="ユーザーAPIキー"
              type="password"
              value={secrets.openAiApiKey}
            />
          </div>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          {needsApiKey
            ? "API key はキャンペーンJSONに含めず、ブラウザの別領域にだけ保存します。"
            : "Ollama はローカルの /api/generate を呼び出します。起動していない場合はルールベース抽出へ戻します。"}
        </p>
      </CardContent>
    </Card>
  );
}
