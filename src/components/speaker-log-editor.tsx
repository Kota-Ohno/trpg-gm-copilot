import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Copy, Download, FileText, MessageSquareText, Plus, RotateCcw, Split, Trash2, UserRound, Wand2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import type { LiveLogSession, SpeakerRole, TranscriptSegment } from "../types";
import { lowConfidenceThreshold, summarizeLiveLog } from "../lib/extraction";

const speakerRoleLabels: Record<SpeakerRole, string> = {
  GM: "GM",
  PL: "PL",
  unknown: "不明",
};

function formatTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, "0");

  return hours > 0 ? `${hours}:${minutes}:${remainingSeconds}` : `${minutes}:${remainingSeconds}`;
}

type SpeakerLogEditorProps = {
  canExtract: boolean;
  isExtracting: boolean;
  liveLog: LiveLogSession;
  onAddSegment: () => void;
  onAddSegmentAfter: (segmentId: string) => void;
  onAddSpeaker: () => void;
  onApplyToPlainLog: () => void;
  onDeleteSpeaker: (speakerId: string) => void;
  onDeleteSegment: (segmentId: string) => void;
  onDuplicateSegment: (segmentId: string) => void;
  onExtract: () => void | Promise<void>;
  onExportVisibleSegments: (segments: TranscriptSegment[]) => void;
  onMergeAdjacentSegments: () => void;
  onNormalizeTiming: () => void;
  onReset: () => void;
  onRestoreSample: () => void;
  onSplitSegment: (segmentId: string) => void;
  onUpdateSegment: (segmentId: string, updates: Partial<TranscriptSegment>) => void;
  onNormalizeSpeakerName: (speakerId: string, name: string) => void;
  onUpdateSpeakerName: (speakerId: string, name: string) => void;
  onUpdateSpeakerRole: (speakerId: string, role: SpeakerRole) => void;
};

