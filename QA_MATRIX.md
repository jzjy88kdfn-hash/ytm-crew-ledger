# 協力会社・出面管理 QA MATRIX

正本参照: `PROJECT_MASTER.md`
判定語: `NOT_RUN / PASS / FAIL / BLOCKED`
原則: 実行証拠がないものをPASSにしない。実機項目はiPhone/Windowsの証拠が揃うまでNOT_RUNまたはBLOCKEDとする。

| ID | 区分 | 試験 | 合格条件 | 状態 | 証拠 |
|---|---|---|---|---|---|
| S-01 | 静的 | app.js構文 | JavaScript構文エラー0 | PASS | GitHub Actions `Internal QA` run 35267130306 success / `node --check app.js` |
| S-02 | 静的 | supabase-lite.js構文 | JavaScript構文エラー0 | PASS | run 35267130306 success / `node --check vendor/supabase-lite.js` |
| S-03 | 静的 | sw.js構文 | JavaScript構文エラー0 | PASS | run 35267130306 success / `node --check sw.js` |
| S-04 | 静的 | import map | 外部esm.sh指定が同一Origin vendorへ解決 | PASS | `qa/static-check.mjs` PASS。index import map → `./vendor/supabase-lite.js` |
| S-05 | 静的 | Service Worker | Supabase/Auth/Storage APIをキャッシュしない | PASS | `qa/static-check.mjs` PASS。Service Workerはsame-origin GETのみ対象 |
| DB-01 | DB | RLS | 全業務tableでRLS有効 | PASS | partners / attendance / worker_profiles / documents / profile_photos / change_log 全て `relrowsecurity=true` |
| DB-02 | DB | 本人制限 | 本人メール+owner_id以外は読書き不可 | PASS | 全業務RLS policyで `owner_id=(select auth.uid())` + JWT email `kcfnk1001@icloud.com` を強制 |
| DB-03 | DB | Storage | private bucket + owner path +本人制限 | PASS | `crew-ledger-private` public=false。SELECT/INSERT/UPDATE/DELETEでauth.uid先頭folder + 本人email制限 |
| DB-04 | DB | インボイス8% | 元単価保持、なし時のみ支払単価92% | PASS | `payment_daily_rate` generated column: なし→`floor(base_daily_rate*0.92)`、それ以外→base_daily_rate |
| DB-05 | DB | 出面snapshot | partner単価変更後も既存出面単価不変 | PASS | attendanceに `source_base_daily_rate` / `source_invoice_status` / `applied_daily_rate` を独立保存。金額はattendance内の適用単価から生成 |
| DB-06 | DB | 変更履歴 | core table INSERT/UPDATE/DELETEがDB triggerで記録 | PASS | partners / attendance / worker_profiles / documents / profile_photos に `crew_audit_*` INSERT/UPDATE/DELETE trigger確認 |
| DB-07 | DB | 取消 | void後もrow残存、集計から除外、復旧可能 | PASS | attendanceに `voided_at` / `void_reason` / `voided_by`。PWA集計は `!voided_at` のみ対象、取消/復旧はUPDATE |
| DB-08 | DB | Security Advisor | セキュリティlint 0 | PASS | 2026-09-18再監査 `lints=[]` |
| DB-09 | DB | Performance Advisor | 重大performance warning 0または根拠付き受容 | PASS | WARN/ERROR 0。残存は未使用index INFO 11件のみ。実データ/利用開始前なので削除せず保留 |
| N-01 | 正常 | Magic Link login | 本人メールでログイン完了、再読込後session維持 | BLOCKED | `auth.users=0`。本人による初回Magic Link認証が未実施 |
| N-02 | 正常 | 協力会社新規 | 入力→DB保存→再読込で一致 | NOT_RUN | N-01待ち |
| N-03 | 正常 | 協力会社編集 | 更新→再読込で一致、履歴あり | NOT_RUN | N-01待ち |
| N-04 | 正常 | 重複候補 | 同氏名/電話の重複候補に警告 | NOT_RUN | 実データ試験未実施 |
| N-05 | 正常 | 出面登録 | 人物→現場→人工→保存→再読込一致 | NOT_RUN | N-01待ち |
| N-06 | 正常 | 単価snapshot | partner単価変更後も過去出面不変 | NOT_RUN | DB構造PASS、実往復未実施 |
| N-07 | 正常 | 出面取消/復旧 | 取消で月次除外、復旧で再加算 | NOT_RUN | DB/PWA構造PASS、実往復未実施 |
| N-08 | 正常 | 証明書 | upload→DB metadata→signed表示 | NOT_RUN | N-01待ち |
| N-09 | 正常 | 顔写真 | 初回/差替え表示、旧object残骸なし | NOT_RUN | N-01待ち |
| N-10 | 正常 | 作業員編集 | 保存→再読込一致、状態管理可 | NOT_RUN | N-01待ち |
| N-11 | 正常 | 検索 | 氏名/会社/電話/住所で絞込 | NOT_RUN | コード実装済み、実データ試験未実施 |
| N-12 | 正常 | 期限 | 期限切れ/7日/8〜30日/未登録を正しく区分 | NOT_RUN | ローカル日付ロジック実装済み、境界試験未実施 |
| N-13 | 正常 | 1500件超 | 全出面取得、取りこぼしなし | NOT_RUN | 1000件単位pagination実装済み、大量データ試験未実施 |
| N-14 | 正常 | JSON backup | schema付きJSONを出力し内容件数一致 | NOT_RUN | 出力/復元コード実装済み、往復照合未実施 |
| N-15 | 正常 | 第5号系帳票 | 正本から帳票生成、主要項目一致 | NOT_RUN | `roster-print.html` 実装済み、実データ印刷未確認 |
| O-01 | Offline | オフライン起動 | 初回online cache後、通信なしでPWA起動 | NOT_RUN | 実機待ち |
| O-02 | Offline | partner queue | offline登録→閉じる→再起動→未送信保持 | NOT_RUN | IndexedDB queue実装済み、実機待ち |
| O-03 | Offline | attendance queue | offline出面→再接続→1回だけDB反映 | NOT_RUN | IndexedDB queue実装済み、実機待ち |
| O-04 | Offline | document Blob queue | offline添付→再起動→再接続→Storage+DB反映 | NOT_RUN | Blob queue実装済み、実機待ち |
| O-05 | Offline | photo Blob queue | offline写真→再起動→再接続→反映 | NOT_RUN | Blob queue実装済み、実機待ち |
| O-06 | Offline | 送信途中通信断 | 未送信を消さず、再送で重複なし | NOT_RUN | 実機/異常系待ち |
| E-01 | 異常 | 二重タップ | 1操作で重複rowを作らない | NOT_RUN | partner/attendanceはsubmit guardあり。document/photo/queue競合は追加検証要 |
| E-02 | 異常 | Storage成功/DB失敗 | 新Storage objectを掃除、queue/エラーで復旧可能 | NOT_RUN | cleanupコード存在。障害注入未実施 |
| E-03 | 異常 | Session期限切れ | refreshまたは再ログインへ安全遷移、queue消失なし | NOT_RUN | transient refresh failureでsessionを消さないよう `79ad7a3` で是正。実機期限切れ試験未実施 |
| E-04 | 異常 | 古いcache | 新cache version適用後、旧資産混在なし | NOT_RUN | Service Worker更新ロジック存在、実機待ち |
| E-05 | 異常 | 未確認情報 | 未確認/矛盾/推定が監査画面へ出る | NOT_RUN | 状態語彙/監査コード実装済み、実データ未実施 |
| R-01 | Red Team | 同名別人 | UUIDで分離、誤上書きしない | NOT_RUN | |
| R-02 | Red Team | 未来/異常日付 | 不正入力を検知/拒否 | NOT_RUN | 防御強化候補あり |
| R-03 | Red Team | 1年後期限 | 日付境界を越えて警告判定正常 | NOT_RUN | |
| R-04 | Red Team | 大量証明書 | 一覧・期限監査が破綻しない | NOT_RUN | |
| R-05 | Red Team | 端末再起動 | cache/queue/sessionが仕様通り復元 | NOT_RUN | |
| X-01 | 実機 | Windows | login→登録→保存→再読込→出力 | NOT_RUN | |
| X-02 | 実機 | iPhone Safari | login→登録→保存→再読込→PWA化 | NOT_RUN | |
| X-03 | 実機 | PC→iPhone同期 | PC登録をiPhoneで確認 | NOT_RUN | |
| X-04 | 実機 | iPhone→PC同期 | iPhone登録をPCで確認 | NOT_RUN | |
| X-05 | 実機 | iPhone offline | 機内相当→登録→終了→起動→復旧→同期 | NOT_RUN | |
| X-06 | 実機 | 帳票 | 実データで帳票内容・印刷/PDF確認 | NOT_RUN | |

## Gateへの対応
- G2: N-02〜N-15、O-01〜O-06に必要なコードが存在すること
- G3: S/DB/N/Eの実行可能範囲がPASS
- G4: X-01〜X-06 PASS
- G5: E/R/Oの重大ケースPASS
- G6: 実運用手順と復旧手順の確認
- G7: main/Pages/Home Screen/実データ往復PASS

## 2026-09-18 内部QAメモ
- 自動静的QAを `.github/workflows/qa.yml` + `qa/static-check.mjs` に固定。以後 `recovery/production-gates` へのpushごとに再実行する。
- 最新自動QA: GitHub Actions run `35267130306` = success。
- Supabase Security Advisor: 0件。
- Performance Advisor: WARN/ERROR 0。`unused_index` INFOのみ。参考: https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
- 初回本人Authがまだ0件のため、ここから先のクラウド往復・Storage・実機系は本人Magic Link認証が開始条件。
