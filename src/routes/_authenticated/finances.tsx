import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatMoney, formatDateTime } from "@/lib/format";
import { Wallet, TrendingDown, TrendingUp, HandCoins, Plus } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { subDays, startOfDay, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/finances")({
  head: () => ({ meta: [{ title: "Финансы — AUTOFLOW" }] }),
  component: FinancesPage,
});

type Period = "today" | "week" | "month" | "year";
const PERIOD_LABELS: Record<Period, string> = { today: "Сегодня", week: "Неделя", month: "Месяц", year: "Год" };

function periodStart(p: Period): Date {
  const n = new Date();
  if (p === "today") return startOfDay(n);
  if (p === "week") return startOfWeek(n, { weekStartsOn: 1 });
  if (p === "month") return startOfMonth(n);
  return startOfYear(n);
}

function FinancesPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>("month");
  const [addOpen, setAddOpen] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");

  const from = periodStart(period).toISOString();

  const { data: entries = [] } = useQuery({
    queryKey: ["finance", period],
    queryFn: async () => {
      const { data } = await supabase.from("finance_entries")
        .select("*").gte("occurred_at", from).order("occurred_at", { ascending: false });
      return data || [];
    },
  });

  const { data: debts = 0 } = useQuery({
    queryKey: ["debts-total"],
    queryFn: async () => {
      const { data } = await supabase.from("debts").select("amount,paid_amount").in("status", ["open", "partial"]);
      return (data || []).reduce((s, d) => s + Number(d.amount) - Number(d.paid_amount), 0);
    },
  });

  const totals = useMemo(() => {
    const income = entries.filter((e: any) => e.finance_type === "income").reduce((s: number, e: any) => s + Number(e.amount), 0);
    const expense = entries.filter((e: any) => e.finance_type === "expense").reduce((s: number, e: any) => s + Number(e.amount), 0);
    return { income, expense, profit: income - expense };
  }, [entries]);

  const chartData = useMemo(() => {
    const map: Record<string, { d: string; income: number; expense: number }> = {};
    entries.forEach((e: any) => {
      const d = new Date(e.occurred_at).toISOString().slice(0, 10);
      if (!map[d]) map[d] = { d: d.slice(5), income: 0, expense: 0 };
      map[d][e.finance_type as "income" | "expense"] += Number(e.amount);
    });
    return Object.values(map).sort((a, b) => a.d.localeCompare(b.d));
  }, [entries]);

  const filteredEntries = filterType === "all" ? entries : entries.filter((e: any) => e.finance_type === filterType);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Финансы"
        description="Контроль доходов и расходов магазина"
        actions={<Button size="lg" onClick={() => setAddOpen(true)}><Plus className="size-4 mr-2" />Добавить операцию</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Общие деньги" value={formatMoney(totals.income)} icon={Wallet} hint={`Доход за: ${PERIOD_LABELS[period].toLowerCase()}`} hintTone="success" />
        <StatCard label="Расходы" value={formatMoney(totals.expense)} icon={TrendingDown} />
        <StatCard label="Чистая прибыль" value={formatMoney(totals.profit)} icon={TrendingUp} hintTone={totals.profit >= 0 ? "success" : "danger"} />
        <StatCard label="Долги клиентов" value={formatMoney(debts)} icon={HandCoins} hintTone={debts > 0 ? "warning" : "neutral"} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {(["today", "week", "month", "year"] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 h-10 rounded-lg text-sm font-medium transition-colors ${
              period === p ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-secondary"
            }`}>{PERIOD_LABELS[p]}</button>
        ))}
      </div>

      <section className="bg-card p-6 rounded-2xl border border-border shadow-card mb-6">
        <h2 className="font-bold text-lg mb-4">Динамика</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="d" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 13 }}
                formatter={(v: any) => formatMoney(Number(v))} />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2.5} name="Доход" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2.5} name="Расход" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
        <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between gap-3">
          <h2 className="font-bold text-lg">История операций</h2>
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все операции</SelectItem>
              <SelectItem value="income">Только доходы</SelectItem>
              <SelectItem value="expense">Только расходы</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {filteredEntries.length === 0 ? (
          <p className="p-16 text-center text-muted-foreground">Операций нет.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Тип</th>
                <th className="px-6 py-3 text-left font-semibold">Категория</th>
                <th className="px-6 py-3 text-left font-semibold">Описание</th>
                <th className="px-6 py-3 text-left font-semibold">Дата</th>
                <th className="px-6 py-3 text-right font-semibold">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEntries.map((e: any) => (
                <tr key={e.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      e.finance_type === "income" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>{e.finance_type === "income" ? "Доход" : "Расход"}</span>
                  </td>
                  <td className="px-6 py-4">{e.category}</td>
                  <td className="px-6 py-4 text-muted-foreground">{e.description || "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDateTime(e.occurred_at)}</td>
                  <td className={`px-6 py-4 text-right font-mono font-semibold ${
                    e.finance_type === "income" ? "text-success" : "text-destructive"
                  }`}>{e.finance_type === "income" ? "+" : "−"} {formatMoney(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AddOperationDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function AddOperationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState<number>(0);
  const [category, setCategory] = useState("Прочее");
  const [description, setDescription] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      if (amount <= 0) throw new Error("Введите сумму больше 0");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("finance_entries").insert({
        finance_type: type, amount, category, description: description || null, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Операция добавлена");
      qc.invalidateQueries();
      onClose();
      setAmount(0); setDescription(""); setCategory("Прочее");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Новая операция</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setType("income")}
              className={`h-12 rounded-lg font-semibold text-sm ${type === "income" ? "bg-success text-success-foreground" : "bg-secondary"}`}>
              Доход
            </button>
            <button type="button" onClick={() => setType("expense")}
              className={`h-12 rounded-lg font-semibold text-sm ${type === "expense" ? "bg-destructive text-destructive-foreground" : "bg-secondary"}`}>
              Расход
            </button>
          </div>
          <div className="space-y-2"><Label>Сумма, ₽</Label>
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} required autoFocus /></div>
          <div className="space-y-2"><Label>Категория</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={100} placeholder="Аренда / Закупка / Зарплата…" /></div>
          <div className="space-y-2"><Label>Описание</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="Комментарий" /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={mut.isPending}>Добавить</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
