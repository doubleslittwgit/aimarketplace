-- 「同じ買い手 × 同じツール」で completed 状態の購入を1件までに制限する。
-- 経緯・理由は本番DBへの適用時のコメント、および
-- app/api/webhooks/stripe/route.ts の 23505 ハンドリング部分を参照。
create unique index if not exists purchases_one_completed_per_buyer_tool
  on public.purchases (tool_id, buyer_id)
  where status = 'completed';
