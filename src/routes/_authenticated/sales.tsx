import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatDateTime, PAYMENT_LABELS } from "@/lib/format";
import { Plus, Search } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "Продажи — AUTOFLOW" }] }),
  component: SalesPage,
});

const saleSchema = z.object({
  product_id: z.string().uuid("Выберите товар"),
  quantity: z.number().int().min(1, "Мин. 1"),
  unit_price: z.number().min(0),
  customer_name: z.string().max(200).optional().or(z.literal("")),
  customer_phone: z.string().max(50).optional().or(z.literal("")),
  payment_method: z.enum(["cash", "card", "transfer", "debt"]),
});

function SalesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales")
        .select("*, products(name)")
        .order("sold_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!search) return sales;
    const s = search.toLowerCase();
    return sales.filter((sale: any) =>
      sale.products?.name?.toLowerCase().includes(s) ||
      sale.customer_name?.toLowerCase().includes(s)
    );
  }, [sales, search]);

  const totalPeriod = useMemo(
    () => filtered.reduce((sum: number, s: any) => sum + Number(s.total), 0),
    [filtered]
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Продажи"
        description="Учёт всех продаж магазина"
        actions={<Button size="lg" onClick={() => setOpen(true)}><Plus className="size-4 mr-2" />Новая продажа</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск по товару или клиенту…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11 bg-card" />
        </div>
        <div className="bg-card border border-border rounded-lg px-5 h-11 flex items-center gap-2 shadow-card">
          <span className="text-xs text-muted-foreground">Итого:</span>
          <span className="font-bold font-mono">{formatMoney(totalPeriod)}</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
        {filtered.length === 0 ? (
          <p className="p-16 text-center text-muted-foreground">Продаж пока нет.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Товар</th>
                <th className="px-6 py-3 text-left font-semibold">Кол-во</th>
                <th className="px-6 py-3 text-left font-semibold">Клиент</th>
                <th className="px-6 py-3 text-left font-semibold">Оплата</th>
                <th className="px-6 py-3 text-left font-semibold">Дата</th>
                <th className="px-6 py-3 text-right font-semibold">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((s: any) => (
                <tr key={s.id} className="hover:bg-secondary/50 transition-colors">
                  <td className="px-6 py-4 font-medium">{s.products?.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">{s.quantity}</td>
                  <td className="px-6 py-4 text-muted-foreground">{s.customer_name || "—"}</td>
                  <td className="px-6 py-4">
                    <Badge variant={s.payment_method === "debt" ? "destructive" : "secondary"}>
                      {PAYMENT_LABELS[s.payment_method]}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDateTime(s.sold_at)}</td>
                  <td className="px-6 py-4 text-right font-mono font-semibold">{formatMoney(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <NewSaleDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewSaleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"cash" | "card" | "transfer" | "debt">("cash");

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-sale"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,name,sale_price,quantity").gt("quantity", 0).order("name");
      return data || [];
    },
    enabled: open,
  });

  function onProductChange(id: string) {
    setProductId(id);
    const p = products.find((x: any) => x.id === id);
    if (p) setUnitPrice(Number(p.sale_price));
  }

  const mut = useMutation({
    mutationFn: async () => {
      const parsed = saleSchema.parse({
        product_id: productId, quantity, unit_price: unitPrice,
        customer_name: customer, customer_phone: phone, payment_method: method,
      });
      const { data: { user } } = await supabase.auth.getUser();
      const total = parsed.quantity * parsed.unit_price;
      const { error } = await supabase.from("sales").insert({
        product_id: parsed.product_id,
        quantity: parsed.quantity,
        unit_price: parsed.unit_price,
        total,
        customer_name: parsed.customer_name || null,
        customer_phone: parsed.customer_phone || null,
        payment_method: parsed.payment_method,
        sold_by: user?.id,
      });
      if (error) throw error;
      if (method === "debt" && customer.trim()) {
        await supabase.from("debts").insert({
          customer_name: customer,
          customer_phone: phone || null,
          product_description: products.find((p: any) => p.id === productId)?.name,
          amount: total,
          created_by: user?.id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Продажа записана");
      qc.invalidateQueries();
      onClose();
      setProductId(""); setQuantity(1); setUnitPrice(0); setCustomer(""); setPhone(""); setMethod("cash");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const total = quantity * unitPrice;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Новая продажа</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Товар</Label>
            <Select value={productId} onValueChange={onProductChange}>
              <SelectTrigger><SelectValue placeholder="Выберите товар" /></SelectTrigger>
              <SelectContent>
                {products.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {formatMoney(p.sale_price)} ({p.quantity} шт)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Количество</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required /></div>
            <div className="space-y-2"><Label>Цена за шт, ₽</Label>
              <Input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} required /></div>
          </div>
          <div className="space-y-2"><Label>Клиент (необязательно)</Label>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Имя клиента" maxLength={200} /></div>
          <div className="space-y-2"><Label>Телефон</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" maxLength={50} /></div>
          <div className="space-y-2"><Label>Способ оплаты</Label>
            <Select value={method} onValueChange={(v: any) => setMethod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Наличные</SelectItem>
                <SelectItem value="card">Карта</SelectItem>
                <SelectItem value="transfer">Перевод</SelectItem>
                <SelectItem value="debt">В долг</SelectItem>
              </SelectContent>
            </Select>
            {method === "debt" && !customer.trim() && (
              <p className="text-xs text-warning">Для продажи в долг укажите имя клиента</p>
            )}
          </div>
          <div className="bg-secondary rounded-lg p-4 flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Итого к оплате:</span>
            <span className="text-2xl font-bold font-mono">{formatMoney(total)}</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={mut.isPending || !productId}>Провести продажу</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
