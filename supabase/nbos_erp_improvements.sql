-- 1. Create Business Types master table
CREATE TABLE IF NOT EXISTS public.business_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'active', -- 'active', 'archived'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and public policies for business_types
ALTER TABLE public.business_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Business Types" ON public.business_types;
CREATE POLICY "Public Full Access Business Types" ON public.business_types FOR ALL USING (true) WITH CHECK (true);

-- Seed initial Business Types
INSERT INTO public.business_types (name, status) VALUES
('Restaurant', 'active'),
('Hospital', 'active'),
('School', 'active'),
('College', 'active'),
('Software Company', 'active'),
('Construction', 'active'),
('Real Estate', 'active'),
('Manufacturing', 'active'),
('Retail', 'active'),
('Ecommerce', 'active'),
('Healthcare', 'active'),
('Education', 'active'),
('Other', 'active')
ON CONFLICT (name) DO NOTHING;

-- 2. Alter crm_clients table to support Billing/Shipping Addresses and PAN
ALTER TABLE public.crm_clients ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE public.crm_clients ADD COLUMN IF NOT EXISTS shipping_address TEXT;
ALTER TABLE public.crm_clients ADD COLUMN IF NOT EXISTS pan TEXT;

-- 3. Alter crm_notes table to support soft delete and auditing
ALTER TABLE public.crm_notes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.crm_notes ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 4. Alter quotations, sows, agreements to support overall discount levels and metadata
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;

ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS gst_pct NUMERIC DEFAULT 18;
ALTER TABLE public.sows ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage';
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS gst_pct NUMERIC DEFAULT 18;
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS notes TEXT;

