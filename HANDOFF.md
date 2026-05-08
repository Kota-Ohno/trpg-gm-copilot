# 引き継ぎメモ: trpg-gm-copilot

このメモは、Codex/AIエージェントを新しい作業ディレクトリで開き直したあとに、今回の会話コンテキストを復元するための一時的な引き継ぎ資料です。次回セッション開始時にこのファイルを読ませてください。

## 2026-05-06 現在の重要ステータス

- active goal: `TRPGのGMサポートシステムとして、市場価値を十分に発揮できるレベルのプロダクトに仕上げてください、機能面はもちろん、UIUX、継続性も考慮してください`
- ローカル開発サーバー: `http://localhost:5174/`
- 直近の検証: `pnpm run check` 通過、12 test files / 127 tests passed、production build passed。
- 直近の疎通: `curl -I http://localhost:5174/` は `200 OK`。
- ユーザーから「動作は問題ないです」と確認済み。実ブラウザでの主要導線確認はOKとして扱う。
- 現在の残goalは、本番向け名称・UI/UX・ビジュアルの仕上げ。

## 現在の主要実装

- ホーム導線、テンプレート、ログ/抽出/承認/記憶/次回準備、PL共有、締め、エクスポート/インポート、Provider設定、運用チェック、診断JSONまで実装済み。
- Provider接続テスト:
  - 抽出ProviderはOpenAI/Ollama/ルールベースの接続可否を画面上で確認する。
  - 文字起こしProviderはOpenAI/手動/Web Speechの準備状態を画面上で確認する。
- APIキー/Token秘匿:
  - キャンペーンJSON/診断JSONにはProvider secretsを含めない。
  - 診断JSONにはProvider secretsを含めない。

## 次に必要な実証

1. ユーザー所有のOpenAI API key、またはローカルOllamaでProvider接続テストを実行する。
   - 抽出Providerと文字起こしProviderを別々に確認する。
2. 必要なら診断JSONを書き出し、Provider secretsが含まれないことを確認する。

## 作業場所

- 正しいリポジトリ: `/Users/kota/Documents/GitHub/trpg-gm-copilot`
- 誤って最初に作業してしまった場所: `/Users/kota/Documents/GitHub/transformer/trpg-gm-copilot`
- 誤作業ディレクトリは移行後に削除済み。
- 旧 `transformer` リポジトリには、このアプリ関連の変更は残していない。
- 旧 `transformer` 側には元から以下の未追跡ファイルがあったが、この作業では触らない方針:
  - `docker/app/debug_model.py`
  - `docker/app/models/mlm_base/`
  - `docker/app/models/mlm_model/`
  - `docker/app/models/mlm_small_v2/`
  - `docker/app/runs/`

## ユーザーの要望と背景

ユーザーはGWに個人開発で面白いものを作りたい。以下の条件でアイデア出しから始まった。

- 作りたい方向:
  - B: 収益化しやすいSaaS
  - C: 技術的に面白い実験作
  - ただし収益化自体は強く重視しない。
- 得意領域:
  - AI/LLM
  - Webアプリ
  - 分野は限定しない。
  - オーディオやゲームが好き。
- 開発期間:
  - 伸びてもよい。
  - GWに作業したい。
- ランニングコスト:
  - 大きいものは避けたい。
- 避けたい方向:
  - AI NPCやAI GMのように、AIが卓を代行する方向はあまりやりたくない。

Web調査をしながら、TRPG案が有力になった。最終的に以下の方向に合意している。

## プロダクト方針

TRPG向けの **人間GMを支援するツール** を作る。

重要なのは、AIにGMを代替させないこと。AI NPCやAI GMではなく、GMがセッションを準備・整理・継続運用するための補助に徹する。

コアコンセプト:

- セッションログやメモを貼り付ける。
- AIがログから重要情報を抽出する。
- GMが抽出結果を承認・修正・破棄する。
- 承認した情報だけがキャンペーンの記憶に入る。
- 次回セッション前に、前回要約、未回収の伏線、次回導入案、GM確認メモを出す。
- セッション中は「即応パレット」として、急なNPC名、別ルートの手がかり、失敗判定の面白い結果、場面転換案などを短く提示する。

最初の対象は **調査シナリオ寄り**。

理由:

- 手がかり、既知情報、GM秘密、未回収の謎が明確で、AI整理の価値が見えやすい。
- クトゥルフ/エモクロア/ミステリー系TRPGの運用に相性がよい。
- 後からファンタジーキャンペーンに拡張しやすい。

後から **ファンタジーキャンペーン寄り** に拡張する。

調査シナリオ:

- 謎
- 手がかり
- 容疑者/NPC
- 場所
- プレイヤーが知っている情報
- まだ開示していない情報
- ミスリード
- 未回収の伏線
- 次に出せる手がかり

