import { notFound } from "next/navigation";
import { getCompanySession } from "@/lib/company-auth";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { findCompanyNameBySlug } from "@/lib/company-slug";
import CompanyLoginForm from "../CompanyLoginForm";
import CompanyDashboard from "../CompanyDashboard";

export const dynamic = "force-dynamic";

export default async function CompanySlugPage({
  params,
}: {
  params: { companySlug: string };
}) {
  const supabase = getSupabaseServerClient();
  const companyName = await findCompanyNameBySlug(supabase, params.companySlug);

  if (!companyName) {
    notFound();
  }

  const session = await getCompanySession();

  // Kalau sudah login tapi beda perusahaan, tampilkan login untuk perusahaan ini.
  if (!session || session.companyName !== companyName) {
    return <CompanyLoginForm companyName={companyName} />;
  }

  return <CompanyDashboard companyName={companyName} email={session.email} />;
}
