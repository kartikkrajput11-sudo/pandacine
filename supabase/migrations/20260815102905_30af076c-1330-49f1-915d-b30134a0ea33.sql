CREATE TABLE public.mart_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_no text NOT NULL UNIQUE,
  buyer_id uuid NOT NULL,
  partner_id uuid,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total integer NOT NULL DEFAULT 0,
  buyer_share integer NOT NULL DEFAULT 0,
  partner_share integer NOT NULL DEFAULT 0,
  split_status text NOT NULL DEFAULT 'none',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

GRANT SELECT ON public.mart_orders TO authenticated;
GRANT ALL ON public.mart_orders TO service_role;

ALTER TABLE public.mart_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer and partner can view their orders"
  ON public.mart_orders FOR SELECT TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = partner_id);

CREATE INDEX mart_orders_buyer_idx ON public.mart_orders (buyer_id, created_at DESC);
CREATE INDEX mart_orders_partner_idx ON public.mart_orders (partner_id, created_at DESC);