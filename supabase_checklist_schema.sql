-- Run this in your Supabase SQL Editor
-- Creates the checklist_items table for tracking user progress on simulation action items

CREATE TABLE checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_id UUID NOT NULL REFERENCES simulations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('go_to_market', 'product_mvp')),
    item_index INTEGER NOT NULL,
    item_text TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate entries for the same item in a simulation
    UNIQUE(simulation_id, category, item_index)
);

-- Index for fast lookups by simulation
CREATE INDEX idx_checklist_simulation ON checklist_items(simulation_id);

-- Index for fast lookups by user
CREATE INDEX idx_checklist_user ON checklist_items(user_id);

-- Enable Row Level Security
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own checklist items
CREATE POLICY "Users can view own checklist items" ON checklist_items
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own checklist items
CREATE POLICY "Users can insert own checklist items" ON checklist_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own checklist items
CREATE POLICY "Users can update own checklist items" ON checklist_items
    FOR UPDATE USING (auth.uid() = user_id);
