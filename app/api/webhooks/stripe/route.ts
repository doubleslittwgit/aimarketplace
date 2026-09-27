import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { sellerAccountFieldsFromStripe } from "@/lib/stripe/seller-account";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyAdmins } from "@/lib/notifications/create";
import { COURSE_PLATFORM_FEE_RATE } from "@/lib/academy/flags";
import { PLATFORM_FEE_RATE } from "@/lib/stripe/server";
import {
  coursePurchaseReceipt,
  sale as saleContent,
  purchaseReceipt,
  sellerAccountStatusChanged,
  tipReceived,
  adminDisputeCreated,
  adminDisputeClosed,
  adminRefundDetected,
  adminDoublePayment,
  adminPaymentMismatch,
  purchaseRefundedBuyer,
} from "@/lib/notifications/content";
import { findPaymentRecord, markPaymentRefunded, getRecordAccessSummary } from "@/lib/stripe/payment-records";
import { formatJst } from "@/lib/access-log";
import { termsAcceptedAt } from "@/lib/stripe/checkout-consent";
import { formatPrice } from "@/lib/mock-data";

/**
 * Stripeからの支払い完了通知を受け取る窓口。
 *
 * ここが決済システムで最も重要な部分。守るべき原則:
 *
 *   1. 署名検証を必ず行う
 *      これが無いと、誰でも「支払いが完了した」という偽の通知を送れてしまい、
 *      無料で商品を手に入れられる。
 *
 *   2. 冪等性を担保する
 *      Stripeは同じ通知を複数回送ることがある（正常な仕様）。
 *      二重に購入記録を作らないよう、既に処理済みなら何もしない。
 *
 *   3. 金額をDBと突き合わせる
 *      metadataの金額とDBの価格が食い違っていたら、改ざんの可能性がある。
 *
 *   4. service_roleキーを使う
 *      purchasesテーブルはRLSでクライアントからの書き込みを禁止している。
 *      Webhookはログインユーザーではないため、管理者権限で書き込む必要がある。
 */