-- 5. Create Line Item Tables for documents
-- Quotation Items
CREATE TABLE IF NOT EXISTS public.quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id TEXT NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    service_id TEXT REFERENCES public.services(id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0, -- discount amount at item level
    tax NUMERIC NOT NULL DEFAULT 0, -- tax percentage snapshot
    total NUMERIC NOT NULL DEFAULT 0, -- line total
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Quotation Items" ON public.quotation_items;
CREATE POLICY "Public Full Access Quotation Items" ON public.quotation_items FOR ALL USING (true) WITH CHECK (true);

-- Invoice Items
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id TEXT NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    service_id TEXT REFERENCES public.services(id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0,
    tax NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Invoice Items" ON public.invoice_items;
CREATE POLICY "Public Full Access Invoice Items" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);

-- SOW Items
CREATE TABLE IF NOT EXISTS public.sow_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sow_id TEXT NOT NULL REFERENCES public.sows(id) ON DELETE CASCADE,
    service_id TEXT REFERENCES public.services(id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0,
    tax NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.sow_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access SOW Items" ON public.sow_items;
CREATE POLICY "Public Full Access SOW Items" ON public.sow_items FOR ALL USING (true) WITH CHECK (true);

-- Agreement Items
CREATE TABLE IF NOT EXISTS public.agreement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id TEXT NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
    service_id TEXT REFERENCES public.services(id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    description TEXT,
    quantity NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0,
    tax NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.agreement_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access Agreement Items" ON public.agreement_items;
CREATE POLICY "Public Full Access Agreement Items" ON public.agreement_items FOR ALL USING (true) WITH CHECK (true);

-- 6. Add Constraints for Validations
-- Negative Price / Quantity and Discount constraints
ALTER TABLE public.quotation_items DROP CONSTRAINT IF EXISTS chk_qty;
ALTER TABLE public.quotation_items ADD CONSTRAINT chk_qty CHECK (quantity >= 0);
ALTER TABLE public.quotation_items DROP CONSTRAINT IF EXISTS chk_price;
ALTER TABLE public.quotation_items ADD CONSTRAINT chk_price CHECK (unit_price >= 0);
ALTER TABLE public.quotation_items DROP CONSTRAINT IF EXISTS chk_discount;
ALTER TABLE public.quotation_items ADD CONSTRAINT chk_discount CHECK (discount >= 0 AND discount <= (unit_price * quantity));

ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS chk_qty;
ALTER TABLE public.invoice_items ADD CONSTRAINT chk_qty CHECK (quantity >= 0);
ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS chk_price;
ALTER TABLE public.invoice_items ADD CONSTRAINT chk_price CHECK (unit_price >= 0);
ALTER TABLE public.invoice_items DROP CONSTRAINT IF EXISTS chk_discount;
ALTER TABLE public.invoice_items ADD CONSTRAINT chk_discount CHECK (discount >= 0 AND discount <= (unit_price * quantity));

ALTER TABLE public.sow_items DROP CONSTRAINT IF EXISTS chk_qty;
ALTER TABLE public.sow_items ADD CONSTRAINT chk_qty CHECK (quantity >= 0);
ALTER TABLE public.sow_items DROP CONSTRAINT IF EXISTS chk_price;
ALTER TABLE public.sow_items ADD CONSTRAINT chk_price CHECK (unit_price >= 0);
ALTER TABLE public.sow_items DROP CONSTRAINT IF EXISTS chk_discount;
ALTER TABLE public.sow_items ADD CONSTRAINT chk_discount CHECK (discount >= 0 AND discount <= (unit_price * quantity));

ALTER TABLE public.agreement_items DROP CONSTRAINT IF EXISTS chk_qty;
ALTER TABLE public.agreement_items ADD CONSTRAINT chk_qty CHECK (quantity >= 0);
ALTER TABLE public.agreement_items DROP CONSTRAINT IF EXISTS chk_price;
ALTER TABLE public.agreement_items ADD CONSTRAINT chk_price CHECK (unit_price >= 0);
ALTER TABLE public.agreement_items DROP CONSTRAINT IF EXISTS chk_discount;
ALTER TABLE public.agreement_items ADD CONSTRAINT chk_discount CHECK (discount >= 0 AND discount <= (unit_price * quantity));

-- Overall discount constraints
ALTER TABLE public.quotations DROP CONSTRAINT IF EXISTS chk_discount_val;
ALTER TABLE public.quotations ADD CONSTRAINT chk_discount_val CHECK (discount_value >= 0);
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS chk_discount_val;
ALTER TABLE public.invoices ADD CONSTRAINT chk_discount_val CHECK (discount_value >= 0);
ALTER TABLE public.sows DROP CONSTRAINT IF EXISTS chk_discount_val;
ALTER TABLE public.sows ADD CONSTRAINT chk_discount_val CHECK (discount_value >= 0);
ALTER TABLE public.agreements DROP CONSTRAINT IF EXISTS chk_discount_val;
ALTER TABLE public.agreements ADD CONSTRAINT chk_discount_val CHECK (discount_value >= 0);

-- 7. Trigger to prevent selecting Inactive/Draft/Archived Services at DB level
CREATE OR REPLACE FUNCTION public.check_active_service_item()
RETURNS TRIGGER AS $$
DECLARE
    svc_status TEXT;
BEGIN
    IF NEW.service_id IS NOT NULL THEN
        SELECT status INTO svc_status FROM public.services WHERE id = NEW.service_id;
        IF svc_status IS DISTINCT FROM 'active' THEN
            RAISE EXCEPTION 'Service with ID % is not active (status is %)', NEW.service_id, svc_status;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind validation triggers to items tables
DROP TRIGGER IF EXISTS trigger_check_active_quotation_item ON public.quotation_items;
CREATE TRIGGER trigger_check_active_quotation_item
BEFORE INSERT OR UPDATE ON public.quotation_items
FOR EACH ROW EXECUTE FUNCTION public.check_active_service_item();

DROP TRIGGER IF EXISTS trigger_check_active_invoice_item ON public.invoice_items;
CREATE TRIGGER trigger_check_active_invoice_item
BEFORE INSERT OR UPDATE ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.check_active_service_item();

DROP TRIGGER IF EXISTS trigger_check_active_sow_item ON public.sow_items;
CREATE TRIGGER trigger_check_active_sow_item
BEFORE INSERT OR UPDATE ON public.sow_items
FOR EACH ROW EXECUTE FUNCTION public.check_active_service_item();

DROP TRIGGER IF EXISTS trigger_check_active_agreement_item ON public.agreement_items;
CREATE TRIGGER trigger_check_active_agreement_item
BEFORE INSERT OR UPDATE ON public.agreement_items
FOR EACH ROW EXECUTE FUNCTION public.check_active_service_item();

-- 8. Add new tables to Supabase realtime publication
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN 
    SELECT tablename FROM (
      VALUES ('business_types'), ('quotation_items'), ('invoice_items'), ('sow_items'), ('agreement_items')
    ) AS t(tablename)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = tbl.tablename
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl.tablename
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl.tablename);
    END IF;
  END LOOP;
END
$$;

-- 9. Create crm_notes_history table to support edit history / audit log
CREATE TABLE IF NOT EXISTS public.crm_notes_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.crm_notes(id) ON DELETE CASCADE,
    content_before TEXT,
    content_after TEXT,
    edited_by TEXT,
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.crm_notes_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Full Access CRM Notes History" ON public.crm_notes_history;
CREATE POLICY "Public Full Access CRM Notes History" ON public.crm_notes_history FOR ALL USING (true) WITH CHECK (true);

-- Trigger to automatically log edits to crm_notes_history
CREATE OR REPLACE FUNCTION public.audit_crm_notes_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.content IS DISTINCT FROM NEW.content) OR (OLD.is_deleted IS DISTINCT FROM NEW.is_deleted) THEN
        INSERT INTO public.crm_notes_history (note_id, content_before, content_after, edited_by, edited_at)
        VALUES (
            NEW.id,
            OLD.content,
            NEW.content,
            NEW.author,
            timezone('utc'::text, now())
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_crm_notes_update ON public.crm_notes;
CREATE TRIGGER trigger_audit_crm_notes_update
BEFORE UPDATE ON public.crm_notes
FOR EACH ROW EXECUTE FUNCTION public.audit_crm_notes_update();

-- Add crm_notes_history to realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'crm_notes_history'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'crm_notes_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_notes_history;
  END IF;
END
$$;

