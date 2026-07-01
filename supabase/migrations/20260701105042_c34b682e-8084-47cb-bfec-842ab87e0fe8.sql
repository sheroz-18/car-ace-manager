
-- === ENUMS ===
CREATE TYPE public.app_role AS ENUM ('admin', 'seller');
CREATE TYPE public.product_category AS ENUM ('cases', 'lamps', 'interior', 'electronics', 'other');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'transfer', 'debt');
CREATE TYPE public.debt_status AS ENUM ('open', 'paid', 'partial');
CREATE TYPE public.movement_type AS ENUM ('income', 'outgoing', 'transfer');
CREATE TYPE public.finance_type AS ENUM ('income', 'expense');

-- === UPDATED_AT TRIGGER FN ===
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- === PROFILES ===
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === USER ROLES ===
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- === HANDLE NEW USER: profile + role ===
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO first_user;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN first_user THEN 'admin'::public.app_role ELSE 'seller'::public.app_role END);

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- === PRODUCTS ===
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category public.product_category NOT NULL DEFAULT 'other',
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "All authenticated update products" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Only admin delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === SALES ===
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  sold_by UUID REFERENCES auth.users(id),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Only admin update sales" ON public.sales FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admin delete sales" ON public.sales FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto decrement product stock + create finance entry on sale insert
CREATE OR REPLACE FUNCTION public.on_sale_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET quantity = quantity - NEW.quantity WHERE id = NEW.product_id;
  INSERT INTO public.warehouse_movements (product_id, movement_type, quantity, note, created_by)
  VALUES (NEW.product_id, 'outgoing', NEW.quantity, 'Продажа', NEW.sold_by);
  IF NEW.payment_method <> 'debt' THEN
    INSERT INTO public.finance_entries (finance_type, amount, category, description, occurred_at, created_by)
    VALUES ('income', NEW.total, 'Продажа', 'Продажа товара', NEW.sold_at, NEW.sold_by);
  END IF;
  RETURN NEW;
END; $$;

-- === WAREHOUSE MOVEMENTS ===
CREATE TABLE public.warehouse_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type public.movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  from_location TEXT,
  to_location TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_movements TO authenticated;
GRANT ALL ON public.warehouse_movements TO service_role;
ALTER TABLE public.warehouse_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read movements" ON public.warehouse_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert movements" ON public.warehouse_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Only admin delete movements" ON public.warehouse_movements FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- === FINANCE ENTRIES ===
CREATE TABLE public.finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finance_type public.finance_type NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT NOT NULL DEFAULT 'Прочее',
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated read finance" ON public.finance_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "All authenticated insert finance" ON public.finance_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Only admin update finance" ON public.finance_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Only admin delete finance" ON public.finance_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Now attach the sale trigger (after both tables exist)
CREATE TRIGGER trg_on_sale_insert AFTER INSERT ON public.sales FOR EACH ROW EXECUTE FUNCTION public.on_sale_insert();

-- === DEBTS ===
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  product_description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.debt_status NOT NULL DEFAULT 'open',
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debts TO authenticated;
GRANT ALL ON public.debts TO service_role;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated manage debts" ON public.debts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_debts_updated BEFORE UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- === DEBT PAYMENTS ===
CREATE TABLE public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_payments TO authenticated;
GRANT ALL ON public.debt_payments TO service_role;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All authenticated manage debt_payments" ON public.debt_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Debt payment trigger: update paid_amount and status + finance income entry
CREATE OR REPLACE FUNCTION public.on_debt_payment_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_paid NUMERIC(12,2);
  debt_total NUMERIC(12,2);
BEGIN
  UPDATE public.debts
    SET paid_amount = paid_amount + NEW.amount
    WHERE id = NEW.debt_id
    RETURNING paid_amount, amount INTO new_paid, debt_total;

  UPDATE public.debts
    SET status = CASE WHEN new_paid >= debt_total THEN 'paid'::public.debt_status ELSE 'partial'::public.debt_status END
    WHERE id = NEW.debt_id;

  INSERT INTO public.finance_entries (finance_type, amount, category, description, occurred_at, created_by)
  VALUES ('income', NEW.amount, 'Оплата долга', 'Погашение долга клиента', NEW.paid_at, NEW.created_by);

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_debt_payment AFTER INSERT ON public.debt_payments FOR EACH ROW EXECUTE FUNCTION public.on_debt_payment_insert();
