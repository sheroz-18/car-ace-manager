import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatMoney, formatDateTime } from "@/lib/format";
import { Plus, Search, Undo2, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/returns")({
  head: () => ({ meta: [{ title: "Возвраты — AUTOFLOW" }] }),
  component: ReturnsPage,
});

const returnSchema = z.object({
  product_id: z.string().uuid("Выберите товар"),
  quantity: z.number().int().min(1, "Мин. 1"),
  refund_amount: z.number().min(0),
  reason: z.string().max(500).optional().or(z.literal("")),
  sale_id: z.string().uuid().optional().or(z.literal("")),
});

function ReturnsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [toDelete, setToDelete] = useState<string | null>(null);

  const { data: returns = [] } = useQuery({
    queryKey: ["returns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("returns")
        .select("*, products(name)")
        .order("returned_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!search) return returns;
    const s = search.toLowerCase();
    return returns.filter((r: any) =>
      r.products?.name?.toLowerCase().includes(s) ||
      r.reason?.toLowerCase().includes(s)
    );
  }, [returns, search]);

  const totalPeriod = useMemo(
    () => filtered.reduce((sum: number, r: any) => sum + Number(r.refund_amount || 0), 0),
    [filtered]
  );

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("returns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Возврат удалён");
      qc.invalidateQueries();
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Возвраты"
        description="Возврат товара автоматически увеличивает остаток на складе"
        actions={<Button size="lg" onClick={() => setOpen(true)}><Plus className="size-4 mr-2" />Новый возврат</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск по товару или причине…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11 bg-card" />
        </div>
        <div className="bg-card border border-border rounded-lg px-5 h-11 flex items-center gap-2 shadow-card">
          <span className="text-xs text-muted-foreground">Сумма возвратов:</span>
          <span className="font-bold font-mono">{formatMoney(totalPeriod)}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Undo2 className="size-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Возвратов пока нет.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Товар</th>
                <th className="px-6 py-3 text-left font-semibold">Кол-во</th>
                <th className="px-6 py-3 text-left font-semibold">Причина</th>
                <th className="px-6 py-3 text-left font-semibold">Дата</th>
                <th className="px-6 py-3 text-right font-semibold">Возврат ₽</th>
                <th className="px-6 py-3 text-right font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{r.products?.name || "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{r.quantity}</td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[300px] truncate">{r.reason || "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDateTime(r.returned_at)}</td>
                  <td className="px-6 py-4 text-right font-mono font-semibold">{formatMoney(r.refund_amount)}</td>
                  <td className="px-6 py-4 text-right">
                    <Button size="icon" variant="ghost" onClick={() => setToDelete(r.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NewReturnDialog open={open} onClose={() => setOpen(false)} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить возврат?</AlertDialogTitle>
            <AlertDialogDescription>
              Запись будет удалена. Остаток на складе и финансовая запись останутся без изменений — при необходимости скорректируйте их вручную.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && delMut.mutate(toDelete)}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewReturnDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [saleId, setSaleId] = useState<string>("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [refund, setRefund] = useState<number>(0);
  const [reason, setReason] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-return"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,sale_price").order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: recentSales = [] } = useQuery({
    queryKey: ["recent-sales-for-return"],
    queryFn: async () => {
      const { data } = await supabase.from("sales")
        .select("id,product_id,quantity,unit_price,total,customer_name,sold_at,products(name)")
        .order("sold_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: open,
  });

  function onSaleChange(id: string) {
    setSaleId(id);
    if (!id) return;
    const sale = recentSales.find((s: any) => s.id === id);
    if (sale) {
      setProductId(sale.product_id);
      setQuantity(sale.quantity);
      setRefund(Number(sale.total));
    }
  }

  function onProductChange(id: string) {
    setProductId(id);
    const p = products.find((x: any) => x.id === id);
    if (p && !refund) setRefund(Number(p.sale_price) * quantity);
  }

  const mut = useMutation({
    mutationFn: async () => {
      const parsed = returnSchema.parse({
        product_id: productId,
        quantity,
        refund_amount: refund,
        reason,
        sale_id: saleId,
      });
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("returns").insert({
        product_id: parsed.product_id,
        sale_id: parsed.sale_id || null,
        quantity: parsed.quantity,
        refund_amount: parsed.refund_amount,
        reason: parsed.reason || null,
        created_by: user?.id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Возврат оформлен. Товар возвращён на склад.");
      qc.invalidateQueries();
      onClose();
      setSaleId(""); setProductId(""); setQuantity(1); setRefund(0); setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Новый возврат</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>На основании продажи (необязательно)</Label>
            <Select value={saleId} onValueChange={onSaleChange}>
              <SelectTrigger><SelectValue placeholder="Выберите продажу" /></SelectTrigger>
              <SelectContent>
                {recentSales.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.products?.name} — {s.quantity} шт — {formatMoney(s.total)} — {formatDateTime(s.sold_at)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Товар</Label>
            <Select value={productId} onValueChange={onProductChange}>
              <SelectTrigger><SelectValue placeholder="Выберите товар" /></SelectTrigger>
              <SelectContent>
                {products.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Количество</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required /></div>
            <div className="space-y-2"><Label>Сумма возврата, ₽</Label>
              <Input type="number" min={0} step="0.01" value={refund} onChange={(e) => setRefund(Number(e.target.value))} required /></div>
          </div>

          <div className="space-y-2">
            <Label>Причина возврата</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Брак, не подошло, передумал…" maxLength={500} rows={3} />
          </div>

          <div className="bg-secondary rounded-lg p-4 text-sm text-muted-foreground">
            После оформления: <b className="text-foreground">+{quantity} шт</b> на склад
            {refund > 0 && <>, расход <b className="text-foreground font-mono">{formatMoney(refund)}</b> в финансах</>}.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={mut.isPending || !productId}>Оформить возврат</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
