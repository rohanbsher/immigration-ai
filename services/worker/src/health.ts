import crypto from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Queue } from 'bullmq';
import { workerConfig } from './config';

const VERSION = '0.1.0';
const startTime = Date.now();

/**
 * Create and start the health/admin Express server.
 *
 * Provides:
 *   GET /health          - JSON health check with queue stats
 *   GET /admin/queues    - Bull Board dashboard (basic-auth protected in production)
 */
export function startHealthServer(queues: Queue[]): void {
  const app = express();

  // -------------------------------------------------------------------------
  // Bull Board dashboard
  // -------------------------------------------------------------------------
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: queues.map((q) => new BullMQAdapter(q)),
    serverAdapter,
  });

  // Auth middleware for Bull Board dashboard
  if (workerConfig.BULL_BOARD_PASSWORD) {
    app.use('/admin/queues', (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
        res.status(401).send('Authentication required');
        return;
      }

      const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
      const [, password] = credentials.split(':');

      // Timing-safe comparison to prevent timing attacks
      const expected = Buffer.from(workerConfig.BULL_BOARD_PASSWORD!);
      const actual = Buffer.from(password || '');
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        res.status(403).send('Forbidden');
        return;
      }

      next();
    });
  } else if (process.env.NODE_ENV === 'production') {
    // In production, deny access entirely when no password is configured
    app.use('/admin/queues', (_req: Request, res: Response) => {
      res.status(403).send('Bull Board is disabled. Set BULL_BOARD_PASSWORD to enable.');
    });
  }

  app.use('/admin/queues', serverAdapter.getRouter());

  // -------------------------------------------------------------------------
  // Health endpoint
  // -------------------------------------------------------------------------
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const queueStats: Record<string, Record<string, number>> = {};

      for (const queue of queues) {
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed'
        );
        queueStats[queue.name] = counts;
      }

      res.json({
        status: 'healthy',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: VERSION,
        queues: queueStats,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(503).json({
        status: 'unhealthy',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        version: VERSION,
        error: message,
      });
    }
  });

  // -------------------------------------------------------------------------
  // Start listening
  // -------------------------------------------------------------------------
  app.listen(workerConfig.PORT, () => {
    console.log(`Health server listening on port ${workerConfig.PORT}`);
    console.log(`  GET /health          - Health check`);
    console.log(`  GET /admin/queues    - Bull Board dashboard`);
  });
}
