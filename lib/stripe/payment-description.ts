/**
 * Stripeの管理画面（取引の一覧・支払いの詳細）で「何の支払いか」がひと目でわかるように、
 * 支払い（PaymentIntent）に付ける説明とメタデータを作る。
 *
 * - description … 一覧の「説明」欄に出る（例: 「ツール購入｜かんたん動画トリマー」）
 * - metadata    … 支払いの詳細ページに出る。Checkoutセッションのメタデータは支払い側には
 *                 引き継がれないため、問い合わせ・チャージバック対応で使う最低限の情報を支払いにも付ける。
 *
 * 購入者の名前やメールアドレスは入れない（Stripe側でもともと顧客情報として持っている）。
 */

export type PaymentDescriptionKind = "tool" | "course" | "tip";

const LABEL: Record<PaymentDescriptionKind, string> = {
  tool: "ツール購入",
  course: "講座購入",
  tip: "チップ",
};

export function paymentIntentDetails(input: {
  kind: PaymentDescriptionKind;
  itemName: string;
  itemId: string;
  buyerId: string;
  sellerId: string;
}): { description: string; metadata: Record<string, string> } {
  const name = input.itemName.replace(/\s+/g, " ").trim() || "—";
  // Stripeの description は最大1000文字。一覧で読める長さに切り詰める
  const shortName = name.length > 120 ? `${name.slice(0, 119)}…` : name;
  return {
    description: `BuildBay ${LABEL[input.kind]}｜${shortName}`,
    metadata: {
      kind: input.kind,
      item_id: input.itemId,
      item_name: shortName,
      buyer_id: input.buyerId,
      seller_id: input.sellerId,
    },
  };
}
