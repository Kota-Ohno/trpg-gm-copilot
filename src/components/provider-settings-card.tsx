import { useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, KeyRound, RotateCcw, Server, Trash2, Unplug } from "lucide-react";
import { extractionProviders, getExtractionProvider } from "../lib/extraction-provider-settings";
import {
  testExtractionProviderConnection,
  type ProviderConnectionTestResult,
} from "../lib/extraction-providers";
import type { ExtractionProviderId, ExtractionProviderSettings, ProviderSecretSettings } from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

type ProviderSettingsCardProps = {
  isLocked: boolean;
  secrets: ProviderSecretSettings;
  settings: ExtractionProviderSettings;
  onChangeSecrets: (settings: ProviderSecretSettings) => void;
  onChange: (settings: ExtractionProviderSettings) => void;
};

export function ProviderSettingsCard({
  isLocked,
  secrets,
  settings,
  onChange,
  onChangeSecrets,
}: ProviderSettingsCardProps) {
  const [connectionResult, setConnectionResult] = useState<ProviderConnectionTestResult | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const latestTestKeyRef = useRef("");
  const selectedProvider = getExtractionProvider(settings.providerId);
  const needsApiKey = settings.providerId === "openai";
  const hasApiKey = secrets.openAiApiKey.trim().length > 0;
  const isApiKeyMissing = needsApiKey && !hasApiKey;
  const isModelDefault = settings.model.trim() === selectedProvider.defaultModel;
  const isEndpointDefault = settings.endpoint.trim() === selectedProvider.defaultEndpoint;
  const providerHelpText =
    settings.providerId === "openai"
      ? "API key はキャンペーンJSONに含めず、ブラウザの別領域にだけ保存します。"
      : settings.providerId === "ollama"
        ? "Ollama はローカルの /api/generate を呼び出します。起動していない場合はルールベース抽出へ戻します。"
        : "ブラウザ内のルールで抽出します。外部ProviderやAPI keyは使いません。";
  const connectionTestKey = [
    secrets.openAiApiKey,
    settings.endpoint,
    settings.model,
    settings.providerId,
  ].join("\n");
  const canTestConnection = !isLocked && !isTestingConnection && !isApiKeyMissing;
  const providerSelectId = "extraction-provider-select";
  const modelInputId = "extraction-provider-model";
  const endpointInputId = "extraction-provider-endpoint";
  const apiKeyInputId = "extraction-provider-api-key";

  useEffect(() => {
    latestTestKeyRef.current = connectionTestKey;
    setIsTestingConnection(false);
    setConnectionResult(null);
  }, [connectionTestKey]);

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

  const restoreProviderDefaults = (): void => {
    onChange({
      providerId: selectedProvider.id,
      model: selectedProvider.defaultModel,
      endpoint: selectedProvider.defaultEndpoint,
    });
  };

  const testConnection = async (): Promise<void> => {
    const testKey = connectionTestKey;
    latestTestKeyRef.current = testKey;
    setIsTestingConnection(true);
    setConnectionResult(null);
    try {
      const result = await testExtractionProviderConnection({ secrets, settings });
      if (latestTestKeyRef.current === testKey) {
        setConnectionResult(result);
      }
    } finally {
      if (latestTestKeyRef.current === testKey) {
        setIsTestingConnection(false);
      }
    }
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
          <Badge className="shrink-0" variant={selectedProvider.status === "available" ? "default" : "secondary"}>
            {selectedProvider.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-2">
          <Badge variant={selectedProvider.status === "available" ? "default" : "secondary"}>
            {selectedProvider.status === "available" ? "利用可能" : "未接続"}
          </Badge>
          <Badge variant={isModelDefault ? "secondary" : "outline"}>
            Model: {isModelDefault ? "既定値" : "変更済み"}
          </Badge>
          <Badge variant={isEndpointDefault ? "secondary" : "outline"}>
            Endpoint: {isEndpointDefault ? "既定値" : "変更済み"}
          </Badge>
          <Badge variant={isApiKeyMissing ? "destructive" : "secondary"}>
            API key: {!needsApiKey ? "不要" : hasApiKey ? "設定済み" : "未設定"}
          </Badge>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground" htmlFor={providerSelectId}>
            Provider
          </label>
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isLocked}
            id={providerSelectId}
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
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground" htmlFor={modelInputId}>
              Model
              <Badge variant={isModelDefault ? "secondary" : "outline"}>
                {isModelDefault ? "既定値" : "変更済み"}
              </Badge>
            </label>
            <Button disabled={isLocked} onClick={restoreProviderDefaults} size="sm" variant="ghost">
              <RotateCcw className="h-3.5 w-3.5" />
              既定値
            </Button>
          </div>
          <Input
            disabled={isLocked}
            id={modelInputId}
            onBlur={(event) => updateSettings({ model: event.target.value.trim() })}
            onChange={(event) => updateSettings({ model: event.target.value })}
            value={settings.model}
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground" htmlFor={endpointInputId}>
            <span className="flex items-center gap-1">
              <Server className="h-3 w-3" />
              Endpoint
            </span>
            <Badge variant={isEndpointDefault ? "secondary" : "outline"}>
              {isEndpointDefault ? "既定値" : "変更済み"}
            </Badge>
          </label>
          <Input
            className="mt-1"
            disabled={isLocked}
            id={endpointInputId}
            onBlur={(event) => updateSettings({ endpoint: event.target.value.trim() })}
            onChange={(event) => updateSettings({ endpoint: event.target.value })}
            placeholder="Provider endpoint"
            value={settings.endpoint}
          />
        </div>

        {needsApiKey && (
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground" htmlFor={apiKeyInputId}>
              <span className="flex items-center gap-1">
                <KeyRound className="h-3 w-3" />
                API key
              </span>
              <Badge variant={isApiKeyMissing ? "destructive" : "secondary"}>
                {hasApiKey ? "設定済み" : "未設定"}
              </Badge>
            </label>
            <div className="mt-1 flex gap-2">
              <Input
                aria-invalid={isApiKeyMissing}
                disabled={isLocked}
                id={apiKeyInputId}
                onBlur={(event) => onChangeSecrets({ ...secrets, openAiApiKey: event.target.value.trim() })}
                onChange={(event) => onChangeSecrets({ ...secrets, openAiApiKey: event.target.value })}
                placeholder="ユーザーAPIキー"
                type="password"
                value={secrets.openAiApiKey}
              />
              <Button
                aria-label="API keyを消去"
                disabled={isLocked || !secrets.openAiApiKey}
                onClick={() => onChangeSecrets({ ...secrets, openAiApiKey: "" })}
                size="icon"
                variant="outline"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs leading-5 text-muted-foreground">
          {providerHelpText}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!canTestConnection} onClick={testConnection} size="sm" variant="outline">
            <Unplug className="h-4 w-4" />
            {isTestingConnection ? "確認中" : "接続テスト"}
          </Button>
          {isTestingConnection && (
            <Badge className="gap-1" variant="secondary">
              <Unplug className="h-3 w-3" />
              確認中
            </Badge>
          )}
          {connectionResult && (
            <Badge
              className="gap-1"
              variant={connectionResult.ok ? "default" : "destructive"}
            >
              {connectionResult.ok ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Unplug className="h-3 w-3" />
              )}
              {connectionResult.ok ? "成功" : "失敗"}
            </Badge>
          )}
        </div>

        {connectionResult && (
          <p className={connectionResult.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
            {connectionResult.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
