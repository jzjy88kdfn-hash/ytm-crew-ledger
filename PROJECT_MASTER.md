# 協力会社・出面管理 — 唯一の進行正本

正本ID: YTM-CREW-MASTER
更新日: 2026-09-18
状態: STEP 8 内部QA・耐障害性是正中 / 本番未承認

このファイルを仕様・進行・完成判定の唯一の正本とする。README、旧Excel、旧VBA、会話、試作品は参照資料であり、この正本と矛盾した場合は本書を優先する。

## 1. 目的
山﨑塗装が、協力会社・一人親方・個人応援について「誰が／いくらで／いつどこへ出たか／必要書類が有効か／作業員名簿に何が不足しているか」をWindows PCとiPhoneから同じ正本データで迷わず管理し、支払・期限・名簿作成の漏れと過去データの改変事故を防ぐ。

## 2. 前提
- 利用者: 本人1名
- 端末: Windows PC + iPhone
- 表層: 日本語PWA
- 正本DB: Supabase `gxpthkgvqyagfmbwcodm`。既存名は `ytm-fieldops-prd` だが、本案件用として使用
- ファイル正本: private Storage `crew-ledger-private`
- ソース正本: GitHub `jzjy88kdfn-hash/ytm-crew-ledger`
- 作業branch: `recovery/production-gates`
- 認証: 本人メールのみ許可。ブラウザへservice_role/DB passwordを置かない
- 作業員名簿: 全建統一様式第5号 改訂6版（令和6年10月）を基準データとし、元請独自様式は正本から出力する

## 3. 制約
- 他案件DB・他リポジトリ・FieldOpsの業務データを混在させない
- 不明値を推測で確定しない
- 過去出面は登録時単価スナップショットを保持し、後日の単価変更で再計算しない
- インボイスなしは元単価を保持し、支払単価を8%減額する。1円未満処理は現DBの切捨てを暫定採用し、実運用前に事業判断ゲートで確認する
- iPhoneのバックグラウンド常時実行を前提にしない
- 通信断でも既存データを失わない。未送信は送信完了まで端末から消さない
- コード生成・画面表示だけを完成証拠にしない

## 4. 出力
- 協力会社プロフィール
- 出面履歴・月次人工・支払集計
- 証明書原本と期限アラート
- 作業員名簿用正本データと第5号系帳票
- 変更履歴・監査結果
- バックアップ/エクスポート

## 5. 資産判定
### 採用
- PWA: `index.html` / `styles.css` / `app.js` / `manifest.webmanifest` / `sw.js` / `config.js` / `assets` / `vendor/supabase-lite.js`
- Supabase: partners / attendance / worker_profiles / documents / profile_photos / change_log
- RLS、本人メール制限、private Storage
- 旧Excelで確定した業務ルール

### 部分採用
- 旧Excel UI: 項目・帳票要件のみ参照。主UIとしては廃止
- 旧VBA: 業務ルールと検証観点のみ参照。実行基盤としては廃止

### 参考
- 協力会社・出面管理_仕様凍結.xlsx
- 協力会社・出面管理_UI操作体系凍結.xlsx
- 協力会社・出面管理_Excel本体再構築.xlsx
- 第4工程VBA一括実装 / 第5工程統合試験 / 第6工程パッケージ
- 旧プレビュー画像・旧テンプレート

### 廃止
- Excel/VBAを正本DBまたは主操作画面とする案
- `app.part*.txt` 実行時結合方式
- 外部CDNがなければアプリ自体が起動しない構造
- 同一ルールを複数資料へ重複して凍結する運用
- コードが存在するだけで「実装済み」と判定する運用

### 保留
- 元請別の作業員名簿テンプレート追加
- チャットからのファイル原本直接投入
- iPhone Push通知

## 6. 表層 / 内部の二層
### 表層
HOME / 出面 / 協力会社 / 期限 / 作業員 / 監査。日常操作を優先し、内部用語・DB状態・技術設定を通常画面へ出さない。

### 内部
UUID、owner_id、RLS、単価スナップショット、原本Storage path、確認状態、変更履歴、未送信キュー、監査ルール、取消履歴、バックアップ、リリース番号を保持する。

## 7. 状態管理
一般情報状態は `確定 / 確認済み / 申告 / 推定 / 未確認 / 矛盾 / 対象外`。`documents.read_status` は `確定 / 未確認 / 読取不能 / 要確認` の証明書読取専用状態として残す。

未確認情報には確認対象・確認方法・根拠を残す。推測値を確定値へ昇格させない。

## 8. 主要業務ルール
- 登録区分: 法人 / 個人事業主・一人親方 / 個人応援・屋号なし
- 電話番号と通常人工単価（税込）は必須
- 法人表示名=会社名、個人事業主=屋号優先、個人応援=氏名
- LINE/メールは連絡可否のみ保持
- インボイスありは登録番号必須
- 出面: 日付 / 人物 / 現場 / 作業内容 / 人工 / 適用単価 / 経費 / 備考
- 出面取消は物理削除せず `voided_at` 等で履歴を残す。復旧可能とする
- 証明書は人物登録後に追加
- 期限: 期限切れ赤 / 7日以内警告 / 8〜30日注意 / 未登録要確認
- 生年月日から年齢を表示時算出し、年齢自体を正本保存しない

