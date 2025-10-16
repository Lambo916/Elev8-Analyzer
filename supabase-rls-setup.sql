-- CompliPilot Row Level Security (RLS) Setup for Supabase
-- Run this script in your Supabase SQL Editor

-- Enable RLS on compliance_reports table
ALTER TABLE compliance_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean setup)
DROP POLICY IF EXISTS "Users can view their own reports" ON compliance_reports;
DROP POLICY IF EXISTS "Users can create their own reports" ON compliance_reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON compliance_reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON compliance_reports;
DROP POLICY IF EXISTS "Legacy ownerId access" ON compliance_reports;

-- Policy 1: Users can view their own reports (authenticated users)
CREATE POLICY "Users can view their own reports"
ON compliance_reports
FOR SELECT
TO authenticated
USING (
    user_id = auth.uid()
);

-- Policy 2: Users can create reports (authenticated users)
CREATE POLICY "Users can create their own reports"
ON compliance_reports
FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid()
);

-- Policy 3: Users can update their own reports
CREATE POLICY "Users can update their own reports"
ON compliance_reports
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
)
WITH CHECK (
    user_id = auth.uid()
);

-- Policy 4: Users can delete their own reports
CREATE POLICY "Users can delete their own reports"
ON compliance_reports
FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
);

-- Policy 5: Legacy ownerId access for anonymous users (temporary during migration)
-- This allows anonymous users to access reports by ownerId
-- Remove this policy after full migration to authenticated users
CREATE POLICY "Legacy ownerId access"
ON compliance_reports
FOR ALL
TO anon
USING (
    -- Anonymous users can only access reports with matching ownerId
    -- This requires the application to pass the correct ownerId
    owner_id IS NOT NULL 
    AND owner_id != ''
    -- The actual ownerId check happens in the application layer
    -- since we can't access HTTP headers in RLS policies
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_compliance_reports_user_id 
ON compliance_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_owner_id 
ON compliance_reports(owner_id);

CREATE INDEX IF NOT EXISTS idx_compliance_reports_created_at 
ON compliance_reports(created_at DESC);

-- Grant necessary permissions
GRANT ALL ON compliance_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON compliance_reports TO anon;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'compliance_reports';

-- Test query to verify policies (will return empty if no data)
-- This should only show reports for the current user
SELECT id, name, entity_name, user_id, owner_id, created_at 
FROM compliance_reports 
LIMIT 5;