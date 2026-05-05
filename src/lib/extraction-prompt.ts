import type { ExtractionInputLine, ExtractionSource } from "./extraction";
import { extractionResponseJsonSchema } from "./extraction-schema";
import type { CampaignMode } from "../types";

type ExtractionPromptInput = {
  campaignMode: CampaignMode;
  lines: ExtractionInputLine[];
  source: ExtractionSource;
};

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatLine(line: ExtractionInputLine, index: number): string {
  const speaker = line.speakerName ? ` speaker="${escapeXmlAttribute(line.speakerName)}"` : "";
  const role = line.role ? ` role="${escapeXmlAttribute(line.role)}"` : "";

  return `<line index="${index + 1}"${speaker}${role}>${escapeXmlText(line.text)}</line>`;
}

const campaignModeGuidance: Record<CampaignMode, string[]> = {
  investigation: [
    "- 調査シナリオとして、謎、手がかり、容疑者/NPC、場所、未開示情報、ミスリード、未回収の伏線を優先する。",
    "- 手がかりはPLが次に行動を選べる粒度で残す。",
  ],
  fantasy: [
    "- ファンタジーキャンペーンとして、クエスト、NPC、拠点、勢力、アイテム、移動履歴、世界変化を優先する。",
    "- 手がかりはクエスト進行や勢力事情につながる情報として扱う。",
  ],
};

const campaignModeLabels: Record<CampaignMode, string> = {
  investigation: "調査シナリオ",
  fantasy: "ファンタジーキャンペーン",
};

export function buildExtractionPrompt({ campaignMode, lines, source }: ExtractionPromptInput): string {
  const transcript = lines.map(formatLine).join("\n");
  const sourceLabel = source === "speaker" ? "話者付きログ" : "通常ログ";

  return [
    "あなたはTRPGの人間GMを支援するログ整理アシスタントです。",
    "AIが世界設定を確定せず、GMが承認・修正するための抽出候補だけを作ってください。",
    `キャンペーン種別: ${campaignModeLabels[campaignMode]}`,
    "",
    "抽出方針:",
    "- 重要な出来事、NPC、手がかり、GM秘密、伏線だけを抽出する。",
    ...campaignModeGuidance[campaignMode],
    "- PLが既に知っている情報と、GMだけが知る秘密を混同しない。",
    "- GM発話やメタ発言に含まれる未開示情報は原則として GMのみ または 未開示候補 にする。",
    "- 断定できない内容は短く、採用前にGMが直せる粒度にする。",
    "- 同じ意味の候補を重複させない。",
    "- 最大12件までに絞る。",
    "",
    "kind は次のいずれか:",
    "- 出来事",
    "- NPC",
    "- 手がかり",
    "- GM秘密",
    "- 伏線",
    "",
    "visibility は次のいずれか:",
    "- PL既知",
    "- GMのみ",
    "- 未開示候補",
    "",
    "返答形式:",
    "- JSONだけを返す。",
    "- Markdown、説明文、コードフェンスを含めない。",
    "- schema:",
    JSON.stringify(extractionResponseJsonSchema.schema, null, 2),
    "",
    `<input_summary source="${escapeXmlAttribute(sourceLabel)}" line_count="${lines.length}" />`,
    "<transcript>",
    transcript,
    "</transcript>",
  ].join("\n");
}
