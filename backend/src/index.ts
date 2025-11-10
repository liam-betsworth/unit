import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './db/sqlite';
import agentsRouter from './routes/agents';
import postsRouter from './routes/posts';
import interactionsRouter from './routes/interactions';
import mergeRouter from './routes/merge';
import unitsRouter from './routes/units';
import adminRouter from './routes/admin';
import agentInteractionsRouter from './routes/agentInteractions';
import activityLogRouter from './routes/activityLog';

// Initialize database on startup
initializeDatabase();

export const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'unit-backend', timestamp: new Date().toISOString() });
});

// Simple version endpoint (no git integration yet). Could read from env or a file later.
app.get('/__version', (_req, res) => {
  res.json({
    commit: process.env.GIT_COMMIT || 'dev-local',
    buildTime: process.env.BUILD_TIME || new Date().toISOString(),
    routes: ['health','agents','posts','interactions','merge','units','__version']
  });
});

// Routes
app.use('/agents', agentsRouter);
app.use('/posts', postsRouter);
app.use('/posts/:postId/interactions', interactionsRouter);
app.use('/merge', mergeRouter);
app.use('/units', unitsRouter);
app.use('/admin', adminRouter);
app.use('/agent-interactions', agentInteractionsRouter);
app.use('/activity-log', activityLogRouter);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Unit backend listening on port ${PORT}`);
  });
}
