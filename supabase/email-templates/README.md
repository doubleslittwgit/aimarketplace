# 認証メールの設定（Resend + BuildBayの文面）

会員登録の確認・パスワード再設定などのメールは Supabase が送っている。
初期設定のままだと Supabase の共用サーバーから送られ、

- 1時間あたりの送信数がごく少ない（登録が集中すると確認メールが届かない人が出る）
- 差出人が Supabase になり、迷惑メールに入りやすい

ため、Resend 経由（差出人 `BuildBay <no-reply@getbuildbay.com>`）に切り替え、文面も BuildBay のものにする。

## 1. Resend 側

1. Resend → **Domains** で `getbuildbay.com` が **Verified** になっていることを確認（通知メールと同じドメイン）
2. Resend → **API Keys** →「Create API Key」
   - Name: `supabase-auth-smtp`
   - Permission: **Sending access**、Domain: `getbuildbay.com`
   - 表示されたキー（`re_...`）を控える（一度しか表示されない）

## 2. Supabase 側：SMTP

Supabase → **Authentication → Emails → SMTP Settings** →「Enable custom SMTP」をオン

| 項目 | 値 |
|---|---|
| Sender email | `no-reply@getbuildbay.com` |
| Sender name | `BuildBay` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | 手順1で作ったAPIキー（`re_...`） |
| Minimum interval between emails | `60`（初期値のまま） |

保存後、**Authentication → Rate Limits** の「Rate limit for sending emails」を `100`（1時間あたり）程度に上げる。
（カスタムSMTPにすると初期値は30。Resendの無料枠は1日100通・月3,000通）

## 3. Supabase 側：URL

**Authentication → URL Configuration**

- Site URL: `https://www.getbuildbay.com`
- Redirect URLs に `https://www.getbuildbay.com/**` が入っていること

## 4. Supabase 側：文面

**Authentication → Emails → Templates** で、次の3つを差し替える（本文は「Source」に全文を貼り付け）

| テンプレート | 件名（Subject） | 本文 |
|---|---|---|
| Confirm signup | `【BuildBay】メールアドレスの確認` | `confirm-signup.html` |
| Reset password | `【BuildBay】パスワードの再設定` | `reset-password.html` |
| Change email address | `【BuildBay】メールアドレス変更の確認` | `change-email.html` |

リンクはすべて `/auth/confirm?token_hash=...` 形式（app/auth/confirm/route.ts）。
メールアプリ内のブラウザなど、申し込んだのと別のブラウザで開いても使える。

## 5. 確認

1. 捨てアドレスで新規登録 → 差出人が BuildBay、文面が BuildBay のものになっているか
2. リンクを開く → ログインした状態でトップに戻るか
3. ログアウト → 「パスワードをお忘れの方」→ 再設定メールのリンク → 新しいパスワードを設定できるか
4. Resend → **Emails** に送信履歴が出ているか
