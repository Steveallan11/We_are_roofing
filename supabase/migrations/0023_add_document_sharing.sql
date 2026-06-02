-- Add document sharing capability with public tokens
CREATE TABLE IF NOT EXISTS job_document_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES job_documents(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_job_document_shares_token ON job_document_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_job_document_shares_job_id ON job_document_shares(job_id);
CREATE INDEX IF NOT EXISTS idx_job_document_shares_document_id ON job_document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_job_document_shares_active ON job_document_shares(is_active, expires_at);

-- Add comment
COMMENT ON TABLE job_document_shares IS 'Manages public sharing tokens for job documents, allowing customers to access shared files';
COMMENT ON COLUMN job_document_shares.share_token IS 'Unique public token used in share URLs';
COMMENT ON COLUMN job_document_shares.expires_at IS 'Optional expiration date for the share link';