ファンタジーキャンペーン:

- クエスト
- NPC
- 街/拠点
- 勢力
- アイテム
- ダンジョン
- 移動履歴
- 未解決の依頼
- 再登場させたい人物
- 世界に起きた変化

設計上は、内部データモデルはなるべく共通化し、表示ラベルや抽出スキーマを「モード」で切り替える方針がよい。

## 差別化の軸

単なるAI要約ツールやNPC生成ツールにしない。

特に重要な差別化:

1. **PL既知情報とGM秘密を分ける**
   - 調査シナリオでは、プレイヤーが知っていることとGMだけが知っている真相の分離が重要。
   - 例:
     - PL既知: 村長が夜に森へ行った。
     - GM秘密: 村長は怪物ではなく、怪物を封印している。
     - 未開示手がかり: 村長の靴に銀色の泥が付いている。
     - 次回出せるルート: 酒場の噂、森の足跡、村長の娘の証言。

2. **GM承認フローを中心にする**
   - AI抽出結果をそのまま世界設定に反映しない。
   - GMが採用/修正/破棄できる。
   - GMの意図と卓の空気を守る。

3. **セッション後処理と次回準備をつなげる**
   - ログ要約だけでは弱い。
   - 「次回何を出すとよいか」「どの伏線を拾えるか」までつなげる。

4. **日本語TRPG運用に寄せる**
   - 海外D&D専用ツールと差別化。
   - CoC、エモクロア、ソード・ワールド、シノビガミ、マーダーミステリー系の運用にも広げたい。

## 技術方針

ユーザー指定:

- Vite + React
- CSS/UIは shadcn/ui がよい

現在の実装:

- Vite + React + TypeScript
- Tailwind CSS
- shadcn/ui風のローカル基本コンポーネントを手実装
  - `Button`
  - `Card`
  - `Badge`
  - `Input`
  - `Textarea`
  - `Tabs`
- lucide-react を利用
- まだ本物の shadcn CLI 初期化はしていない。
- 今後、必要に応じて正式な shadcn/ui 構成へ寄せるとよい。

低ランニングコスト方針:

- 初期はサーバーレス/ローカル中心。
- 保存は将来的に IndexedDB/Dexie.js が有力。
- LLMはユーザーAPIキー方式がよい。
- 将来的に Ollama 対応も検討。
- 音声文字起こしはProvider設定と取り込み導線まで実装済み。
- ココフォリアAPI連携、Discord連携、Tekeyログ取り込みなども後回し。
- 最初は「ログ貼り付け」で十分。

## 現在の実装状態

作成済みファイル:

- `.gitignore`
- `index.html`
- `package.json`
- `pnpm-lock.yaml`
- `postcss.config.js`
- `tailwind.config.js`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/styles.css`
- `src/types.ts`
- `src/data/sample.ts`
- `src/lib/utils.ts`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/tabs.tsx`

現在の画面機能:

- 左サイドバー:
  - アプリ名 `Loreline`
  - キャンペーン名入力
  - 調査ボード、NPC、場所、年表、伏線のナビ表示
  - 承認進捗

- 中央ワークスペース:
  - タブ:
    - `ログ`
    - `承認`
    - `記憶`
    - `次回準備`
  - ログタブ:
    - サンプルのTRPGログを表示
    - テキストエリアで編集可能
    - `抽出プレビュー` ボタン
  - 承認タブ:
    - モック抽出結果をカード表示
    - 採用/破棄ボタン
    - 採用するとクロニクルへ反映
  - 記憶タブ:
    - 手がかり
    - NPC
    - 伏線
  - 次回準備タブ:
    - 3行あらすじ
    - 次回導入案
    - 未解決の問い
    - GM確認メモ

- 右サイドバー:
  - 即応パレット
  - 急なNPC
  - 別ルートの手がかり
  - 失敗判定の結果
  - 場面転換
  - 選択すると候補テキストを表示
  - ファンタジーモード拡張予定のメモカード

現在はAI APIには未接続。`src/data/sample.ts` のモックデータで動作する。

## サンプル世界観

現在のデモでは、調査シナリオ「灰ヶ浦異聞」のような雰囲気を使っている。

主な要素:

- 港町・灰ヶ浦
- 古い灯台
- 村長
- 酒場の女将ミヨ
- 銀色の泥
- 岬の青白い光
- 灯台地下扉の警告「月が沈むまで開けるな」

このサンプルはデモとして使いやすいが、正式実装時にはテンプレート/サンプルキャンペーンとして分離してもよい。

## 動作確認

実行済み:

```bash
pnpm install
pnpm run build
```

`pnpm run build` は成功済み。

開発サーバー:

```bash
pnpm run dev
```

起動時のURL:

- `http://localhost:5173/`
- `http://192.168.11.50:5173/`

