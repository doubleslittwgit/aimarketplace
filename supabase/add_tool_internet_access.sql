-- ツールの「インターネット接続が必要か」
--   required = 必要 / partial = 一部の機能で必要 / offline = 不要（オフラインで動く）
-- ローカル実行・クラウドのどちらのツールにも設定できる。
-- この項目を追加する前に出品されたツールは null（未設定）のまま。
alter table public.tools
  add column if not exists internet_access text
  check (internet_access is null or internet_access in ('required', 'partial', 'offline'));
comment on column public.tools.internet_access is 'インターネット接続の要否: required=必要 / partial=一部の機能で必要 / offline=不要（オフラインで動く）。未設定の既存ツールはnull';
