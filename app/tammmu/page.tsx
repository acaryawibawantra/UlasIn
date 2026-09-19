import { permanentRedirect } from "next/navigation";

/* ═══════════════════════════════════════════════════════════════════
   BACKWARD COMPAT REDIRECT (308 PERMANENT)
   QR lama yang sudah di-print menuju /tammmu?table=XX → redirect ke
   route dinamis baru /tammmu/XX (RESTful clean path).
   ═══════════════════════════════════════════════════════════════════ */
export const dynamic = "force-dynamic";

export default async function TammmuBackwardRedirect({
  searchParams,
}: {
  searchParams?: Promise<{ table?: string; meja?: string }> | { table?: string; meja?: string };
}) {
  const sp = await Promise.resolve(searchParams || {});
  const raw = (sp.table || sp.meja || "01").toString();
  const numMatch = raw.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0], 10) : 1;
  const tableNum = String(Math.max(1, Math.min(999, num))).padStart(2, "0");

  permanentRedirect(`/tammmu/${tableNum}`);
}
