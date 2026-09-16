# GUVEL Operational — Phase 2.0.C

## Session Lifecycle & Validation

This phase extends the Status module without changing Legacy Capture.

### Included
- Phase label updated to 2.0.C.
- Active machines are disabled in the Start Production selector.
- Client-side protection against starting a second active session on the same machine.
- Finish Session confirmation.
- Active cards show operation information.
- Better lot-number and operation validation.
- Automatic customer selection when a part number contains a customer relationship and no customer has been selected.
- More descriptive status messages and loading states.

### Database
No new migration is required for this phase. It uses the existing `machine_production_sessions` columns already introduced by the previous compatibility fixes.
