-- Step 22: granular RBAC permission toggles for department coordinators.
-- Admin and exam-coordinator roles have implicit full access; this column
-- stores the permission map for dept-coordinator accounts. The RBAC middleware
-- reads it on every protected request.
ALTER TABLE "users" ADD COLUMN "permissions" JSONB;
