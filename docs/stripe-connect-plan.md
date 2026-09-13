# Stripe Connect (Express) 移行計画

BuildBay を「複数の出品者に売上を自動分配するマーケットプレイス」にするための移行計画。
**作業が中断してもここから再開できるよう、決定事項と進捗を記録する。**

---

## 前提・決定事項

| 項目 | 決定 |
|---|---|
| 対象地域 | 当面 **日本国内のみ**（出品者・購入者とも日本） |
| 理由 | Stripe Connect の海外送金は US/UK/EEA/CA/CH のプラットフォームに限られ、日本のプラットフォームからは台湾等へ送金できないため |
| アカウントタイプ | **Express**（Stripeがホストする登録フォーム。本人確認もStripeが代行） |
| 送金タイミング | **購入と同時に自動分配**（destination charge） |
| 手数料 | プラットフォーム手数料 20%（`PLATFORM_FEE_RATE`） |
| 返金・チャージバック責任 | **プラットフォーム(BuildBay)が負う**（Connect契約で同意済み） |
| `on_behalf_of` | **使わない**（国内のみのため不要。決済の名義はプラットフォーム） |

### 決済フローの変更点

```
【変更前】
  購入者 → プラットフォームのStripe残高（全額）
           ※出品者への送金手段が存在しない。マイページの「売上」は帳簿上の数字だけ

【変更後】destination charge
  購入者 → プラットフォーム → 手数料20%を差し引いて出品者のConnectアカウントへ自動送金
```

---

## 重要な設計判断：なぜ `profiles` に列を足さないのか

`supabase/grants.sql` は `grant insert, update on public.profiles to authenticated` と
**テーブル全体に対して**更新権限を与えている。ここに `charges_enabled` のような
列を足すと、ログイン中のユーザーが自分の行を更新して
**「Stripeの審査を通さずに自分を受取可能状態にする」ことが可能になってしまう。**

そのため、Stripeの連結アカウント情報は専用テーブル `seller_accounts` に分離し、
**authenticated には書き込み権限を一切与えない**（service_role のみ書ける）。
Webhook と、サーバー側で本人確認を済ませたサーバーアクションだけが書き込む。

---

## 進捗

- [x] **Step 0** 計画書の作成（このファイル）
- [x] **Step 1** DB: `seller_accounts` テーブル作成（RLS・権限含む）
- [x] **Step 2** Connect オンボーディング（`/seller` ページ + Account Links）
- [x] **Step 3** Webhook: `account.updated` で審査状況を追跡
  - ⚠️ Stripeダッシュボードのエンドポイント設定に `account.updated` を追加する必要あり
- [ ] **Step 4** 出品制限: 有料出品はオンボーディング完了者のみ
- [ ] **Step 5** チェックアウトを destination charge 方式に変更 ★本番の決済に影響
- [ ] **Step 6** テストモードで通しテスト
- [ ] **Step 7** 本番キーへの切り替え（最後）

### 安全に進めるための原則

1. **Step 5 より前は全て「追加するだけ」** — 既存の決済フローを壊さない。
   途中で中断しても本番サイトは動き続ける。
2. Step 5 で初めて決済ロジックを切り替える。ここは他が全部揃ってから着手する。
3. **開発中はテストモード(サンドボックス)のまま**。本番キーへの切り替えは Step 7。

---

## 実装上の落とし穴（記録）

### `"use server"` からのエクスポートは公開エンドポイントになる

`"use server"` を付けたファイルからエクスポートした async 関数は、
Next.js によって**誰でも呼べるHTTPエンドポイント**として公開される。

当初 `syncSellerAccount(userId, account)` を `app/seller/actions.ts` に
置いていたが、これは第三者が任意の userId を「受取可能」に書き換えられる
**重大な脆弱性**だった。`lib/stripe/seller-account.ts`（通常のサーバーモジュール）
に移動して解決済み。

原則:
- `"use server"` からエクスポートする関数は、**引数に「誰の操作か」を取らない**。
  必ず `auth.getUser()` でセッションから本人を確定させる。
- 引数で対象を指定する必要がある処理は、サーバーアクションにしない。

---

## 既存データの扱い

現在出品されているツールの出品者（shugoto1 / shugoto4 / aimarketplacetest1234）は
まだConnectアカウントを持っていない。Step 5 以降、Connect未完了の出品者の
**有料**ツールは購入できなくなる（無料ツールは影響なし）。
これはテストデータなので問題ないが、本番移行時は既存出品者への告知が必要。

---

## 環境変数

| 変数名 | 用途 | 状態 |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe APIキー | テストキー設定済み。本番キーは Step 7 で差し替え |
| `STRIPE_WEBHOOK_SECRET` | Webhook署名検証 | 設定済み（`www.getbuildbay.com` 宛） |
| `NEXT_PUBLIC_SITE_URL` | `https://www.getbuildbay.com` | 設定済み |

Stripeアカウント:
- 本番: `acct_1UEt679bBRN0D0Jb`（本人確認・Connect設定 完了済み）
- サンドボックス: `acct_1UEt6F5O2ZdmTMxl`（Connect有効・動作確認済み）
