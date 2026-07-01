import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDate } from "@/lib/format";
import { Plus, Phone, Check, History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/debts")({
  head: () => ({ meta: [{ title: "Долги — AUTOFLOW" }] }),
  component: DebtsPage,
});

function DebtsPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [payDebt, setPayDebt] = useState<any>(null);
  const [historyDebt, setHistoryDebt] = useState<any>(null);

  const { data: debts = [] } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data } = await supabase.from("debts").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const open = debts.filter((d: any) => d.status !== "paid");
  const closed = debts.filter((d: any) => d.status === "paid");
  const totalOpen = open.reduce((s: number, d: any) => s + Number(d.amount) - Number(d.paid_amount), 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Долги клиентов"
        description={`Открытых долгов: ${formatMoney(totalOpen)}`}
        actions={<Button size="lg" onClick={() => setAddOpen(true)}><Plus className="size-4 mr-2" />Добавить долг</Button>}
      />

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Активные ({open.length})</h2>
        {open.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground">
            Открытых долгов нет 👌
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {open.map((d: any) => (
              <DebtCard key={d.id} debt={d} onPay={() => setPayDebt(d)} onHistory={() => setHistoryDebt(d)} />
            ))}
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Оплаченные ({closed.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {closed.slice(0, 6).map((d: any) => (
              <DebtCard key={d.id} debt={d} onPay={() => {}} onHistory={() => setHistoryDebt(d)} />
            ))}
          </div>
        </section>
      )}

      <AddDebtDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <PaymentDialog debt={payDebt} onClose={() => setPayDebt(null)} />
      <HistoryDialog debt={historyDebt} onClose={() => setHistoryDebt(null)} />
    </div>
  );
}

function DebtCard({ debt, onPay, onHistory }: { debt: any; onPay: () => void; onHistory: () => void }) {
  const remaining = Number(debt.amount) - Number(debt.paid_amount);
  const progress = (Number(debt.paid_amount) / Number(debt.amount)) * 100;
  const statusVariant = debt.status === "paid" ? "secondary" : debt.status === "partial" ? "default" : "destructive";
  const statusLabel = debt.status === "paid" ? "Оплачено" : debt.status === "partial" ? "Частично" : "Открыт";

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-bold text-base">{debt.customer_name}</h3>
          {debt.customer_phone && (
            <a href={`tel:${debt.customer_phone}`} className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 hover:text-primary">
              <Phone className="size-3" />{debt.customer_phone}
            </a>
          )}
        </div>
        <Badge variant={statusVariant as any}>{statusLabel}</Badge>
      </div>
      {debt.product_description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{debt.product_description}</p>
      )}
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs text-muted-foreground">Остаток</span>
        <span className="text-xl font-bold font-mono">{formatMoney(remaining)}</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-xs text-muted-foreground mb-4">
        Куплено: {formatDate(debt.purchase_date)} · Оплачено {formatMoney(debt.paid_amount)} из {formatMoney(debt.amount)}
      </div>
      <div className="flex gap-2">
        {debt.status !== "paid" && (
          <Button size="sm" className="flex-1" onClick={onPay}><Check className="size-3.5 mr-1" />Принять оплату</Button>
        )}
        <Button size="sm" variant="outline" onClick={onHistory}><History className="size-3.5" /></Button>
      </div>
    </div>
  );
}

function AddDebtDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ customer_name: "", customer_phone: "", product_description: "", amount: 0 });

  const mut = useMutation({
    mutationFn: async () => {
      if (!form.customer_name.trim()) throw new Error("Укажите имя клиента");
      if (form.amount <= 0) throw new Error("Сумма должна быть больше 0");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("debts").insert({
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        product_description: form.product_description || null,
        amount: form.amount,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Долг добавлен");
      qc.invalidateQueries();
      onClose();
      setForm({ customer_name: "", customer_phone: "", product_description: "", amount: 0 });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Новый долг</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="space-y-2"><Label>Имя клиента</Label>
            <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} required maxLength={200} /></div>
          <div className="space-y-2"><Label>Телефон</Label>
            <Input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} maxLength={50} placeholder="+7…" /></div>
          <div className="space-y-2"><Label>Что взял</Label>
            <Input value={form.product_description} onChange={(e) => setForm({ ...form, product_description: e.target.value })} maxLength={500} /></div>
          <div className="space-y-2"><Label>Сумма долга, ₽</Label>
            <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={mut.isPending}>Добавить</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ debt, onClose }: { debt: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<number>(0);
  const remaining = debt ? Number(debt.amount) - Number(debt.paid_amount) : 0;

  const mut = useMutation({
    mutationFn: async () => {
      if (amount <= 0 || amount > remaining) throw new Error(`Сумма должна быть от 0 до ${formatMoney(remaining)}`);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("debt_payments").insert({ debt_id: debt.id, amount, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Оплата принята");
      qc.invalidateQueries();
      onClose();
      setAmount(0);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!debt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Принять оплату — {debt?.customer_name}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="bg-secondary rounded-lg p-4 text-sm">
            Остаток к оплате: <span className="font-bold font-mono">{formatMoney(remaining)}</span>
          </div>
          <div className="space-y-2"><Label>Сумма оплаты, ₽</Label>
            <Input type="number" min="0" max={remaining} step="0.01" value={amount}
              onChange={(e) => setAmount(Number(e.target.value))} required autoFocus /></div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setAmount(remaining)} className="flex-1">Оплатить полностью</Button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={mut.isPending}>Принять</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ debt, onClose }: { debt: any; onClose: () => void }) {
  const { data: payments = [] } = useQuery({
    queryKey: ["debt-payments", debt?.id],
    queryFn: async () => {
      if (!debt) return [];
      const { data } = await supabase.from("debt_payments").select("*").eq("debt_id", debt.id).order("paid_at", { ascending: false });
      return data || [];
    },
    enabled: !!debt,
  });

  return (
    <Dialog open={!!debt} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>История платежей</DialogTitle></DialogHeader>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Платежей пока нет.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((p: any) => (
              <li key={p.id} className="py-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{formatDate(p.paid_at)}</span>
                <span className="font-mono font-semibold text-success">+ {formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
