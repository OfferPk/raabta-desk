import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { countUsers } from "@/lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  if (countUsers() === 0) redirect("/register");
  redirect("/login");
}
