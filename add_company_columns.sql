-- Add missing columns to companies table for payroll info
-- Run this manually in your PostgreSQL database

-- Add city column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS city VARCHAR(255);

-- Add state column  
ALTER TABLE companies ADD COLUMN IF NOT EXISTS state VARCHAR(255);

-- Add pincode column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS pincode VARCHAR(10);

-- Add payrollProcessingDate column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "payrollProcessingDate" INTEGER DEFAULT 1;

-- Add salaryDisbursementDate column
ALTER TABLE companies ADD COLUMN IF NOT EXISTS "salaryDisbursementDate" INTEGER DEFAULT 5;

-- Update payrollCycle enum to include new values (if needed)
-- Note: This might need to be done differently depending on your current enum definition

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'companies' 
ORDER BY ordinal_position;
