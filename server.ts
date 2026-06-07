import http, { IncomingMessage, ServerResponse } from 'http';

import dmHandler       from './api/dm.tsx';
import guideHandler    from './api/guide.tsx';
import cardHandler     from './api/card.tsx';
import portraitHandler from './api/portrait.tsx';

const PORT = Number(process.env.PORT) || 3000;

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

const routes: Record<string, Handler> = {
  '/api/dm':       dmHandler,
  '/api/guide':    guideHandler,
  '/api/card':     cardHandler,
  '/api/portrait': portraitHandler,
};

http.createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  const handler = routes[pathname];
  if (handler) {
    Promise.resolve(handler(req, res)).catch(() => {
      if (!res.headersSent) { res.statusCode = 500; res.end('Internal error'); }
    });
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`[server] :${PORT}`);
});
