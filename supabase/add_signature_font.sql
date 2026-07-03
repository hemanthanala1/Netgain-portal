-- ============================================================
-- SQL DDL Migration: Add signature_font column
-- Run this in Supabase SQL Editor
-- ============================================================

ALTER TABLE document_signatures 
ADD COLUMN IF NOT EXISTS signature_font TEXT;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
