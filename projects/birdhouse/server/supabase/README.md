# Platform Database Migrations

This directory contains database migrations for the Birdhouse platform Supabase instance.

## Project Details

- **Project URL**: https://hzqxwcbohrtxyvmmamsn.supabase.co
- **Project Ref**: `hzqxwcbohrtxyvmmamsn`
- **Purpose**: Shared platform database for Birdhouse

## Directory Structure

```
supabase/
├── migrations/          # Versioned SQL migration files (COMMIT THESE)
├── config.toml          # Supabase CLI configuration (COMMIT THIS)
├── .gitignore           # Ignores .temp and .branches
└── README.md            # This file
```

## Migration Workflow

### Creating a New Migration

```bash
# 1. Create a new migration file
cd projects/birdhouse/server
supabase migration new add_feature_description

# 2. Edit the generated file in supabase/migrations/
# Add your SQL DDL statements

# 3. Test the migration (requires Docker)
supabase db reset

# 4. Push to production
supabase db push --linked

# 5. Commit the migration file
git add supabase/migrations/
git commit -m "db: add feature description"
```

### Without Local Development (No Docker)

```bash
supabase migration new my_change
# Edit the SQL file, then push directly
supabase db push --linked
```

⚠️ Pushing without local testing is risky. Consider testing in a staging project first.

### Viewing Migration Status

```bash
supabase migration list
supabase migration list --linked
```

### Emergency: Capturing Manual Changes

If you made changes via the Supabase dashboard (try to avoid this!), capture them:

```bash
supabase db pull  # Requires Docker
# Review the generated migration, then commit
```

## Linking to the Project

```bash
cd projects/birdhouse/server
supabase link --project-ref hzqxwcbohrtxyvmmamsn
```

## Best Practices

1. ✅ **Always use migrations** — Never make schema changes via the SQL editor
2. ✅ **Commit migration files** — They're source code, not generated artifacts
3. ✅ **Descriptive names** — `add_user_preferences` not `migration_1`
4. ✅ **One logical change per migration** — Easier to review and rollback
5. ✅ **Test before pushing** — Use `supabase db reset` locally or on staging
6. ✅ **Include RLS policies** — Document security rules alongside schema

## Rollback Strategy

Supabase CLI doesn't have automatic rollbacks. To revert changes:

```bash
supabase migration new revert_feature_x
# Write SQL to undo the previous change, then push
```

⚠️ Never delete migration files after they've been applied to production.

## Troubleshooting

### "Cannot connect to Docker daemon"
Local features (`db reset`, `db pull`) require Docker. For remote-only work, use `db push` directly.

### "Migration already applied"
```bash
supabase migration list
supabase migration repair <timestamp> --status applied
```

### "Schema drift detected"
Someone made changes outside of migrations:
```bash
supabase db pull  # Requires Docker
```
