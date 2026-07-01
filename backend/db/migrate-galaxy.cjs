const dotenv = require('dotenv');
const { join } = require('path');
dotenv.config({ path: join(__dirname, '../.env') });
const pool = require('./client.cjs');

async function migrateGalaxy() {
  if (!pool) { console.log("⚠️ DB disabled"); return; }
  try {
    console.log("🔄 Galaxy + Collaboration + Lessons migration...");

    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // galaxy_nodes - enriched node data for visualization
    await pool.query(`
      CREATE TABLE IF NOT EXISTS galaxy_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        node_type TEXT NOT NULL CHECK (node_type IN (
          'project','client','agent','memory','architecture',
          'research','automation','deployment','sop','lesson','root'
        )),
        ref_id TEXT,
        label TEXT NOT NULL,
        description TEXT DEFAULT '',
        metadata JSONB DEFAULT '{}',
        activity_score DECIMAL(5,2) DEFAULT 0,
        connection_count INTEGER DEFAULT 0,
        last_active TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // galaxy_edges - relationships between nodes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS galaxy_edges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id UUID NOT NULL REFERENCES galaxy_nodes(id) ON DELETE CASCADE,
        target_id UUID NOT NULL REFERENCES galaxy_nodes(id) ON DELETE CASCADE,
        edge_type TEXT NOT NULL DEFAULT 'related',
        weight DECIMAL(3,2) DEFAULT 1.0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(source_id, target_id, edge_type)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_galaxy_nodes_type ON galaxy_nodes(node_type);
      CREATE INDEX IF NOT EXISTS idx_galaxy_edges_source ON galaxy_edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_galaxy_edges_target ON galaxy_edges(target_id);
    `);

    // collaboration_chains - agent collaboration tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS collaboration_chains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chain_name TEXT NOT NULL,
        trigger_memory_id UUID,
        trigger_agent_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','failed','paused')),
        steps JSONB DEFAULT '[]',
        result_summary TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // collaboration_step_logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS collaboration_step_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chain_id UUID NOT NULL REFERENCES collaboration_chains(id) ON DELETE CASCADE,
        step_index INTEGER NOT NULL,
        agent_id TEXT NOT NULL,
        action TEXT NOT NULL,
        input_data JSONB DEFAULT '{}',
        output_data JSONB DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_collab_chains_status ON collaboration_chains(status);
      CREATE INDEX IF NOT EXISTS idx_collab_steps_chain ON collaboration_step_logs(chain_id);
    `);

    // lessons_learned
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons_learned (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_type TEXT NOT NULL CHECK (source_type IN ('deployment','architecture','automation','failure','success','memory_update')),
        source_ref_id TEXT,
        lesson_type TEXT NOT NULL CHECK (lesson_type IN ('pattern','failure_pattern','success_pattern','recommendation','anti_pattern')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        evidence JSONB DEFAULT '[]',
        confidence DECIMAL(3,2) DEFAULT 0.70,
        usefulness_score DECIMAL(3,2) DEFAULT 0.50,
        times_applied INTEGER DEFAULT 0,
        tags TEXT[] DEFAULT '{}',
        related_node_ids UUID[] DEFAULT '{}',
        embedding vector(1536),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_lessons_type ON lessons_learned(lesson_type);
      CREATE INDEX IF NOT EXISTS idx_lessons_source ON lessons_learned(source_type);
      CREATE INDEX IF NOT EXISTS idx_lessons_usefulness ON lessons_learned(usefulness_score DESC);
    `);

    // system_health_snapshots
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_health_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        graph_density DECIMAL(5,4) DEFAULT 0,
        memory_connectivity DECIMAL(5,4) DEFAULT 0,
        agent_collaboration_score DECIMAL(5,4) DEFAULT 0,
        knowledge_reuse_rate DECIMAL(5,4) DEFAULT 0,
        learning_rate DECIMAL(5,4) DEFAULT 0,
        retrieval_accuracy DECIMAL(5,4) DEFAULT 0,
        reasoning_accuracy DECIMAL(5,4) DEFAULT 0,
        overall_score DECIMAL(5,4) DEFAULT 0,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // agent_activity_log - tracks all agent actions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_activity_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_agent ON agent_activity_log(agent_id);
      CREATE INDEX IF NOT EXISTS idx_activity_created ON agent_activity_log(created_at DESC);
    `);

    console.log("✅ Galaxy migration completed");
  } catch (err) {
    console.error("❌ Galaxy migration failed:", err.message);
    throw err;
  }
}

if (require.main === module) {
  migrateGalaxy().then(() => process.exit(0)).catch(() => process.exit(1));
}
module.exports = { migrateGalaxy };
