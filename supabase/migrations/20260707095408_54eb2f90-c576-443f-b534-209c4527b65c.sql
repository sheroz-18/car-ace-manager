
CREATE TABLE public.returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
  reason TEXT,
  returned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.returns TO authenticated;
GRANT ALL ON public.returns TO service_role;

ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own returns; admins see all"
  ON public.returns FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated create own returns"
  ON public.returns FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins delete returns"
  ON public.returns FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_returns_updated_at
  BEFORE UPDATE ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.on_return_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
    SET quantity = quantity + NEW.quantity
    WHERE id = NEW.product_id;

  INSERT INTO public.warehouse_movements (product_id, movement_type, quantity, note, created_by)
  VALUES (NEW.product_id, 'incoming', NEW.quantity, COALESCE('Возврат: ' || NEW.reason, 'Возврат'), NEW.created_by);

  IF NEW.refund_amount > 0 THEN
    INSERT INTO public.finance_entries (finance_type, amount, category, description, occurred_at, created_by)
    VALUES ('expense', NEW.refund_amount, 'Возврат', COALESCE(NEW.reason, 'Возврат средств клиенту'), NEW.returned_at, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.on_return_insert() FROM PUBLIC, anon;

CREATE TRIGGER trg_on_return_insert
  AFTER INSERT ON public.returns
  FOR EACH ROW EXECUTE FUNCTION public.on_return_insert();
