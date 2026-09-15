import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, notificationEmailHtml } from "@/lib/email/resend";
import type { NotificationContent } from "@/lib/notifications/content";

/**
 * 通知を1件作成する（アプリ内通知の保存 + メール送信）。
 *
 * 【なぜ admin クライアントを使うのか】
 * 通知の対象者（userId）は、操作した本人とは限らない
 * （例: 管理者がAさんの出品を承認 → 通知はAさん宛）。
 * notifications テーブルは authenticated に insert 権限を
 * 与えていないため、ここでは常に service_role を使う。
 * 呼び出せるのはサーバー側のコード（サーバーアクション・Webhook）のみで、
 * クライアントから直接呼ばれることはない。
 *
 * メール送信が失敗しても、アプリ内通知の保存は独立して成功させる
 * （逆も同様）。どちらか一方が失敗しても、もう一方はユーザーに届く。
 */
export async function notify(
  userId: string,
  type: string,
  content: NotificationContent,
  options: { email?: boolean } = { email: true }
): Promise<void> {
  const admin = createAdminClient();

  const { error: insertError } = await admin.from("notifications").insert({
    user_id: userId,
    type,
    title: content.title,
    body: content.body,
    link_url: content.linkUrl,
  });

  if (insertError) {
    console.error(`[notify] アプリ内通知の保存に失敗 (type=${type}):`, insertError.message);
  }

  if (options.email === false) return;

  try {
    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(userId);

    if (userError || !userData?.user?.email) {
      console.error(
        `[notify] メールアドレスの取得に失敗 (userId=${userId}):`,
        userError?.message
      );
      return;
    }

    const result = await sendEmail({
      to: userData.user.email,
      subject: content.emailSubject ?? content.title,
      html: notificationEmailHtml({
        title: content.title,
        body: content.body,
        linkUrl: content.linkUrl,
      }),
    });

    if (!result.sent) {
      console.error(`[notify] メール送信に失敗 (type=${type}):`, result.error);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    console.error(`[notify] メール送信中に例外 (type=${type}):`, message);
  }
}

/**
 * 管理者全員に通知する（現在は1人だが、将来増えても対応できるように）。
 */
export async function notifyAdmins(
  type: string,
  content: NotificationContent
): Promise<void> {
  const admin = createAdminClient();
  const { data: admins, error } = await admin.from("admins").select("user_id");

  if (error || !admins) {
    console.error("[notifyAdmins] 管理者一覧の取得に失敗:", error?.message);
    return;
  }

  await Promise.all(admins.map((a) => notify(a.user_id, type, content)));
}