export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  // Stripeでは「自分のアカウントのイベント」と「連結アカウント（出品者）のイベント」を
  // 別々の送信先で受け取ることがあり、送信先ごとに署名の鍵が違う。
  // そのため鍵は複数登録できるようにし、どれか1つで検証が通れば正規の通知とみなす。
  const webhookSecrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_2]
    .flatMap((v) => (v ?? "").split(","))
    .map((v) => v.trim())
    .filter(Boolean);

  if (!signature || webhookSecrets.length === 0) {
    return NextResponse.json(
      { error: "Webhookの署名設定が未完了です" },
      { status: 400 }
    );
  }


  // --- 1. 署名検証 ---
  // Stripe以外が送ってきた偽の通知をここで弾く。
  let verified: Stripe.Event | null = null;
  let lastError = "不明なエラー";
  for (const secret of webhookSecrets) {
    try {
      verified = stripe.webhooks.constructEvent(body, signature, secret);
      break;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "不明なエラー";
    }
  }
  if (!verified) {
    return NextResponse.json(
      { error: `署名の検証に失敗しました: ${lastError}` },
      { status: 400 }
    );
  }
  const event: Stripe.Event = verified;

  // --- テスト環境と本番環境の取り違えを防ぐ ---
  // 本番のキーで動いているのに「テスト環境の支払い」の通知が届いた（またはその逆）場合は無視する。
  // テスト用の送信先の鍵が残っていると、テストカードの支払いが本物の購入として記録されてしまうため。
  // 200を返す（エラーを返すとStripeが何度も再送してくるため）。
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  const serverIsLive = secretKey.startsWith("sk_live") || secretKey.startsWith("rk_live");
  if (event.livemode !== serverIsLive) {
    console.warn(
      `[webhook] 環境の異なる通知を無視しました: event.livemode=${event.livemode}, server=${serverIsLive ? "live" : "test"}, type=${event.type}, id=${event.id}`
    );
    return NextResponse.json({ received: true, ignored: "mode_mismatch" });
  }

  // --- 出品者（連結アカウント）の審査状況が変わったとき ---
  // 本人確認が通った、追加情報が必要になった、入金が止められた等で届く。
  // ここで更新しておかないと、出品者の画面が古い状態のままになる。
  //
  // 対象の特定には、署名検証済みのイベントに含まれる account.id だけを使う。
  // ユーザーから渡された値は一切使わないため、なりすましの余地がない。
  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const admin = createAdminClient();

    // 通知を出すかどうかの判定に使うため、更新前の状態を先に取得しておく
    const { data: before } = await admin
      .from("seller_accounts")
      .select("user_id, transfers_enabled, payouts_enabled, requirements_due")
      .eq("stripe_account_id", account.id)
      .maybeSingle();

    const newFields = sellerAccountFieldsFromStripe(account);

    const { error } = await admin
      .from("seller_accounts")
      .update(newFields)
      .eq("stripe_account_id", account.id);

    if (error) {
      console.error("[webhook] 出品者情報の更新に失敗:", error.message);
      return NextResponse.json(
        { error: `出品者情報の更新に失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    // Stripeはこのイベントを些細な変更でも頻繁に送ってくるため、
    // 「受け取り可否」や「追加情報の要否」が実際に変わった時だけ通知する。
    if (before) {
      const wasEnabled = before.transfers_enabled && before.payouts_enabled;
      const isEnabled = newFields.transfers_enabled && newFields.payouts_enabled;
      const hadRequirements = (before.requirements_due?.length ?? 0) > 0;
      const hasRequirements = (newFields.requirements_due?.length ?? 0) > 0;

      if (!wasEnabled && isEnabled) {
        await notify(
          before.user_id,
          "seller_account_status_changed",
          (locale) => sellerAccountStatusChanged("enabled", locale)
        );
      } else if (wasEnabled && !isEnabled) {
        await notify(
          before.user_id,
          "seller_account_status_changed",
          (locale) => sellerAccountStatusChanged("disabled", locale)
        );
      } else if (!hadRequirements && hasRequirements) {
        await notify(
          before.user_id,
          "seller_account_status_changed",
          (locale) => sellerAccountStatusChanged("requirements_due", locale)
        );
      }
    }

    return NextResponse.json({ received: true });
  }

  // --- 返金 ---
  // BuildBayの返金ボタンで返金した場合は、記録はその場で「返金済み」にしているので何もしない。
  // それ以外（Stripeの画面から直接返金された等）の場合は、購入者の権限を外したうえで、
  // 出品者への送金が取り消されているか確認するよう管理者に知らせる。
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    // 一部だけの返金では権限を外さない（全額返金されたときだけ）
    if (!charge.refunded) return NextResponse.json({ received: true, skipped: "partial" });
    const paymentIntentId =
      typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (!paymentIntentId) return NextResponse.json({ received: true });

    const admin = createAdminClient();
    const record = await findPaymentRecord(admin, paymentIntentId);
    if (!record || record.status === "refunded") {
      return NextResponse.json({ received: true });
    }
    const { error } = await markPaymentRefunded(admin, record);
    if (error) {
      console.error("[webhook] 返金の反映に失敗:", error);
      return NextResponse.json({ error: `返金の反映に失敗しました: ${error}` }, { status: 500 });
    }
    // BuildBayの返金ボタンからの返金なら、記録の更新より通知が先に届いただけなので、管理者には知らせない
    const refunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 10 });
    if (refunds.data.some((r) => r.metadata?.source === "buildbay_admin")) {
      return NextResponse.json({ received: true });
    }
    await notifyAdmins(
      "admin_refund_detected",
      adminRefundDetected({
        paymentIntentId,
        itemName: record.itemName,
        amount: formatPrice(record.amount),
        livemode: event.livemode,
      })
    );
    return NextResponse.json({ received: true });
  }

  // --- チャージバック（購入者がカード会社に支払いの取り消しを申し立てた） ---
  // この決済方式では、チャージバックの責任はBuildBay（プラットフォーム）側にある。
  // 期限内に証拠を出さないと自動的に負けるため、すぐ管理者に知らせる。
  if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
    const dispute = event.data.object as Stripe.Dispute;
    const paymentIntentId =
      typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
    const admin = createAdminClient();
    const record = paymentIntentId ? await findPaymentRecord(admin, paymentIntentId) : null;
    const itemName = record?.itemName ?? "（不明な支払い）";
    const amount = formatPrice(dispute.amount);

    if (event.type === "charge.dispute.created") {
      const dueBy = dispute.evidence_details?.due_by
        ? `${new Date(dispute.evidence_details.due_by * 1000).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}（日本時間）`
        : null;
      // 証拠として出せる記録（購入者が商品を受け取った日時・IPアドレス、決済時の規約同意）をまとめて知らせる
      let evidence: string | null = null;
      if (record) {
        const summary = await getRecordAccessSummary(admin, record);
        const lines = [
          summary && summary.count > 0
            ? `・購入後の受け取り（ダウンロード・利用・閲覧）: ${summary.count}回（初回 ${formatJst(summary.first)}、最終 ${formatJst(summary.last)}${summary.lastIp ? `、最終IP ${summary.lastIp}` : ""}）`
            : "・購入後の受け取りの記録: なし",
          record.termsAcceptedAt
            ? `・決済時に利用規約（デジタルコンテンツのため原則返金不可）へ同意: ${formatJst(record.termsAcceptedAt)}`
            : "・決済時の規約同意の記録: なし",
          `・支払いID: ${paymentIntentId}`,
        ];
        evidence = lines.join("\n");
      }
      await notifyAdmins(
        "admin_dispute",
        adminDisputeCreated({
          disputeId: dispute.id,
          amount,
          reason: dispute.reason,
          itemName,
          dueBy,
          livemode: event.livemode,
          evidence,
        })
      );
      return NextResponse.json({ received: true });
    }

    // 結果が出た。負けた場合はお金が購入者に戻されているので、購入者の権限を外し、
    // 出品者に送った売上も取り戻す（取り戻さないと、出品者の取り分までBuildBayが負担することになる）
    const won = dispute.status === "won";
    let reversalNote: string | null = null;
    if (!won && dispute.status === "lost") {
      if (record && record.status !== "refunded") {
        const { error } = await markPaymentRefunded(admin, record);
        if (error) console.error("[webhook] チャージバック敗北の反映に失敗:", error);
      }
      reversalNote = await reverseSellerTransfer(dispute);
    }
    if (dispute.status === "won" || dispute.status === "lost") {
      const closed = adminDisputeClosed({ disputeId: dispute.id, won, itemName, amount, livemode: event.livemode });
      await notifyAdmins(
        "admin_dispute",
        reversalNote ? { ...closed, body: `${closed.body}\n${reversalNote}` } : closed
      );
    }
    return NextResponse.json({ received: true });
  }

  // 支払い完了以外のイベントは、受け取ったことだけ伝えて何もしない。
  // （カード払いのみに限定しているが、後払い系の支払い方法が有効になっていた場合に備え、
  //  「後から支払いが完了した」通知も支払い完了として扱う）
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // 支払いが実際に完了していないセッションは無視する
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, skipped: "unpaid" });
  }

  const meta = session.metadata ?? {};

  // チップ（投げ銭）は購入とは別物なので、先に分岐して処理する。
  // 購入フローに混ぜると「購入済み扱い」になってしまい、
  // 無料ツールにチップしただけの人がダウンロード権限を得るなど、
  // 権限の判定が壊れてしまうため。
  if (meta.kind === "tip") {
    return handleTip(session, meta);
  }

  // 講座（BuildBay Academy）の購入も、ツールの購入記録（purchases）とは別の表に記録する。
  // 混ぜるとツールのダウンロード権限や分析に講座が紛れ込むため。
  if (meta.kind === "course") {
    return handleCoursePurchase(session, meta);
  }

  const toolId = meta.tool_id;
  const buyerId = meta.buyer_id;
  const sellerId = meta.seller_id;

  if (!toolId || !buyerId || !sellerId) {
    return NextResponse.json(
      { error: "必要な情報がセッションに含まれていません" },
      { status: 400 }
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!paymentIntentId) {
    return NextResponse.json(
      { error: "支払いIDを特定できませんでした" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // --- 2. 冪等性の担保 ---
  // 同じ支払いに対する通知が再送されても、記録は1つだけにする。
  const { data: alreadyRecorded, error: idempotencyError } = await supabase
    .from("purchases")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (idempotencyError) {
    // ここでエラーを握りつぶすと「ツールが見つかりません」等の誤解を招くメッセージになり、
    // 本当の原因（例: SUPABASE_SERVICE_ROLE_KEYが無効）が分からなくなる。
    console.error("[webhook] 購入記録の重複確認に失敗:", idempotencyError.message);
    return NextResponse.json(
      { error: `重複確認に失敗しました: ${idempotencyError.message}` },
      { status: 500 }
    );
  }

  if (alreadyRecorded) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // --- 3. 金額の再検証 ---
  // ブラウザ経由の値ではなく、DBの正規の価格を信頼する。
  const { data: tool, error: toolFetchError } = await supabase
    .from("tools")
    .select("id, name, slug, price, sale_price, author_id")
    .eq("id", toolId)
    .maybeSingle();

  if (toolFetchError) {
    console.error("[webhook] ツール情報の取得に失敗:", toolFetchError.message);
    return NextResponse.json(
      { error: `ツール情報の取得に失敗しました: ${toolFetchError.message}` },
      { status: 500 }
    );
  }

  if (!tool) {
    console.error(`[webhook] ツールが見つかりません: tool_id=${toolId}`);
    return NextResponse.json({ error: "ツールが見つかりません" }, { status: 400 });
  }

  // 実際にStripeで支払われた金額と、DB上の価格が一致するか確認する。
  // 通常価格・セール価格のどちらでの購入も正当としたい。「決済開始時点では
  // セール中だったが、Webhook処理までの間にセールが終了していた」という
  // タイミングのズレでも正規の購入を弾いてしまわないよう、sale_priceは
  // 期限を問わず「設定されていれば許容する価格」として扱う
  // （sale_priceの値自体はDBの正規の値であり、ブラウザからは改変できないため安全）。
  //
  // 【価格が途中で変わった場合】
  // 購入者がStripeの支払い画面にいる間（最長24時間）に出品者が価格を変えると、
  // 支払額とDBの今の価格が食い違う。ここで記録を拒むと「代金を払ったのに商品が届かない」
  // 状態になり、Stripeの再送も失敗し続けるため、決済を作った時点の価格（metadata.price。
  // サーバー側で設定した値で、署名検証済みの通知に含まれるため改ざんできない）とも照合する。
  // それでも一致しない場合も、購入者は実際に代金を支払っているので記録したうえで、管理者に確認を促す。
  const amountPaid = session.amount_total ?? 0;
  const priceAtCheckout = Number(meta.price);
  const validAmounts = [tool.price, tool.sale_price, Number.isFinite(priceAtCheckout) ? priceAtCheckout : null].filter(
    (v): v is number => v != null
  );
  const amountMismatch = !validAmounts.includes(amountPaid);
  if (amountMismatch) {
    console.error(
      `[webhook] 金額の不一致を検出（記録は行う）: 支払額=${amountPaid}, 決済時=${meta.price}, DB価格=${tool.price}, セール価格=${tool.sale_price}, tool=${toolId}`
    );
  }

  // 出品者が途中で変わっている等の不整合も確認する
  if (tool.author_id !== sellerId) {
    console.error(`[webhook] 出品者の不一致を検出: tool=${toolId}`);
    return NextResponse.json({ error: "出品者情報が一致しません" }, { status: 400 });
  }

  // 手数料はここで再計算する（metadataの値をそのまま信用しない）。
  // 「DBの現在価格」ではなく「実際にStripeで支払われた金額」を基準にする
  // （セール価格での購入の場合、tool.priceは通常価格のままなので、
  //  これを基準にすると手数料も出品者の取り分もズレてしまう）。
  const platformFee = Math.round(amountPaid * PLATFORM_FEE_RATE);
  const sellerEarnings = amountPaid - platformFee;

  // --- 4. 購入記録の作成 ---
  const { error: insertError } = await supabase.from("purchases").insert({
    tool_id: tool.id,
    buyer_id: buyerId,
    seller_id: sellerId,
    price_paid: amountPaid,
    platform_fee: platformFee,
    seller_earnings: sellerEarnings,
    stripe_payment_intent_id: paymentIntentId,
    status: "completed",
    // 決済画面で利用規約（原則返金不可）に同意した日時。チャージバックの証拠になる
    terms_accepted_at: termsAcceptedAt(session),
    completed_at: new Date().toISOString(),
  });

  if (insertError) {
    // purchases_one_completed_per_buyer_tool（DBのユニーク制約）に
    // ひっかかった場合は、他の話と性質が違うので分けて扱う。
    //
    // これは「同じ買い手が同じツールをほぼ同時に2回購入し、
    // 2つの独立した支払いが両方とも成立してしまった」ケース。
    // Stripe上では既に実際にお金が動いてしまっているため、
    // 500を返してStripeに再送させても解決しない
    // （再送してもこのセッションの支払い自体は既に完了済みで、
    //  再試行のたびに同じ理由で失敗し続けるだけ）。
    //
    // 代わりに、返金対応が必要な事象として大きくログに残した上で
    // 200を返し、Stripeの再送ループを止める。
    if (insertError.code === "23505") {
      // 重複には2種類ある。
      // (1) 同じ支払いの通知がほぼ同時に2回届いた（先に確認した時点ではまだ記録が無かった）→ 何もしない
      const { data: samePayment } = await supabase
        .from("purchases")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();
      if (samePayment) return NextResponse.json({ received: true, duplicate: true });
      // (2) 同じ人が同じツールに、別々の支払いを2回した（実際にお金が2回動いている）→ 2回目を自動で返金する
      console.error(
        `[webhook] ⚠️ 二重決済を検出（自動返金）: tool=${toolId}, buyer=${buyerId}, payment_intent=${paymentIntentId}, amount=${amountPaid}`
      );
      await refundDuplicatePayment({ paymentIntentId, buyerId, itemName: tool.name, amount: amountPaid });
      return NextResponse.json({ received: true, duplicate: "refunded" });
    }

    // ここで失敗すると「支払ったのに購入記録が無い」状態になる。
    // 500を返すとStripeが自動で再送してくれるので、あえてエラーにする。
    console.error("[webhook] 購入記録の作成に失敗:", insertError.message);
    return NextResponse.json(
      { error: `購入記録の作成に失敗: ${insertError.message}` },
      { status: 500 }
    );
  }

  if (amountMismatch) {
    await notifyAdmins(
      "admin_payment_mismatch",
      adminPaymentMismatch({
        itemName: tool.name,
        paymentIntentId,
        paid: formatPrice(amountPaid),
        expected: validAmounts.map((v) => formatPrice(v)).join(" / "),
      })
    );
  }

  // インストール数を増やす（失敗しても購入自体は成立しているので、エラーにはしない）
  const { error: rpcError } = await supabase.rpc("increment_install_count", {
    p_tool_id: tool.id,
  });
  if (rpcError) {
    console.error("[webhook] インストール数の更新に失敗:", rpcError.message);
  }

  // 出品者・購入者への通知。失敗しても購入自体の成立には影響させない。
  const { data: buyerProfile } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("id", buyerId)
    .maybeSingle();
  const buyerName =
    buyerProfile?.display_name || buyerProfile?.handle || "購入者";

  await notify(
    sellerId,
    "sale",
    (locale) => saleContent(tool.name, buyerName, formatPrice(sellerEarnings), locale)
  );
  await notify(
    buyerId,
    "purchase_receipt",
    (locale) => purchaseReceipt(tool.name, formatPrice(amountPaid), tool.slug, locale),
    { email: true }
  );

  return NextResponse.json({ received: true, recorded: true });
}

/**
 * チップ（投げ銭）の支払い完了を記録する。
 *
 * 購入と違い、ダウンロード権限などには一切影響しない。
 * 「出品者にお礼が届いた」という記録と、出品者への通知だけを行う。
 */
async function handleTip(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>
): Promise<NextResponse> {
  const supabase = createAdminClient();

  const toolId = meta.tool_id;
  const tipperId = meta.tipper_id;
  const sellerId = meta.seller_id;
  if (!tipperId || !sellerId) {
    return NextResponse.json(
      { error: "チップに必要な情報が含まれていません" },
      { status: 400 }
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) {
    return NextResponse.json({ error: "支払いIDを特定できませんでした" }, { status: 400 });
  }

  // 実際に支払われた額を正とする（metadataの値は参考情報として扱う）
  const amountPaid = session.amount_total ?? 0;
  if (amountPaid <= 0) {
    return NextResponse.json({ error: "金額が不正です" }, { status: 400 });
  }
  const platformFee = Math.round(amountPaid * PLATFORM_FEE_RATE);

  const { error: insertError } = await supabase.from("tips").insert({
    tool_id: toolId || null,
    seller_id: sellerId,
    tipper_id: tipperId,
    amount: amountPaid,
    platform_fee: platformFee,
    seller_earnings: amountPaid - platformFee,
    stripe_payment_intent_id: paymentIntentId,
    status: "completed",
    // 決済画面で利用規約（原則返金不可）に同意した日時。チャージバックの証拠になる
    terms_accepted_at: termsAcceptedAt(session),
  });

  if (insertError) {
    // 同じ支払いを二重に記録しようとした場合（Stripeの再送など）は成功扱いにする
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[webhook] チップの記録に失敗:", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 出品者に知らせる
  const { data: tipperProfile } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("id", tipperId)
    .maybeSingle();
  const tipperName =
    tipperProfile?.display_name || tipperProfile?.handle || "どなたか";

  const { data: tool } = await supabase
    .from("tools")
    .select("name, slug")
    .eq("id", toolId)
    .maybeSingle();

  await notify(sellerId, "tip_received", (locale) =>
    tipReceived(
      tipperName,
      tool?.name ?? "",
      tool?.slug ?? "",
      formatPrice(amountPaid),
      locale
    )
  );

  return NextResponse.json({ received: true });
}

/**
 * 講座の購入を記録する（Stripeから「支払い完了」の通知が届いた時だけ呼ばれる）。
 *
 * 金額・手数料・受取人は、ブラウザ経由の情報（metadata）を信用せず、
 * データベースの講座と、Stripeが実際に受け取った金額から決める。
 */
async function handleCoursePurchase(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>
): Promise<NextResponse> {
  const supabase = createAdminClient();
  const courseId = meta.course_id;
  const buyerId = meta.buyer_id;
  if (!courseId || !buyerId) {
    return NextResponse.json({ error: "講座の購入情報が不足しています" }, { status: 400 });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!paymentIntentId) {
    return NextResponse.json({ error: "支払いIDを特定できませんでした" }, { status: 400 });
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, slug, price, author_id")
    .eq("id", courseId)
    .maybeSingle();
  if (!course) {
    return NextResponse.json({ error: "講座が見つかりません" }, { status: 400 });
  }

  // 実際に支払われた額が、講座の価格と一致するか確認する。
  // 支払い画面にいる間に作者が価格を変えることがあるため、決済を作った時点の価格（metadata.price）とも照合し、
  // それでも一致しない場合も、代金は支払われているので記録したうえで管理者に確認を促す
  const amountPaid = session.amount_total ?? 0;
  const priceAtCheckout = Number(meta.price);
  const amountMismatch = amountPaid !== course.price && amountPaid !== priceAtCheckout;
  if (amountMismatch) {
    console.error(
      `[webhook] 講座の金額不一致（記録は行う）: 支払額=${amountPaid}, 決済時=${meta.price}, 価格=${course.price}, course=${courseId}`
    );
  }

  const platformFee = Math.round(amountPaid * COURSE_PLATFORM_FEE_RATE);
  const sellerEarnings = amountPaid - platformFee;

  const { error: insertError } = await supabase.from("course_purchases").insert({
    course_id: course.id,
    buyer_id: buyerId,
    // 受取人は metadata ではなく、講座の作者（DBの値）を正とする
    seller_id: course.author_id,
    price_paid: amountPaid,
    platform_fee: platformFee,
    seller_earnings: sellerEarnings,
    stripe_payment_intent_id: paymentIntentId,
    status: "completed",
    // 決済画面で利用規約（原則返金不可）に同意した日時。チャージバックの証拠になる
    terms_accepted_at: termsAcceptedAt(session),
  });

  if (insertError) {
    if (insertError.code === "23505") {
      // 重複には2種類ある。区別しないと、本当の二重決済を見逃してしまう。
      const { data: samePayment } = await supabase
        .from("course_purchases")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();
      if (samePayment) {
        // (1) Stripeが同じ通知を再送してきただけ。既に記録済みなので何もしない
        return NextResponse.json({ received: true, duplicate: true });
      }
      // (2) 同じ人が同じ講座に、別々の支払いを2回してしまった（実際にお金が2回動いている）。
      //     2回目の支払いを自動で返金する（出品者への送金・手数料も取り消す）
      console.error(
        `[webhook] ⚠️ 講座の二重決済（自動返金）: course=${courseId}, buyer=${buyerId}, payment_intent=${paymentIntentId}`
      );
      await refundDuplicatePayment({ paymentIntentId, buyerId, itemName: course.title, amount: amountPaid });
      return NextResponse.json({ received: true, duplicate: "refunded" });
    }
    // 「支払ったのに購入記録が無い」状態を避けるため、500を返してStripeに再送させる
    console.error("[webhook] 講座の購入記録の作成に失敗:", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (amountMismatch) {
    await notifyAdmins(
      "admin_payment_mismatch",
      adminPaymentMismatch({
        itemName: course.title,
        paymentIntentId,
        paid: formatPrice(amountPaid),
        expected: formatPrice(course.price),
      })
    );
  }

  const { data: buyerProfile } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("id", buyerId)
    .maybeSingle();
  const buyerName = buyerProfile?.display_name || buyerProfile?.handle || "購入者";

  await notify(course.author_id, "sale", (locale) =>
    saleContent(course.title, buyerName, formatPrice(sellerEarnings), locale)
  );
  await notify(buyerId, "purchase_receipt", (locale) =>
    coursePurchaseReceipt(course.title, formatPrice(amountPaid), course.slug, locale)
  );

  return NextResponse.json({ received: true });
}

/**
 * 二重決済の2回目の支払いを全額返金する。
 * 出品者への送金（reverse_transfer）とBuildBayの手数料（refund_application_fee）も取り消すので、
 * 誰の負担も残らない（Stripeの決済手数料を除く）。同じ支払いを二重に返金しないよう冪等キーを付ける。
 */
async function refundDuplicatePayment(params: {
  paymentIntentId: string;
  buyerId: string;
  itemName: string;
  amount: number;
}): Promise<void> {
  const { paymentIntentId, buyerId, itemName, amount } = params;
  try {
    // 同じ通知が再送されてきた場合は、すでに返金済みなので何もしない（通知も二重に送らない）
    const existing = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 10 });
    if (existing.data.some((r) => r.status !== "failed" && r.status !== "canceled")) return;

    await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
        reason: "duplicate",
        metadata: { source: "buildbay_duplicate" },
      },
      { idempotencyKey: `buildbay-duplicate-refund-${paymentIntentId}` }
    );
    await notify(buyerId, "purchase_refunded", (locale) =>
      purchaseRefundedBuyer(itemName, formatPrice(amount), locale)
    );
    await notifyAdmins(
      "admin_double_payment",
      adminDoublePayment({ itemName, paymentIntentId, amount: formatPrice(amount), refunded: true })
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook] 二重決済の自動返金に失敗:", message);
    await notifyAdmins(
      "admin_double_payment",
      adminDoublePayment({ itemName, paymentIntentId, amount: formatPrice(amount), refunded: false, error: message })
    );
  }
}

/**
 * チャージバックに負けたとき、出品者に送った売上を取り戻す。
 * 戻り値は管理者への通知に添える一文（取り戻せなかった場合は、その理由）。
 */
async function reverseSellerTransfer(dispute: Stripe.Dispute): Promise<string | null> {
  try {
    const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;
    if (!chargeId) return null;
    const charge = await stripe.charges.retrieve(chargeId);
    const transferId = typeof charge.transfer === "string" ? charge.transfer : charge.transfer?.id;
    if (!transferId) return "出品者への送金が見つからないため、売上の取り戻しは行っていません。";
    const transfer = await stripe.transfers.retrieve(transferId);
    const remaining = transfer.amount - transfer.amount_reversed;
    if (remaining <= 0) return "出品者への送金は、すでに取り消されています。";
    // 一部の金額だけの申し立ての場合は、その割合の分だけ取り戻す
    const share =
      charge.amount > 0 ? Math.round((transfer.amount * Math.min(dispute.amount, charge.amount)) / charge.amount) : remaining;
    const toReverse = Math.min(remaining, share);
    if (toReverse <= 0) return null;
    await stripe.transfers.createReversal(
      transferId,
      { amount: toReverse, metadata: { source: "buildbay_dispute_lost", dispute: dispute.id } },
      { idempotencyKey: `buildbay-dispute-reversal-${dispute.id}` }
    );
    return `出品者に送った売上（${formatPrice(toReverse)}）を取り戻しました。`;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook] チャージバック敗北時の売上の取り戻しに失敗:", message);
    return `⚠️ 出品者に送った売上の取り戻しに失敗しました（Stripeの「送金」から手動で取り消してください）: ${message}`;
  }
}
