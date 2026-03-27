---
name: posthog-usage-report
description: Generate a Birdhouse app usage report from PostHog showing active users, event counts, locations, and install trends across 1/3/7 day windows. Use when asked for usage report, who is using the app, active users, installs, or user activity.
tags:
  - birdhouse
  - analytics
trigger_phrases:
  - usage report
  - posthog report
version: 1.0.0
author: Birdhouse Team
---

# Birdhouse PostHog Usage Report

Generate a usage report showing who is using the Birdhouse app, from where, and how actively — across 1, 3, and 7 day windows.

## Context

- **PostHog Project:** Named `Birdhouse`
- **App filter:** `properties.product = 'birdhouse-app'` — this excludes the marketing site
- **Known users:**
  - **Cody** (Edmonton, AB, Canada) — the founder/developer, not an external user
  - **Quinlan** (likely appears as Shawnigan Lake, BC, Canada ) — the co-founder/developer, not an external user
  - All others are external users worth highlighting

## Step 1: Switch to Birdhouse Project

Find the Birdhouse project ID by calling `posthog_projects-get`, then switch to it:

```javascript
posthog_projects-get()
// Find the project where name === "Birdhouse", use its id
posthog_switch-project({ projectId: <id> })
```

## Step 2: Run Three Parallel Usage Queries

Run all three time windows in parallel using `posthog_query-run` with HogQL:

```sql
-- Template (swap INTERVAL value for 1 DAY, 3 DAY, 7 DAY)
SELECT
    person.properties.name AS name,
    properties.$geoip_city_name AS city,
    properties.$geoip_country_name AS country,
    count() AS event_count,
    uniq(toDate(timestamp)) AS active_days,
    min(timestamp) AS first_seen,
    max(timestamp) AS last_seen
FROM events
WHERE timestamp >= now() - INTERVAL N DAY
  AND properties.product = 'birdhouse-app'
GROUP BY name, city, country
ORDER BY event_count DESC
LIMIT 100
```

Use `posthog_query-run` with `DataVisualizationNode` + `HogQLQuery` kind.

## Step 3: Run Install Queries in Parallel

Run both of these alongside the usage queries.

**Install trend (daily counts):**
```javascript
posthog_query-trends({
  series: [{ kind: "EventsNode", event: "install", math: "total" }],
  dateRange: { date_from: "-5d" },
  interval: "day"
})
```

**Install detail (per-event info):**
```sql
SELECT
    timestamp,
    distinct_id,
    person.properties.name AS name,
    properties.$geoip_city_name AS city,
    properties.$geoip_subdivision_1_name AS region,
    properties.$geoip_country_name AS country,
    properties.$os AS os,
    properties.$browser AS browser,
    properties.$device_type AS device_type,
    properties.$raw_user_agent AS user_agent
FROM events
WHERE event = 'install'
  AND timestamp >= now() - INTERVAL 5 DAY
ORDER BY timestamp DESC
LIMIT 100
```

Use `posthog_query-run` with `DataVisualizationNode` + `HogQLQuery` kind.

## Step 4: Format the Report

Present three tables (Today, 3 Days, 7 Days) with these columns:

| Name | Location | Events | Active Days | First Seen | Last Seen |
|------|----------|--------|-------------|------------|-----------|

**Annotation rules:**
- Cody Rayment (Edmonton) → append `*(Cody, founder)*`
- Any other named or located user → highlight as external user
- `null` name → show as `*(anon)*`

Then show installs in two parts:
1. A daily count table for the last 5 days with a total
2. A per-install detail table with every available field — timestamp, name (if identified), location, OS, browser, device type, user agent, and distinct_id. If `distinct_id` is `local-tarball` note it as a tarball/CLI install with no browser context. If most fields are null (e.g. CLI installs), still show the row — null fields are informative.

## Step 5: Summary Callouts

After the tables, add a brief summary:
- Total external users seen in the 7-day window (excluding Cody and Quinlan)
- Most active day for installs
- Any new named users who appeared for the first time

## Example Output Structure

```
### Today

| Name | Location | Events | Active |
|------|----------|--------|--------|
| Alice *(internal)* | City, Country | 397 | ~19 hrs |
| Bob | City, Country | 44 | ~3 hrs |

### Last 3 Days
...

### Last 7 Days
...

### Installs (Last 5 Days)

| Date | Installs |
|------|----------|
| Mar 21 | 1 |
| Mar 25 | 1 |
Total: N installs

### Install Details

| Time | Name | Location | OS | Browser | Device | User Agent | ID |
|------|------|----------|----|---------|--------|------------|----|
| Mar 25 17:15 | *(anon)* | Edmonton, AB, Canada | — | — | — | — | `local-tarball` *(CLI install)* |
| Mar 21 09:00 | Bob | City, Country | Mac OS X | Chrome | Desktop | Mozilla/5.0... | `abc123` |

### Summary
- X external users in the last 7 days: Bob (City), Carol (Country)
- Most active install day: Mar 17 (3 installs)
- New this period: Bob (first seen today)
```

## Notes

- All three usage queries and the install query can run in parallel — do this for speed
- Do NOT use `countDistinct()` — HogQL requires `uniq()` instead
- The `person.properties.name` join in HogQL pulls names without needing separate person lookups
- Data is in UTC; times shown should be converted to a human-readable relative format where helpful
