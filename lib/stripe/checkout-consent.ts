import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";

/**
 * 決済画面で「利用規約（デジタルコンテンツのため原則返金不可）」への同意を必須にして、
 * Stripeの決済セッションを作る。
 *
 * 同意の記録は、チャージバック（カード会社への申し立て）で「購入者は条件を知ったうえで買った」
 * ことを示す証拠になる。Stripe側にも同意の事実（session.consent）が残る。
 *
 * 注意: 同意チェックを出すには、Stripeダッシュボードの「設定 → ビジネス → 公開情報」に
 * 利用規約のURLが登録されている必要がある。未登録だとStripeがエラーを返すため、その場合だけは
 * 同意チェック無しで作り直し、購入自体は止めない（ログに設定漏れを残す）。
 */

type Kind = "purchase" | "tip";

const TERMS_URL = "https://www.getbuildbay.com/legal/terms";

const TEXT: Record<string, Record<Kind, { consent: string; submit: string }>> = {
  ja: {
    purchase: {
      consent: `[利用規約](${TERMS_URL})に同意します。デジタルコンテンツのため、購入後の返金は原則としてお受けしていません。`,
      submit: "お支払い後すぐにダウンロード・閲覧できます。デジタルコンテンツのため、購入後の返金は原則としてお受けしていません。",
    },
    tip: {
      consent: `[利用規約](${TERMS_URL})に同意します。チップは出品者への応援の送金で、決済の誤りを除き返金されません。`,
      submit: "チップは出品者への応援の送金です。決済の誤りを除き返金されません。",
    },
  },
  zh: {
    purchase: {
      consent: `我同意[使用條款](${TERMS_URL})。由於是數位內容，購買後原則上不接受退款。`,
      submit: "付款後即可立即下載或閱讀。由於是數位內容，購買後原則上不接受退款。",
    },
    tip: {
      consent: `我同意[使用條款](${TERMS_URL})。小費是給賣家的支持款項，除付款錯誤外不予退款。`,
      submit: "小費是給賣家的支持款項，除付款錯誤外不予退款。",
    },
  },
  en: {
    purchase: {
      consent: `I agree to the [Terms of Service](${TERMS_URL}). As this is digital content, purchases are generally non-refundable.`,
      submit: "You can download or read it right after payment. As this is digital content, purchases are generally non-refundable.",
    },
    tip: {
      consent: `I agree to the [Terms of Service](${TERMS_URL}). Tips support the seller and are non-refundable except for payment errors.`,
      submit: "Tips support the seller and are non-refundable except for payment errors.",
    },
  },
};

/**
 * 現地通貨での支払い（Adaptive Pricing）は使わない。
 * ダッシュボードで有効になっていても、この決済画面では必ず日本円で請求する。
 * 理由: 購入の記録・金額の照合（Webhook）・出品者への送金・返金がすべて円を前提にしているため。
 * 海外の人向けの通貨は、サイト上の「約NT$」などの目安表示で案内している（lib/currency）。
 */
const NO_ADAPTIVE_PRICING = { adaptive_pricing: { enabled: false } } as const;

export async function createCheckoutSessionWithConsent(
  params: Stripe.Checkout.SessionCreateParams,
  kind: Kind,
  locale: string
): Promise<Stripe.Checkout.Session> {
  const text = (TEXT[locale] ?? TEXT.ja)[kind];
  try {
    return await stripe.checkout.sessions.create({
      ...params,
      ...NO_ADAPTIVE_PRICING,
      consent_collection: { terms_of_service: "required" },
      custom_text: {
        terms_of_service_acceptance: { message: text.consent },
        submit: { message: text.submit },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!/terms of service/i.test(message)) throw e;
    console.error(
      "[checkout] 利用規約への同意チェックを出せませんでした。Stripeダッシュボードの「公開情報」に利用規約のURLを登録してください:",
      message
    );
    // 同意チェックは付けられないが、返金についての案内だけは表示して購入を続ける
    return stripe.checkout.sessions.create({
      ...params,
      ...NO_ADAPTIVE_PRICING,
      custom_text: { submit: { message: text.submit } },
    });
  }
}

/** 決済完了の通知（Checkout Session）から、規約への同意の日時を取り出す */
export function termsAcceptedAt(session: Stripe.Checkout.Session): string | null {
  // 通知の処理が遅れたり再送されたりしても、実際に決済した時刻に近い値になるよう、
  // 処理した時刻ではなく決済画面が作られた時刻を使う（同意は決済の直前に行われる）
  if (session.consent?.terms_of_service !== "accepted") return null;
  const created = typeof session.created === "number" ? session.created * 1000 : Date.now();
  return new Date(created).toISOString();
}
