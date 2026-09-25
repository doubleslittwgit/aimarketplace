"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { stripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COURSE_PURCHASE_ENABLED, COURSE_PLATFORM_FEE_RATE } from "@/lib/academy/flags";

/**
 * 講座の購入を始める（Stripeの決済画面へ移動する）。
 *
 * ツールの購入（app/apps/[slug]/checkout-actions.ts）と同じ原則で作っている:
 *   1. 金額はブラウザから受け取らず、必ずデータベースの価格を使う
 *   2. 購入記録はここでは作らない。Stripeから「支払い完了」の通知
 *      （Webhook）が届いて初めて作る（途中で離脱した人に全文を見せないため）
 */
export async function startCoursePurchase(courseId: string): Promise<{ error: string }> {
  const t = await getTranslations("academyCourse.errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, title, price, status, author_id, thumbnail_url")
    .eq("id", courseId)
    .maybeSingle();

  if (!course || course.status !== "published") return { error: t("notPurchasable") };
  if (!user) redirect(`/login?next=/academy/courses/${course.slug}`);
  if (course.price <= 0) return { error: t("notPurchasable") };
  if (!COURSE_PURCHASE_ENABLED) return { error: t("comingSoon") };
  if (course.author_id === user.id) return { error: t("ownCourse") };

  // すでに購入済みなら、決済に進まず講座へ戻す（二重に支払わせない）
  const { data: existing } = await supabase
    .from("course_purchases")
    .select("id")
    .eq("course_id", course.id)
    .eq("buyer_id", user.id)
    .eq("status", "completed")
    .maybeSingle();
  if (existing) redirect(`/academy/courses/${course.slug}`);

  // 販売部数の上限に達していたら売らない
  // （決済中に他の人が買って上限を超えることはありうる。その場合も支払い済みの購入は有効として記録する）
  const { data: stock } = await supabase.rpc("course_stock", { p_ids: [course.id] });
  const row = ((stock ?? []) as { remaining: number }[])[0];
  if (row && row.remaining <= 0) return { error: t("soldOut") };

  // 作者が売上を受け取れる状態か（seller_accounts は本人以外非公開なので管理者権限で読む）
  const { data: account } = await createAdminClient()
    .from("seller_accounts")
    .select("stripe_account_id, transfers_enabled, payouts_enabled")
    .eq("user_id", course.author_id)
    .maybeSingle();
  if (!account?.stripe_account_id || !account.transfers_enabled || !account.payouts_enabled) {
    return { error: t("sellerCannotReceive") };
  }

  const origin =
    (await headers()).get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const platformFee = Math.round(course.price * COURSE_PLATFORM_FEE_RATE);

  let checkoutUrl: string | null = null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "jpy",
            unit_amount: course.price,
            product_data: {
              name: course.title,
              ...(course.thumbnail_url?.startsWith("https://") ? { images: [course.thumbnail_url] } : {}),
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/academy/courses/${course.slug}?purchased=1`,
      cancel_url: `${origin}/academy/courses/${course.slug}`,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: { destination: account.stripe_account_id },
      },
      // Webhook側は kind を見て、ツールの購入・チップ・講座の購入を振り分ける
      metadata: {
        kind: "course",
        course_id: course.id,
        buyer_id: user.id,
        seller_id: course.author_id,
      },
    });
    checkoutUrl = session.url;
  } catch (e) {
    return { error: t("checkoutFailed", { message: e instanceof Error ? e.message : "unknown" }) };
  }

  if (!checkoutUrl) return { error: t("checkoutFailed", { message: "no url" }) };
  redirect(checkoutUrl);
}
