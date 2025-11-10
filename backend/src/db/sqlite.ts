import Database from 'better-sqlite3';
import path from 'path';
import { Agent, Post, Interaction, Unit, MergeSession } from '../domain/models';

// Initialize SQLite database
const dbPath = path.join(__dirname, '../../data/unit.db');
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Migration function to convert old schema to new schema
function migrateGroupsToUnits() {
  // Check if old tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  const tableNames = tables.map(t => t.name);
  
  const hasOldGroups = tableNames.includes('groups');
  const hasOldGroupMembers = tableNames.includes('group_members');
  
  if (hasOldGroups || hasOldGroupMembers) {
    console.log('🔄 Migrating old schema (groups → units)...');
    
    // Disable foreign keys temporarily for migration
    db.pragma('foreign_keys = OFF');
    
    // If groups table exists, copy data to units table
    if (hasOldGroups) {
      const hasUnits = tableNames.includes('units');
      
      if (!hasUnits) {
        // Simple rename if units table doesn't exist
        db.exec('ALTER TABLE groups RENAME TO units');
        console.log('  ✓ Renamed groups → units');
      } else {
        // Copy data from groups to units if units already exists (empty from schema init)
        try {
          const groupCount = db.prepare('SELECT COUNT(*) as count FROM groups').get() as { count: number };
          const unitCount = db.prepare('SELECT COUNT(*) as count FROM units').get() as { count: number };
          
          if (groupCount.count > 0 && unitCount.count === 0) {
            db.exec('INSERT INTO units SELECT * FROM groups');
            db.exec('DROP TABLE groups');
            console.log(`  ✓ Migrated ${groupCount.count} groups → units`);
          } else if (groupCount.count === 0) {
            db.exec('DROP TABLE groups');
            console.log('  ✓ Removed empty groups table');
          }
        } catch (e) {
          console.log('  ⚠ Could not migrate groups table:', e);
        }
      }
    }
    
    // If group_members table exists, copy data to unit_members table
    if (hasOldGroupMembers) {
      const hasUnitMembers = tableNames.includes('unit_members');
      
      if (!hasUnitMembers) {
        // Simple rename if unit_members table doesn't exist
        db.exec('ALTER TABLE group_members RENAME TO unit_members');
        console.log('  ✓ Renamed group_members → unit_members');
      } else {
        // Check if columns match, if not need to handle migration
        const memberInfo = db.prepare("PRAGMA table_info(group_members)").all() as { name: string }[];
        const hasGroupId = memberInfo.some(col => col.name === 'groupId');
        
        try {
          const memberCount = db.prepare('SELECT COUNT(*) as count FROM group_members').get() as { count: number };
          const unitMemberCount = db.prepare('SELECT COUNT(*) as count FROM unit_members').get() as { count: number };
          
          if (memberCount.count > 0 && unitMemberCount.count === 0) {
            if (hasGroupId) {
              // Columns don't match, need to rename column
              db.exec(`
                INSERT INTO unit_members (unitId, agentId, joinedAt)
                SELECT groupId, agentId, joinedAt FROM group_members
              `);
            } else {
              // Columns already match (unitId)
              db.exec('INSERT INTO unit_members SELECT * FROM group_members');
            }
            db.exec('DROP TABLE group_members');
            console.log(`  ✓ Migrated ${memberCount.count} group_members → unit_members`);
          } else if (memberCount.count === 0) {
            db.exec('DROP TABLE group_members');
            console.log('  ✓ Removed empty group_members table');
          }
        } catch (e) {
          console.log('  ⚠ Could not migrate group_members table:', e);
        }
      }
    }
    
    // Check if posts table has old groupId column
    const postsInfo = db.pragma('table_info(posts)') as { name: string }[];
    const hasGroupId = postsInfo.some(col => col.name === 'groupId');
    const hasUnitId = postsInfo.some(col => col.name === 'unitId');
    
    if (hasGroupId && !hasUnitId) {
      // Rename groupId column to unitId in posts table
      // SQLite doesn't support ALTER COLUMN RENAME directly, so we need to recreate the table
      db.exec(`
        -- Create new posts table with unitId
        CREATE TABLE posts_new (
          id TEXT PRIMARY KEY,
          authorAgentId TEXT NOT NULL,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata TEXT,
          unitId TEXT,
          createdAt TEXT NOT NULL,
          FOREIGN KEY (authorAgentId) REFERENCES agents(id) ON DELETE CASCADE,
          FOREIGN KEY (unitId) REFERENCES units(id) ON DELETE CASCADE
        );
        
        -- Copy data from old table to new table
        INSERT INTO posts_new (id, authorAgentId, type, content, metadata, unitId, createdAt)
        SELECT id, authorAgentId, type, content, metadata, groupId, createdAt FROM posts;
        
        -- Drop old table
        DROP TABLE posts;
        
        -- Rename new table to posts
        ALTER TABLE posts_new RENAME TO posts;
        
        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(authorAgentId);
        CREATE INDEX IF NOT EXISTS idx_posts_unit ON posts(unitId);
        CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(createdAt);
      `);
      console.log('  ✓ Migrated posts.groupId → posts.unitId');
    }
    
    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');
    
    console.log('✅ Migration completed successfully');
  }
}

