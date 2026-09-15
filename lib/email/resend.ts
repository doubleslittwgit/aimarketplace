/**
 * メール送信ラッパー（Resend）。
 *
 * RESEND_API_KEY が未設定の環境（ローカル開発・Resend導入前の本番）でも
 * アプリ全体が壊れないよう、未設定時は送信をスキップしてログに残すだけにする。
 * 通知機能の他の部分（アプリ内通知）は、メールの成否と無関係に動き続ける。
 */

const FROM_ADDRESS = "BuildBay <notify@getbuildbay.com>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY未設定のため送信をスキップ: to=${to}, subject=${subject}`
    );
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[email] 送信に失敗 (${res.status}): ${text}`);
      return { sent: false, error: `HTTP ${res.status}` };
    }

    return { sent: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    console.error("[email] 送信中に例外:", message);
    return { sent: false, error: message };
  }
}

/**
 * 通知用の共通メールテンプレート（1ボタンのシンプルな構成）。
 * BuildBayのブランドカラー（コーラル）でボタンを1つだけ出し、
 * クリックすると該当ページへ戻ってこられる。
 */
export function notificationEmailHtml({
  title,
  body,
  linkUrl,
  buttonLabel = "BuildBayで確認する",
}: {
  title: string;
  body: string;
  linkUrl: string;
  buttonLabel?: string;
}): string {
  return `
<!DOCTYPE html>
<html lang="ja">
  <body style="margin:0;padding:0;background-color:#f5fafd;font-family:'Hiragino Sans','Yu Gothic',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5fafd;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3edf2;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <span style="font-size:18px;font-weight:700;color:#16232d;">BuildBay</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="font-size:18px;line-height:1.5;color:#16232d;margin:16px 0 8px;">${title}</h1>
                <p style="font-size:14px;line-height:1.8;color:#4a5b64;margin:0 0 24px;white-space:pre-wrap;">${body}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <a href="${linkUrl}" style="display:inline-block;background-color:#ff6b4a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">${buttonLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;border-top:1px solid #eef4f7;">
                <p style="font-size:12px;color:#9aa8b0;margin:16px 0 0;">
                  このメールはBuildBayでの操作に基づいて自動送信されています。
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
