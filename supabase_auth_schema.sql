-- ⚠️ WARNING: This will drop your existing simulations table and erase the old runs!
-- (You authorized this "fresh start" in the Implementation Plan)

DROP TABLE IF EXISTS simulations;

CREATE TABLE simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_id UUID UNIQUE,
    idea TEXT NOT NULL,
    target_audience TEXT,
    market TEXT,
    revenue_model TEXT,
    constraints TEXT,
    business_plan JSONB,
    final_report TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only select their own simulations
CREATE POLICY "Users can view their own simulations"
ON simulations FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can only insert their own simulations
-- (Note: Since our backend uses the Service Role key to insert, the backend bypasses this policy anyway, 
-- but it's best practice to have it defined in case you insert from the frontend later).
CREATE POLICY "Users can insert their own simulations"
ON simulations FOR INSERT
WITH CHECK (auth.uid() = user_id);
