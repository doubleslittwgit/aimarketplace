# データベース設定ガイド

このフォルダには、マーケットプレイスのデータベース設計が入っています。

---

## ファイルの説明

| ファイル | 内容 |
|---|---|
| `schema.sql` | テーブル（ユーザー・ツール・購入履歴・レビュー）の定義とアクセス制御 |
| `storage.sql` | ファイル保管場所の設定と、ダウンロード権限の制御 |
| `storage_limits.sql` | アップロードできるファイルサイズ・形式の制限 |
| `functions.sql` | 購入処理・手数料計算などのサーバー側の処理 |
| `likes.sql` | いいね機能（`tool_likes` テーブルと件数の自動同期） |
| `notifications.sql` | 通知機能（`notifications` テーブル、アプリ内通知の保存） |
| `seller_accounts.sql` | Stripe Connectの連結アカウント情報（出品者の受け取り設定） |
| `admins.sql` | 管理者一覧と `is_admin()` 判定関数（出品審査などに使用） |
| `add_thumbnail.sql` | サムネイル列の追加（後から足したもの） |
| `add_gallery.sql` | 商品詳細ページ用のギャラリー画像列の追加（後から足したもの） |
| `add_view_count.sql` | 閲覧数（インプレッション表示用）の追加（後から足したもの） |
| `add_categories_array.sql` | 複数カテゴリ対応（後から足したもの） |
| `translations.sql` | 商品・レビューの多言語翻訳キャッシュ（後から足したもの） |
| `legal_translations.sql` | 法務ページのHTML翻訳キャッシュ（後から足したもの） |
| `follows.sql` | ユーザー間のフォロー機能（後から足したもの） |
| `posts.sql` | 投稿フィード機能（文章・画像・いいね・コメント・通報）（後から足したもの） |
| `tool_questions.sql` | 商品詳細ページのQ&A機能（後から足したもの） |
| `tool_requests.sql` | 「欲しいツール」リクエスト掲示板（後から足したもの） |
| `get_seller_badge_stats.sql` | プロフィールの実績バッジ用の集計RPC（後から足したもの） |
| `add_host_apps.sql` | 「BuildBay Creative」用のhost_appsカラム（後から足したもの） |
| `add_profile_locale.sql` | メール通知を出品時の言語で送るためのlocaleカラム（後から足したもの） |
| `add_notification_prefs.sql` | 通知の種類ごとのオン/オフ設定（後から足したもの） |
| `add_sale_pricing.sql` | 出品者が設定するセール価格・期限（後から足したもの） |
| `create_refund_requests.sql` | 返金・トラブルのアプリ内報告窓口（後から足したもの） |
| `add_versions_and_remix.sql` | バージョン履歴・リミックス許可（後から足したもの） |
| `protect_tool_columns.sql` | 審査ステータス・実績カウントの改ざん防止（後から足したもの） |
| `add_policy_wip_announcements.sql` | 返金ポリシー・開発中フラグ・出品者のお知らせ（後から足したもの） |
| `add_tips_and_notes.sql` | 使い方のコツ投稿・チップ（後から足したもの） |
| `add_tool_video_url.sql` | 商品ページの紹介動画（後から足したもの） |
| `create_tool_access_urls.sql` | クラウド型ツールのURLを購入者限定で保管（後から足したもの） |
| `create_academy_courses.sql` | BuildBay Academy の講座（後から足したもの） |
| `add_course_category.sql` | Academy の講座カテゴリ（後から足したもの） |
| `academy_purchases.sql` | Academy の講座の購入・返金ポリシー（後から足したもの） |
| `academy_image_cleanup.sql` | Academy の未使用画像の一覧（後から足したもの） |
| `increment_install.sql` | ダウンロード数を加算する関数 |
| `grants.sql` | 各テーブルへのアクセス許可（**最後に実行**） |

---

## 設定手順

### ステップ1：Supabaseのアカウントを作る（あなたの作業）

