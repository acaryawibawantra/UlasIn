import { NextResponse } from "next/server";
import { getCompanySession } from "@/lib/company-auth";

export async function GET() {
  const session = await getCompanySession();
  if (!session) {
    return NextResponse.json({ error: "Belum login." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    userId: session.userId,
    companyName: session.companyName,
    email: session.email,
  });
}
