# 山﨑塗装 協力会社・出面管理 PWA

他部屋・FieldOps・他システムと混在させない専用PWA。

## 正本
- 利用端末: 本人のWindows PC + iPhone
- UI: PWA（HTML/CSS/JavaScript）
- DB: Supabase project `gxpthkgvqyagfmbwcodm`（既存 `ytm-fieldops-prd` をユーザー指示により本システム専用として使用）
- Storage: 非公開 `crew-ledger-private`
- RLS: 全業務テーブル有効。本人ログインの owner_id のみ読書き可能
- GitHub: 本システム専用リポジトリ

## 実装済み
- 新規登録
- インボイス未登録時8%減額（元単価保持）
- 出面登録時の単価スナップショット
- 協力会社プロフィール
- 顔写真
- 証明書・期限
- 期限切れ / 7日 / 30日 / 未登録の判定
- 作業員名簿用正本データ
- 変更履歴
- RLS / 非公開Storage
- PWA manifest / Service Worker

## 未完了ゲート
- 本人Authログイン実機確認
- GitHub Pages公開
- PC/iPhone同期実機試験
- 第5号帳票の最終レイアウト出力
- オフライン時の未送信キュー（現版は表示キャッシュのみ。登録はオンライン前提）
