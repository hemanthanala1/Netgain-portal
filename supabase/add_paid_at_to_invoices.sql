-- Migration: Add paid_at column to invoices table
-- Run this in your Supabase SQL editor

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT NULL;

-- Optional: Update existing invoices that already have status 'paid'
-- UPDATE invoices SET paid_at = updated_at WHERE status = 'paid' AND paid_at IS NULL;
