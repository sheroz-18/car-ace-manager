import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/layout/AppSidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar userName={profile?.full_name || profile?.email || user.email || ""} />
      <main className="ml-64 min-h-screen p-6 sm:p-10 max-w-[1600px]">
        <Outlet />
      </main>
    </div>
  );
}
