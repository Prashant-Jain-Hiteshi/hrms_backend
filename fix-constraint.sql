-- Remove the unique constraint from leave_types table
ALTER TABLE leave_types DROP CONSTRAINT IF EXISTS leave_types_name_key;

-- Verify the constraint is removed
\d leave_types;
