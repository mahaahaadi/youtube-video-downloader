import type { Express, Request, Response } from 'express';

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Something went wrong.';

  if (/video unavailable/i.test(message)) {
    return 'This video is unavailable. It may be private, deleted, or region-restricted.';
  }

  return message.replace(/^ERROR:\s*/i, '').replace(/^\[youtube\]\s*[\w-]+:\s*/i, '').trim();
}

export function registerYoutubeRoutes(app: Express): void {
  app.post('/api/youtube/analyze', async (req: Request, res: Response) => {
    try {
      const url = String(req.body?.url ?? '').trim();

      if (!url) {
        res.status(400).json({ error: 'YouTube URL is required.' });
        return;
      }

      const { analyzeVideo } = await import('./youtube.service.js');
      const analysis = await analyzeVideo(url);
      res.json(analysis);
    } catch (error) {
      res.status(422).json({ error: sanitizeError(error) });
    }
  });

  app.get('/api/youtube/download', async (req: Request, res: Response) => {
    try {
      const url = String(req.query['url'] ?? '').trim();
      const formatId = String(req.query['formatId'] ?? '').trim();

      if (!url || !formatId) {
        res.status(400).json({ error: 'url and formatId query parameters are required.' });
        return;
      }

      const { streamDownload } = await import('./youtube.service.js');
      await streamDownload(url, formatId, res);
    } catch (error) {
      if (!res.headersSent) {
        res.status(422).json({ error: sanitizeError(error) });
      }
    }
  });
}
