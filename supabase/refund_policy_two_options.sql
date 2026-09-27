-- 返金ポリシーの選択肢を2つ（none=返金なし / conditional=場合によって返金あり）に絞る。
-- 以前の「返金対応あり（full）」は「場合によって返金あり」に置き換える。
-- 原則は返金不可（特定商取引法に基づく表記を参照）。
update public.tools set refund_policy = 'conditional' where refund_policy = 'full';
update public.courses set refund_policy = 'conditional' where refund_policy = 'full';
update public.tools set refund_policy = 'none' where refund_policy is null or refund_policy not in ('none', 'conditional');
update public.courses set refund_policy = 'none' where refund_policy is null or refund_policy not in ('none', 'conditional');
alter table public.tools drop constraint if exists tools_refund_policy_check;
alter table public.tools add constraint tools_refund_policy_check check (refund_policy in ('none', 'conditional'));
alter table public.courses drop constraint if exists courses_refund_policy_check;
alter table public.courses add constraint courses_refund_policy_check check (refund_policy in ('none', 'conditional'));
