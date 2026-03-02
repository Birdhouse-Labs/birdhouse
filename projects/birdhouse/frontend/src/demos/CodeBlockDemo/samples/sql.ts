// ABOUTME: SQL code sample for syntax highlighting demo
// ABOUTME: Demonstrates DDL, complex queries, CTEs, and window functions

import type { CodeSample } from "./types";

export const sql: CodeSample = {
  id: "sql",
  name: "SQL",
  language: "sql",
  description: "Analytics queries for a startup that measures everything except profit",
  code: `-- Startup Analytics Database
-- "We're not profitable, but our metrics are amazing"

-- Track every micro-interaction because data is the new oil
CREATE TABLE user_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- We track time to the microsecond because we're "data-driven"
    processed_at TIMESTAMPTZ,
    attribution_source VARCHAR(255) -- Always seems to be "organic"
);

CREATE INDEX idx_events_user_time ON user_events (user_id, created_at DESC);
CREATE INDEX idx_events_type ON user_events (event_type) WHERE event_type != 'page_view';

-- The query that runs every board meeting
-- Runtime: 47 seconds. Results: Confusing but impressive-looking.
WITH monthly_cohorts AS (
    SELECT 
        DATE_TRUNC('month', u.created_at) AS cohort_month,
        COUNT(DISTINCT u.id) AS cohort_size
    FROM users u
    WHERE u.created_at >= NOW() - INTERVAL '12 months'
    GROUP BY 1
),
user_activity AS (
    SELECT 
        u.id AS user_id,
        DATE_TRUNC('month', u.created_at) AS cohort_month,
        DATE_TRUNC('month', e.created_at) AS activity_month,
        COUNT(*) AS event_count
    FROM users u
    LEFT JOIN user_events e ON u.id = e.user_id
    WHERE u.created_at >= NOW() - INTERVAL '12 months'
    GROUP BY 1, 2, 3
),
retention_matrix AS (
    SELECT 
        ua.cohort_month,
        ua.activity_month,
        COUNT(DISTINCT ua.user_id) AS active_users,
        mc.cohort_size,
        EXTRACT(MONTH FROM AGE(ua.activity_month, ua.cohort_month)) AS months_since_signup
    FROM user_activity ua
    JOIN monthly_cohorts mc ON ua.cohort_month = mc.cohort_month
    WHERE ua.activity_month IS NOT NULL
    GROUP BY 1, 2, 4
)
SELECT 
    TO_CHAR(cohort_month, 'Mon YYYY') AS cohort,
    cohort_size AS "Users Acquired",
    ROUND(100.0 * active_users / NULLIF(cohort_size, 0), 1) AS "Retention %",
    months_since_signup AS "Month #",
    -- The magic number that makes investors happy
    ROUND(active_users * 29.99 * 0.7, 2) AS "Projected MRR"
FROM retention_matrix
WHERE months_since_signup <= 6
ORDER BY cohort_month DESC, months_since_signup;

-- Find power users (people who haven't realized there are other apps)
SELECT 
    u.email,
    u.name,
    COUNT(*) AS total_events,
    COUNT(DISTINCT DATE(e.created_at)) AS active_days,
    MAX(e.created_at) AS last_seen,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY 
        EXTRACT(EPOCH FROM (e.created_at - LAG(e.created_at) OVER (
            PARTITION BY e.user_id ORDER BY e.created_at
        )))
    ) AS median_session_gap_seconds
FROM users u
JOIN user_events e ON u.id = e.user_id
WHERE e.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.email, u.name
HAVING COUNT(*) > 100
ORDER BY total_events DESC
LIMIT 50;`,
};
