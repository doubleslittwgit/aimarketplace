/**
 * 通知の種類と、それぞれの文言テンプレート。
 *
 * 1箇所にまとめておくことで、「アプリ内通知とメールで文言が微妙に違う」
 * 「同じ種類の通知なのに呼び出し箇所ごとに文言がバラバラ」を防ぐ。
 */

export type NotificationType =
  | "tool_approved"
  | "tool_rejected"
  | "tool_auto_rejected_risk"
  | "tool_unpublished_by_admin"
  | "sale"
  | "new_review"
  | "seller_account_status_changed"
  | "purchase_receipt"
  | "admin_new_pending_review"
  | "admin_high_risk_flagged"
  | "admin_post_reported"
  | "new_follower"
  | "post_liked"
  | "new_post_comment"
  | "new_question"
  | "question_answered"
  | "new_request_link";

export type NotificationContent = {
  title: string;
  body: string;
  linkUrl: string;
  /** メール件名。省略時は title をそのまま使う。 */
  emailSubject?: string;
};

const SITE_URL = "https://www.getbuildbay.com";

export function toolApproved(toolName: string, slug: string): NotificationContent {
  return {
    title: `「${toolName}」が公開されました`,
    body: "審査を通過し、マーケットに公開されました。",
    linkUrl: `${SITE_URL}/apps/${slug}`,
  };
}

export function toolRejected(toolName: string, reason: string): NotificationContent {
  return {
    title: `「${toolName}」が却下されました`,
    body: `却下理由: ${reason}`,
    linkUrl: `${SITE_URL}/dashboard`,
  };
}

export function toolAutoRejectedRisk(toolName: string, reason: string): NotificationContent {
  return {
    title: `「${toolName}」が自動的に却下されました`,
    body: `内容の自動チェックにより却下されました。理由: ${reason}`,
    linkUrl: `${SITE_URL}/dashboard`,
  };
}

export function toolUnpublishedByAdmin(
  toolName: string,
  reason: string
): NotificationContent {
  return {
    title: `「${toolName}」が非公開になりました`,
    body: `運営により非公開にされました。理由: ${reason}`,
    linkUrl: `${SITE_URL}/dashboard`,
  };
}

export function sale(
  toolName: string,
  buyerName: string,
  earnings: string
): NotificationContent {
  return {
    title: `「${toolName}」が売れました`,
    body: `${buyerName}さんが購入しました（あなたの取り分: ${earnings}）。`,
    linkUrl: `${SITE_URL}/dashboard`,
  };
}

export function newReview(
  toolName: string,
  rating: number,
  slug: string
): NotificationContent {
  return {
    title: `「${toolName}」に新しいレビューがつきました`,
    body: `評価: ${"★".repeat(rating)}${"☆".repeat(5 - rating)}`,
    linkUrl: `${SITE_URL}/apps/${slug}`,
  };
}

export function sellerAccountStatusChanged(
  status: "enabled" | "requirements_due" | "disabled"
): NotificationContent {
  const messages: Record<typeof status, string> = {
    enabled: "受け取り設定が完了し、有料ツールの販売・入金ができるようになりました。",
    requirements_due: "受け取り設定に追加の情報が必要です。ご確認ください。",
    disabled: "受け取り設定の状態が変わり、現在は入金を受け付けられません。",
  };
  return {
    title: "受け取り設定の状況が更新されました",
    body: messages[status],
    linkUrl: `${SITE_URL}/seller`,
  };
}

export function purchaseReceipt(
  toolName: string,
  price: string,
  slug: string
): NotificationContent {
  return {
    title: `「${toolName}」のご購入ありがとうございます`,
    body: `${price}のお支払いが完了しました。マイページからいつでもダウンロードできます。`,
    linkUrl: `${SITE_URL}/apps/${slug}`,
    emailSubject: `ご購入ありがとうございます — ${toolName}`,
  };
}

export function adminNewPendingReview(
  toolName: string,
  authorName: string
): NotificationContent {
  return {
    title: `新しい出品があります: ${toolName}`,
    body: `${authorName}さんが出品しました。審査をお願いします。`,
    linkUrl: `${SITE_URL}/admin/review`,
  };
}

export function adminHighRiskFlagged(
  toolName: string,
  authorName: string,
  reason: string
): NotificationContent {
  return {
    title: `⚠️ 危険判定で自動却下されました: ${toolName}`,
    body: `出品者: ${authorName}。理由: ${reason}`,
    linkUrl: `${SITE_URL}/admin/review`,
  };
}

export function adminToolReported(
  toolName: string,
  reasonLabel: string
): NotificationContent {
  return {
    title: `🚩 通報がありました: ${toolName}`,
    body: `理由: ${reasonLabel}`,
    linkUrl: `${SITE_URL}/admin/reports`,
  };
}

export function adminPostReported(
  authorName: string,
  reasonLabel: string
): NotificationContent {
  return {
    title: `🚩 投稿が通報されました`,
    body: `投稿者: ${authorName}。理由: ${reasonLabel}`,
    linkUrl: `${SITE_URL}/admin/post-reports`,
  };
}

export function newFollower(followerName: string, followerHandle: string): NotificationContent {
  return {
    title: `${followerName}さんにフォローされました`,
    body: "プロフィールを見てみましょう。",
    linkUrl: `${SITE_URL}/u/${followerHandle}`,
  };
}

export function postLiked(likerName: string, postExcerpt: string, postId: string): NotificationContent {
  return {
    title: `${likerName}さんが投稿にいいねしました`,
    body: postExcerpt ? `「${postExcerpt}」` : "あなたの投稿にいいねがつきました。",
    linkUrl: `${SITE_URL}/feed/${postId}`,
  };
}

export function newPostComment(
  commenterName: string,
  commentExcerpt: string,
  postId: string
): NotificationContent {
  return {
    title: `${commenterName}さんが投稿にコメントしました`,
    body: `「${commentExcerpt}」`,
    linkUrl: `${SITE_URL}/feed/${postId}`,
  };
}

export function newQuestion(
  askerName: string,
  toolName: string,
  questionExcerpt: string,
  slug: string
): NotificationContent {
  return {
    title: `「${toolName}」に質問が届きました`,
    body: `${askerName}さん: 「${questionExcerpt}」`,
    linkUrl: `${SITE_URL}/apps/${slug}#qa`,
  };
}

export function questionAnswered(toolName: string, slug: string): NotificationContent {
  return {
    title: `「${toolName}」への質問に回答がありました`,
    body: "商品ページで回答を確認できます。",
    linkUrl: `${SITE_URL}/apps/${slug}#qa`,
  };
}

export function newRequestLink(
  toolName: string,
  requestTitle: string,
  requestId: string
): NotificationContent {
  return {
    title: `リクエストに回答するツールが見つかりました`,
    body: `「${requestTitle}」に「${toolName}」が紐付けられました。`,
    linkUrl: `${SITE_URL}/requests#${requestId}`,
  };
}
