-- Prefix-aware, phone-aware workspace search.
--
-- Two gaps this closes, both found by driving the ⌘K palette against real data:
--
-- 1. Phone was never in the contact search vector at all
--    (contact_search_tsv took firstName/lastName/email/jobTitle only). Sales
--    teams look people up by the number that called yesterday, not by name, so
--    the one lookup that has to be fast was the one that could not be done.
--
-- 2. plainto_tsquery only matches whole lexemes. Typing "anj" returned nothing
--    while "anjali" returned the contact — so the palette looked broken during
--    the exact window in which it is being used, and the failure was
--    indistinguishable from "the feature does not work".
--
-- On stemming the query term, which is the subtle part of prefix matching: the
-- indexed lexeme for "running" is "run", because the vector was built with the
-- 'english' config. A naive `'running':*` would never match it. So the query
-- is stemmed with the same config first, then the prefix operator is applied to
-- each resulting lexeme.
--
-- Phone is indexed digits-only and with the 'simple' config: "+91 98250 12345"
-- is otherwise three separate lexemes, so pasting the number as one contiguous
-- string would match none of them.

-- Prefix tsquery, stemmed with the same config the vectors were built with.
-- Empty/blank input yields NULL, and `tsvector @@ NULL` is NULL (falsy), so a
-- blank query matches nothing rather than erroring or matching everything.
CREATE OR REPLACE FUNCTION prefix_tsquery(q text)
RETURNS tsquery LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT (
    SELECT string_agg(lex || ':*', ' & ')
    FROM unnest(tsvector_to_array(to_tsvector('english', btrim(COALESCE(q, ''))))) AS lex
  )::tsquery
$$;

CREATE OR REPLACE FUNCTION contact_search_tsv(
  firstName text, lastName text, email text, jobTitle text, phone text
)
RETURNS tsvector LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT setweight(to_tsvector('english', COALESCE(firstName,'')), 'A') ||
         setweight(to_tsvector('english', COALESCE(lastName,'')),  'A') ||
         setweight(to_tsvector('english', COALESCE(email,'')),      'B') ||
         setweight(to_tsvector('english', COALESCE(jobTitle,'')),   'C') ||
         setweight(to_tsvector('simple', p.digits), 'A') ||
         -- Also the national form, without the country code.
         --
         -- Indexing only the digits as stored means "+91 98250 12345" becomes
         -- the single lexeme 919825012345, and a person searching the number
         -- they are looking at — 98250 12345, the way it is written on a
         -- visiting card — matches nothing. Both forms are indexed so either
         -- spelling finds the contact.
         setweight(
           to_tsvector(
             'simple',
             CASE WHEN length(p.digits) > 10 THEN right(p.digits, 10) ELSE p.digits END
           ),
           'A'
         )
  FROM (
    SELECT regexp_replace(COALESCE(phone, ''), '\D', '', 'g') AS digits
  ) p
$$;

-- The index is defined over the function call, so changing the signature
-- changes the expression. CREATE INDEX IF NOT EXISTS would silently keep the
-- old index and the new query would fall back to a sequential scan.
DROP INDEX IF EXISTS "Contact_search_expr_idx";
CREATE INDEX "Contact_search_expr_idx"
  ON "Contact" USING GIN (
    contact_search_tsv("firstName", "lastName", "email", "jobTitle", "phone")
  );

-- Unchanged functions, but keep these idempotent so a re-run repairs an index
-- that was dropped by hand.
CREATE INDEX IF NOT EXISTS "Organization_search_expr_idx"
  ON "Organization" USING GIN (organization_search_tsv("name", "domain", "industry"));

CREATE INDEX IF NOT EXISTS "Deal_search_expr_idx"
  ON "Deal" USING GIN (deal_search_tsv("title"));