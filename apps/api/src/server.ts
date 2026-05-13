import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { transform, Config } from '@mazas/3dmt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(__dirname, '../../web');

const app = express();
app.use(express.json());

// Serve the web app static files
app.use(express.static(WEB_DIR));

// POST /transform
// Body: { url: string, config?: Config }
// Response: raw GLB bytes (application/octet-stream)
app.post('/transform', async (req: Request, res: Response) => {
  const { url, config } = req.body as { url?: string; config?: Config };

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'url is required' });
    return;
  }

  try {
    const bytes = await transform(url, config ?? {});
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', bytes.byteLength);
    res.send(Buffer.from(bytes));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[transform error]', message);
    res.status(500).json({ error: message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`3DMT inspection app running at http://localhost:${PORT}`);
});
