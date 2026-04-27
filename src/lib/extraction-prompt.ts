import type { ExtractionInputLine, ExtractionSource } from "./extraction";
import { extractionResponseJsonSchema } from "./extraction-schema";

type ExtractionPromptInput = {
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

export function buildExtractionPrompt({ lines, source }: ExtractionPromptInput): string {
  const transcript = lines.map(formatLine).join("\n");

  return [
    "あなたはTRPGの人間GMを支援するログ整理アシスタントです。",
    "AIが世界設定を確定せず、GMが承認・修正するための抽出候補だけを作ってください。",
    "",
    "抽出方針:",
    "- 重要な出来事、NPC、手がかり、GM秘密、伏線だけを抽出する。",
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
    `入力種別: ${source === "speaker" ? "話者付きログ" : "通常ログ"}`,
    "<transcript>",
    transcript,
    "</transcript>",
  ].join("\n");
}
