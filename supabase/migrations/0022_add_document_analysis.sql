-- Add AI analysis fields to job_documents for storing analysis results from OpenAI vision API
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS analysis_data JSONB DEFAULT NULL;
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS analysis_status TEXT DEFAULT NULL;
ALTER TABLE job_documents ADD COLUMN IF NOT EXISTS analysis_created_at TIMESTAMP DEFAULT NULL;

-- Create index for efficient querying of analyzed documents
CREATE INDEX IF NOT EXISTS idx_job_documents_analysis ON job_documents(job_id, analysis_status) WHERE analysis_status IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN job_documents.analysis_data IS 'JSON data containing AI analysis results from OpenAI vision API';
COMMENT ON COLUMN job_documents.analysis_status IS 'Status of analysis: pending, completed, failed';
COMMENT ON COLUMN job_documents.analysis_created_at IS 'Timestamp when analysis was completed';
