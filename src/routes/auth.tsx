import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Package } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Вход — AUTOFLOW" },
      { name: "description", content: "Войдите в систему учёта магазина автоаксессуаров." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Добро пожаловать!");
    navigate({ to: "/dashboard" });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Аккаунт создан. Входим…");
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="size-11 bg-primary rounded-xl flex items-center justify-center text-primary-foreground">
            <Package className="size-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight">AUTOFLOW</span>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-card p-8">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid grid-cols-2 mb-6 w-full">
              <TabsTrigger value="signin">Вход</TabsTrigger>
              <TabsTrigger value="signup">Регистрация</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email-in">Email</Label>
                  <Input id="email-in" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="you@shop.ru" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass-in">Пароль</Label>
                  <Input id="pass-in" type="password" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin mr-2" />}
                  Войти
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name-up">Ваше имя</Label>
                  <Input id="name-up" required value={fullName}
                    onChange={(e) => setFullName(e.target.value)} placeholder="Алексей" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-up">Email</Label>
                  <Input id="email-up" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} placeholder="you@shop.ru" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass-up">Пароль</Label>
                  <Input id="pass-up" type="password" required minLength={6} value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Минимум 6 символов — без спецсимволов и заглавных</p>
                </div>
                <Button type="submit" className="w-full h-11" disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin mr-2" />}
                  Создать аккаунт
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Первый зарегистрированный пользователь становится администратором.
        </p>
      </div>
    </div>
  );
}
