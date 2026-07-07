import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Package, TrendingUp, Wallet, HandCoins, Warehouse, Undo2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { to: "/products", label: "Товары", icon: Package },
  { to: "/sales", label: "Продажи", icon: TrendingUp },
  { to: "/returns", label: "Возвраты", icon: Undo2 },
  { to: "/finances", label: "Финансы", icon: Wallet },
  { to: "/debts", label: "Долги", icon: HandCoins },
  { to: "/warehouse", label: "Склад", icon: Warehouse },
] as const;

export function AppSidebar({ userName }: { userName?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Вы вышли из системы");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-64 bg-sidebar text-sidebar-foreground flex flex-col z-30">
      <div className="p-6 flex items-center gap-3">
        <div className="size-9 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-lg">
          A
        </div>
        <span className="text-white font-bold tracking-tight text-xl">AUTOFLOW</span>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-2">
        {nav.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 " +
                (active
                  ? "bg-primary text-primary-foreground shadow-lift"
                  : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-white")
              }
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={2} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 space-y-3">
        <div className="bg-sidebar-hover/50 rounded-xl p-4">
          <div className="text-xs text-sidebar-muted mb-1">Пользователь</div>
          <div className="text-sm font-semibold text-white truncate">{userName || "—"}</div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-hover hover:text-white transition-colors"
        >
          <LogOut className="size-4" /> Выйти
        </button>
      </div>
    </aside>
  );
}
