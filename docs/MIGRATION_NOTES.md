# Database Migration Notes

## Main Migration (`migrate.ts`)

The main migration file (`backend/src/db/migrate.ts`) now includes **all schema changes** in one place. Running `npm run migrate` will set up a complete, fresh database with:

- ✅ All base tables (users, shorts, assignments, files, payments)
- ✅ User roles table (for multiple roles per user)
- ✅ Profile picture and timezone columns
- ✅ All payment-related columns (role, rate_description, completed_at, assignment_id, paypal_transaction_link)
- ✅ Rate columns in assignments table
- ✅ All file types (script_pdf, clips_zip, audio, etc.)
- ✅ All status values (including ready_to_upload)
- ✅ All indexes

## Individual Migration Files

The individual migration files (`migrateRoles.ts`, `migrateProfilePicture.ts`, etc.) are kept for:
- **Updating existing databases** that were created before these features were added
- **Reference** - showing the incremental changes made over time

You **don't need to run them** for fresh database setups - the main migration includes everything.

## When to Use Individual Migrations

Only use individual migration files if:
1. You have an existing database that was created with an older version of `migrate.ts`
2. You need to add a specific feature to an existing database without recreating it

## Fresh Database Setup

For a new database, just run:
```bash
cd backend
npm run migrate
npm run setup-admin
```

That's it! Everything is set up in one step.

