/**
 * 一時的な失敗を再試行する。
 *
 * Supabase（特に無料プラン）では、DBが正常でも稀に
 * ゲートウェイ側で 504 Gateway Timeout が返ることがある。
 * 決済・アカウント作成まわりでこれを取りこぼすと、
 * 「Stripeにはアカウントがあるのにこちらに記録が無い」といった
 * 整合しない状態が生まれてしまうため、重要な処理では再試行する。
 *
 * @param operation 実行したい処理。成功すればその値を返す
 * @param attempts 最大試行回数（初回を含む）
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) {
        // 1秒、2秒と間隔を空けて待つ（混雑が収まるのを待つため）
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Supabaseクライアントの戻り値（{ data, error } 形式）向けの再試行。
 *
 * supabase-js は失敗しても例外を投げず error を返すため、
 * withRetry だけでは再試行されない。一時的なエラーのときだけ投げ直す。
 */
export async function withRetrySupabase<
  T extends { data: unknown; error: { message: string } | null },
>(
  // supabase-js のクエリは厳密には Promise ではなく thenable なので PromiseLike で受ける
  operation: () => PromiseLike<T>,
  attempts = 3
): Promise<T> {
  let last: T | null = null;

  for (let i = 0; i < attempts; i++) {
    const result = await operation();
    if (!result.error) return result;

    last = result;

    // 一時的とみなせるものだけ再試行する。
    // 制約違反などの「やり直しても同じ」エラーは即座に返す。
    const message = result.error.message.toLowerCase();
    const isTransient =
      message.includes("timeout") ||
      message.includes("gateway") ||
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("503") ||
      message.includes("504");

    if (!isTransient) return result;

    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }

  return last!;
}
