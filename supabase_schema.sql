-- Run this in your Supabase SQL Editor
CREATE TABLE simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- (Optional) If you want to enable Row Level Security later
-- ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
