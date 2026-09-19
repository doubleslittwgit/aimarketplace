import { getTranslations } from "next-intl/server";
import LegalPageContent from "@/components/LegalPageContent";

export async function generateMetadata() {
  const t = await getTranslations("legal");
  return { title: t("contactTitle"), description: t("contactDescription") };
}

// 実際の問い合わせ用メールアドレス
const CONTACT_EMAIL = "supportbuildbay@gmail.com";

const HTML = `
<h1>お問い合わせ</h1>

<p class="mt-8">
  本サービスに関するお問い合わせは、下記のメールアドレスにて承っております。
  内容を確認のうえ、通常3営業日以内にご返信いたします。
</p>

<div class="my-8 rounded-xl border border-border bg-surface p-6">
  <p class="mb-1 text-[13px] text-text-muted">メールアドレス</p>
  <p class="font-mono text-lg text-text-primary">${CONTACT_EMAIL}</p>
</div>

<h2>お問い合わせの前に</h2>
<p>次の内容は、ご自身で解決いただける場合があります。</p>

<h3>購入したツールをダウンロードしたい</h3>
<p>
  <a href="/dashboard">ダッシュボード</a>
  の「購入したツール」からいつでもダウンロードできます。
  出品者がツールを非公開にした場合でも、購入済みのツールは引き続きダウンロード可能です。
</p>

<h3>有料でツールを販売したい</h3>
<p>
  <a href="/seller">受け取り設定</a>
  から、売上の受取口座を設定してください。設定が完了すると、有料での出品が可能になります。
</p>

<h3>出品したツールが「審査中」のまま</h3>
<p>
  出品されたツールは、公開前に内容の確認を行っています。
  通常は1〜2営業日以内に結果をお知らせします。
</p>

<h2>ご連絡いただく際のお願い</h2>
<ul>
  <li>ご登録のメールアドレスからお送りください</li>
  <li>特定のツールに関するお問い合わせの場合は、ツール名またはページのURLをお知らせください</li>
  <li>不具合のご報告は、お使いのOS・ブラウザと、発生時の状況を添えていただけると助かります</li>
</ul>

<h2>権利侵害に関するご連絡</h2>
<p>
  出品されているツールが著作権その他の権利を侵害していると思われる場合は、
  該当ツールのURL、侵害されている権利の内容、およびご連絡先を明記のうえ、
  上記メールアドレスまでご連絡ください。確認のうえ、必要な対応を行います。
</p>
`;

export default function ContactPage() {
  return <LegalPageContent slug="contact" html={HTML} />;
}
