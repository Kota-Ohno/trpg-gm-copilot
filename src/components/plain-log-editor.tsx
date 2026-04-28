import { AlertTriangle, MessageSquareText, RotateCcw, Wand2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

type PlainLogEditorProps = {
  canExtract: boolean;
  isExtracting: boolean;
  log: string;
  onChange: (log: string) => void;
  onExtract: () => void | Promise<void>;
  onImportToSpeakerLog: () => void;
  onReset: () => void;
};

export function PlainLogEditor({
  canExtract,
  isExtracting,
  log,
  onChange,
  onExtract,
  onImportToSpeakerLog,
  onReset,
}: PlainLogEditorProps) {
  const hasLogText = log.trim().length > 0;
  const nonEmptyLines = log.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const speakerLineCount = nonEmptyLines.filter((line) => /^(?:\[[^\]]+\]\s*)?[^:：]{1,32}[:：]\s*.+$/.test(line.trim())).length;
  const speakerLineRatio = nonEmptyLines.length > 0 ? Math.round((speakerLineCount / nonEmptyLines.length) * 100) : 0;
  const hasNoSpeakerLines = hasLogText && speakerLineCount === 0;
  const logStatusId = "plain-log-editor-status";

  return (
    <>
      <Textarea
        aria-describedby={logStatusId}
        aria-invalid={hasNoSpeakerLines}
        className="min-h-[420px] resize-y font-mono text-sm leading-6"
        disabled={isExtracting}
        value={log}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">{log.length.toLocaleString()}文字</p>
            <Badge variant="muted">{nonEmptyLines.length.toLocaleString()}有効行</Badge>
            <Badge
              variant={hasNoSpeakerLines ? "destructive" : "muted"}
            >
              {speakerLineCount.toLocaleString()}発話候補
              {speakerLineCount > 0 && ` / ${speakerLineRatio}%`}
            </Badge>
            {hasNoSpeakerLines && (
              <Badge className="gap-1" variant="destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                話者行なし
              </Badge>
            )}
          </div>
          <p className="max-w-[42rem] text-xs leading-5 text-muted-foreground" id={logStatusId}>
            {hasLogText
              ? hasNoSpeakerLines
                ? "「話者: セリフ」形式の行が見つかりません。話者付きログ化の前に区切りを確認してください。"
                : "「話者: セリフ」形式の行を発話候補として数えています。必要に応じてこのまま抽出できます。"
              : "ここにログを貼り付けます。例: GM: 扉の奥から足音が聞こえる"}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Badge className="h-9 px-3" variant="outline">
            ローカル自動保存
          </Badge>
          <Button disabled={isExtracting} onClick={onReset} variant="outline">
            <RotateCcw className="h-4 w-4" />
            デモ初期化
          </Button>
          <Button disabled={!hasLogText} onClick={onImportToSpeakerLog} variant="outline">
            <MessageSquareText className="h-4 w-4" />
            話者付きログ化
          </Button>
          <Button disabled={isExtracting || !canExtract} onClick={onExtract}>
            <Wand2 className="h-4 w-4" />
            {isExtracting ? "抽出中" : "抽出プレビュー"}
          </Button>
        </div>
      </div>
    </>
  );
}
