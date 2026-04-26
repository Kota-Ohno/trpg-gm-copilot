import { MessageSquareText, RotateCcw, Wand2 } from "lucide-react";
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

  return (
    <>
      <Textarea
        className="min-h-[420px] resize-y font-mono text-sm leading-6"
        disabled={isExtracting}
        value={log}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">{log.length.toLocaleString()}文字</p>
          <Badge variant="muted">{nonEmptyLines.length.toLocaleString()}行</Badge>
          {speakerLineCount > 0 && <Badge variant="muted">{speakerLineCount.toLocaleString()}発話候補</Badge>}
          <Badge variant="outline">ローカル自動保存</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
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