export function SpeakerLogEditor({
  canExtract,
  isExtracting,
  liveLog,
  onAddSegment,
  onAddSegmentAfter,
  onAddSpeaker,
  onApplyToPlainLog,
  onDeleteSpeaker,
  onDeleteSegment,
  onDuplicateSegment,
  onExtract,
  onExportVisibleSegments,
  onMergeAdjacentSegments,
  onNormalizeTiming,
  onReset,
  onRestoreSample,
  onSplitSegment,
  onUpdateSegment,
  onNormalizeSpeakerName,
  onUpdateSpeakerName,
  onUpdateSpeakerRole,
}: SpeakerLogEditorProps) {
  const [showLowConfidenceOnly, setShowLowConfidenceOnly] = useState(false);
  const [showEmptySegmentsOnly, setShowEmptySegmentsOnly] = useState(false);
  const [segmentQuery, setSegmentQuery] = useState("");
  const normalizedSegmentQuery = segmentQuery.trim().toLowerCase();
  const sortedSegments = [...liveLog.segments].sort((first, second) => first.startTimeSec - second.startTimeSec);
  const liveLogSummary = summarizeLiveLog(liveLog);
  const hasSegmentText = liveLog.segments.some((segment) => segment.text.trim().length > 0);
  const hasMergeableAdjacentSegments = sortedSegments.some(
    (segment, index) => index > 0 && sortedSegments[index - 1].speakerId === segment.speakerId,
  );
  const emptySegmentCount = isExtracting ? 0 : liveLogSummary.emptySegmentCount;
  const lowConfidenceCount = liveLogSummary.lowConfidenceCount;
  const visibleSegments = sortedSegments.filter((segment) => {
    const speaker = liveLog.speakers.find((candidate) => candidate.id === segment.speakerId);
    if (
      normalizedSegmentQuery &&
      ![segment.text, speaker?.name ?? "", speaker ? speakerRoleLabels[speaker.role] : ""].some((value) =>
        value.toLowerCase().includes(normalizedSegmentQuery),
      )
    ) {
      return false;
    }

    if (showLowConfidenceOnly) {
      return (
        typeof segment.confidence === "number" &&
        Number.isFinite(segment.confidence) &&
        segment.confidence < lowConfidenceThreshold
      );
    }

    if (showEmptySegmentsOnly) {
      return segment.text.trim().length === 0;
    }

    return true;
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {liveLog.sourceType === "sample" ? "サンプル" : liveLog.sourceType === "imported" ? "取り込み" : "手動"}
            </Badge>
            <Badge variant="muted">{liveLogSummary.totalSegmentCount}発話</Badge>
            <Badge variant="muted">本文あり {liveLogSummary.nonEmptySegmentCount}</Badge>
            {emptySegmentCount > 0 && <Badge variant="muted">未入力 {emptySegmentCount}</Badge>}
            <Badge variant="muted">合計 {formatTimestamp(liveLogSummary.totalDurationSec)}</Badge>
            <Badge variant="muted">{liveLog.speakers.length}話者</Badge>
            <Badge variant="muted">使用中 {liveLogSummary.usedSpeakerCount}</Badge>
            {liveLogSummary.averageConfidence !== null && (
              <Badge variant="muted">平均信頼度 {Math.round(liveLogSummary.averageConfidence * 100)}%</Badge>
            )}
            {lowConfidenceCount > 0 && <Badge variant="destructive">要確認 {lowConfidenceCount}</Badge>}
          </div>
          <p className="mt-2 text-sm font-medium">{liveLog.title}</p>
          <p className="text-xs text-muted-foreground">
            音声連携前の検証用です。話者情報を保ったまま抽出フローへ渡せます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isExtracting} onClick={onRestoreSample} variant="outline">
            <RotateCcw className="h-4 w-4" />
            サンプル復元
          </Button>
          <Button disabled={isExtracting} onClick={onReset} variant="outline">
            <RotateCcw className="h-4 w-4" />
            デモ初期化
          </Button>
          <Button disabled={isExtracting || !hasSegmentText} onClick={onApplyToPlainLog}>
            <FileText className="h-4 w-4" />
            通常ログへ反映
          </Button>
          <Button disabled={isExtracting || !hasMergeableAdjacentSegments} onClick={onMergeAdjacentSegments} variant="outline">
            <MessageSquareText className="h-4 w-4" />
            連続発話を結合
          </Button>
          <Button disabled={isExtracting || liveLog.segments.length < 2} onClick={onNormalizeTiming} variant="outline">
            <Clock3 className="h-4 w-4" />
            時刻を整える
          </Button>
          <Button disabled={isExtracting || !canExtract} onClick={onExtract}>
            <Wand2 className="h-4 w-4" />
            {isExtracting ? "抽出中" : "抽出プレビュー"}
          </Button>
        </div>
      </div>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">話者</h2>
          </div>
          <Button disabled={isExtracting} onClick={onAddSpeaker} size="sm" variant="outline">
            <Plus className="h-4 w-4" />
            話者を追加
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-1">
          {liveLog.speakers.map((speaker) => {
            const isSpeakerUsed = liveLog.segments.some((segment) => segment.speakerId === speaker.id);
            const speakerNameInputId = `speaker-name-${speaker.id}`;
            const speakerRoleSelectId = `speaker-role-${speaker.id}`;

            return (
              <div className="rounded-md border bg-background p-3" key={speaker.id}>
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor={speakerNameInputId}>
                    名前
                  </label>
                  <Button
                    aria-label="話者を削除"
                    disabled={isExtracting || isSpeakerUsed || liveLog.speakers.length <= 1}
                    onClick={() => onDeleteSpeaker(speaker.id)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  className="mt-1"
                  disabled={isExtracting}
                  id={speakerNameInputId}
                  value={speaker.name}
                  onBlur={(event) => onNormalizeSpeakerName(speaker.id, event.target.value)}
                  onChange={(event) => onUpdateSpeakerName(speaker.id, event.target.value)}
                />
                <label className="mt-3 block text-xs font-medium text-muted-foreground" htmlFor={speakerRoleSelectId}>
                  ロール
                </label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={isExtracting}
                  id={speakerRoleSelectId}
                  value={speaker.role}
                  onChange={(event) => onUpdateSpeakerRole(speaker.id, event.target.value as SpeakerRole)}
                >
                  {Object.entries(speakerRoleLabels).map(([role, label]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">発話ログ</h2>
            {normalizedSegmentQuery && <Badge variant="secondary">検索: {segmentQuery.trim()}</Badge>}
            {showLowConfidenceOnly && <Badge variant="destructive">要確認のみ</Badge>}
            {showEmptySegmentsOnly && <Badge variant="secondary">未入力のみ</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="発話ログを検索"
              className="h-8 w-44"
              disabled={isExtracting}
              placeholder="発話を検索"
              value={segmentQuery}
              onChange={(event) => setSegmentQuery(event.target.value)}
            />
            {lowConfidenceCount > 0 && (
              <Button
                aria-pressed={showLowConfidenceOnly}
                disabled={isExtracting}
                onClick={() => {
                  setShowLowConfidenceOnly((current) => !current);
                  setShowEmptySegmentsOnly(false);
                }}
                size="sm"
                variant={showLowConfidenceOnly ? "default" : "outline"}
              >
                要確認 {lowConfidenceCount}
              </Button>
            )}
            {emptySegmentCount > 0 && (
              <Button
                aria-pressed={showEmptySegmentsOnly}
                disabled={isExtracting}
                onClick={() => {
                  setShowEmptySegmentsOnly((current) => !current);
                  setShowLowConfidenceOnly(false);
                }}
                size="sm"
                variant={showEmptySegmentsOnly ? "default" : "outline"}
              >
                未入力 {emptySegmentCount}
              </Button>
            )}
            {(normalizedSegmentQuery || showLowConfidenceOnly || showEmptySegmentsOnly) && (
              <Button
                disabled={isExtracting}
                onClick={() => {
                  setSegmentQuery("");
                  setShowLowConfidenceOnly(false);
                  setShowEmptySegmentsOnly(false);
                }}
                size="sm"
                variant="ghost"
              >
                <RotateCcw className="h-4 w-4" />
                条件解除
              </Button>
            )}
            <Button
              disabled={isExtracting || visibleSegments.length === 0}
              onClick={() => onExportVisibleSegments(visibleSegments)}
              size="sm"
              variant="outline"
            >
              <Download className="h-4 w-4" />
              表示中JSON
            </Button>
            <Button disabled={isExtracting} onClick={onAddSegment} size="sm" variant="outline">
              <Plus className="h-4 w-4" />
              発話を追加
            </Button>
          </div>
        </div>

        {sortedSegments.length === 0 ? (
          <div className="rounded-md border border-dashed bg-background p-6 text-center">
            <p className="text-sm font-medium">発話ログはまだありません</p>
            <Button className="mt-3" disabled={isExtracting} onClick={onAddSegment} size="sm" variant="outline">
              <Plus className="h-4 w-4" />
              発話を追加
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {visibleSegments.length === 0 && (
              <div className="rounded-md border border-dashed bg-background p-6 text-center">
                <p className="text-sm font-medium">
                  {normalizedSegmentQuery
                    ? "検索に一致する発話はありません"
                    : showEmptySegmentsOnly
                      ? "未入力の発話はありません"
                      : "要確認の発話はありません"}
                </p>
                <Button
                  className="mt-3"
                  onClick={() => {
                    setSegmentQuery("");
                    setShowLowConfidenceOnly(false);
                    setShowEmptySegmentsOnly(false);
                  }}
                  size="sm"
                  variant="outline"
                >
                  すべて表示
                </Button>
              </div>
            )}
            {visibleSegments.map((segment) => {
              const speaker = liveLog.speakers.find((candidate) => candidate.id === segment.speakerId);
              const isSegmentTextInvalid = !isExtracting && segment.text.trim().length === 0;
              const confidencePercent =
                typeof segment.confidence === "number" && Number.isFinite(segment.confidence)
                  ? Math.round(Math.max(0, Math.min(1, segment.confidence)) * 100)
                  : null;
              const segmentTextHintId = `segment-text-hint-${segment.id}`;
              const segmentStartInputId = `segment-start-${segment.id}`;
              const segmentEndInputId = `segment-end-${segment.id}`;
              const segmentSpeakerSelectId = `segment-speaker-${segment.id}`;
              const segmentTextInputId = `segment-text-${segment.id}`;

              return (
                <div
                  className="grid grid-cols-[120px_160px_1fr_40px] gap-3 rounded-md border bg-background p-3 max-lg:grid-cols-1"
                  key={segment.id}
                >
                  <fieldset>
                    <legend className="text-xs font-medium text-muted-foreground">時刻</legend>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <Input
                        aria-label="開始秒"
                        disabled={isExtracting}
                        id={segmentStartInputId}
                        inputMode="numeric"
                        min={0}
                        step={1}
                        type="number"
                        value={segment.startTimeSec}
                        onChange={(event) =>
                          onUpdateSegment(segment.id, { startTimeSec: event.currentTarget.valueAsNumber })
                        }
                      />
                      <Input
                        aria-label="終了秒"
                        disabled={isExtracting}
                        id={segmentEndInputId}
                        inputMode="numeric"
                        min={0}
                        step={1}
                        type="number"
                        value={segment.endTimeSec}
                        onChange={(event) =>
                          onUpdateSegment(segment.id, { endTimeSec: event.currentTarget.valueAsNumber })
                        }
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatTimestamp(segment.startTimeSec)} - {formatTimestamp(segment.endTimeSec)}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        aria-label="時刻を5秒戻す"
                        disabled={isExtracting || segment.startTimeSec <= 0}
                        onClick={() => {
                          const offset = Math.min(5, segment.startTimeSec);
                          onUpdateSegment(segment.id, {
                            endTimeSec: segment.endTimeSec - offset,
                            startTimeSec: segment.startTimeSec - offset,
                          });
                        }}
                        size="icon"
                        variant="ghost"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label="時刻を5秒進める"
                        disabled={isExtracting}
                        onClick={() =>
                          onUpdateSegment(segment.id, {
                            endTimeSec: segment.endTimeSec + 5,
                            startTimeSec: segment.startTimeSec + 5,
                          })
                        }
                        size="icon"
                        variant="ghost"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </fieldset>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground" htmlFor={segmentSpeakerSelectId}>
                      話者
                    </label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={isExtracting}
                      id={segmentSpeakerSelectId}
                      value={segment.speakerId}
                      onChange={(event) => onUpdateSegment(segment.id, { speakerId: event.target.value })}
                    >
                      {liveLog.speakers.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name} / {speakerRoleLabels[candidate.role]}
                        </option>
                      ))}
                    </select>
                    {speaker && (
                      <Badge className="mt-2" variant={speaker.role === "GM" ? "secondary" : "outline"}>
                        {speakerRoleLabels[speaker.role]}
                      </Badge>
                    )}
                    {confidencePercent !== null && (
                      <Badge
                        className="mt-2"
                        variant={confidencePercent < lowConfidenceThreshold * 100 ? "destructive" : "muted"}
                      >
                        信頼度 {confidencePercent}%
                      </Badge>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor={segmentTextInputId}>
                        発話
                      </label>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {segment.text.trim().length}字
                      </span>
                    </div>
                    <Textarea
                      aria-describedby={isSegmentTextInvalid ? segmentTextHintId : undefined}
                      aria-invalid={isSegmentTextInvalid}
                      className="mt-1 min-h-[84px] resize-y text-sm leading-6"
                      disabled={isExtracting}
                      id={segmentTextInputId}
                      value={segment.text}
                      onChange={(event) => onUpdateSegment(segment.id, { text: event.target.value })}
                    />
                    {isSegmentTextInvalid && (
                      <p className="mt-1 text-xs text-muted-foreground" id={segmentTextHintId}>
                        発話本文が未入力です
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Button
                      aria-label="この後に発話を追加"
                      disabled={isExtracting}
                      onClick={() => onAddSegmentAfter(segment.id)}
                      size="icon"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="発話を分割"
                      disabled={isExtracting || segment.text.trim().length < 2}
                      onClick={() => onSplitSegment(segment.id)}
                      size="icon"
                      variant="outline"
                    >
                      <Split className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="発話を複製"
                      disabled={isExtracting}
                      onClick={() => onDuplicateSegment(segment.id)}
                      size="icon"
                      variant="outline"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label="発話を削除"
                      disabled={isExtracting}
                      onClick={() => onDeleteSegment(segment.id)}
                      size="icon"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
