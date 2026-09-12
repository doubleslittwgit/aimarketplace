-- ============================================================
-- ストレージ（ファイル保管）のアクセス制御
-- ============================================================
-- schema.sql を実行した後に、このファイルを実行してください。
--
-- 重要な考え方:
--   ツールの実体ファイルは「購入した人だけ」がダウンロードできる必要がある。
--   ここを間違えると、誰でも無料でファイルを取れてしまい、
--   マーケットプレイスとして成立しなくなる。
-- ============================================================


-- ------------------------------------------------------------
-- 1. バケット（保管場所）の作成
-- ------------------------------------------------------------
-- tool-files: ツール本体。非公開。購入者のみダウンロード可。
insert into storage.buckets (id, name, public)
values ('tool-files', 'tool-files', false)
on conflict (id) do nothing;

-- tool-images: スクリーンショット等。公開。誰でも閲覧可。
insert into storage.buckets (id, name, public)
values ('tool-images', 'tool-images', true)
on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 2. tool-files（ツール本体）のポリシー
-- ------------------------------------------------------------
-- ファイルのパス構成を「{author_id}/{tool_id}/{ファイル名}」と決めておく。
-- こうすると、パスの1階層目を見るだけで「誰のファイルか」が判定できる。

-- アップロード: ログイン済みユーザーが、自分のフォルダにだけ置ける
drop policy if exists "sellers can upload own tool files" on storage.objects;
create policy "sellers can upload own tool files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tool-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 更新・削除: 自分のフォルダのファイルだけ
drop policy if exists "sellers can update own tool files" on storage.objects;
create policy "sellers can update own tool files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'tool-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "sellers can delete own tool files" on storage.objects;
create policy "sellers can delete own tool files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tool-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ダウンロード: ここが最重要。
-- 「出品者本人」か「購入完了した人」だけが読める。
drop policy if exists "owners and buyers can download tool files" on storage.objects;
create policy "owners and buyers can download tool files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'tool-files'
    and (
      -- 出品者本人
      (storage.foldername(name))[1] = auth.uid()::text
      -- または、このツールを購入完了している人
      or exists (
        select 1
        from public.purchases p
        join public.tools t on t.id = p.tool_id
        where p.buyer_id = auth.uid()
          and p.status = 'completed'
          and (storage.foldername(name))[2] = t.id::text
      )
      -- または、無料公開されているツール
      or exists (
        select 1 from public.tools t
        where (storage.foldername(name))[2] = t.id::text
          and t.price = 0
          and t.status = 'published'
      )
    )
  );


-- ------------------------------------------------------------
-- 3. tool-images（スクリーンショット）のポリシー
-- ------------------------------------------------------------
-- 閲覧は誰でも可。アップロードは自分のフォルダのみ。
drop policy if exists "tool images are viewable by everyone" on storage.objects;
create policy "tool images are viewable by everyone"
  on storage.objects for select
  using (bucket_id = 'tool-images');

drop policy if exists "users can upload own tool images" on storage.objects;
create policy "users can upload own tool images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'tool-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users can delete own tool images" on storage.objects;
create policy "users can delete own tool images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'tool-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
