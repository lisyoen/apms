export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ db }, { reconcile }] = await Promise.all([import("@/lib/db"), import("@/lib/storage")]);
  try { await reconcile(db); } catch (error) { console.error("APMS storage reconcile skipped:", error instanceof Error ? error.message : error); }
}
