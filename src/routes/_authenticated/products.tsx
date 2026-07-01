import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatMoney, CATEGORY_LABELS } from "@/lib/format";
import { Plus, Search, Pencil, Trash2, Package, ImageOff } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Товары — AUTOFLOW" }] }),
  component: ProductsPage,
});

const CATS = Object.entries(CATEGORY_LABELS) as [string, string][];

const productSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(200),
  category: z.enum(["cases", "lamps", "interior", "electronics", "other"]),
  purchase_price: z.number().min(0),
  sale_price: z.number().min(0),
  quantity: z.number().int().min(0),
  image_url: z.string().max(1000).optional().or(z.literal("")),
});

type ProductForm = z.infer<typeof productSchema>;
type Product = ProductForm & { id: string };

function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    return products.filter((p: any) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, cat, search]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Товар удалён");
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeletingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Товары"
        description="Управление каталогом магазина"
        actions={
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus className="size-4 mr-2" />Добавить товар
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Поиск по названию…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="pl-9 h-11 bg-card" />
        </div>
        <div className="flex flex-wrap gap-2">
          <CatChip active={cat === "all"} onClick={() => setCat("all")}>Все</CatChip>
          {CATS.map(([k, label]) => (
            <CatChip key={k} active={cat === k} onClick={() => setCat(k)}>{label}</CatChip>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Package className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Товары не найдены. Добавьте первый товар.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p: any) => (
            <div key={p.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-card hover:shadow-lift transition-shadow group">
              <div className="aspect-video bg-secondary flex items-center justify-center text-muted-foreground">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="size-8 opacity-40" />
                )}
              </div>
              <div className="p-5">
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  {CATEGORY_LABELS[p.category]}
                </div>
                <h3 className="font-semibold text-base mb-2 line-clamp-2 min-h-[3rem]">{p.name}</h3>
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-xl font-bold font-mono">{formatMoney(p.sale_price)}</span>
                  <span className={`text-sm font-medium ${p.quantity <= p.low_stock_threshold ? "text-destructive" : "text-muted-foreground"}`}>
                    {p.quantity} шт
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(p)}>
                    <Pencil className="size-3.5 mr-1" />Изменить
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeletingId(p.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProductDialog open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} initial={editing} />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить товар?</AlertDialogTitle>
            <AlertDialogDescription>Действие нельзя отменить. Товар будет удалён навсегда.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMut.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CatChip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-4 h-11 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-card border border-border text-foreground hover:bg-secondary"
      }`}>{children}</button>
  );
}

function ProductDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: Product | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ProductForm>(() => ({
    name: initial?.name || "",
    category: (initial?.category as any) || "other",
    purchase_price: initial?.purchase_price || 0,
    sale_price: initial?.sale_price || 0,
    quantity: initial?.quantity || 0,
    image_url: initial?.image_url || "",
  }));

  const mut = useMutation({
    mutationFn: async (data: ProductForm) => {
      const parsed = productSchema.parse(data);
      const payload = { ...parsed, image_url: parsed.image_url || null };
      if (initial) {
        const { error } = await supabase.from("products").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("products").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Товар обновлён" : "Товар добавлен");
      qc.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Изменить товар" : "Новый товар"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(form); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Название</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Категория</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATS.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Цена покупки, ₽</Label>
              <Input type="number" min={0} step="0.01" value={form.purchase_price}
                onChange={(e) => setForm({ ...form, purchase_price: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Цена продажи, ₽</Label>
              <Input type="number" min={0} step="0.01" value={form.sale_price}
                onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Количество на складе</Label>
            <Input type="number" min={0} value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Фото (URL)</Label>
            <Input value={form.image_url || ""} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://…" maxLength={1000} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={mut.isPending}>{initial ? "Сохранить" : "Добавить"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
