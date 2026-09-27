import { getTranslations } from "next-intl/server";
import LegalPageContent from "@/components/LegalPageContent";

export async function generateMetadata() {
  const t = await getTranslations("legal");
  return { title: t("tokushohoTitle"), description: t("tokushohoDescription") };
}

// ============================================================
// ★要記入★
// 以下は実際の事業者情報に置き換えてください。
// 未記入のままでは法令上の表示義務を満たしません。
// ============================================================
const OPERATOR = {
  name: "後藤 脩", // 開業届を出す場合は屋号（BuildBay）も併記
  address: "220 台北市板橋區大觀路一段174巷138之2號2樓（台湾）",
  email: "supportbuildbay@gmail.com",
};

function row(label: string, contentHtml: string): string {
  return `
    <div class="grid grid-cols-1 gap-1 border-b border-border py-4 sm:grid-cols-[13rem_1fr] sm:gap-6">
      <dt class="font-medium text-text-primary">${label}</dt>
      <dd class="text-text-secondary">${contentHtml}</dd>
    </div>
  `;
}

const HTML = `
<h1>特定商取引法に基づく表記</h1>
<p class="text-[13px] text-text-muted">
  本表記は、BuildBay（以下「本サービス」）の運営者に関するものです。本サービス上で販売される各ツール、
  およびBuildBay Academyの各講座の販売者は、原則として当該ツール・講座を出品した個々の出品者です。
</p>

<dl class="mt-8 border-t border-border">
  ${row("サービス名", "BuildBay")}
  ${row("運営者", `<span translate="no">${OPERATOR.name}</span>`)}
  ${row("所在地", OPERATOR.address)}
  ${row(
    "電話番号",
    `<p>ご請求をいただいた場合、遅滞なく開示いたします。</p><p class="mt-1 text-[13px] text-text-muted">お問い合わせは原則としてメールにて受け付けております。</p>`
  )}
  ${row("メールアドレス", OPERATOR.email)}
  ${row("販売価格", "各ツール・各講座のページに表示された価格（消費税込み）によります。チップ（出品者への応援の送金）は、購入者が選んだ金額となります。")}
  ${row("商品代金以外の必要料金", "インターネット接続に必要な通信料金等は、お客様のご負担となります。")}
  ${row("支払方法", "クレジットカード決済（Apple Pay・Google Payを含む。決済代行事業者: Stripe, Inc.）")}
  ${row("支払時期", "購入手続きの完了時にお支払いが確定します。実際の請求時期はご利用のカード会社の規定によります。")}
  ${row(
    "商品の引渡時期",
    `<ul class="list-disc space-y-1 pl-5">
       <li>ツール: 決済完了後、直ちにダウンロード（クラウド型のツールは利用）が可能となります。</li>
       <li>講座（BuildBay Academy）: 決済完了後、直ちに有料部分を含む全文を閲覧できます。</li>
       <li>チップ: 出品者への任意の応援の送金であり、引き渡す商品はありません。</li>
     </ul>`
  )}
  ${row(
    "返品・キャンセルについて",
    `<p class="mb-2">商品の性質上（デジタルコンテンツ）、決済完了後の返品・返金は原則としてお受けしておりません。ただし、次の場合は、購入から14日以内にマイページの「トラブルを報告」からご連絡ください。出品者と協議のうえ、個別に対応いたします。</p>
     <ul class="list-disc space-y-1 pl-5">
       <li>出品者が商品ページで「場合によって返金あり」と表示しており、その条件に該当する場合</li>
       <li>商品がページの記載内容と著しく異なる場合、または重大な不具合により利用できない場合</li>
       <li>二重決済など、決済上の誤りがあった場合</li>
     </ul>
     <p class="mt-2">返金した場合、当該商品のダウンロード・閲覧はできなくなります。お客様のご利用環境（OS・バージョン等）が対応環境を満たさないことによる不動作は、返金の対象外となる場合があります。チップは、決済上の誤りを除き返金いたしません。</p>`
  )}
  ${row("動作環境", "各ツールのページに記載された対応OS・インターネット接続の要否・対応言語等をご確認のうえご購入ください。")}
</dl>

<p class="mt-10 text-[13px] text-text-muted">最終更新日: 2026年9月27日</p>
`;

export default function TokushohoPage() {
  return (
    <LegalPageContent
      slug="tokushoho"
      html={HTML}
      overrides={{
        // translate="no"により英語版でも「後藤 脩」のまま残るため、
        // DeepLのローマ字化（Osamu Goto等）に任せず、ここで確実に固定する。
        // 繁体字は漢字表記のままで自然なため、上書きしない。
        en: [[OPERATOR.name, "Shu Goto"]],
      }}
    />
  );
}
