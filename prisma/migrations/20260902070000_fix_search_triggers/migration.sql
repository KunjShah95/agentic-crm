-- Fix broken searchVector triggers left by 20260902060046 (idempotent, for DBs that already applied it)
DROP TRIGGER IF EXISTS contact_search_vector_trigger ON "Contact";
DROP TRIGGER IF EXISTS organization_search_vector_trigger ON "Organization";
DROP TRIGGER IF EXISTS deal_search_vector_trigger ON "Deal";
DROP FUNCTION IF EXISTS contact_search_vector_update() CASCADE;
DROP FUNCTION IF EXISTS organization_search_vector_update() CASCADE;
DROP FUNCTION IF EXISTS deal_search_vector_update() CASCADE;

