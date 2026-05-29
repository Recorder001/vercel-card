import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMAGE_PATH = path.join(__dirname, '미오통합', '캐릭터', '미오_무표정.png');

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const buffer = fs.readFileSync(IMAGE_PATH);
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0');
  res.end(buffer);
}