## 9. 例外・Red Team必須ケース
入力不足、二重登録、二重タップ、通信断、送信途中終了、古いキャッシュ、Storage upload成功後DB失敗、DB成功後画面更新失敗、写真差替え時の旧ファイル残存、取消/復旧、日付境界、iPhone再起動、セッション切れ、1500件超出面、大量証明書、同名人物、単価変更後の過去出面、1年後の期限、元請様式追加を試験対象とする。

## 10. 変更管理
本番変更は作業branch → 静的/自動QA → 実機確認 → main merge。main直書きを通常運用にしない。変更前/後、理由、影響、日付、再検証要否をcommit/DB change_logへ残す。

## 11. 完了ゲート
G1 設計: 目的・前提・制約・出力・主要機能・例外・保存先が本書に定義済み
G2 実装: 登録/編集、出面、写真、証明書、期限、作業員、検索、監査、履歴、バックアップ、オフライン復旧、帳票出力がコード上存在
G3 内部QA: 構文、DB制約、RLS、Storage、正常系、異常系、自動監査がPASS
G4 実機: iPhone + Windowsで本人ログイン、入力→保存→再読込→同期→出力→再確認がPASS
G5 Red Team: 重大問題0、復旧不能0、未検証重大ケース0
G6 運用: 説明書を読まなくても主要操作を完了でき、日常/変更/バックアップ/復旧手順が確定
G7 本番: GitHub Pages本番URL、Home Screen、キャッシュ更新、実データ1件の往復確認がPASS

全G1〜G7 PASS時のみ「完成」。

## 12. 現在地（2026-09-18）
- G1: PASS
- G2: PASS。登録/編集、出面、写真、証明書、期限、作業員、検索、監査、履歴、JSONバックアップ/復元、IndexedDB未送信復旧、第5号系帳票出力のコードが存在
- G3: PARTIAL。GitHub Actions静的QA PASS、Supabase RLS/Storage/生成列/監査trigger確認済み、Security Advisor 0、Performance WARN/ERROR 0。本人Authを要するREST/Storage/正常系・異常系の実往復が未実施
- G4: FAIL。本人Auth/iPhone/Windows同期の実機証拠なし
- G5: FAIL。Red Team実行証拠未完了
- G6: FAIL。日常/復旧/バックアップ運用未確定
- G7: FAIL。GitHub Pages本番・実データ往復未確認

## 13. 2026-09-18までに是正・実装済み
- 日本時間0:00〜8:59に前日となるUTC日付処理をローカル日付処理へ変更
- `app.part*.txt` 分割実行を廃止し `app.js` へ一本化
- 外部 `esm.sh` 依存を同一Origin `vendor/supabase-lite.js` へ置換するimport mapを実装
- Service Workerを同一Origin静的資産だけのキャッシュへ制限
- IndexedDB snapshot + 未送信queueを実装
- 出面1500件上限をページング取得へ変更
- 出面取消/復旧を履歴保持方式で実装
- 協力会社検索を実装
- 一般情報の確認状態・根拠欄を実装
- 作業員情報編集を実装
- 期限7日/8〜30日を分離
- JSONメタデータバックアップと復元画面を実装
- 第5号系A3横帳票 `roster-print.html` を実装
- DB側自動変更履歴triggerを実装
- `updated_at` DB triggerを実装
- 写真差替え時旧Storage object削除、DB失敗時新object掃除を実装
- モバイル下部ナビで6機能すべて表示
- Auth token refresh時の再帰イベント発火を抑止
- 一時的な通信失敗/5xxで保存済みsessionを消さないようAuth refreshを強化
- `qa/static-check.mjs` と `.github/workflows/qa.yml` を追加し、作業branch pushごとの自動静的QAを固定
- 最新GitHub Actions `Internal QA` run 35267130306 success
- Supabase Performance Advisorの旧RLS initplan WARN 7件を解消。現在WARN/ERROR 0、未使用index INFOのみ

## 14. 未完了の重大/重要課題
P0: Supabase `auth.users=0`。本人Magic Linkの初回認証がまだ一度も成立していない
P0: 本人ログイン→保存→再読込→別端末同期の実機証拠がない
P0: IndexedDB未送信queueをiPhone Safari実機で通信断→終了→再起動→再接続まで未検証
P0: `vendor/supabase-lite.js` のAuth/PostgREST/Storage互換性を実認証で未検証
P1: 未送信queueの同時flush競合、証明書/写真の二重操作をRed Teamで重点確認する
P1: 未来日など異常日付の拒否条件をRed Teamで確認し、不足時は入力防御を追加する
P1: 第5号系帳票はコード実装済みだが実データ印刷/PDFの視認確認がない
P1: JSON復元はStorage原本そのものを含まないため、原本ファイルの別バックアップ方針をG6で確定する
P1: GitHub Pages候補公開とMagic Link callbackの実機確認が未実施

## 15. 次の固定順序
1. STEP 8残り: ユーザー操作不要の内部QA・既知異常系のコード是正
2. Draft PR作成（mainへはmergeしない）
3. HTTPS候補URLを用意し、本人Magic Link初回認証を1回だけ実施
4. Auth/REST/Storage正常系QA → Red Team → オフライン復旧QA
5. Windows/iPhone相互同期・帳票・Home Screen実機確認
6. 不具合修正→全QA再実行
7. 日常/バックアップ/復旧手順確定
8. G1〜G7全PASS確認後のみmainへ本番収束