このメモを書いた時点では、前セッションで起動した Vite dev server がまだ動いている可能性がある。新しいセッションでポートが埋まっていたら、既存サーバーを止めるか別ポートで起動する。

## 既知の注意点

- `.gitignore` は追加済み。
- `dist/`, `node_modules/`, `*.tsbuildinfo`, `vite.config.js`, `vite.config.d.ts` は無視対象。
- `pnpm run build` 後に `dist/` は生成されるがGitには出ない想定。
- `tsconfig.node.json` は残っているが、`tsconfig.json` から project reference は外している。
- いまの `tsconfig.node.json` はほぼ未使用。将来整理してよい。
- React 19 + TypeScript で `JSX.Element` 戻り値型が面倒だったため、コンポーネントの戻り値型は明示していない。
- 最初に作った `Slot` コンポーネントは型問題があり、未使用だったので削除済み。

## 次にやるとよいこと

優先度高:

1. 正しい作業ディレクトリでCodexを開き直す。
   - `/Users/kota/Documents/GitHub/trpg-gm-copilot`
   - 開き直したら、この `HANDOFF.md` を読ませる。

2. UI/UXを触って確認する。
   - `pnpm run dev`
   - `http://localhost:5173/`
   - ログタブから抽出プレビュー、承認、記憶、次回準備の流れを確認。

3. 保存機能を入れる。
   - まずは `localStorage` でもよい。
   - 早めに `IndexedDB` + `Dexie.js` へ寄せるのがよさそう。
   - 保存対象:
     - キャンペーン名
     - セッションログ
     - 承認済みクロニクル
     - 承認済み/破棄済み抽出結果

4. AI接続の設計を入れる。
   - ユーザーAPIキー方式。
   - 設定画面にAPI provider/API key/modelを置く。
   - 最初はOpenAI互換APIを想定してもよい。
   - ただしAPIキーをブラウザ保存する場合は注意文が必要。

5. 抽出スキーマを定義する。
   - Zodなどで構造化するとよい。
   - 調査モードの抽出項目:
     - events
     - npcs
     - clues
     - locations
     - secrets
     - threads
     - promises/tasks
     - next-session seeds
   - `PL既知`, `GMのみ`, `未開示候補` の分類を必ず持たせる。

優先度中:

6. 編集可能な承認フローにする。
   - 今は採用/破棄だけ。
   - 実際にはタイトル/本文/公開範囲/種別を修正してから採用したい。

7. 調査ボードを強化する。
   - 手がかり同士の関連
   - 未開示/開示済み
   - 真相への接続
   - PLが次に取りそうな行動

8. 次回準備生成をクロニクルから動的に作る。
   - 今はサンプル固定。
   - 承認済みデータから算出するか、LLMに渡して生成。

9. ファンタジーモードの拡張設計。
   - 調査モードの `clues` を `quests` や `factions` に対応させる。
   - データモデルは共通化しすぎて抽象的になりすぎないよう注意。

優先度低/後回し:

- 音声文字起こし
- ココフォリアログファイル直接取り込み
- Discord連携
- Tekey連携
- Markdown/JSONエクスポート
- Ollama対応
- PWA化
- 複数キャンペーン管理
- キャラクターシート連携
- 本物のAI NPC会話
- AI GM代行

AI NPC/AI GM代行は、ユーザーが「Dはあまりやりたくない」と明示しているため、避ける。

## 重要なプロダクト判断

- ツールは「GMの代わりに物語を進める」のではない。
- ツールは「GMが忘れない」「次回につなげる」「即興の選択肢を増やす」ためにある。
- AIの出力は必ずGMの承認を通す。
- ローカル保存と低ランニングコストを重視する。
- 最初は調査シナリオの体験品質を優先する。
- ファンタジー対応はあとで拡張するが、最初から破綻しないデータ設計にしておく。

## 次回Codexへの依頼文例

新しいCodexセッションを `/Users/kota/Documents/GitHub/trpg-gm-copilot` で開いたら、以下のように依頼するとよい。

```text
HANDOFF.md を読んで、前回の文脈を引き継いでください。
まず現状のファイル構成と実装を確認し、次の実装ステップとして localStorage または IndexedDB でキャンペーン状態を保存できるようにしてください。
AI NPC/AI GM代行方向には寄せず、GM承認フローと調査シナリオ向けの記憶整理を優先してください。
```

## 現在のGit状態の想定

新リポジトリでは以下が未追跡として出る想定:

- `.gitignore`
- `HANDOFF.md`
- `index.html`
- `pnpm-lock.yaml`
- `package.json`
- `postcss.config.js`
- `src/`
- `tailwind.config.js`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`

README.md はユーザーがリポジトリ作成時に置いた既存ファイルで、今回は触っていない。
