import { redirect } from "next/navigation";

import { getSessionContext } from "@/lib/auth/session";

/**
 * There is no marketing site. `/` is a router: signed-in users land on their
 * dashboard, everyone else on the login screen.
 */
export default async function RootPage() {
  const session = await getSessionContext();
  redirect(session ? "/dashboard" : "/login");
}
