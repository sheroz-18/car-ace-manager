import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { formatMoney, formatDateTime, CATEGORY_LABELS } from "@/lib/format";
import { Wallet, TrendingDown, TrendingUp, HandCoins, Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { subDays, startOfDay, format } from "date-fns";
import { ru } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Дашборд — AUTOFLOW" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const monthAgo = subDays(new Date(), 30).toISOString();
      const [salesRes, financeRes, debtsRes, productsRes] = await Promise.all([
        supabase.from("sales").select("total,sold_at").gte("sold_at", monthAgo),
        supabase.from("finance_entries").select("amount,finance_type,occurred_at").gte("occurred_at", monthAgo),
        supabase.from("debts").select("amount,paid_amount").in("status", ["open", "partial"]),
        supabase.from("products").select("id,name,quantity,low_stock_threshold,category"),
      ]);
      const revenue = (financeRes.data || []).filter(f => f.finance_type === "income").reduce((s, f) => s + Number(f.amount), 0);
      const expenses = (financeRes.data || []).filter(f => f.finance_type === "expense").reduce((s, f) => s + Number(f.amount), 0);
      const debts = (debtsRes.data || []).reduce((s, d) => s + (Number(d.amount) - Number(d.paid_amount)), 0);
      const lowStock = (productsRes.data || []).filter(p => p.quantity <= p.low_stock_threshold);
      const salesByDay: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        salesByDay[d] = 0;
      }
      (salesRes.data || []).forEach(s => {
        const d = format(new Date(s.sold_at), "yyyy-MM-dd");
        if (d in salesByDay) salesByDay[d] += Number(s.total);
      });
      const chart = Object.entries(salesByDay).map(([d, v]) => ({
        day: format(new Date(d), "EE", { locale: ru }),
        total: v,
      }));
      return { revenue, expenses, profit: revenue - expenses, debts, lowStock, chart };
    },
  });

  const { data: recentSales } = useQuery({
    queryKey: ["recent-sales"],
    queryFn: async () => {
      const { data } = await supabase.from("sales")
        .select("id,total,quantity,sold_at,customer_name,payment_method,products(name)")
        .order("sold_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Панель управления"
        description="Обзор магазина за последние 30 дней"
        actions={
          <Button asChild size="lg" className="shadow-lift">
            <Link to="/sales"><Plus className="size-4 mr-2" />Новая продажа</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Общие деньги" value={formatMoney(stats?.revenue ?? 0)} icon={Wallet} hint="Доход за 30 дней" hintTone="success" />
        <StatCard label="Расходы" value={formatMoney(stats?.expenses ?? 0)} icon={TrendingDown} hint="За 30 дней" />
        <StatCard label="Чистая прибыль" value={formatMoney(stats?.profit ?? 0)} icon={TrendingUp} hint="Доход − расходы" hintTone={stats && stats.profit >= 0 ? "success" : "danger"} />
        <StatCard label="Долги клиентов" value={formatMoney(stats?.debts ?? 0)} icon={HandCoins} hint="Не оплачено" hintTone={stats && stats.debts > 0 ? "warning" : "neutral"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-card p-6 rounded-2xl border border-border shadow-card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-lg">Динамика продаж</h2>
            <span className="text-xs text-muted-foreground">Последние 7 дней</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.chart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  cursor={{ fill: "rgba(234,88,12,0.06)" }}
                  contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13 }}
                  formatter={(v: any) => [formatMoney(Number(v)), "Продажи"] as [string, string]}
                />
                <Bar dataKey="total" fill="#ea580c" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-card p-6 rounded-2xl border border-border shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="size-4 text-warning" />
            <h2 className="font-bold">Мало на складе</h2>
          </div>
          {stats && stats.lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Всё в наличии</p>
          ) : (
            <ul className="space-y-3">
              {stats?.lowStock.slice(0, 6).map((p: any) => (
                <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[p.category]}</div>
                  </div>
                  <span className={p.quantity === 0 ? "text-destructive font-bold" : "text-warning font-bold"}>
                    {p.quantity} шт
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/warehouse" className="block mt-6 text-center text-sm text-primary hover:underline font-medium">
            Перейти к складу →
          </Link>
        </section>
      </div>

      <section className="mt-6 bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="font-bold text-lg">Последние продажи</h2>
          <Link to="/sales" className="text-sm text-primary font-medium hover:underline">Все продажи</Link>
        </div>
        {recentSales && recentSales.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Продаж пока нет.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-semibold">Товар</th>
                <th className="px-6 py-3 font-semibold">Клиент</th>
                <th className="px-6 py-3 font-semibold">Дата</th>
                <th className="px-6 py-3 font-semibold text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentSales?.map((s: any) => (
                <tr key={s.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{s.products?.name} <span className="text-muted-foreground">× {s.quantity}</span></td>
                  <td className="px-6 py-4 text-muted-foreground">{s.customer_name || "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDateTime(s.sold_at)}</td>
                  <td className="px-6 py-4 font-mono font-semibold text-right">{formatMoney(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
