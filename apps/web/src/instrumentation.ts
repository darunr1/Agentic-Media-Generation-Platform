/**
 * Next.js instrumentation hook — runs once when the server process boots,
 * before it serves any request. This is where "secret validation at
 * startup" (brief §14) happens: a misconfigured deploy fails immediately
 * and loudly instead of surfacing as a confusing 500 on the first request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadEnv } = await import("@contentforge/shared");
    loadEnv();
  }
}
