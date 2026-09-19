import { getClientSession } from "@/lib/client-auth";
import ClientLoginForm from "./ClientLoginForm";
import ClientPortal from "./ClientPortal";

export const dynamic = "force-dynamic";

export default async function KelolaPage() {
  const session = await getClientSession();

  if (!session) {
    return <ClientLoginForm />;
  }

  return <ClientPortal />;
}
