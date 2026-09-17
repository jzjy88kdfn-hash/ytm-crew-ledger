# 協力会社・出面管理 QA MATRIX

正本参照: `PROJECT_MASTER.md`
判定語: `NOT_RUN / PASS / FAIL / BLOCKED`
原則: 実行証拠がないものをPASSにしない。実機項目はiPhone/Windowsの証拠が揃うまでNOT_RUNまたはBLOCKEDとする。

| ID | 区分 | 試験 | 合格条件 | 状態 | 証拠 |
|---|---|---|---|---|---|
| S-01 | 静的 | app.js構文 | JavaScript構文エラー0 | NOT_RUN | |
| S-02 | 静的 | supabase-lite.js構文 | JavaScript構文エラー0 | NOT_RUN | |
| S-03 | 静的 | sw.js構文 | JavaScript構文エラー0 | NOT_RUN | |
| S-04 | 静的 | import map | 外部esm.sh指定が同一Origin vendorへ解決 | NOT_RUN | |
| S-05 | 静的 | Service Worker | Supabase/Auth/Storage APIをキャッシュしない | NOT_RUN | |
| DB-01 | DB | RLS | 全業務tableでRLS有効 | NOT_RUN | |
| DB-02 | DB | 本人制限 | 本人メール+owner_id以外は読書き不可 | NOT_RUN | |
| DB-03 | DB | Storage | private bucket + owner path +本人制限 | NOT_RUN | |
| DB-04 | DB | インボイス8% | 元単価保持、なし時のみ支払単価92% | NOT_RUN | |
| DB-05 | DB | 出面snapshot | partner単価変更後も既存出面単価不変 | NOT_RUN | |
| DB-06 | DB | 変更履歴 | core table INSERT/UPDATE/DELETEがDB triggerで記録 | NOT_RUN | |
| DB-07 | DB | 取消 | void後もrow残存、集計から除外、復旧可能 | NOT_RUN | |
| DB-08 | DB | Security Advisor | セキュリティlint 0 | NOT_RUN | |
| DB-09 | DB | Performance Advisor | 重大performance warning 0または根拠付き受容 | NOT_RUN | |
| N-01 | 正常 | Magic Link login | 本人メールでログイン完了、再読込後session維持 | NOT_RUN | |
| N-02 | 正常 | 協力会社新規 | 入力→DB保存→再読込で一致 | NOT_RUN | |
| N-03 | 正常 | 協力会社編集 | 更新→再読込で一致、履歴あり | NOT_RUN | |
| N-04 | 正常 | 重複候補 | 同氏名/電話の重複候補に警告 | NOT_RUN | |
| N-05 | 正常 | 出面登録 | 人物→現場→人工→保存→再読込一致 | NOT_RUN | |
| N-06 | 正常 | 単価snapshot | partner単価変更後も過去出面不変 | NOT_RUN | |
| N-07 | 正常 | 出面取消/復旧 | 取消で月次除外、復旧で再加算 | NOT_RUN | |
| N-08 | 正常 | 証明書 | upload→DB metadata→signed表示 | NOT_RUN | |
| N-09 | 正常 | 顔写真 | 初回/差替え表示、旧object残骸なし | NOT_RUN | |
| N-10 | 正常 | 作業員編集 | 保存→再読込一致、状態管理可 | NOT_RUN | |
| N-11 | 正常 | 検索 | 氏名/会社/電話/住所で絞込 | NOT_RUN | |
| N-12 | 正常 | 期限 | 期限切れ/7日/8〜30日/未登録を正しく区分 | NOT_RUN | |
| N-13 | 正常 | 1500件超 | 全出面取得、取りこぼしなし | NOT_RUN | |
| N-14 | 正常 | JSON backup | schema付きJSONを出力し内容件数一致 | NOT_RUN | |
| N-15 | 正常 | 第5号系帳票 | 正本から帳票生成、主要項目一致 | NOT_RUN | |
| O-01 | Offline | オフライン起動 | 初回online cache後、通信なしでPWA起動 | NOT_RUN | |
| O-02 | Offline | partner queue | offline登録→閉じる→再起動→未送信保持 | NOT_RUN | |
| O-03 | Offline | attendance queue | offline出面→再接続→1回だけDB反映 | NOT_RUN | |
| O-04 | Offline | document Blob queue | offline添付→再起動→再接続→Storage+DB反映 | NOT_RUN | |
| O-05 | Offline | photo Blob queue | offline写真→再起動→再接続→反映 | NOT_RUN | |
| O-06 | Offline | 送信途中通信断 | 未送信を消さず、再送で重複なし | NOT_RUN | |
| E-01 | 異常 | 二重タップ | 1操作で重複rowを作らない | NOT_RUN | |
| E-02 | 異常 | Storage成功/DB失敗 | 新Storage objectを掃除、queue/エラーで復旧可能 | NOT_RUN | |
| E-03 | 異常 | Session期限切れ | refreshまたは再ログインへ安全遷移、queue消失なし | NOT_RUN | |
| E-04 | 異常 | 古いcache | 新cache version適用後、旧資産混在なし | NOT_RUN | |
| E-05 | 異常 | 未確認情報 | 未確認/矛盾/推定が監査画面へ出る | NOT_RUN | |
| R-01 | Red Team | 同名別人 | UUIDで分離、誤上書きしない | NOT_RUN | |
| R-02 | Red Team | 未来/異常日付 | 不正入力を検知/拒否 | NOT_RUN | |
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
