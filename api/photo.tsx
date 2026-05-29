import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIO_CHARS = path.join(__dirname, '미오통합', '캐릭터');

const VALID_EXPRS = new Set([
  '감동', '기대', '눈물', '단호함', '뚱함', '말함', '멍함', '무표정',
  '부끄러움', '분노', '불안', '비웃음', '뾰루퉁', '실망', '우울', '웃음',
  '졸림', '화남&소리침', '활짝웃음',
]);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { searchParams } = new URL(req.url!, 'http://localhost');
    const expr = searchParams.get('expr') || '무표정';

    const filename = VALID_EXPRS.has(expr) ? `미오_${expr}.png` : '미오_무표정.png';
    const filepath = path.join(MIO_CHARS, filename);

    if (!fs.existsSync(filepath)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const buffer = fs.readFileSync(filepath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0');
    res.end(buffer);
  } catch (e: any) {
    res.statusCode = 500;
    res.end('ERROR: ' + String(e?.message || e));
  }
}
