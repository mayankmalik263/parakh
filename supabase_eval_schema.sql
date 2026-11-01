-- Run this in your Supabase SQL Editor to support the Evaluation & Self-Improvement Framework

-- Track evaluation metrics across sessions
CREATE TABLE IF NOT EXISTS evaluation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    idea TEXT NOT NULL,
    runs_count INTEGER NOT NULL,
    avg_financial_coherence NUMERIC(3,2),
    avg_constraint_adherence NUMERIC(3,2),
    avg_completeness NUMERIC(3,2),
    avg_debate_rounds NUMERIC(3,1),
    consistency_score NUMERIC(3,2),
    detailed_metrics JSONB NOT NULL
);

-- Store learned guidelines/critiques for the self-improvement loop
CREATE TABLE IF NOT EXISTS agent_lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source TEXT NOT NULL,          -- 'evaluation_engine' or 'user_feedback'
    category TEXT NOT NULL,        -- 'pricing', 'gtm', 'financials', 'general'
    tag TEXT NOT NULL,             -- e.g., 'bootstrapped', 'india', 'b2b_saas'
    lesson TEXT NOT NULL,          -- The actual rule/advice to inject
    rating_impact INTEGER          -- -1 for thumbs down feedback, +1 for positive reinforcement
);

-- Enable RLS on new tables (if enabled for existing tables)
ALTER TABLE evaluation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_lessons ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view evaluations and lessons
CREATE POLICY "Users can view evaluations" ON evaluation_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can view agent lessons" ON agent_lessons FOR SELECT TO authenticated USING (true);

-- Migration to update existing simulations table
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS alignment_score NUMERIC(3,2);

