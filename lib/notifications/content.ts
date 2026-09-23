/**
 * 通知の種類と、それぞれの文言テンプレート。
 *
 * 1箇所にまとめておくことで、「アプリ内通知とメールで文言が微妙に違う」
 * 「同じ種類の通知なのに呼び出し箇所ごとに文言がバラバラ」を防ぐ。
 *
 * 【多言語対応について】
 * 利用者（買い手・出品者）宛の通知は、その人が最後に出品した時の言語
 * （profiles.locale）で送る。実際の文言は messages/*.json の
 * "notifications" 名前空間にあり、lib/notifications/i18n.ts の tNotif() で
 * 取り出している。一方、管理者（Shuさん）宛の通知（admin_*）は、
 * 常にShuさん自身が使う日本語のまま。これは「その通知を受け取る人が
 * 何語を使っているか」で決めているため、対象が違えば扱いも変える。
 */

import { tNotif } from "./i18n";
import type { SupportedLocale } from "@/lib/deepl";

export type NotificationType =
  | "tool_approved"
  | "tool_rejected"
  | "tool_auto_rejected_risk"
  | "tool_edit_triggered_review"
  | "tool_unpublished_by_admin"
  | "sale"
  | "new_review"
  | "seller_account_status_changed"
  | "purchase_receipt"
  | "admin_new_pending_review"
  | "admin_high_risk_flagged"
  | "admin_post_reported"
  | "admin_refund_requested"
  | "new_follower"
  | "post_liked"
  | "new_post_comment"
  | "new_question"
  | "question_answered"
  | "new_request_link"
  | "liked_tool_on_sale"
  | "tool_updated"
  | "seller_announcement"
  | "tip_received"
  | "course_approved"
  | "course_rejected"
  | "admin_course_pending"
  | "admin_course_double_payment";

// ------------------------------------------------------------
// 通知設定でオフにできる種類。
// ------------------------------------------------------------
// 審査結果・売上・購入完了・受け取り設定の状況など、取引に関わる
// 重要な通知は、ここに含めない（常にメールが届く）。
// SNS的な機能まわりの通知だけを、利用者が選んでオフにできるようにしている。
export const OPTIONAL_NOTIFICATION_TYPES = [
  "new_follower",
  "post_liked",
  "new_post_comment",
  "new_review",
  "new_question",
  "question_answered",
  "new_request_link",
  "liked_tool_on_sale",
  "tool_updated",
  "seller_announcement",
  "tip_received",
] as const;

export type OptionalNotificationType = (typeof OPTIONAL_NOTIFICATION_TYPES)[number];

export type NotificationContent = {
  title: string;
  body: string;
  linkUrl: string;
  /** メール件名。省略時は title をそのまま使う。 */
  emailSubject?: string;
};

const SITE_URL = "https://www.getbuildbay.com";

export function toolApproved(
  toolName: string,
  slug: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "toolApproved.title", { toolName }),
    body: tNotif(locale, "toolApproved.body"),
    linkUrl: `${SITE_URL}/apps/${slug}`,
  };
}

export function toolRejected(
  toolName: string,
  reason: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "toolRejected.title", { toolName }),
    body: tNotif(locale, "toolRejected.body", { reason }),
    linkUrl: `${SITE_URL}/dashboard`,
  };
}

export function toolAutoRejectedRisk(
  toolName: string,
  reason: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "toolAutoRejectedRisk.title", { toolName }),
    body: tNotif(locale, "toolAutoRejectedRisk.body", { reason }),
    linkUrl: `${SITE_URL}/dashboard`,
  };
}

export function toolEditTriggeredReview(
  toolName: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "toolEditTriggeredReview.title", { toolName }),
    body: tNotif(locale, "toolEditTriggeredReview.body"),
    linkUrl: `${SITE_URL}/dashboard`,
  };
}

export function toolUnpublishedByAdmin(
  toolName: string,
  reason: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "toolUnpublishedByAdmin.title", { toolName }),
    body: tNotif(locale, "toolUnpublishedByAdmin.body", { reason }),
    linkUrl: `${SITE_URL}/dashboard`,
  };
}

export function sale(
  toolName: string,
  buyerName: string,
  earnings: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "sale.title", { toolName }),
    body: tNotif(locale, "sale.body", { buyerName, earnings }),
    linkUrl: `${SITE_URL}/dashboard`,
  };
}

export function newReview(
  toolName: string,
  rating: number,
  slug: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "newReview.title", { toolName }),
    body: tNotif(locale, "newReview.body", {
      stars: `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`,
    }),
    linkUrl: `${SITE_URL}/apps/${slug}`,
  };
}

export function sellerAccountStatusChanged(
  status: "enabled" | "requirements_due" | "disabled",
  locale: SupportedLocale
): NotificationContent {
  const bodyKey =
    status === "enabled"
      ? "sellerAccountEnabled"
      : status === "requirements_due"
        ? "sellerAccountRequirementsDue"
        : "sellerAccountDisabled";
  return {
    title: tNotif(locale, "sellerAccountStatusTitle"),
    body: tNotif(locale, bodyKey),
    linkUrl: `${SITE_URL}/seller`,
  };
}

export function purchaseReceipt(
  toolName: string,
  price: string,
  slug: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "purchaseReceipt.title", { toolName }),
    body: tNotif(locale, "purchaseReceipt.body", { price }),
    linkUrl: `${SITE_URL}/apps/${slug}`,
    emailSubject: tNotif(locale, "purchaseReceipt.emailSubject", { toolName }),
  };
}

