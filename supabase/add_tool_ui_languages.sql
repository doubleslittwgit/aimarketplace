-- ツールの対応言語（画面・説明書など）。複数選択。
-- 値は lib/tool-languages.ts の TOOL_LANGUAGES と一致させること（other = その他の言語）。
-- この項目を追加する前に出品されたツールは空配列（未設定）のまま。
alter table public.tools
  add column if not exists ui_languages text[] not null default '{}'
  check (ui_languages <@ array['ja','en','zh-Hant','zh-Hans','ko','es','fr','de','pt','other']::text[]);
comment on column public.tools.ui_languages is 'ツールの対応言語（画面・説明書など）。複数選択。other=その他の言語。未設定の既存ツールは空配列';
