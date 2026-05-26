class FPSGame {
  constructor() {
    this.player = {
      health: 100, maxHealth: 100,
      pos: new THREE.Vector3(0, 1.65, 28),
      vel: new THREE.Vector3(),
      yaw: Math.PI, pitch: 0,
      onGround: true, isMoving: false, isAlive: true,
      kills: 0, deaths: 0,
    };

    this.weapons = {
      current: 'marshal',
      ammoState: {},
      isReloading: false,
      lastShotTime: 0,
      reloadTimer: null,
    };

    this.keys = {};
    this.mouseButtons = {};
    this.isPointerLocked = false;
    this.isADS = false;

    this.weaponAnim = { raiseT: 0, kickT: 0, adsT: 0, reloadT: 0 };

    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDir = new THREE.Vector3();
    this.slideSpeed = 0;
    this.slideCooldown = 0;
    this.camHeightOffset = 0;

    this.mouseSens = 0.002;
    this.state = 'lobby';
    this.bots = [];

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.weaponScene = null;
    this.weaponCamera = null;
    this.weaponGroup = null;
    this.weaponBobT = 0;

    this.envMeshes = [];
    this.bulletHoles = [];
    this._bulletHoleTex = null;

    this._init();
  }

  _init() {
    this._setupRenderer();
    this._setupScenes();
    this._setupLighting();
    this._setupMap();
    this._setupBots();
    this._setupWeaponGroup();
    this._setupControls();
    this._bulletHoleTex = this._createBulletHoleTexture();
    this._initAmmo(this.weapons.current);
    this.ui = new GameUI(this);
    this._buildWeaponModel(this.weapons.current);
    this.ui.updateHUD();
    this._loop();
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    document.getElementById('game-canvas').appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      [this.camera, this.weaponCamera].forEach(cam => {
        cam.aspect = window.innerWidth / window.innerHeight;
        cam.updateProjectionMatrix();
      });
    });
  }

  _setupScenes() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7EC8E3);
    this.scene.fog = new THREE.Fog(0x7EC8E3, 40, 120);
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    this.weaponScene = new THREE.Scene();
    this.weaponCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 10);
    this.weaponScene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const wDir = new THREE.DirectionalLight(0xffffff, 0.9);
    wDir.position.set(1, 2, 2);
    this.weaponScene.add(wDir);
    const wDir2 = new THREE.DirectionalLight(0x8899bb, 0.4);
    wDir2.position.set(-2, 0, 1);
    this.weaponScene.add(wDir2);
  }

  _setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xfffaea, 0.9);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
    sun.shadow.camera.top  =  50; sun.shadow.camera.bottom = -50;
    sun.shadow.camera.far  = 120;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xaaccff, 0.25);
    fill.position.set(-10, 5, -10);
    this.scene.add(fill);
  }

  // ═══════════════════════════════════════════════════════
  //  ARENA MAP
  // ═══════════════════════════════════════════════════════

  _setupMap() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshLambertMaterial({ color: 0x6B7A5E })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.envMeshes.push(floor);

    this.scene.add(new THREE.GridHelper(80, 40, 0x445544, 0x556655));

    const wallMat = new THREE.MeshLambertMaterial({ color: 0xC4B898 });
    [
      { pos: [0, 3.5, -38], size: [80, 7, 1] },
      { pos: [0, 3.5,  38], size: [80, 7, 1] },
      { pos: [-40, 3.5, 0], size: [1, 7, 76] },
      { pos: [ 40, 3.5, 0], size: [1, 7, 76] },
    ].forEach(w => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat);
      m.position.set(...w.pos);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m); this.envMeshes.push(m);
    });

    const covers = [
      // Centre cluster
      { pos: [-7, 0, 0],  size: [1.2, 2.5, 10], color: 0xAA9977 },
      { pos: [ 7, 0, 0],  size: [1.2, 2.5, 10], color: 0xAA9977 },
      { pos: [0, 0, -7],  size: [14, 2.5, 1.2], color: 0xAA9977 },
      { pos: [0, 0,  7],  size: [14, 2.5, 1.2], color: 0xAA9977 },
      // Enemy side (z < 0)
      { pos: [-18, 0, -20], size: [1.2, 2.2, 7], color: 0x8B6340 },
      { pos: [ 18, 0, -20], size: [1.2, 2.2, 7], color: 0x8B6340 },
      { pos: [ -5, 0, -22], size: [4.5, 2.2, 1.2], color: 0x8B6340 },
      { pos: [  5, 0, -22], size: [4.5, 2.2, 1.2], color: 0x8B6340 },
      { pos: [  0, 0, -30], size: [10, 2.2, 1.2], color: 0x775533 },
      // Player side (z > 0)
      { pos: [-18, 0,  20], size: [1.2, 2.2, 7], color: 0x8B6340 },
      { pos: [ 18, 0,  20], size: [1.2, 2.2, 7], color: 0x8B6340 },
      { pos: [ -5, 0,  22], size: [4.5, 2.2, 1.2], color: 0x8B6340 },
      { pos: [  5, 0,  22], size: [4.5, 2.2, 1.2], color: 0x8B6340 },
      { pos: [  0, 0,  30], size: [10, 2.2, 1.2], color: 0x775533 },
    ];
    covers.forEach(c => {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(...c.size),
        new THREE.MeshLambertMaterial({ color: c.color })
      );
      m.position.set(c.pos[0], c.size[1] / 2, c.pos[2]);
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m); this.envMeshes.push(m);
    });
  }

  // ═══════════════════════════════════════════════════════
  //  BOTS
  // ═══════════════════════════════════════════════════════

  _setupBots() {
    const WP = [
      new THREE.Vector3(-20, 0, -26), new THREE.Vector3(0, 0, -29), new THREE.Vector3(20, 0, -26),
      new THREE.Vector3(-12, 0, -18), new THREE.Vector3(0, 0, -20), new THREE.Vector3(12, 0, -18),
      new THREE.Vector3(-10, 0, -8),  new THREE.Vector3(0, 0, -10), new THREE.Vector3(10, 0, -8),
      new THREE.Vector3(-8,  0,  0),  new THREE.Vector3(8, 0, 0),
      new THREE.Vector3(-10, 0,  8),  new THREE.Vector3(0, 0, 10),  new THREE.Vector3(10, 0, 8),
    ];
    [[-12, 0, -30], [0, 0, -33], [12, 0, -30]].forEach((pos, i) => {
      this.bots.push(this._makeBot(pos, i, WP));
    });
  }

  _makeBot(position, id, waypoints) {
    const group = new THREE.Group();
    group.position.set(...position);

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xCC2222 });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xFFAAA0 });
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x333333 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.2, 8), bodyMat);
    body.position.y = 0.9; body.castShadow = true;
    body.userData = { botId: id, hitbox: 'body' };
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), headMat);
    head.position.y = 1.78; head.castShadow = true;
    head.userData = { botId: id, hitbox: 'head' };
    group.add(head);

    const legs = [];
    [-0.22, 0.22].forEach(x => {
      const legMat = new THREE.MeshLambertMaterial({ color: 0x221133 });
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 6), legMat);
      leg.position.set(x, 0.4, 0); leg.castShadow = true;
      leg.userData = { botId: id, hitbox: 'leg' };
      group.add(leg); legs.push(leg);
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.1, 8), baseMat);
    base.position.y = 0.05; group.add(base);

    this.scene.add(group);

    return {
      id, group, body, head, legs, bodyMat, headMat,
      pos: new THREE.Vector3(...position),
      spawnPos: new THREE.Vector3(...position),
      health: 100, maxHealth: 100, alive: true,
      state: 'patrol',
      stateTimer: Math.random() * 2 + 1,
      shootCooldown: 2 + Math.random() * 3,
      waypoints,
      currentWaypoint: Math.floor(Math.random() * waypoints.length),
      moveSpeed: 2.2 + Math.random() * 1.0,
      respawnTimer: null,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  WEAPON MODEL
  // ═══════════════════════════════════════════════════════

  _setupWeaponGroup() {
    this.weaponGroup = new THREE.Group();
    this.weaponScene.add(this.weaponGroup);
  }

  _buildWeaponModel(wid) {
    while (this.weaponGroup.children.length) this.weaponGroup.remove(this.weaponGroup.children[0]);
    const w = WEAPONS[wid];
    const g  = new THREE.MeshPhongMaterial({ color: w.color,  shininess: 90, specular: 0x666666 });
    const d  = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 70, specular: 0x444444 });
    const h  = new THREE.MeshPhongMaterial({ color: 0xBB8855, shininess: 15, specular: 0x110800 });
    const wd = new THREE.MeshPhongMaterial({ color: 0x6B3A1F, shininess: 20, specular: 0x220E00 });

    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.09), h);
    hand.position.set(0.04, -0.13, -0.08); this.weaponGroup.add(hand);
    const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.07), h);
    hand2.position.set(0.02, -0.11, -0.26); this.weaponGroup.add(hand2);

    this._buildSniper(g, d, wd, wid);
    this.weaponGroup.position.set(0.19, -0.21, -0.38);
  }

  _add(geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz); m.rotation.set(rx, ry, rz);
    this.weaponGroup.add(m); return m;
  }

  _buildSniper(g, d, wd, id) {
    const isAWP = id === 'operator';
    this._add(new THREE.BoxGeometry(0.058, 0.074, isAWP ? 0.82 : 0.68), g, 0, 0, 0);
    this._add(new THREE.CylinderGeometry(0.012, 0.012, isAWP ? 0.50 : 0.38, 10), d, 0, 0.010, isAWP ? -0.68 : -0.60, Math.PI/2);
    this._add(new THREE.BoxGeometry(0.030, 0.022, 0.06), d, 0, 0.010, isAWP ? -0.95 : -0.81);
    this._add(new THREE.BoxGeometry(0.044, 0.058, 0.28), wd, 0, -0.010, isAWP ? 0.55 : 0.48);
    this._add(new THREE.BoxGeometry(0.042, 0.082, 0.06), wd, 0, -0.010, isAWP ? 0.69 : 0.62);
    this._add(new THREE.BoxGeometry(0.048, 0.120, 0.046), d, 0, -0.090, isAWP ? 0.16 : 0.12);
    this._add(new THREE.BoxGeometry(0.038, 0.090, 0.040), d, 0, -0.082, isAWP ? 0.26 : 0.22);
    const sz = isAWP ? 0.0 : -0.02;
    this._add(new THREE.CylinderGeometry(0.026, 0.026, isAWP ? 0.28 : 0.24, 12), d, 0, 0.058, sz, Math.PI/2);
    const lMat = new THREE.MeshPhongMaterial({ color: 0x1133AA, shininess: 200, specular: 0x8899FF, transparent: true, opacity: 0.7 });
    this._add(new THREE.CylinderGeometry(0.024, 0.024, 0.010, 12), lMat, 0, 0.058, sz - (isAWP ? 0.145 : 0.125), Math.PI/2);
    this._add(new THREE.CylinderGeometry(0.018, 0.018, 0.010, 12), lMat, 0, 0.058, sz + (isAWP ? 0.145 : 0.125), Math.PI/2);
    this._add(new THREE.CylinderGeometry(0.007, 0.007, 0.030, 6), d, 0, 0.088, sz);
    this._add(new THREE.CylinderGeometry(0.007, 0.007, 0.030, 6), d, 0.038, 0.058, sz);
    this._add(new THREE.CylinderGeometry(0.006, 0.006, 0.060, 6), d, 0.048, 0.030, isAWP ? 0.08 : 0.06, 0, 0, Math.PI/2);
    if (isAWP) {
      const bMat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 40 });
      [-0.028, 0.028].forEach(x => this._add(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 4), bMat, x, -0.09, -0.38, 0, 0, x > 0 ? -0.35 : 0.35));
    }
  }

  // ═══════════════════════════════════════════════════════
  //  CONTROLS
  // ═══════════════════════════════════════════════════════

  _setupControls() {
    document.addEventListener('keydown', e => this._onKeyDown(e));
    document.addEventListener('keyup',   e => { this.keys[e.code] = false; });
    document.addEventListener('mousemove', e => this._onMouseMove(e));
    document.addEventListener('mousedown', e => this._onMouseDown(e));
    document.addEventListener('mouseup',   e => { this.mouseButtons[e.button] = false; if (e.button === 2) this.isADS = false; });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('click', () => {
      if (this.state === 'playing' && !this.isPointerLocked) document.body.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === document.body;
    });
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
    if (this.state !== 'playing' || !this.player.isAlive) return;
    switch (e.code) {
      case 'Digit1': this._switchWeapon('marshal');   break;
      case 'Digit2': this._switchWeapon('operator');  break;
      case 'KeyR':   this.startReload(); break;
      case 'Escape': if (this.isPointerLocked) document.exitPointerLock(); break;
    }
  }

  _switchWeapon(wid) {
    if (this.weapons.current === wid) return;
    this.weapons.current = wid;
    this._initAmmo(wid);
    this._buildWeaponModel(wid);
    this.weaponAnim.raiseT = 0;
    this.ui.updateHUD();
  }

  _onMouseMove(e) {
    if (!this.isPointerLocked || this.state !== 'playing' || !this.player.isAlive) return;
    this.player.yaw   -= e.movementX * this.mouseSens;
    this.player.pitch -= e.movementY * this.mouseSens;
    this.player.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.player.pitch));
  }

  _onMouseDown(e) {
    this.mouseButtons[e.button] = true;
    if (e.button === 2) { this.isADS = true; e.preventDefault(); }
    if (e.button === 0 && this.isPointerLocked && this.state === 'playing') this._tryShoot();
  }

  // ═══════════════════════════════════════════════════════
  //  WEAPON SYSTEM
  // ═══════════════════════════════════════════════════════

  _initAmmo(wid) {
    if (!this.weapons.ammoState[wid]) {
      const w = WEAPONS[wid];
      this.weapons.ammoState[wid] = { magazine: w.magazineSize, reserve: w.reserveAmmo };
    }
  }

  getCurrentWeapon() { return WEAPONS[this.weapons.current]; }

  _tryShoot() {
    if (!this.player.isAlive || this.weapons.isReloading) return;
    const wdef = this.getCurrentWeapon();
    if (!wdef) return;
    const now = Date.now();
    if (now - this.weapons.lastShotTime < wdef.fireRate) return;
    const ammo = this.weapons.ammoState[this.weapons.current];
    if (!ammo || ammo.magazine <= 0) { this.startReload(); return; }
    this.weapons.lastShotTime = now;
    ammo.magazine--;
    this._performShot(wdef);
    this._muzzleFlash(wdef);
    this.weaponAnim.kickT = 1.0;
    if (ammo.magazine === 0 && ammo.reserve > 0) setTimeout(() => this.startReload(), 80);
    this.ui.updateHUD();
  }

  _performShot(wdef) {
    const spread = this.isADS ? wdef.adsSpread : (this.player.isMoving ? wdef.movementSpread : wdef.spread);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
    const up    = new THREE.Vector3().crossVectors(right, dir).normalize();

    const shotDir = dir.clone();
    if (spread > 0) {
      shotDir.addScaledVector(right, (Math.random() - 0.5) * 2 * spread);
      shotDir.addScaledVector(up,    (Math.random() - 0.5) * 2 * spread);
      shotDir.normalize();
    }

    const raycaster = new THREE.Raycaster();
    raycaster.set(this.camera.position, shotDir);

    const botMeshes = [];
    this.bots.forEach(b => { if (b.alive) botMeshes.push(b.body, b.head, ...b.legs); });
    const hits = raycaster.intersectObjects(botMeshes);
    let targetHitDist = Infinity;

    if (hits.length > 0) {
      const hit    = hits[0];
      const hitbox = hit.object.userData.hitbox;
      const bot    = this.bots[hit.object.userData.botId];
      targetHitDist = hit.distance;
      if (bot?.alive) {
        const dmg = hitbox === 'head' ? 300 : hitbox === 'body' ? 150 : 100;
        this._hitBot(bot, dmg, hitbox);
      }
      this._bulletTrace(this.camera.position.clone(), shotDir, hit.distance);
      this.ui.showHitMarker(hitbox === 'head');
    } else {
      this._bulletTrace(this.camera.position.clone(), shotDir, 120);
    }

    const envHits = raycaster.intersectObjects(this.envMeshes);
    if (envHits.length > 0 && envHits[0].distance < targetHitDist) {
      const eh = envHits[0];
      this._createBulletHole(eh.point.clone(), eh.face.normal.clone().transformDirection(eh.object.matrixWorld));
    }

    this.ui.expandCrosshair(4);
  }

  _bulletTrace(origin, dir, dist) {
    const end = origin.clone().addScaledVector(dir, Math.min(dist, 120));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xFFFF99, transparent: true, opacity: 0.55 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    setTimeout(() => { this.scene.remove(line); geo.dispose(); mat.dispose(); }, 45);
  }

  _createBulletHole(position, normal) {
    const geo = new THREE.PlaneGeometry(0.13, 0.13);
    const mat = new THREE.MeshBasicMaterial({
      map: this._bulletHoleTex, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position).addScaledVector(normal, 0.006);
    mesh.lookAt(mesh.position.clone().add(normal));
    mesh.rotateZ(Math.random() * Math.PI * 2);
    this.scene.add(mesh);
    this.bulletHoles.push(mesh);
    if (this.bulletHoles.length > 120) {
      const old = this.bulletHoles.shift();
      this.scene.remove(old); old.geometry.dispose(); old.material.dispose();
    }
  }

  _createBulletHoleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 6, 32, 32, 30);
    grad.addColorStop(0,    'rgba(0,0,0,1)');
    grad.addColorStop(0.4,  'rgba(15,10,5,0.95)');
    grad.addColorStop(0.75, 'rgba(30,20,10,0.7)');
    grad.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(32, 32, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath(); ctx.arc(32, 32, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,15,10,0.8)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.moveTo(32 + Math.cos(a) * 9, 32 + Math.sin(a) * 9);
      ctx.lineTo(32 + Math.cos(a) * (20 + Math.random() * 8), 32 + Math.sin(a) * (20 + Math.random() * 8));
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
  }

  _muzzleFlash(wdef) {
    const geo = new THREE.SphereGeometry(0.025, 5, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xFFEE44 });
    const flash = new THREE.Mesh(geo, mat);
    flash.position.set(0, 0, wdef.barrelTipZ - this.weaponGroup.position.z);
    this.weaponScene.add(flash);
    setTimeout(() => { this.weaponScene.remove(flash); geo.dispose(); mat.dispose(); }, 35);
  }

  // ═══════════════════════════════════════════════════════
  //  BOT DAMAGE / KILL
  // ═══════════════════════════════════════════════════════

  _hitBot(bot, dmg, hitbox) {
    bot.health -= dmg;
    this.ui.showDamageNumber(dmg, hitbox === 'head');

    const flashColors = { head: [0xFF2200, 0xFFAAA0], body: [0xFF6600, 0xCC2222], leg: [0xFF8800, 0x221133] };
    const [fc, rc] = flashColors[hitbox] || flashColors.body;

    if (hitbox === 'head') {
      bot.head.material.color.setHex(fc);
      setTimeout(() => { if (bot.alive) bot.head.material.color.setHex(rc); }, 90);
    } else if (hitbox === 'leg') {
      bot.legs.forEach(l => {
        l.material.color.setHex(fc);
        setTimeout(() => { if (bot.alive) l.material.color.setHex(rc); }, 90);
      });
    } else {
      bot.body.material.color.setHex(fc);
      setTimeout(() => { if (bot.alive) bot.body.material.color.setHex(rc); }, 90);
    }

    if (bot.health <= 0) this._killBot(bot, hitbox === 'head');
  }

  _killBot(bot, isHead) {
    bot.alive = false;
    bot.group.visible = false;
    this.player.kills++;
    this.ui.showKillFeed(isHead, `Bot ${bot.id + 1}`);
    this.ui.updateHUD();
    clearTimeout(bot.respawnTimer);
    bot.respawnTimer = setTimeout(() => {
      bot.health = bot.maxHealth;
      bot.alive  = true;
      bot.group.visible = true;
      bot.group.position.copy(bot.spawnPos);
      bot.pos.copy(bot.spawnPos);
      bot.bodyMat.color.setHex(0xCC2222);
      bot.headMat.color.setHex(0xFFAAA0);
      bot.legs.forEach(l => l.material.color.setHex(0x221133));
      bot.state = 'patrol';
      bot.shootCooldown = 2 + Math.random() * 2;
    }, 5000);
  }

  // ═══════════════════════════════════════════════════════
  //  BOT AI
  // ═══════════════════════════════════════════════════════

  _botHasLOS(bot) {
    const origin = new THREE.Vector3(bot.pos.x, 1.4, bot.pos.z);
    const target = new THREE.Vector3(this.player.pos.x, 1.4, this.player.pos.z);
    const dist   = origin.distanceTo(target);
    const dir    = target.clone().sub(origin).normalize();
    const ray    = new THREE.Raycaster(origin, dir, 0, dist - 0.5);
    return ray.intersectObjects(this.envMeshes).length === 0;
  }

  _botShoot(bot) {
    if (!this.player.isAlive) return;
    const origin = new THREE.Vector3(bot.pos.x, 1.4, bot.pos.z);
    const target = new THREE.Vector3(this.player.pos.x, 1.1, this.player.pos.z);
    const dist   = origin.distanceTo(target);
    this._bulletTrace(origin, target.clone().sub(origin).normalize(), dist);
    const accuracy = Math.max(0.1, 0.72 - dist * 0.011);
    if (Math.random() < accuracy) {
      this.player.health = Math.max(0, this.player.health - 80);
      this.ui.showDamageFlash();
      if (this.player.health <= 0) this._playerDie(bot.id);
      this.ui.updateHUD();
    }
  }

  _updateBots(dt) {
    this.bots.forEach(bot => {
      if (!bot.alive) return;
      bot.stateTimer    -= dt;
      bot.shootCooldown -= dt;

      const dist   = bot.pos.distanceTo(this.player.pos);
      const hasLOS = dist < 55 && this._botHasLOS(bot);

      if (this.player.isAlive && hasLOS) {
        bot.state = 'attack';
        bot.stateTimer = 0.5;
        const dx = this.player.pos.x - bot.pos.x;
        const dz = this.player.pos.z - bot.pos.z;
        bot.group.rotation.y = Math.atan2(dx, dz);
        if (bot.shootCooldown <= 0) {
          this._botShoot(bot);
          bot.shootCooldown = 1.8 + Math.random() * 2.2;
        }
      } else if (bot.stateTimer <= 0) {
        bot.state = 'patrol';
        bot.stateTimer = 1.5 + Math.random() * 3;
        bot.currentWaypoint = Math.floor(Math.random() * bot.waypoints.length);
      }

      // Move toward current waypoint
      const wp  = bot.waypoints[bot.currentWaypoint];
      const dx  = wp.x - bot.pos.x;
      const dz  = wp.z - bot.pos.z;
      const wpd = Math.sqrt(dx * dx + dz * dz);
      if (wpd > 1.5) {
        const nx = dx / wpd, nz = dz / wpd;
        bot.pos.x += nx * bot.moveSpeed * dt;
        bot.pos.z += nz * bot.moveSpeed * dt;
        if (bot.state !== 'attack') bot.group.rotation.y = Math.atan2(nx, nz);
      } else {
        bot.currentWaypoint = Math.floor(Math.random() * bot.waypoints.length);
      }

      bot.pos.x = Math.max(-38, Math.min(38, bot.pos.x));
      bot.pos.z = Math.max(-36, Math.min(36, bot.pos.z));
      bot.group.position.set(bot.pos.x, 0, bot.pos.z);
    });
  }

  // ═══════════════════════════════════════════════════════
  //  PLAYER DEATH / RESPAWN
  // ═══════════════════════════════════════════════════════

  _playerDie(killerBotId) {
    if (!this.player.isAlive) return;
    this.player.isAlive = false;
    this.player.deaths++;
    this.player.health = 0;
    this.isADS = false;
    this.isSliding = false;
    clearTimeout(this.weapons.reloadTimer);
    this.weapons.isReloading = false;
    if (this.isPointerLocked) document.exitPointerLock();
    this.ui.showDeathOverlay(`Bot ${killerBotId + 1}`);
    this.ui.updateHUD();
    setTimeout(() => this._playerRespawn(), 3000);
  }

  _playerRespawn() {
    this.player.health    = this.player.maxHealth;
    this.player.isAlive   = true;
    this.player.pos.set(0, 1.65, 28);
    this.player.yaw       = Math.PI;
    this.player.pitch     = 0;
    this.player.vel.set(0, 0, 0);
    this.player.onGround  = true;
    this.camHeightOffset  = 0;
    this.isSliding        = false;
    this.slideCooldown    = 0;
    const w = WEAPONS[this.weapons.current];
    this.weapons.ammoState[this.weapons.current] = { magazine: w.magazineSize, reserve: w.reserveAmmo };
    this.weapons.isReloading = false;
    this.ui.hideDeathOverlay();
    this.ui.updateHUD();
    document.body.requestPointerLock();
  }

  // ═══════════════════════════════════════════════════════
  //  RELOAD
  // ═══════════════════════════════════════════════════════

  startReload() {
    if (this.weapons.isReloading || !this.player.isAlive) return;
    const wid  = this.weapons.current;
    const w    = WEAPONS[wid];
    const ammo = this.weapons.ammoState[wid];
    if (!ammo || ammo.magazine >= w.magazineSize || ammo.reserve <= 0) return;
    this.weapons.isReloading = true;
    this.ui.showReloadBar(w.reloadTime);
    clearTimeout(this.weapons.reloadTimer);
    this.weapons.reloadTimer = setTimeout(() => {
      const fill = Math.min(w.magazineSize - ammo.magazine, ammo.reserve);
      ammo.magazine += fill; ammo.reserve -= fill;
      this.weapons.isReloading = false;
      this.ui.updateHUD();
    }, w.reloadTime);
  }

  // ═══════════════════════════════════════════════════════
  //  GAME LOOP
  // ═══════════════════════════════════════════════════════

  _loop() {
    const clock = new THREE.Clock();
    const tick  = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      this._update(dt);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      this.renderer.clearDepth();
      this.renderer.render(this.weaponScene, this.weaponCamera);
    };
    tick();
  }

  _update(dt) {
    if (this.state !== 'playing') return;

    if (this.player.isAlive) this._updateMovement(dt);
    this._updateBots(dt);

    const offsetTarget = this.isSliding ? -0.9 : 0;
    this.camHeightOffset += (offsetTarget - this.camHeightOffset) * Math.min(1, dt * 14);

    this.camera.position.copy(this.player.pos);
    this.camera.position.y += this.camHeightOffset;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;

    this._updateADS(dt);
    this._updateWeaponAnim(dt);
    this.ui.setCrosshairMoving(this.player.isMoving && !this.isSliding);
  }

  _updateADS(dt) {
    const target = this.isADS ? 1 : 0;
    this.weaponAnim.adsT += (target - this.weaponAnim.adsT) * Math.min(1, dt * 14);
    const fovTarget = 75 - this.weaponAnim.adsT * 50;
    this.camera.fov += (fovTarget - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();
    const scopeEl = document.getElementById('scope-overlay');
    if (scopeEl) {
      scopeEl.classList.toggle('visible', this.weaponAnim.adsT > 0.88);
      const ch = document.getElementById('crosshair');
      if (ch) ch.style.opacity = this.weaponAnim.adsT > 0.88 ? '0' : '1';
    }
  }

  _updateMovement(dt) {
    if (this.slideCooldown > 0) this.slideCooldown -= dt;

    const isWalking = !!this.keys['ShiftLeft'];
    const dir = new THREE.Vector3();
    if (this.keys['KeyW']) dir.z -= 1;
    if (this.keys['KeyS']) dir.z += 1;
    if (this.keys['KeyA']) dir.x -= 1;
    if (this.keys['KeyD']) dir.x += 1;
    this.player.isMoving = dir.lengthSq() > 0;

    // ── JUMP (checked first — always responds to Space) ──
    if (this.keys['Space'] && this.player.onGround) {
      if (this.isSliding) {
        // Slide-jump: cancel slide immediately, no cooldown, slight boost
        this.isSliding     = false;
        this.slideCooldown = 0;
        this.player.vel.y  = 6.2;
      } else {
        this.player.vel.y  = 5.8;
      }
      this.player.onGround = false;
    }

    // ── START SLIDE (Ctrl or CapsLock on ground while moving) ──
    const wantSlide = this.keys['ControlLeft'] || this.keys['ControlRight'];
    if (wantSlide && this.player.isMoving && !this.isSliding && this.slideCooldown <= 0 && this.player.onGround) {
      this.isSliding  = true;
      this.slideTimer = 0.85;
      this.slideSpeed = 9.5;
      this.slideDir.copy(dir.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw));
    }

    // ── HORIZONTAL MOVEMENT ──
    if (this.isSliding) {
      this.slideTimer -= dt;
      this.slideSpeed  = Math.max(0, this.slideSpeed - (this.player.onGround ? 10 : 3) * dt);
      this.player.pos.x += this.slideDir.x * this.slideSpeed * dt;
      this.player.pos.z += this.slideDir.z * this.slideSpeed * dt;
      // Only end slide (with cooldown) when back on ground
      if (this.player.onGround && (this.slideTimer <= 0 || this.slideSpeed <= 0.2)) {
        this.isSliding     = false;
        this.slideCooldown = 0.6;
      }
    } else if (this.player.isMoving) {
      const speed = 5.2 * (isWalking ? 0.55 : 1.0) * (this.weaponAnim.adsT > 0.1 ? 0.85 : 1.0);
      const moveDir = dir.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
      this.player.pos.x += moveDir.x * speed * dt;
      this.player.pos.z += moveDir.z * speed * dt;
    }

    // ── VERTICAL PHYSICS ──
    if (this.player.onGround) {
      this.player.pos.y = 1.65;
      this.player.vel.y = 0;
    } else {
      this.player.vel.y -= 16 * dt;
      this.player.pos.y += this.player.vel.y * dt;
      if (this.player.pos.y <= 1.65) {
        this.player.pos.y    = 1.65;
        this.player.vel.y    = 0;
        this.player.onGround = true;
      }
    }

    // ── BOUNDS ──
    this.player.pos.x = Math.max(-38, Math.min(38, this.player.pos.x));
    this.player.pos.z = Math.max(-36, Math.min(36, this.player.pos.z));
  }

  _updateWeaponAnim(dt) {
    const anim = this.weaponAnim;
    anim.raiseT = Math.min(1, anim.raiseT + dt * 7);
    if (anim.kickT > 0) anim.kickT = Math.max(0, anim.kickT - dt * 14);
    const wdef = this.getCurrentWeapon();
    if (this.weapons.isReloading) {
      anim.reloadT = Math.min(1, anim.reloadT + dt * (1000 / (wdef?.reloadTime || 2500)));
    } else {
      anim.reloadT = Math.max(0, anim.reloadT - dt * 6);
    }
    const bobMult = 1 - anim.adsT;
    if (this.player.isMoving) this.weaponBobT += dt * 9;
    const bobX = Math.sin(this.weaponBobT) * 0.012 * bobMult;
    const bobY = Math.abs(Math.sin(this.weaponBobT)) * 0.006 * bobMult;
    const raiseOff  = (1 - anim.raiseT) * 0.4;
    const reloadOff = Math.sin(anim.reloadT * Math.PI) * 0.13;
    const reloadRot = Math.sin(anim.reloadT * Math.PI) * 0.3;
    const kickZ     = anim.kickT * 0.04;
    const px = (0.19 + (0 - 0.19) * anim.adsT) + bobX;
    const py = (-0.21 + 0.07 * anim.adsT) + bobY - raiseOff - reloadOff;
    this.weaponGroup.position.set(px, py, -0.38 + kickZ);
    this.weaponGroup.rotation.x = anim.kickT * 0.06 + reloadRot;
    this.weaponGroup.visible = !(anim.adsT > 0.9);
  }
}
