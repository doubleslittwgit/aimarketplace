import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { sellerAccountFieldsFromStripe } from "@/lib/stripe/seller-account";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhookの署名設定が未完了です" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  // --- 1. 署名検証 ---
  // Stripe以外が送ってきた偽の通知をここで弾く。
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "不明なエラー";
    return NextResponse.json(
      { error: `署名の検証に失敗しました: ${message}` },
      { status: 400 }
    );
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

    const { error } = await admin
      .from("seller_accounts")
      .update(sellerAccountFieldsFromStripe(account))
      .eq("stripe_account_id", account.id);

    if (error) {
      console.error("[webhook] 出品者情報の更新に失敗:", error.message);
      return NextResponse.json(
        { error: `出品者情報の更新に失敗しました: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  }

  // 支払い完了以外のイベントは、受け取ったことだけ伝えて何もしない
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // 支払いが実際に完了していないセッションは無視する
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true, skipped: "unpaid" });
  }

  const meta = session.metadata ?? {};
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
    .select("id, price, author_id")
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

  // 実際にStripeで支払われた金額と、DB上の価格が一致するか確認する
  const amountPaid = session.amount_total ?? 0;
  if (amountPaid !== tool.price) {
    // 一致しない場合は記録せず、調査できるようログに残す
    console.error(
      `[webhook] 金額の不一致を検出: 支払額=${amountPaid}, DB価格=${tool.price}, tool=${toolId}`
    );
    return NextResponse.json(
      { error: "支払金額が商品価格と一致しません" },
      { status: 400 }
    );
  }

  // 出品者が途中で変わっている等の不整合も確認する
  if (tool.author_id !== sellerId) {
    console.error(`[webhook] 出品者の不一致を検出: tool=${toolId}`);
    return NextResponse.json({ error: "出品者情報が一致しません" }, { status: 400 });
  }

  // 手数料はここで再計算する（metadataの値をそのまま信用しない）
  const platformFee = Math.round(tool.price * 0.2);
  const sellerEarnings = tool.price - platformFee;

  // --- 4. 購入記録の作成 ---
  const { error: insertError } = await supabase.from("purchases").insert({
    tool_id: tool.id,
    buyer_id: buyerId,
    seller_id: sellerId,
    price_paid: tool.price,
    platform_fee: platformFee,
    seller_earnings: sellerEarnings,
    stripe_payment_intent_id: paymentIntentId,
    status: "completed",
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
      console.error(
        `[webhook] ⚠️ 二重決済を検出（要・返金対応）: tool=${toolId}, buyer=${buyerId}, payment_intent=${paymentIntentId}, amount=${amountPaid}`
      );
      return NextResponse.json({
        received: true,
        error: "duplicate_completed_purchase_needs_refund",
      });
    }

    // ここで失敗すると「支払ったのに購入記録が無い」状態になる。
    // 500を返すとStripeが自動で再送してくれるので、あえてエラーにする。
    console.error("[webhook] 購入記録の作成に失敗:", insertError.message);
    return NextResponse.json(
      { error: `購入記録の作成に失敗: ${insertError.message}` },
      { status: 500 }
    );
  }

  // インストール数を増やす（失敗しても購入自体は成立しているので、エラーにはしない）
  const { error: rpcError } = await supabase.rpc("increment_install_count", {
    p_tool_id: tool.id,
  });
  if (rpcError) {
    console.error("[webhook] インストール数の更新に失敗:", rpcError.message);
  }

  return NextResponse.json({ received: true, recorded: true });
}
