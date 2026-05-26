const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const os      = require('os');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname)));

const players = {};

io.on('connection', socket => {
  console.log(`[+] Player connected: ${socket.id}`);

  players[socket.id] = {
    id:     socket.id,
    pos:    { x: 0, y: 1.65, z: 28 },
    yaw:    Math.PI,
    pitch:  0,
    health: 100,
    kills:  0,
    deaths: 0,
    alive:  true,
  };

  // Send existing room state to newcomer
  socket.emit('init', { id: socket.id, players });

  // Tell everyone else about the newcomer
  socket.broadcast.emit('playerJoined', players[socket.id]);

  // Position / rotation broadcast (throttled on client side)
  socket.on('update', data => {
    if (!players[socket.id]) return;
    Object.assign(players[socket.id], data);
    socket.broadcast.emit('playerUpdate', { id: socket.id, ...data });
  });

  // Bullet trace visual
  socket.on('shoot', data => {
    socket.broadcast.emit('playerShoot', { id: socket.id, ...data });
  });

  // Hit registration (simple — server just relays and deducts health)
  socket.on('hit', ({ targetId, damage }) => {
    const target = players[targetId];
    if (!target || !target.alive) return;

    target.health -= damage;
    io.to(targetId).emit('takeDamage', { damage, killerId: socket.id });

    if (target.health <= 0) {
      target.alive  = false;
      target.deaths++;
      players[socket.id].kills++;

      io.to(targetId).emit('died', { killerId: socket.id });
      io.emit('playerStats', {
        id: targetId,
        kills:  target.kills,
        deaths: target.deaths,
        health: 0,
      });
      io.emit('playerStats', {
        id: socket.id,
        kills:  players[socket.id].kills,
        deaths: players[socket.id].deaths,
        health: players[socket.id].health,
      });

      // Auto-respawn after 3 s
      setTimeout(() => {
        if (!players[targetId]) return;
        players[targetId].health = 100;
        players[targetId].alive  = true;
        io.to(targetId).emit('respawnOk');
      }, 3000);
    }
    io.emit('playerHealth', { id: targetId, health: Math.max(0, target.health) });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
    console.log(`[-] Player disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const ifaces = os.networkInterfaces();
  const ips = [];
  Object.values(ifaces).flat().forEach(i => {
    if (i.family === 'IPv4' && !i.internal) ips.push(i.address);
  });
  console.log(`\n=== Sniper Arena Server ===`);
  console.log(`Local :  http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`LAN   :  http://${ip}:${PORT}`));
  console.log(`==========================\n`);
});
