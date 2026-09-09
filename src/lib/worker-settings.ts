import { db } from "@/lib/db";
export const defaults={max_workers:20,timeout_min:20,runner:"subprocess",opencode_path:"opencode"};
export async function getWorkerSettings(){const r=await db.query("SELECT value FROM settings WHERE scope='global' AND key='worker_settings'");return{...defaults,...(r.rows[0]?.value??{})}}
