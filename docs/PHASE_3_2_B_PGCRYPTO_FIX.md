# GUVEL Operational — Phase 3.2.B
## Fix: "function gen_salt(unknown) does not exist"

Base: Phase 3.2.A

### Cause
Supabase installs the `pgcrypto` extension into its own `extensions` schema, not `public`. Phase
3.2.A's two functions (`set_personnel_pin`, `verify_personnel_pin`) pinned `search_path = public`,
so their unqualified calls to `gen_salt()` and `crypt()` couldn't find pgcrypto at all — hence the
error when saving a PIN from Personnel.

### Fix
`sql/025_phase_3_2_B_pgcrypto_search_path_fix.sql` recreates both functions with
`search_path = public, extensions`, so they find pgcrypto's functions wherever your project
installed them, and re-runs `create extension if not exists pgcrypto` defensively. No changes to
`js/app.js` or `css/style.css` — this is a database-only fix. Run this migration, then Set PIN
again from Personnel.
