import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDateTime, CATEGORY_LABELS } from "@/lib/format";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/warehouse")({
  head: () => ({ meta: [{ title: "Склад — AUTOFLOW" }] }),
  component: WarehousePage,
});

const MOVEMENT_LABELS: Record<string, string> = {
  income: "Приход",
  outgoing: "Расход",
  transfer: "Перемещение",
};

function WarehousePage() {
  const [type, setType] = useState<"income" | "outgoing" | "transfer" | null>(null);

  const { data: movements = [] } = useQuery({
    queryKey: ["movements"],
    queryFn: async () => {
      const { data } = await supabase.from("warehouse_movements")
        .select("*, products(name, category)")
        .order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ["low-stock"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("quantity");
      return (data || []).filter((p) => p.quantity <= p.low_stock_threshold);
    },
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Склад" description="Приход, расход и перемещение товаров" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <ActionCard icon={ArrowDownToLine} label="Приход товара" color="success" onClick={() => setType("income")} />
        <ActionCard icon={ArrowUpFromLine} label="Расход товара" color="destructive" onClick={() => setType("outgoing")} />
        <ActionCard icon={ArrowRightLeft} label="Перемещение" color="primary" onClick={() => setType("transfer")} />
      </div>

      {lowStock.length > 0 && (
        <section className="bg-warning/10 border border-warning/30 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-5 text-warning" />
            <h2 className="font-bold">Требуют внимания ({lowStock.length})</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStock.slice(0, 6).map((p: any) => (
              <div key={p.id} className="bg-card rounded-lg p-3 flex justify-between items-center">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[p.category]}</div>
                </div>
                <div className={`text-sm font-bold ${p.quantity === 0 ? "text-destructive" : "text-warning"}`}>
                  {p.quantity} шт
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
        <div className="p-6 border-b border-border">
          <h2 className="font-bold text-lg">История движений</h2>
        </div>
        {movements.length === 0 ? (
          <p className="p-16 text-center text-muted-foreground">Движений пока нет.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Товар</th>
                <th className="px-6 py-3 text-left font-semibold">Тип</th>
                <th className="px-6 py-3 text-left font-semibold">Откуда → Куда</th>
                <th className="px-6 py-3 text-left font-semibold">Кол-во</th>
                <th className="px-6 py-3 text-left font-semibold">Примечание</th>
                <th className="px-6 py-3 text-left font-semibold">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movements.map((m: any) => (
                <tr key={m.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{m.products?.name || "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      m.movement_type === "income" ? "bg-success/10 text-success" :
                      m.movement_type === "outgoing" ? "bg-destructive/10 text-destructive" :
                      "bg-primary/10 text-primary"
                    }`}>{MOVEMENT_LABELS[m.movement_type]}</span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">
                    {m.from_location || "—"} → {m.to_location || "—"}
                  </td>
                  <td className="px-6 py-4 font-mono font-semibold">{m.quantity}</td>
                  <td className="px-6 py-4 text-muted-foreground">{m.note || "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDateTime(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <MovementDialog type={type} onClose={() => setType(null)} />
    </div>
  );
}

function ActionCard({ icon: Icon, label, color, onClick }: { icon: any; label: string; color: "success" | "destructive" | "primary"; onClick: () => void }) {
  const bg = color === "success" ? "bg-success/10 text-success" : color === "destructive" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary";
  return (
    <button onClick={onClick}
      className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4 shadow-card hover:shadow-lift transition-shadow text-left">
      <div className={`size-12 rounded-xl ${bg} flex items-center justify-center`}>
        <Icon className="size-5" />
      </div>
      <span className="font-semibold">{label}</span>
    </button>
  );
}

function MovementDialog({ type, onClose }: { type: "income" | "outgoing" | "transfer" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,quantity").order("name");
      return data || [];
    },
    enabled: !!type,
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!type || !productId) throw new Error("Выберите товар");
      if (quantity <= 0) throw new Error("Количество должно быть больше 0");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("warehouse_movements").insert({
        product_id: productId, movement_type: type, quantity,
        from_location: from || null, to_location: to || null,
        note: note || null, created_by: user?.id,
      });
      if (error) throw error;
      // Update product qty for income (outgoing already handled by sales trigger; manual outgoing also decrements)
      if (type === "income") {
        await supabase.rpc as any;
        const p = products.find((x: any) => x.id === productId) as any;
        if (p) await supabase.from("products").update({ quantity: p.quantity + quantity }).eq("id", productId);
      } else if (type === "outgoing") {
        const p = products.find((x: any) => x.id === productId) as any;
        if (p) await supabase.from("products").update({ quantity: Math.max(0, p.quantity - quantity) }).eq("id", productId);
      }
    },
    onSuccess: () => {
      toast.success("Движение зафиксировано");
      qc.invalidateQueries();
      onClose();
      setProductId(""); setQuantity(1); setFrom(""); setTo(""); setNote("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!type} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{type ? MOVEMENT_LABELS[type] : ""}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="space-y-2"><Label>Товар</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Выберите товар" /></SelectTrigger>
              <SelectContent>
                {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantity} шт)</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Количество</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required /></div>
          {type === "transfer" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Откуда</Label>
                <Input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={100} placeholder="Склад" /></div>
              <div className="space-y-2"><Label>Куда</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} maxLength={100} placeholder="Магазин" /></div>
            </div>
          )}
          <div className="space-y-2"><Label>Примечание</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={mut.isPending}>Записать</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
