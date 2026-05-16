import { redirect } from "next/navigation";
import HabitApp from "../components/HabitApp";
import { todayIso } from "../lib/date";
import { hasSupabaseEnv } from "../lib/supabase/env";
import { createClient } from "../lib/supabase/server";

export default async function Home() {
  if (!hasSupabaseEnv()) redirect("/login?error=missing_supabase_env");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return <HabitApp userId={user.id} userEmail={user.email || ""} initialDate={todayIso()} />;
}
