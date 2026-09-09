export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ db }, { reconcile }] = await Promise.all([import("@/lib/db"), import("@/lib/storage/index")]);
  try { await reconcile(db); } catch (error) { console.error("APMS storage reconcile skipped:", error instanceof Error ? error.message : error); }
  if (process.env.APMS_SCHEDULER_INPROCESS === "true") {
    const { Scheduler, selectRunner } = await import("@/worker/scheduler");
    const state = globalThis as typeof globalThis & { __apmsScheduler?: InstanceType<typeof Scheduler> };
    if (!state.__apmsScheduler) {
      state.__apmsScheduler = new Scheduler(db, selectRunner());
      await state.__apmsScheduler.start();
    }
  }
}
