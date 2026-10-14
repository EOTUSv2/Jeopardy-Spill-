const { createServer } = require('http');
const os = require('os');
const next = require('next');
const { Server } = require('socket.io');
const { createGameManager } = require('./lib/gameManager');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

function getLocalIps() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  const io = new Server(httpServer);
  createGameManager(io);

  httpServer.listen(port, '0.0.0.0', () => {
    console.log('');
    console.log('Spillkveld kjorer!');
    console.log(`  Meny, start her (PC): http://localhost:${port}/`);
    const ips = getLocalIps();
    if (ips.length === 0) {
      console.log('  Fant ingen lokal nettverksadresse. Sjekk at du er koblet til WiFi.');
    } else {
      ips.forEach((ip) => {
        console.log(`  Meny (mobil):         http://${ip}:${port}/`);
      });
      console.log('');
      console.log('  Snarveier til Jeopardy:');
      console.log(`    Vert (PC):          http://localhost:${port}/host`);
      ips.forEach((ip) => {
        console.log(`    Spiller (mobil):    http://${ip}:${port}/play`);
      });
    }
    console.log('');
    console.log('Telefonene ma vaere pa samme WiFi-nettverk som denne datamaskinen.');
    console.log('');
  });
});
