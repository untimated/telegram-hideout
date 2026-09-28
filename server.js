import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

export function createHideoutServer() {
  const page = readFileSync(new URL('./public/hideout.html', import.meta.url));
  const server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (request.method === 'GET' && path === '/') {
      response.writeHead(302, { Location: '/hideout' }).end();
    } else if (request.method === 'GET' && (path === '/hideout' || path === '/hideout/')) {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(page);
    } else {
      response.writeHead(404).end('Not found');
    }
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  let nextGuest = 1;

  server.on('upgrade', (request, socket, head) => {
    if (new URL(request.url, 'http://localhost').pathname !== '/ws') {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    sockets.handleUpgrade(request, socket, head, client => {
      sockets.emit('connection', client);
    });
  });

  sockets.on('connection', client => {
    const name = `Guest ${nextGuest++}`;
    client.on('error', error => console.error('WebSocket:', error.message));
    client.send(JSON.stringify({ type: 'welcome', name }));
    client.on('message', (data, isBinary) => {
      if (isBinary) return;
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (message?.type !== 'chat' || typeof message.text !== 'string') return;
      const text = message.text.trim();
      if (!text || text.length > 500) return;
      const outgoing = JSON.stringify({ type: 'chat', name, text });
      for (const peer of sockets.clients) {
        if (peer.readyState === WebSocket.OPEN) peer.send(outgoing);
      }
    });
  });
  return { server, sockets };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { server } = createHideoutServer();
  const port = Number(process.env.PORT || 8080);
  server.listen(port, '0.0.0.0', () => {
    console.log(`Hideout: http://localhost:${port}/hideout`);
  });
}
