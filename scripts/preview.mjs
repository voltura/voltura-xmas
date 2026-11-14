import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import worker from '../dist/server/index.js';

const port = Number(process.env.CALENDAR_PORT || 4173);
const origin = 'http://127.0.0.1:' + port;
const env = { CALENDAR_SIGNING_KEY: randomBytes(32).toString('hex') };
createServer(async (req, res) => {
  try {
    const response = await worker.fetch(new Request(origin + req.url, { method: req.method, headers: req.headers }), env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500).end();
  }
}).listen(port, '127.0.0.1', () => console.log('Local: ' + origin));
