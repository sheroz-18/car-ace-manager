
-- Profiles: only owner reads
DROP POLICY IF EXISTS "Profiles readable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Sales: read own or admin
DROP POLICY IF EXISTS "All authenticated read sales" ON public.sales;
DROP POLICY IF EXISTS "Read own or admin sales" ON public.sales;
CREATE POLICY "Read own or admin sales" ON public.sales
  FOR SELECT TO authenticated
  USING (sold_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "All authenticated insert sales" ON public.sales;
DROP POLICY IF EXISTS "Insert own sales" ON public.sales;
CREATE POLICY "Insert own sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (sold_by = auth.uid());

-- Debts: split permissive FOR ALL, restrict reads
DROP POLICY IF EXISTS "All authenticated manage debts" ON public.debts;
DROP POLICY IF EXISTS "Read own or admin debts" ON public.debts;
DROP POLICY IF EXISTS "Insert own debts" ON public.debts;
DROP POLICY IF EXISTS "Update own or admin debts" ON public.debts;
DROP POLICY IF EXISTS "Admin delete debts" ON public.debts;
CREATE POLICY "Read own or admin debts" ON public.debts
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert own debts" ON public.debts
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update own or admin debts" ON public.debts
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete debts" ON public.debts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User roles: only admins can write
DROP POLICY IF EXISTS "Admin insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin delete roles" ON public.user_roles;
CREATE POLICY "Admin insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Finance entries: admin-only reads
DROP POLICY IF EXISTS "All authenticated read finance" ON public.finance_entries;
DROP POLICY IF EXISTS "Admin read finance" ON public.finance_entries;
CREATE POLICY "Admin read finance" ON public.finance_entries
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "All authenticated insert finance" ON public.finance_entries;
DROP POLICY IF EXISTS "Auth insert finance" ON public.finance_entries;
CREATE POLICY "Auth insert finance" ON public.finance_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Tighten permissive products/warehouse writes off "true"
DROP POLICY IF EXISTS "All authenticated insert products" ON public.products;
DROP POLICY IF EXISTS "All authenticated update products" ON public.products;
DROP POLICY IF EXISTS "Auth insert products" ON public.products;
DROP POLICY IF EXISTS "Auth update products" ON public.products;
CREATE POLICY "Auth insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update products" ON public.products
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "All authenticated insert movements" ON public.warehouse_movements;
DROP POLICY IF EXISTS "Auth insert movements" ON public.warehouse_movements;
CREATE POLICY "Auth insert movements" ON public.warehouse_movements
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- SECURITY DEFINER: revoke anon EXECUTE
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_sale_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_debt_payment_insert() FROM PUBLIC, anon, authenticated;