1. ブラウザで https://supabase.com を開く
2. 「Start your project」からアカウントを作成（GitHubアカウントでログインできます）
3. 「New project」で新しいプロジェクトを作成
   - Name: `aimarketplace` など任意
   - Database Password: **必ずどこかに控えてください**（後で必要になります）
   - Region: `Northeast Asia (Tokyo)` を選ぶと日本・台湾から速くなります
4. プロジェクトの作成完了まで1〜2分待つ

### ステップ2：SQLを実行する

左メニューの「SQL Editor」を開き、以下を**この順番で**実行してください。

1. `schema.sql`
2. `storage.sql`
3. `storage_limits.sql`
4. `functions.sql`
5. `likes.sql`
6. `notifications.sql`
7. `seller_accounts.sql`
8. `admins.sql`（実行後、ファイル内のコメントに従って初期管理者を1件登録すること）
9. `add_thumbnail.sql`
10. `add_gallery.sql`
11. `add_view_count.sql`
12. `add_categories_array.sql`
13. `translations.sql`
14. `legal_translations.sql`
15. `follows.sql`
16. `posts.sql`
17. `tool_questions.sql`
18. `tool_requests.sql`
19. `get_seller_badge_stats.sql`
20. `add_host_apps.sql`
21. `add_profile_locale.sql`
22. `add_notification_prefs.sql`
23. `add_sale_pricing.sql`
24. `create_refund_requests.sql`
25. `add_versions_and_remix.sql`
26. `add_policy_wip_announcements.sql`
27. `add_tips_and_notes.sql`
28. `add_tool_video_url.sql`
29. `create_tool_access_urls.sql`
30. `create_academy_courses.sql`
31. `add_course_category.sql`
32. `academy_purchases.sql`
33. `academy_image_cleanup.sql`
34. `increment_install.sql`
35. `protect_tool_columns.sql`
36. `academy_reviews_progress.sql`
37. `grants.sql` ← **必ず最後**

> `grants.sql` を最後に実行するのは、それより前に作られたテーブルすべてに
> 許可を与える必要があるためです。順番を飛ばすと「401エラーで何も見えない」
> 状態になります。
>
> 何度実行しても問題ない作りにしてあります。
> 途中で失敗した場合は、もう一度同じものを実行して構いません。

### ステップ3：接続情報を控える

左メニューの「Project Settings」→「API」を開き、次の2つを控えてください。

- **Project URL**（`https://xxxxx.supabase.co` のような形）
- **anon public** キー

この2つは、次の工程（サイトとデータベースをつなぐ作業）で使います。

> **service_role キーについて**
> 同じ画面に `service_role` というキーもありますが、これは
> **すべてのアクセス制御を無視できる非常に強力なキー**です。
> ブラウザ側のコードには絶対に書かず、サーバー側だけで使います。
> チャットやメールで共有するのも避けてください。

---

## 設計の考え方（なぜこうしたか）

### 購入履歴は、ブラウザから書き込めない

`purchases` テーブルには、わざと「書き込みの許可」を設定していません。

もしブラウザから書き込めてしまうと、技術がわかる人なら
「お金を払わずに購入済みの記録を作る」ことができてしまいます。

そのため、購入記録は **決済サービス（Stripe）からの通知を受けたサーバーだけ** が
作れるようにしています。

### 売上は本人しか見られない

`purchases` を見られるのは「買った本人」と「売った本人」だけです。
他の出品者がいくら稼いでいるかは、誰にも見えません。

### ファイルは購入者しかダウンロードできない

ツール本体のファイルは、次のいずれかに当てはまる人だけがダウンロードできます。

- そのツールを出品した本人
- そのツールを購入完了した人
- 無料公開されているツールの場合は、ログイン済みの全員

### 自分のツールは自分で買えない

手数料だけ払って売上を水増しする、といった不正を防ぐため、
出品者本人による購入はエラーになるようにしています。

---

## 次の工程

データベースの準備ができたら、次はサイト側とつなぐ作業に進みます。

1. Next.js に Supabase 接続を組み込む
2. ログイン・サインアップ画面を作る
3. 出品フォームから実際にデータを保存できるようにする
