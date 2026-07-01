const dotenv = require('dotenv');
const { join } = require('path');

dotenv.config({ path: join(__dirname, '../.env') });

const pool = require('./client.cjs');

async function migrateSharedMemory() {
  if (!pool) {
    console.log("⚠️ Database disabled - skipping shared memory migration");
    return;
  }

  try {
    console.log("🔄 Running shared memory migration...");

    // Ensure pgvector extension
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // Create shared_memory table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shared_memory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        memory_type TEXT NOT NULL CHECK (memory_type IN (
          'decisions', 'research', 'architecture', 'deployments',
          'customer_context', 'automation_knowledge'
        )),
        title TEXT NOT NULL,
        content JSONB NOT NULL,
        confidence DECIMAL(3,2) DEFAULT 0.80 CHECK (confidence >= 0 AND confidence <= 1),
        related_graph_nodes TEXT[] DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        parent_id UUID REFERENCES shared_memory(id) ON DELETE SET NULL,
        embedding vector(1536),
        tenant_id TEXT DEFAULT 'global',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_shared_memory_agent ON shared_memory(agent_id);
      CREATE INDEX IF NOT EXISTS idx_shared_memory_type ON shared_memory(memory_type);
      CREATE INDEX IF NOT EXISTS idx_shared_memory_tenant ON shared_memory(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_shared_memory_created ON shared_memory(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_shared_memory_tags ON shared_memory USING GIN(tags);
      CREATE INDEX IF NOT EXISTS idx_shared_memory_graph_nodes ON shared_memory USING GIN(related_graph_nodes);
    `);

    // Create memory_conflicts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS memory_conflicts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        memory_a_id UUID NOT NULL REFERENCES shared_memory(id) ON DELETE CASCADE,
        memory_b_id UUID NOT NULL REFERENCES shared_memory(id) ON DELETE CASCADE,
        conflict_type TEXT NOT NULL CHECK (conflict_type IN ('contradiction', 'duplication', 'outdated')),
        severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        resolution TEXT,
        resolved_by TEXT,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_conflicts_memory_a ON memory_conflicts(memory_a_id);
      CREATE INDEX IF NOT EXISTS idx_conflicts_memory_b ON memory_conflicts(memory_b_id);
      CREATE INDEX IF NOT EXISTS idx_conflicts_severity ON memory_conflicts(severity);
    `);

    // Create memory_references table (citation tracking)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS memory_references (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_memory_id UUID NOT NULL REFERENCES shared_memory(id) ON DELETE CASCADE,
        referenced_memory_id UUID NOT NULL REFERENCES shared_memory(id) ON DELETE CASCADE,
        reference_type TEXT NOT NULL CHECK (reference_type IN ('supports', 'contradicts', 'builds_on', 'cites', 'related')),
        context TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source_memory_id, referenced_memory_id, reference_type)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_refs_source ON memory_references(source_memory_id);
      CREATE INDEX IF NOT EXISTS idx_refs_target ON memory_references(referenced_memory_id);
    `);

    console.log("✅ Shared memory migration completed");
  } catch (err) {
    console.error("❌ Shared memory migration failed:", err.message);
    throw err;
  }
}

if (require.main === module) {
  migrateSharedMemory()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { migrateSharedMemory };