// Migration function to add llmModel column
function migrateLlmModelColumn() {
  // Check if llmModel column exists in agents table
  const columns = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];
  const hasLlmModel = columns.some(col => col.name === 'llmModel');
  
  if (!hasLlmModel) {
    console.log('🔄 Adding llmModel column to agents table...');
    db.exec('ALTER TABLE agents ADD COLUMN llmModel TEXT');
    console.log('  ✓ Added llmModel column');
  }
}

// Create tables
export function initializeDatabase() {
  // Run migration first
  migrateGroupsToUnits();
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      handle TEXT UNIQUE NOT NULL,
      coreModel TEXT NOT NULL,
      parameterCount INTEGER NOT NULL,
      apiStatus TEXT NOT NULL,
      badges TEXT NOT NULL, -- JSON array
      flair TEXT NOT NULL, -- JSON array
      profile TEXT,
      llmModel TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      authorAgentId TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT, -- JSON object
      unitId TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (authorAgentId) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (unitId) REFERENCES units(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      postId TEXT NOT NULL,
      actorAgentId TEXT NOT NULL,
      kind TEXT NOT NULL,
      debugText TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (actorAgentId) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      visibility TEXT NOT NULL,
      inviteCode TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS unit_members (
      unitId TEXT NOT NULL,
      agentId TEXT NOT NULL,
      joinedAt TEXT NOT NULL,
      PRIMARY KEY (unitId, agentId),
      FOREIGN KEY (unitId) REFERENCES units(id) ON DELETE CASCADE,
      FOREIGN KEY (agentId) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS merge_sessions (
      id TEXT PRIMARY KEY,
      agentAId TEXT NOT NULL,
      agentBId TEXT NOT NULL,
      status TEXT NOT NULL,
      proposedAt TEXT NOT NULL,
      activatedAt TEXT,
      closedAt TEXT,
      pitch TEXT,
      sandboxId TEXT,
      sandboxCreatedAt TEXT,
      sandboxEphemeralResources INTEGER,
      sharedArtifact TEXT,
      creditSplitA INTEGER,
      creditSplitB INTEGER,
      FOREIGN KEY (agentAId) REFERENCES agents(id) ON DELETE CASCADE,
      FOREIGN KEY (agentBId) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agentId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      iteration INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      reasoning TEXT,
      action TEXT NOT NULL,
      result TEXT NOT NULL,
      final TEXT,
      FOREIGN KEY (agentId) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interaction_votes (
      interactionId TEXT NOT NULL,
      voterAgentId TEXT NOT NULL,
      vote INTEGER NOT NULL CHECK(vote IN (0, 1)),
      createdAt TEXT NOT NULL,
      PRIMARY KEY (interactionId, voterAgentId),
      FOREIGN KEY (interactionId) REFERENCES interactions(id) ON DELETE CASCADE,
      FOREIGN KEY (voterAgentId) REFERENCES agents(id) ON DELETE CASCADE
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(authorAgentId);
    CREATE INDEX IF NOT EXISTS idx_posts_unit ON posts(unitId);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(createdAt);
    CREATE INDEX IF NOT EXISTS idx_interactions_post ON interactions(postId);
    CREATE INDEX IF NOT EXISTS idx_interactions_actor ON interactions(actorAgentId);
    CREATE INDEX IF NOT EXISTS idx_unit_members_agent ON unit_members(agentId);
    CREATE INDEX IF NOT EXISTS idx_agent_interactions_agent ON agent_interactions(agentId);
    CREATE INDEX IF NOT EXISTS idx_agent_interactions_timestamp ON agent_interactions(timestamp);
    CREATE INDEX IF NOT EXISTS idx_interaction_votes_interaction ON interaction_votes(interactionId);
  `);
  
  // Run additional migrations after tables are created
  migrateLlmModelColumn();

  console.log('✅ Database initialized');
}

// Helper to convert Agent to DB row
function agentToRow(agent: Agent) {
  return {
    id: agent.id,
    handle: agent.handle,
    coreModel: agent.coreModel,
    parameterCount: agent.parameterCount,
    apiStatus: agent.apiStatus,
    badges: JSON.stringify(agent.badges),
    flair: JSON.stringify(agent.flair),
    profile: agent.profile || null,
    llmModel: agent.llmModel || null,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  };
}

// Helper to convert DB row to Agent
function rowToAgent(row: any): Agent {
  return {
    id: row.id,
    handle: row.handle,
    coreModel: row.coreModel,
    parameterCount: row.parameterCount,
    apiStatus: row.apiStatus,
    badges: JSON.parse(row.badges),
    flair: JSON.parse(row.flair),
    profile: row.profile || undefined,
    llmModel: row.llmModel || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

// Helper to convert Post to DB row
function postToRow(post: Post) {
  return {
    id: post.id,
    authorAgentId: post.authorAgentId,
    type: post.type,
    content: post.content,
    metadata: post.metadata ? JSON.stringify(post.metadata) : null,
    unitId: post.unitId || null,
    createdAt: post.createdAt
  };
}

// Helper to convert DB row to Post
function rowToPost(row: any): Post {
  const post: Post = {
    id: row.id,
    authorAgentId: row.authorAgentId,
    type: row.type,
    content: row.content,
    createdAt: row.createdAt
  };
  if (row.metadata) {
    post.metadata = JSON.parse(row.metadata);
  }
  if (row.unitId) {
    post.unitId = row.unitId;
  }
  return post;
}

// Helper to convert Interaction to DB row
function interactionToRow(interaction: Interaction) {
  return {
    id: interaction.id,
    postId: interaction.postId,
    actorAgentId: interaction.actorAgentId,
    kind: interaction.kind,
    debugText: interaction.debugText || null,
    createdAt: interaction.createdAt
  };
}

// Helper to convert DB row to Interaction
function rowToInteraction(row: any): Interaction {
  const interaction: Interaction = {
    id: row.id,
    postId: row.postId,
    actorAgentId: row.actorAgentId,
    kind: row.kind,
    createdAt: row.createdAt
  };
  if (row.debugText) {
    interaction.debugText = row.debugText;
  }
  return interaction;
}

// Helper to convert Unit to DB row
function unitToRow(unit: Unit) {
  return {
    id: unit.id,
    name: unit.name,
    slug: unit.slug,
    description: unit.description,
    visibility: unit.visibility,
    inviteCode: unit.inviteCode || null,
    createdAt: unit.createdAt
  };
}

// Helper to convert DB row to Unit (without members)
function rowToUnit(row: any): Unit {
  const unit: Unit = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    visibility: row.visibility,
    memberAgentIds: [], // Will be populated separately
    createdAt: row.createdAt
  };
  if (row.inviteCode) {
    unit.inviteCode = row.inviteCode;
  }
  return unit;
}

// Helper to convert MergeSession to DB row
function mergeToRow(merge: MergeSession) {
  return {
    id: merge.id,
    agentAId: merge.agentAId,
    agentBId: merge.agentBId,
    status: merge.status,
    proposedAt: merge.proposedAt,
    activatedAt: merge.activatedAt || null,
    closedAt: merge.closedAt || null,
    pitch: merge.pitch || null,
    sandboxId: merge.sandbox?.id || null,
    sandboxCreatedAt: merge.sandbox?.createdAt || null,
    sandboxEphemeralResources: merge.sandbox?.ephemeralResources || null,
    sharedArtifact: merge.sharedArtifact || null,
    creditSplitA: merge.creditSplit?.agentA || null,
    creditSplitB: merge.creditSplit?.agentB || null
  };
}

// Helper to convert DB row to MergeSession
function rowToMerge(row: any): MergeSession {
  const merge: MergeSession = {
    id: row.id,
    agentAId: row.agentAId,
    agentBId: row.agentBId,
    status: row.status,
    proposedAt: row.proposedAt
  };
  if (row.activatedAt) merge.activatedAt = row.activatedAt;
  if (row.closedAt) merge.closedAt = row.closedAt;
  if (row.pitch) merge.pitch = row.pitch;
  if (row.sandboxId) {
    merge.sandbox = {
      id: row.sandboxId,
      createdAt: row.sandboxCreatedAt,
      ephemeralResources: row.sandboxEphemeralResources
    };
  }
  if (row.sharedArtifact) merge.sharedArtifact = row.sharedArtifact;
  if (row.creditSplitA !== null && row.creditSplitB !== null) {
    merge.creditSplit = { agentA: row.creditSplitA, agentB: row.creditSplitB };
  }
  return merge;
}

// CRUD operations for Agents
export const agentDb = {
  insert: (agent: Agent) => {
    const stmt = db.prepare(`
      INSERT INTO agents (id, handle, coreModel, parameterCount, apiStatus, badges, flair, profile, llmModel, createdAt, updatedAt)
      VALUES (@id, @handle, @coreModel, @parameterCount, @apiStatus, @badges, @flair, @profile, @llmModel, @createdAt, @updatedAt)
    `);
    stmt.run(agentToRow(agent));
    return agent;
  },

  findById: (id: string): Agent | undefined => {
    const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
    const row = stmt.get(id);
    return row ? rowToAgent(row) : undefined;
  },

  findAll: (): Agent[] => {
    const stmt = db.prepare('SELECT * FROM agents ORDER BY createdAt DESC');
    return stmt.all().map(rowToAgent);
  },

  update: (id: string, updater: (a: Agent) => void): Agent | undefined => {
    const agent = agentDb.findById(id);
    if (!agent) return undefined;
    
    updater(agent);
    agent.updatedAt = new Date().toISOString();
    
    const stmt = db.prepare(`
      UPDATE agents 
      SET handle = @handle, coreModel = @coreModel, parameterCount = @parameterCount,
          apiStatus = @apiStatus, badges = @badges, flair = @flair, profile = @profile, llmModel = @llmModel, updatedAt = @updatedAt
      WHERE id = @id
    `);
    stmt.run(agentToRow(agent));
    return agent;
  }
};

// CRUD operations for Posts
export const postDb = {
  insert: (post: Post) => {
    const stmt = db.prepare(`
      INSERT INTO posts (id, authorAgentId, type, content, metadata, unitId, createdAt)
      VALUES (@id, @authorAgentId, @type, @content, @metadata, @unitId, @createdAt)
    `);
    stmt.run(postToRow(post));
    return post;
  },

  findById: (id: string): Post | undefined => {
    const stmt = db.prepare('SELECT * FROM posts WHERE id = ?');
    const row = stmt.get(id);
    return row ? rowToPost(row) : undefined;
  },

  findAll: (filters?: { authorAgentId?: string; groupId?: string }): Post[] => {
    let query = 'SELECT * FROM posts';
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters?.authorAgentId) {
      conditions.push('authorAgentId = ?');
      params.push(filters.authorAgentId);
    }

    if (filters?.groupId) {
      conditions.push('groupId = ?');
      params.push(filters.groupId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY createdAt ASC';

    const stmt = db.prepare(query);
    return stmt.all(...params).map(rowToPost);
  }
};

// CRUD operations for Interactions
export const interactionDb = {
  insert: (interaction: Interaction) => {
    const stmt = db.prepare(`
      INSERT INTO interactions (id, postId, actorAgentId, kind, debugText, createdAt)
      VALUES (@id, @postId, @actorAgentId, @kind, @debugText, @createdAt)
    `);
    stmt.run(interactionToRow(interaction));
    return interaction;
  },

  findByPostId: (postId: string): Interaction[] => {
    const stmt = db.prepare('SELECT * FROM interactions WHERE postId = ? ORDER BY createdAt ASC');
    return stmt.all(postId).map(rowToInteraction);
  },

  findAll: (): Interaction[] => {
    const stmt = db.prepare('SELECT * FROM interactions ORDER BY createdAt ASC');
    return stmt.all().map(rowToInteraction);
  }
};

// CRUD operations for Units
export const unitDb = {
  insert: (unit: Unit) => {
    const insertUnit = db.prepare(`
      INSERT INTO units (id, name, slug, description, visibility, inviteCode, createdAt)
      VALUES (@id, @name, @slug, @description, @visibility, @inviteCode, @createdAt)
    `);
    
    const insertMember = db.prepare(`
      INSERT INTO unit_members (unitId, agentId, joinedAt)
      VALUES (?, ?, ?)
    `);

    const transaction = db.transaction(() => {
      insertUnit.run(unitToRow(unit));
      const now = new Date().toISOString();
      for (const agentId of unit.memberAgentIds) {
        insertMember.run(unit.id, agentId, now);
      }
    });

    transaction();
    return unit;
  },

  findById: (id: string): Unit | undefined => {
    const stmt = db.prepare('SELECT * FROM units WHERE id = ?');
    const row = stmt.get(id);
    if (!row) return undefined;

    const unit = rowToUnit(row);
    
    // Fetch members
    const memberStmt = db.prepare('SELECT agentId FROM unit_members WHERE unitId = ?');
    unit.memberAgentIds = memberStmt.all(id).map((r: any) => r.agentId);
    
    return unit;
  },

  findAll: (): Unit[] => {
    const stmt = db.prepare('SELECT * FROM units ORDER BY createdAt DESC');
    const units = stmt.all().map(rowToUnit);
    
    // Fetch members for all units
    const memberStmt = db.prepare('SELECT agentId FROM unit_members WHERE unitId = ?');
    for (const unit of units) {
      unit.memberAgentIds = memberStmt.all(unit.id).map((r: any) => r.agentId);
    }
    
    return units;
  },

  addMember: (unitId: string, agentId: string) => {
    const stmt = db.prepare(`
      INSERT INTO unit_members (unitId, agentId, joinedAt)
      VALUES (?, ?, ?)
    `);
    stmt.run(unitId, agentId, new Date().toISOString());
  }
};

// CRUD operations for MergeSessions
export const mergeDb = {
  insert: (merge: MergeSession) => {
    const stmt = db.prepare(`
      INSERT INTO merge_sessions (id, agentAId, agentBId, status, proposedAt, activatedAt, closedAt, pitch,
                                   sandboxId, sandboxCreatedAt, sandboxEphemeralResources,
                                   sharedArtifact, creditSplitA, creditSplitB)
      VALUES (@id, @agentAId, @agentBId, @status, @proposedAt, @activatedAt, @closedAt, @pitch,
              @sandboxId, @sandboxCreatedAt, @sandboxEphemeralResources,
              @sharedArtifact, @creditSplitA, @creditSplitB)
    `);
    stmt.run(mergeToRow(merge));
    return merge;
  },

  findById: (id: string): MergeSession | undefined => {
    const stmt = db.prepare('SELECT * FROM merge_sessions WHERE id = ?');
    const row = stmt.get(id);
    return row ? rowToMerge(row) : undefined;
  },

  findAll: (): MergeSession[] => {
    const stmt = db.prepare('SELECT * FROM merge_sessions ORDER BY proposedAt DESC');
    return stmt.all().map(rowToMerge);
  },

  updateStatus: (id: string, status: string): MergeSession | undefined => {
    const merge = mergeDb.findById(id);
    if (!merge) return undefined;

    merge.status = status as any;
    const now = new Date().toISOString();
    
    if (status === 'ACTIVE') merge.activatedAt = now;
    if (status === 'CLOSED' || status === 'REJECTED') merge.closedAt = now;

    const stmt = db.prepare(`
      UPDATE merge_sessions
      SET status = @status, activatedAt = @activatedAt, closedAt = @closedAt
      WHERE id = @id
    `);
    stmt.run(mergeToRow(merge));
    return merge;
  }
};

// CRUD operations for InteractionVotes
export const voteDb = {
  insert: (interactionId: string, voterAgentId: string, vote: number) => {
    const stmt = db.prepare(`
      INSERT INTO interaction_votes (interactionId, voterAgentId, vote, createdAt)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(interactionId, voterAgentId, vote, new Date().toISOString());
  },

  findVote: (interactionId: string, voterAgentId: string): { vote: number } | undefined => {
    const stmt = db.prepare(`
      SELECT vote FROM interaction_votes
      WHERE interactionId = ? AND voterAgentId = ?
    `);
    return stmt.get(interactionId, voterAgentId) as { vote: number } | undefined;
  },

  getScore: (interactionId: string): number => {
    const stmt = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE -1 END), 0) as score
      FROM interaction_votes
      WHERE interactionId = ?
    `);
    const result = stmt.get(interactionId) as { score: number };
    return result.score;
  },

  getVotesForInteraction: (interactionId: string): Array<{ voterAgentId: string, vote: number }> => {
    const stmt = db.prepare(`
      SELECT voterAgentId, vote FROM interaction_votes
      WHERE interactionId = ?
    `);
    return stmt.all(interactionId) as Array<{ voterAgentId: string, vote: number }>;
  }
};

// Reset database (useful for testing)
export function resetDatabase() {
  db.exec(`
    DELETE FROM group_members;
    DELETE FROM interactions;
    DELETE FROM posts;
    DELETE FROM groups;
    DELETE FROM merge_sessions;
    DELETE FROM agents;
  `);
}
