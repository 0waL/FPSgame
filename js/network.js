class NetworkManager {
  constructor(game) {
    this.game          = game;
    this.socket        = null;
    this.myId          = null;
    this.remotePlayers = new Map();
    this.connected     = false;
    this._lastSend     = 0;
    this.SEND_RATE     = 50; // ms → ~20 Hz
  }

  connect(serverUrl) {
    this.socket = io(serverUrl);

    this.socket.on('connect',    ()   => this._onConnect());
    this.socket.on('disconnect', ()   => this._onDisconnect());
    this.socket.on('init',       d    => this._onInit(d));
    this.socket.on('playerJoined',  d => this._onPlayerJoined(d));
    this.socket.on('playerUpdate',  d => this._onPlayerUpdate(d));
    this.socket.on('playerLeft',    id=> this._onPlayerLeft(id));
    this.socket.on('playerShoot',   d => this._onPlayerShoot(d));
    this.socket.on('takeDamage',    d => this._onTakeDamage(d));
    this.socket.on('died',          d => this._onDied(d));
    this.socket.on('respawnOk',     () => this._onRespawnOk());
    this.socket.on('playerHealth',  d => this._onPlayerHealth(d));
    this.socket.on('playerStats',   d => this._onPlayerStats(d));
  }

  // ── Outgoing ───────────────────────────────────────────

  sendUpdate(now) {
    if (!this.connected || now - this._lastSend < this.SEND_RATE) return;
    this._lastSend = now;
    const p = this.game.player;
    this.socket.emit('update', {
      pos:   { x: p.pos.x, y: p.pos.y, z: p.pos.z },
      yaw:   p.yaw,
      pitch: p.pitch,
    });
  }

  sendShoot(origin, dir) {
    if (!this.connected) return;
    this.socket.emit('shoot', {
      origin: { x: origin.x, y: origin.y, z: origin.z },
      dir:    { x: dir.x,    y: dir.y,    z: dir.z    },
    });
  }

  sendHit(targetPlayerId, damage, hitbox) {
    if (!this.connected) return;
    this.socket.emit('hit', { targetId: targetPlayerId, damage, hitbox });
  }

  // ── Incoming ───────────────────────────────────────────

  _onConnect() {
    this.connected = true;
    // Disable bots in multiplayer mode
    this.game.bots.forEach(b => { b.alive = false; b.group.visible = false; });
    console.log('Connected to server');
  }

  _onDisconnect() {
    this.connected = false;
    this.remotePlayers.forEach(rp => this.game.scene.remove(rp.group));
    this.remotePlayers.clear();
    console.log('Disconnected from server');
  }

  _onInit({ id, players }) {
    this.myId = id;
    Object.values(players).forEach(p => {
      if (p.id !== id) this._createRemotePlayer(p);
    });
  }

  _onPlayerJoined(data) {
    if (data.id !== this.myId) this._createRemotePlayer(data);
  }

  _onPlayerUpdate({ id, pos, yaw, pitch }) {
    const rp = this.remotePlayers.get(id);
    if (!rp) return;
    rp.targetPos.set(pos.x, pos.y, pos.z);
    rp.targetYaw   = yaw;
    rp.targetPitch = pitch;
  }

  _onPlayerLeft(id) {
    const rp = this.remotePlayers.get(id);
    if (rp) { this.game.scene.remove(rp.group); this.remotePlayers.delete(id); }
  }

  _onPlayerShoot({ id, origin, dir }) {
    const o = new THREE.Vector3(origin.x, origin.y, origin.z);
    const d = new THREE.Vector3(dir.x,    dir.y,    dir.z   );
    this.game._bulletTrace(o, d, 120);
  }

  _onTakeDamage({ damage }) {
    if (!this.game.player.isAlive) return;
    this.game.player.health = Math.max(0, this.game.player.health - damage);
    this.game.ui.showDamageFlash();
    if (this.game.player.health <= 0) this.game._playerDie(-99);
    this.game.ui.updateHUD();
  }

  _onDied({ killerId }) { /* handled by _onTakeDamage */ }

  _onRespawnOk() {
    this.game._playerRespawn();
  }

  _onPlayerHealth({ id, health }) {
    const rp = this.remotePlayers.get(id);
    if (rp) rp.health = health;
  }

  _onPlayerStats({ id, kills, deaths, health }) {
    if (id !== this.myId) return;
    this.game.player.kills  = kills;
    this.game.player.deaths = deaths;
    if (health !== undefined) this.game.player.health = health;
    this.game.ui.updateHUD();
  }

  // ── Remote player model ────────────────────────────────

  _createRemotePlayer(data) {
    const group   = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3366DD, metalness: 0.1, roughness: 0.7 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xFFDDCC, metalness: 0.0, roughness: 0.9 });
    const legMat  = new THREE.MeshStandardMaterial({ color: 0x1A1A2E, metalness: 0.0, roughness: 0.8 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.2, roughness: 0.7 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.2, 8), bodyMat);
    body.position.y = 0.9; body.castShadow = true;
    body.userData = { playerId: data.id, hitbox: 'body' };
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), headMat);
    head.position.y = 1.78; head.castShadow = true;
    head.userData = { playerId: data.id, hitbox: 'head' };
    group.add(head);

    const legs = [];
    [-0.22, 0.22].forEach(x => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 6), legMat.clone());
      leg.position.set(x, 0.4, 0); leg.castShadow = true;
      leg.userData = { playerId: data.id, hitbox: 'leg' };
      group.add(leg); legs.push(leg);
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.1, 8), baseMat);
    base.position.y = 0.05; group.add(base);

    group.position.set(data.pos?.x ?? 0, 0, data.pos?.z ?? 0);
    this.game.scene.add(group);

    const rp = {
      id: data.id,
      group, body, head, legs,
      health:      data.health ?? 100,
      pos:         new THREE.Vector3(data.pos?.x ?? 0, data.pos?.y ?? 0, data.pos?.z ?? 0),
      targetPos:   new THREE.Vector3(data.pos?.x ?? 0, data.pos?.y ?? 0, data.pos?.z ?? 0),
      targetYaw:   data.yaw   ?? 0,
      targetPitch: data.pitch ?? 0,
    };
    this.remotePlayers.set(data.id, rp);
    return rp;
  }

  // ── Per-frame ──────────────────────────────────────────

  update(dt) {
    this.remotePlayers.forEach(rp => {
      rp.pos.lerp(rp.targetPos, Math.min(1, dt * 20));
      rp.group.position.set(rp.pos.x, 0, rp.pos.z);
      const dy = rp.targetYaw - rp.group.rotation.y;
      rp.group.rotation.y += dy * Math.min(1, dt * 20);
    });
  }

  getMeshes() {
    const out = [];
    this.remotePlayers.forEach(rp => out.push(rp.body, rp.head, ...rp.legs));
    return out;
  }

  getPlayerByMesh(mesh) {
    const pid = mesh.userData.playerId;
    return pid ? this.remotePlayers.get(pid) : null;
  }
}
