const pool = require("./client.cjs");

async function logInfo({
  jobId,
  engine,
  status,
  tenant_id = 'default',
  input = null,
  output = null,
  error = null,
}) {
  if (!pool) {
    console.log("⚠️ Log skipped (DB disabled)");
    return;
  }

  try {
    await pool.query(
      `INSERT INTO logs (job_id, engine, status, tenant_id, input, output, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [jobId, engine, status, tenant_id,
       input !== null && input !== undefined ? JSON.stringify(input) : null,
       output !== null && output !== undefined ? JSON.stringify(output) : null,
       error]
    );
  } catch (err) {
    console.error("❌ Log Error:", err.message);
  }
}

async function logJob({ job_id, job_type, status, tenant_id = 'default', input = null, output = null, error = null }) {
  return logInfo({
    jobId: job_id,
    engine: job_type,
    status,
    tenant_id,
    input,
    output,
    error,
  });
}

module.exports = {
  logInfo,
  logJob,
};