// ------------------------------------------------------------
// 管理者（Shuさん）宛の通知。受け取る人が固定なので、常に日本語のまま。
// ------------------------------------------------------------

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

export function adminRefundRequested(
  toolName: string,
  message: string
): NotificationContent {
  return {
    title: `🧾 返金・トラブルの報告があります: ${toolName}`,
    body: message.slice(0, 200),
    linkUrl: `${SITE_URL}/admin/refund-requests`,
  };
}

// ------------------------------------------------------------
// ここから先も利用者宛（SNS的な機能まわり）
// ------------------------------------------------------------

export function newFollower(
  followerName: string,
  followerHandle: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "newFollower.title", { followerName }),
    body: tNotif(locale, "newFollower.body"),
    linkUrl: `${SITE_URL}/u/${followerHandle}`,
  };
}

export function postLiked(
  likerName: string,
  postExcerpt: string,
  postId: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "postLiked.title", { likerName }),
    body: postExcerpt
      ? tNotif(locale, "postLiked.bodyWithExcerpt", { postExcerpt })
      : tNotif(locale, "postLiked.bodyNoExcerpt"),
    linkUrl: `${SITE_URL}/feed/${postId}`,
  };
}

export function newPostComment(
  commenterName: string,
  commentExcerpt: string,
  postId: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "newPostComment.title", { commenterName }),
    body: tNotif(locale, "newPostComment.body", { commentExcerpt }),
    linkUrl: `${SITE_URL}/feed/${postId}`,
  };
}

export function newQuestion(
  askerName: string,
  toolName: string,
  questionExcerpt: string,
  slug: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "newQuestion.title", { toolName }),
    body: tNotif(locale, "newQuestion.body", { askerName, questionExcerpt }),
    linkUrl: `${SITE_URL}/apps/${slug}#qa`,
  };
}

export function questionAnswered(
  toolName: string,
  slug: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "questionAnswered.title", { toolName }),
    body: tNotif(locale, "questionAnswered.body"),
    linkUrl: `${SITE_URL}/apps/${slug}#qa`,
  };
}

export function newRequestLink(
  toolName: string,
  requestTitle: string,
  requestId: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "newRequestLink.title"),
    body: tNotif(locale, "newRequestLink.body", { requestTitle, toolName }),
    linkUrl: `${SITE_URL}/requests#${requestId}`,
  };
}

export function likedToolOnSale(
  toolName: string,
  slug: string,
  oldPrice: string,
  newPrice: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "likedToolOnSale.title", { toolName }),
    body: tNotif(locale, "likedToolOnSale.body", { oldPrice, newPrice }),
    linkUrl: `${SITE_URL}/apps/${slug}`,
  };
}

export function toolUpdated(
  toolName: string,
  slug: string,
  version: string,
  changelog: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "toolUpdated.title", { toolName }),
    body: tNotif(locale, "toolUpdated.body", {
      version,
      changelog: changelog.slice(0, 200),
    }),
    linkUrl: `${SITE_URL}/apps/${slug}`,
  };
}

export function sellerAnnouncement(
  sellerName: string,
  sellerHandle: string,
  message: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "sellerAnnouncement.title", { sellerName }),
    body: tNotif(locale, "sellerAnnouncement.body", { message: message.slice(0, 300) }),
    linkUrl: `${SITE_URL}/u/${sellerHandle}`,
  };
}

export function tipReceived(
  tipperName: string,
  toolName: string,
  slug: string,
  amount: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "tipReceived.title", { tipperName }),
    body: tNotif(locale, "tipReceived.body", { toolName, amount }),
    linkUrl: `${SITE_URL}/apps/${slug}`,
  };
}

export function courseApproved(title: string, slug: string, locale: SupportedLocale): NotificationContent {
  return {
    title: tNotif(locale, "courseApproved.title", { title }),
    body: tNotif(locale, "courseApproved.body"),
    linkUrl: `${SITE_URL}/academy/courses/${slug}`,
  };
}

export function courseRejected(
  title: string,
  courseId: string,
  reason: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "courseRejected.title", { title }),
    body: tNotif(locale, "courseRejected.body", { reason: reason.slice(0, 300) }),
    linkUrl: `${SITE_URL}/academy/${courseId}/edit`,
  };
}

/** 管理者（Shuさん）宛：講座が審査に提出された */
export function adminCoursePending(title: string, authorName: string): NotificationContent {
  return {
    title: `📚 講座の審査依頼: ${title || "（タイトル未設定）"}`,
    body: `${authorName}さんが講座を審査に提出しました。`,
    linkUrl: `${SITE_URL}/admin/courses`,
  };
}

export function coursePurchaseReceipt(
  title: string,
  price: string,
  slug: string,
  locale: SupportedLocale
): NotificationContent {
  return {
    title: tNotif(locale, "coursePurchaseReceipt.title", { title }),
    body: tNotif(locale, "coursePurchaseReceipt.body", { price }),
    linkUrl: `${SITE_URL}/academy/courses/${slug}`,
    emailSubject: tNotif(locale, "coursePurchaseReceipt.title", { title }),
  };
}

/** 管理者（Shuさん）宛：講座の二重決済。Stripeの管理画面から返金が必要 */
export function adminCourseDoublePayment(title: string, paymentIntentId: string, amount: string): NotificationContent {
  return {
    title: `⚠️ 講座の二重決済（要・返金）: ${title}`,
    body: `同じ購入者が同じ講座に2回支払いました。Stripeで ${paymentIntentId}（${amount}）を返金してください。`,
    linkUrl: `https://dashboard.stripe.com/payments/${paymentIntentId}`,
  };
}
