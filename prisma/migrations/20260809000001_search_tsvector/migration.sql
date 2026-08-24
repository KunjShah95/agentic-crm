-- Add stored tsvector columns + GIN indexes for workspace-scoped full-text search
-- Keeps Prisma schema unchanged (columns are managed via raw SQL) — search queries use them when present
-- Falls back gracefully via trigger-updated columns.

-- Contact.searchVector  (firstName + lastName + email + jobTitle)
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;
CREATE INDEX IF NOT EXISTS "Contact_searchVector_idx" ON "Contact" USING GIN ("searchVector");
CREATE INDEX IF NOT EXISTS "Contact_workspace_search_idx" ON "Contact" ("workspaceId", "searchVector");

-- Organization.searchVector (name + domain + industry)
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;
CREATE INDEX IF NOT EXISTS "Organization_searchVector_idx" ON "Organization" USING GIN ("searchVector");

-- Deal.searchVector (title)
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;
CREATE INDEX IF NOT EXISTS "Deal_searchVector_idx" ON "Deal" USING GIN ("searchVector");

-- Triggers to keep searchVector in sync
CREATE OR REPLACE FUNCTION contact_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW."firstName",'')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."lastName",'')),  'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."email",'')),      'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."jobTitle",'')),   'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_search_vector_trigger ON "Contact";
CREATE TRIGGER contact_search_vector_trigger
BEFORE INSERT OR UPDATE OF "firstName", "lastName", "email", "jobTitle" ON "Contact"
FOR EACH ROW EXECUTE FUNCTION contact_search_vector_update();

CREATE OR REPLACE FUNCTION organization_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', COALESCE(NEW."name",'')),     'A') ||
    setweight(to_tsvector('english', COALESCE(NEW."domain",'')),   'B') ||
    setweight(to_tsvector('english', COALESCE(NEW."industry",'')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS organization_search_vector_trigger ON "Organization";
CREATE TRIGGER organization_search_vector_trigger
BEFORE INSERT OR UPDATE OF "name", "domain", "industry" ON "Organization"
FOR EACH ROW EXECUTE FUNCTION organization_search_vector_update();

CREATE OR REPLACE FUNCTION deal_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', COALESCE(NEW."title",''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deal_search_vector_trigger ON "Deal";
CREATE TRIGGER deal_search_vector_trigger
BEFORE INSERT OR UPDATE OF "title" ON "Deal"
FOR EACH ROW EXECUTE FUNCTION deal_search_vector_update();

-- Backfill existing rows
UPDATE "Contact" SET "searchVector" =
  setweight(to_tsvector('english', COALESCE("firstName",'')), 'A') ||
  setweight(to_tsvector('english', COALESCE("lastName",'')),  'A') ||
  setweight(to_tsvector('english', COALESCE("email",'')),      'B') ||
  setweight(to_tsvector('english', COALESCE("jobTitle",'')),   'C')
WHERE "searchVector" IS NULL;

UPDATE "Organization" SET "searchVector" =
  setweight(to_tsvector('english', COALESCE("name",'')),     'A') ||
  setweight(to_tsvector('english', COALESCE("domain",'')),   'B') ||
  setweight(to_tsvector('english', COALESCE("industry",'')), 'C')
WHERE "searchVector" IS NULL;

UPDATE "Deal" SET "searchVector" = to_tsvector('english', COALESCE("title",''))
WHERE "searchVector" IS NULL;
