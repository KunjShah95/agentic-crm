-- Search tsvector helper functions + GIN indexes (replaces the stored
-- searchVector columns dropped in 20260902060046). The functions are called by
-- modules/search/queries.ts, so queries stay index-backed via expression match.
-- Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION contact_search_tsv(firstName text, lastName text, email text, jobTitle text)
RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english', COALESCE(firstName,'')), 'A') ||
         setweight(to_tsvector('english', COALESCE(lastName,'')),  'A') ||
         setweight(to_tsvector('english', COALESCE(email,'')),      'B') ||
         setweight(to_tsvector('english', COALESCE(jobTitle,'')),   'C')
$$;

CREATE OR REPLACE FUNCTION organization_search_tsv(name text, domain text, industry text)
RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english', COALESCE(name,'')),     'A') ||
         setweight(to_tsvector('english', COALESCE(domain,'')),   'B') ||
         setweight(to_tsvector('english', COALESCE(industry,'')), 'C')
$$;

CREATE OR REPLACE FUNCTION deal_search_tsv(title text)
RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT to_tsvector('english', COALESCE(title,''))
$$;

CREATE INDEX IF NOT EXISTS "Contact_search_expr_idx"
  ON "Contact" USING GIN (contact_search_tsv("firstName", "lastName", "email", "jobTitle"));

CREATE INDEX IF NOT EXISTS "Organization_search_expr_idx"
  ON "Organization" USING GIN (organization_search_tsv("name", "domain", "industry"));

CREATE INDEX IF NOT EXISTS "Deal_search_expr_idx"
  ON "Deal" USING GIN (deal_search_tsv("title"));
