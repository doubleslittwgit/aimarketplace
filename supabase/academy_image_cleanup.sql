-- ============================================================
-- Academy の講座用フォルダ（<user>/courses/<course>/）の未使用画像を一覧にする
-- ============================================================
-- 画像は挿入した瞬間にアップロードされるため、書きかけで放置された講座や、
-- 差し替え・削除した画像がストレージに残り続ける。この関数で一覧を出し、
-- 削除はストレージのAPIで行う（lib/academy/cleanup.ts）。
-- データベースから直接消すとファイル本体が残るため、Supabase側で直接削除は禁止されている。
-- 判定は「ファイル名がサムネイルのURLか本文に含まれるか」。ファイル名は
-- sanitizeFileName で英数字・-・_ だけにしているので、URL上で表記が変わって誤判定することはない。
-- ============================================================
create or replace function public.list_unused_course_images(p_min_age interval default interval '1 hour')
returns table (name text, bytes bigint, created_at timestamptz, course_saved boolean)
language sql
security definer
set search_path = public, storage
as $$
  select o.name,
         coalesce((o.metadata->>'size')::bigint, 0),
         o.created_at,
         exists (select 1 from public.courses c where c.id::text = split_part(o.name, '/', 3))
  from storage.objects o
  where o.bucket_id = 'tool-images'
    and split_part(o.name, '/', 2) = 'courses'
    and o.created_at < now() - p_min_age
    and not exists (
      select 1
      from public.courses c
      left join public.course_bodies b on b.course_id = c.id
      where c.id::text = split_part(o.name, '/', 3)
        and (
          position(o.name in coalesce(c.thumbnail_url, '')) > 0
          or position(o.name in coalesce(b.content::text, '')) > 0
        )
    )
  order by o.created_at;
$$;

revoke all on function public.list_unused_course_images(interval) from public, anon, authenticated;
grant execute on function public.list_unused_course_images(interval) to service_role;
