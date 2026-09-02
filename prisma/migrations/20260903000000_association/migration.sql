-- Association network (P0 moat) + buyer portal
CREATE TABLE IF NOT EXISTS \"Association\" (
  \"id\" TEXT PRIMARY KEY,
  \"slug\" TEXT UNIQUE NOT NULL,
  \"name\" TEXT NOT NULL,
  \"city\" TEXT NOT NULL DEFAULT 'Ahmedabad',
  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS \"Association_slug_idx\" ON \"Association\"(\"slug\");

CREATE TABLE IF NOT EXISTS \"AssociationMember\" (
  \"id\" TEXT PRIMARY KEY,
  \"associationId\" TEXT NOT NULL REFERENCES \"Association\"(\"id\") ON DELETE CASCADE,
  \"workspaceId\" TEXT NOT NULL REFERENCES \"Workspace\"(\"id\") ON DELETE CASCADE,
  \"role\" TEXT NOT NULL DEFAULT 'MEMBER',
  \"joinedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(\"associationId\", \"workspaceId\")
);
CREATE INDEX IF NOT EXISTS \"AssociationMember_workspaceId_idx\" ON \"AssociationMember\"(\"workspaceId\");

CREATE TABLE IF NOT EXISTS \"AssociationLead\" (
  \"id\" TEXT PRIMARY KEY,
  \"associationId\" TEXT NOT NULL REFERENCES \"Association\"(\"id\") ON DELETE CASCADE,
  \"contactId\" TEXT UNIQUE NOT NULL REFERENCES \"Contact\"(\"id\") ON DELETE CASCADE,
  \"pooledByWorkspaceId\" TEXT NOT NULL REFERENCES \"Workspace\"(\"id\") ON DELETE CASCADE,
  \"status\" TEXT NOT NULL DEFAULT 'POOLED',
  \"claimedByWorkspaceId\" TEXT REFERENCES \"Workspace\"(\"id\") ON DELETE SET NULL,
  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \"updatedAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS \"AssociationLead_associationId_status_idx\" ON \"AssociationLead\"(\"associationId\", \"status\");

CREATE TABLE IF NOT EXISTS \"AssociationListing\" (
  \"id\" TEXT PRIMARY KEY,
  \"associationId\" TEXT NOT NULL REFERENCES \"Association\"(\"id\") ON DELETE CASCADE,
  \"unitId\" TEXT UNIQUE NOT NULL REFERENCES \"Unit\"(\"id\") ON DELETE CASCADE,
  \"listedByWorkspaceId\" TEXT NOT NULL REFERENCES \"Workspace\"(\"id\") ON DELETE CASCADE,
  \"status\" TEXT NOT NULL DEFAULT 'ACTIVE',
  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS \"AssociationListing_associationId_status_idx\" ON \"AssociationListing\"(\"associationId\", \"status\");

CREATE TABLE IF NOT EXISTS \"Referral\" (
  \"id\" TEXT PRIMARY KEY,
  \"associationId\" TEXT NOT NULL REFERENCES \"Association\"(\"id\") ON DELETE CASCADE,
  \"fromWorkspaceId\" TEXT NOT NULL REFERENCES \"Workspace\"(\"id\") ON DELETE CASCADE,
  \"toWorkspaceId\" TEXT NOT NULL REFERENCES \"Workspace\"(\"id\") ON DELETE CASCADE,
  \"contactId\" TEXT NOT NULL REFERENCES \"Contact\"(\"id\") ON DELETE CASCADE,
  \"dealId\" TEXT REFERENCES \"Deal\"(\"id\") ON DELETE SET NULL,
  \"pct\" DOUBLE PRECISION,
  \"amount\" DOUBLE PRECISION,
  \"status\" TEXT NOT NULL DEFAULT 'PENDING',
  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS \"BuyerPortalAccess\" (
  \"id\" TEXT PRIMARY KEY,
  \"workspaceId\" TEXT NOT NULL REFERENCES \"Workspace\"(\"id\") ON DELETE CASCADE,
  \"contactId\" TEXT NOT NULL REFERENCES \"Contact\"(\"id\") ON DELETE CASCADE,
  \"token\" TEXT UNIQUE NOT NULL,
  \"expiresAt\" TIMESTAMP(3) NOT NULL,
  \"lastSeenAt\" TIMESTAMP(3),
  \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS \"BuyerPortalAccess_workspaceId_idx\" ON \"BuyerPortalAccess\"(\"workspaceId\");
