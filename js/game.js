class FPSGame {
  constructor() {
    // ── Player ──────────────────────────────────────────
    this.player = {
      health: 100,
      armor: 0,
      money: 3000,
      pos: new THREE.Vector3(0, 1.65, 5),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      onGround: true,
      isMoving: false,
    };

    // ── Weapons ─────────────────────────────────────────
    this.weapons = {
      primary: null,
      secondary: 'classic',
      currentSlot: 'secondary',
      ammoState: {},
      isReloading: false,
      lastShotTime: 0,
      reloadTimer: null,
    };

    // ── Input ────────────────────────────────────────────
    this.keys = {};
    this.mouseButtons = {};
    this.isPointerLocked = false;
    this.isADS = false;

    // ── State ────────────────────────────────────────────
    this.state = 'lobby';
    this.score = 0;
    this.targets = [];

    // ── Three.js objects ─────────────────────────────────
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.weaponScene = null;
    this.weaponCamera = null;
    this.weaponGroup = null;
    this.weaponBobT = 0;
    this.weaponReloadAnim = false;
    this.weaponKickT = 0; // recoil kick animation

    // ── Collision boxes (AABB list) ──────────────────────
    this.colliders = [];

    this._init();
  }

  // ═══════════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════════

  _init() {
    this._setupRenderer();
    this._setupScenes();
    this._setupLighting();
    this._setupMap();
    this._setupTargets();
    this._setupWeaponGroup();
    this._setupControls();

    // Give default pistol ammo
    this._initAmmo('classic');
    this.weapons.currentSlot = 'secondary';

    this.ui = new GameUI(this);
    this._buildWeaponModel('classic');
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
    // World scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7EC8E3);
    this.scene.fog = new THREE.Fog(0x7EC8E3, 30, 120);

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);

    // Weapon scene (rendered on top with cleared depth)
    this.weaponScene = new THREE.Scene();
    this.weaponCamera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 10);

    const wAmbient = new THREE.AmbientLight(0xffffff, 0.9);
    this.weaponScene.add(wAmbient);
    const wDir = new THREE.DirectionalLight(0xffffff, 0.6);
    wDir.position.set(1, 2, 2);
    this.weaponScene.add(wDir);
  }

  _setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const sun = new THREE.DirectionalLight(0xfffaea, 0.9);
    sun.position.set(15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left   = -40;
    sun.shadow.camera.right  =  40;
    sun.shadow.camera.top    =  40;
    sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far    = 100;
    this.scene.add(sun);

    // Fill light
    const fill = new THREE.DirectionalLight(0xaaccff, 0.25);
    fill.position.set(-10, 5, -10);
    this.scene.add(fill);
  }

  // ═══════════════════════════════════════════════════════
  //  MAP
  // ═══════════════════════════════════════════════════════

  _setupMap() {
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x9B9B8A });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid
    const grid = new THREE.GridHelper(80, 40, 0x777766, 0x888877);
    grid.position.y = 0.01;
    this.scene.add(grid);

    const wallMat = new THREE.MeshLambertMaterial({ color: 0xC4B898 });
    const wallDefs = [
      { pos: [0,  4, -38], size: [76, 8, 1] },
      { pos: [0,  4,  38], size: [76, 8, 1] },
      { pos: [-38, 4, 0],  size: [1, 8, 76] },
      { pos: [38,  4, 0],  size: [1, 8, 76] },
    ];
    wallDefs.forEach(w => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...w.size), wallMat);
      mesh.position.set(...w.pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push({ min: new THREE.Vector3(w.pos[0]-w.size[0]/2, 0, w.pos[2]-w.size[2]/2),
                            max: new THREE.Vector3(w.pos[0]+w.size[0]/2, w.size[1], w.pos[2]+w.size[2]/2) });
    });

    const boxMat = new THREE.MeshLambertMaterial({ color: 0x8B6340 });
    const boxDefs = [
      { pos: [6,  0, -14], size: [2, 1.5, 2] },
      { pos: [-6, 0, -14], size: [2, 1.5, 2] },
      { pos: [12, 0, -20], size: [3, 1.5, 1] },
      { pos: [-12,0, -20], size: [3, 1.5, 1] },
      { pos: [0,  0,  -8], size: [5, 1.1, 1.2] },
      { pos: [18, 0,   0], size: [2, 2, 5] },
      { pos: [-18,0,   0], size: [2, 2, 5] },
      { pos: [0,  0,  12], size: [8, 2.2, 2] },
      { pos: [8,  0,  20], size: [1.5, 3, 1.5] },
      { pos: [-8, 0,  20], size: [1.5, 3, 1.5] },
    ];
    boxDefs.forEach(b => {
      const h = b.size[1];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...b.size), boxMat);
      mesh.position.set(b.pos[0], h / 2, b.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push({ min: new THREE.Vector3(b.pos[0]-b.size[0]/2, 0, b.pos[2]-b.size[2]/2),
                            max: new THREE.Vector3(b.pos[0]+b.size[0]/2, h, b.pos[2]+b.size[2]/2) });
    });
  }

  // ═══════════════════════════════════════════════════════
  //  TARGETS
  // ═══════════════════════════════════════════════════════

  _setupTargets() {
    const positions = [
      [-10, 0, -28], [-3, 0, -28], [3, 0, -28], [10, 0, -28],
      [-18, 0, -32], [18, 0, -32],
      [-6,  0, -16], [6,  0, -16],
    ];
    positions.forEach((pos, i) => {
      this.targets.push(this._makeTarget(pos, i));
    });
  }

  _makeTarget(position, id) {
    const group = new THREE.Group();
    group.position.set(...position);

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xFF6600 });
    const headMat = new THREE.MeshLambertMaterial({ color: 0xFFBB88 });
    const legMat  = new THREE.MeshLambertMaterial({ color: 0x334455 });
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8), bodyMat);
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), headMat);
    head.position.y = 1.75;
    head.castShadow = true;
    group.add(head);

    [-0.2, 0.2].forEach(x => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.8, 6), legMat);
      leg.position.set(x, 0.4, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.1, 8), baseMat);
    base.position.y = 0.05;
    group.add(base);

    this.scene.add(group);

    body.userData = { targetId: id, hitbox: 'body' };
    head.userData = { targetId: id, hitbox: 'head' };

    return { id, group, body, head,
             bodyMat, headMat,
             health: 100, maxHealth: 100, alive: true,
             origPos: [...position], respawnTimer: null };
  }

  // ═══════════════════════════════════════════════════════
  //  WEAPON MODEL
  // ═══════════════════════════════════════════════════════

  _setupWeaponGroup() {
    this.weaponGroup = new THREE.Group();
    this.weaponScene.add(this.weaponGroup);
  }

  _buildWeaponModel(wid) {
    while (this.weaponGroup.children.length) {
      this.weaponGroup.remove(this.weaponGroup.children[0]);
    }

    const w = WEAPONS[wid];
    const gMat = new THREE.MeshLambertMaterial({ color: w.color });
    const dMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const hMat = new THREE.MeshLambertMaterial({ color: 0xC49A5A });

    // Hand
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.09), hMat);
    hand.position.set(0.04, -0.13, -0.08);
    this.weaponGroup.add(hand);

    switch (w.type) {
      case 'pistol':   this._buildPistol(gMat, dMat); break;
      case 'smg':      this._buildSMG(gMat, dMat); break;
      case 'rifle':    this._buildRifle(gMat, dMat); break;
      case 'sniper':   this._buildSniper(gMat, dMat); break;
      case 'shotgun':  this._buildShotgun(gMat, dMat); break;
      case 'mg':       this._buildMG(gMat, dMat); break;
      default:         this._buildPistol(gMat, dMat);
    }

    this.weaponGroup.position.set(0.19, -0.21, -0.38);
  }

  _add(geo, mat, px, py, pz, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.rotation.set(rx, ry, rz);
    this.weaponGroup.add(m);
    return m;
  }

  _buildPistol(g, d) {
    this._add(new THREE.BoxGeometry(0.06, 0.07, 0.22), g, 0, 0.02, 0);
    this._add(new THREE.BoxGeometry(0.055, 0.045, 0.18), g, 0, -0.02, 0.01);
    this._add(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 6), d, 0, 0.02, -0.16, Math.PI/2, 0, 0);
    this._add(new THREE.BoxGeometry(0.055, 0.13, 0.045), d, 0, -0.1, 0.04);
  }

  _buildSMG(g, d) {
    this._add(new THREE.BoxGeometry(0.07, 0.075, 0.38), g, 0, 0, 0);
    this._add(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 6), d, 0, 0.005, -0.25, Math.PI/2, 0, 0);
    this._add(new THREE.CylinderGeometry(0.020, 0.020, 0.08, 8), d, 0, 0.005, -0.33, Math.PI/2, 0, 0);
    this._add(new THREE.BoxGeometry(0.05, 0.04, 0.12), g, 0, 0, 0.25);
    this._add(new THREE.BoxGeometry(0.05, 0.15, 0.04), d, 0, -0.11, 0.04);
  }

  _buildRifle(g, d) {
    this._add(new THREE.BoxGeometry(0.07, 0.08, 0.58), g, 0, 0, 0);
    this._add(new THREE.BoxGeometry(0.065, 0.065, 0.26), d, 0, -0.007, -0.22);
    this._add(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), d, 0, 0.01, -0.46, Math.PI/2, 0, 0);
    this._add(new THREE.BoxGeometry(0.05, 0.055, 0.22), g, 0, -0.01, 0.38);
    this._add(new THREE.BoxGeometry(0.055, 0.19, 0.05), d, 0, -0.14, 0.05, 0.18, 0, 0);
    this._add(new THREE.BoxGeometry(0.03, 0.014, 0.22), d, 0, 0.048, 0);
  }

  _buildSniper(g, d) {
    this._add(new THREE.BoxGeometry(0.06, 0.075, 0.74), g, 0, 0, 0);
    this._add(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 8), d, 0, 0.01, -0.58, Math.PI/2, 0, 0);
    this._add(new THREE.BoxGeometry(0.042, 0.055, 0.26), g, 0, -0.01, 0.50);
    this._add(new THREE.BoxGeometry(0.04, 0.105, 0.042), d, 0, -0.09, 0.12);
    // Scope
    this._add(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 8), d, 0, 0.056, -0.02, Math.PI/2, 0, 0);
    this._add(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 8), new THREE.MeshLambertMaterial({ color: 0x4488DD }), 0, 0.056, -0.13, Math.PI/2, 0, 0);
    this._add(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 8), new THREE.MeshLambertMaterial({ color: 0x4488DD }), 0, 0.056,  0.09, Math.PI/2, 0, 0);
  }

  _buildShotgun(g, d) {
    this._add(new THREE.BoxGeometry(0.082, 0.092, 0.42), g, 0, 0, 0);
    this._add(new THREE.CylinderGeometry(0.023, 0.023, 0.34, 6), d, 0, 0.01, -0.38, Math.PI/2, 0, 0);
    this._add(new THREE.BoxGeometry(0.075, 0.072, 0.13), d, 0, 0, -0.18);
    this._add(new THREE.BoxGeometry(0.056, 0.072, 0.23), g, 0, -0.01, 0.32);
    this._add(new THREE.CylinderGeometry(0.014, 0.014, 0.28, 6), d, 0, -0.035, -0.12, Math.PI/2, 0, 0);
  }

  _buildMG(g, d) {
    this._add(new THREE.BoxGeometry(0.1, 0.105, 0.64), g, 0, 0, 0);
    this._add(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8), d, 0, 0.01, -0.51, Math.PI/2, 0, 0);
    this._add(new THREE.BoxGeometry(0.072, 0.072, 0.23), g, 0, -0.005, 0.43);
    // Drum magazine
    this._add(new THREE.CylinderGeometry(0.07, 0.07, 0.065, 12), d, 0.065, -0.065, 0.08, Math.PI/2, 0, 0);
    // Bipod
    const bMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    [-0.04, 0.04].forEach(x => {
      this._add(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 4), bMat, x, -0.1, -0.3, 0, 0, x > 0 ? -0.4 : 0.4);
    });
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
    document.addEventListener('wheel',     e => this._onWheel(e), { passive: true });
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

    if (this.state === 'buy') {
      if (e.code === 'Escape' || e.code === 'KeyB') this.closeBuyMenu();
      return;
    }

    switch (e.code) {
      case 'KeyB':   this.openBuyMenu(); break;
      case 'Digit1': this.switchSlot('secondary'); break;
      case 'Digit2': if (this.weapons.primary) this.switchSlot('primary'); break;
      case 'KeyR':   this.startReload(); break;
      case 'KeyG':   this._dropPrimary(); break;
      case 'Escape': if (this.isPointerLocked) document.exitPointerLock(); break;
    }
  }

  _onMouseMove(e) {
    if (!this.isPointerLocked || this.state !== 'playing') return;
    const sens = 0.002;
    this.player.yaw   -= e.movementX * sens;
    this.player.pitch -= e.movementY * sens;
    this.player.pitch  = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.player.pitch));
  }

  _onMouseDown(e) {
    this.mouseButtons[e.button] = true;
    if (e.button === 2) {
      this.isADS = true;
      e.preventDefault();
    }
    if (e.button === 0 && this.isPointerLocked && this.state === 'playing') {
      this._tryShoot();
    }
  }

  _onWheel(e) {
    if (this.state !== 'playing') return;
    if (e.deltaY > 0) {
      this.weapons.currentSlot === 'secondary' && this.weapons.primary
        ? this.switchSlot('primary')
        : this.switchSlot('secondary');
    } else {
      this.weapons.currentSlot === 'primary'
        ? this.switchSlot('secondary')
        : (this.weapons.primary && this.switchSlot('primary'));
    }
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

  getCurrentWeapon() {
    const id = this.weapons[this.weapons.currentSlot];
    return id ? WEAPONS[id] : null;
  }

  equipWeapon(wid) {
    const w = WEAPONS[wid];
    this._initAmmo(wid);
    this.weapons[w.slot] = wid;
    this.switchSlot(w.slot);
  }

  switchSlot(slot) {
    if (!this.weapons[slot]) return;
    this.weapons.currentSlot = slot;
    this._buildWeaponModel(this.weapons[slot]);
    this.ui?.updateHUD();
  }

  buyWeapon(wid) {
    const w = WEAPONS[wid];
    if (this.player.money < w.price) {
      this.ui.showMessage('돈이 부족합니다!', 'error');
      return;
    }
    this.player.money -= w.price;
    this.equipWeapon(wid);
    this.ui.showMessage(`${w.name} 장착!`, 'success');
    this.ui.updateHUD();
  }

  _dropPrimary() {
    if (this.weapons.currentSlot !== 'primary') return;
    this.weapons.primary = null;
    this.switchSlot('secondary');
  }

  // ── Shooting ──────────────────────────────────────────

  _tryShoot() {
    if (this.weapons.isReloading) return;
    const wdef = this.getCurrentWeapon();
    if (!wdef) return;

    const now = Date.now();
    if (now - this.weapons.lastShotTime < wdef.fireRate) return;

    const wid   = this.weapons[this.weapons.currentSlot];
    const ammo  = this.weapons.ammoState[wid];
    if (!ammo || ammo.magazine <= 0) { this.startReload(); return; }

    this.weapons.lastShotTime = now;
    ammo.magazine--;

    this._performShot(wdef);
    this._muzzleFlash(wdef);
    this._kickWeapon();

    if (ammo.magazine === 0 && ammo.reserve > 0) {
      setTimeout(() => this.startReload(), 80);
    }

    this.ui.updateHUD();
  }

  _performShot(wdef) {
    const moving = this.player.isMoving;
    const spread = moving ? wdef.movementSpread : wdef.spread;

    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    const right = new THREE.Vector3().crossVectors(dir, this.camera.up).normalize();
    const up    = new THREE.Vector3().crossVectors(right, dir).normalize();

    const raycaster = new THREE.Raycaster();

    for (let p = 0; p < wdef.pellets; p++) {
      const shotDir = dir.clone();
      if (spread > 0) {
        shotDir.addScaledVector(right, (Math.random() - 0.5) * 2 * spread);
        shotDir.addScaledVector(up,    (Math.random() - 0.5) * 2 * spread);
        shotDir.normalize();
      }

      raycaster.set(this.camera.position, shotDir);

      const meshes = [];
      this.targets.forEach(t => { if (t.alive) meshes.push(t.body, t.head); });

      const hits = raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        const hit    = hits[0];
        const isHead = hit.object.userData.hitbox === 'head';
        const tid    = hit.object.userData.targetId;
        const target = this.targets[tid];

        if (target?.alive) {
          const dmg = Math.round(wdef.damage * (isHead ? wdef.headshotMult : 1));
          this._hitTarget(target, dmg, isHead);
        }

        this._bulletTrace(this.camera.position.clone(), shotDir, hit.distance);
        this.ui.showHitMarker(isHead);
      } else {
        this._bulletTrace(this.camera.position.clone(), shotDir, 120);
      }
    }

    // Recoil
    this.player.pitch -= 0.008 + wdef.damage * 0.00012;
    this.ui.expandCrosshair(7 + wdef.pellets * 2);
  }

  _bulletTrace(origin, dir, dist) {
    const end = origin.clone().addScaledVector(dir, Math.min(dist, 120));
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xFFFF99, transparent: true, opacity: 0.55 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    setTimeout(() => { this.scene.remove(line); geo.dispose(); mat.dispose(); }, 45);
  }

  _muzzleFlash(wdef) {
    const fGeo = new THREE.SphereGeometry(0.025, 5, 5);
    const fMat = new THREE.MeshBasicMaterial({ color: 0xFFEE44 });
    const flash = new THREE.Mesh(fGeo, fMat);
    flash.position.set(0, 0, wdef.barrelTipZ - this.weaponGroup.position.z);
    this.weaponScene.add(flash);
    setTimeout(() => { this.weaponScene.remove(flash); fGeo.dispose(); fMat.dispose(); }, 35);
  }

  _kickWeapon() {
    this.weaponKickT = 1.0;
  }

  // ── Target damage ────────────────────────────────────

  _hitTarget(target, dmg, isHead) {
    target.health -= dmg;
    this.ui.showDamageNumber(dmg, isHead);

    const flashColor = isHead ? 0xFF2200 : 0xFF4400;
    const origColor  = isHead ? 0xFFBB88 : 0xFF6600;
    const mesh       = isHead ? target.head : target.body;
    mesh.material.color.setHex(flashColor);
    setTimeout(() => { if (target.alive) mesh.material.color.setHex(origColor); }, 90);

    if (target.health <= 0) this._killTarget(target, isHead);
  }

  _killTarget(target, isHead) {
    target.alive = false;
    target.group.visible = false;

    const reward = isHead ? 300 : 200;
    this.player.money += reward;
    this.score        += isHead ? 150 : 100;

    this.ui.showKillFeed(isHead);
    this.ui.updateHUD();

    clearTimeout(target.respawnTimer);
    target.respawnTimer = setTimeout(() => {
      target.health = target.maxHealth;
      target.alive  = true;
      target.group.visible = true;
      target.bodyMat.color.setHex(0xFF6600);
      target.headMat.color.setHex(0xFFBB88);
    }, 5000);
  }

  // ── Reload ────────────────────────────────────────────

  startReload() {
    if (this.weapons.isReloading) return;
    const wid  = this.weapons[this.weapons.currentSlot];
    if (!wid) return;
    const w    = WEAPONS[wid];
    const ammo = this.weapons.ammoState[wid];
    if (!ammo || ammo.magazine >= w.magazineSize || ammo.reserve <= 0) return;

    this.weapons.isReloading   = true;
    this.weaponReloadAnim       = true;
    this.ui.showReloadBar(w.reloadTime);

    clearTimeout(this.weapons.reloadTimer);
    this.weapons.reloadTimer = setTimeout(() => {
      const needed = w.magazineSize - ammo.magazine;
      const fill   = Math.min(needed, ammo.reserve);
      ammo.magazine          += fill;
      ammo.reserve           -= fill;
      this.weapons.isReloading = false;
      this.weaponReloadAnim    = false;
      this.ui.updateHUD();
    }, w.reloadTime);
  }

  // ── Buy menu ──────────────────────────────────────────

  openBuyMenu() {
    if (this.state === 'buy') return;
    this.state = 'buy';
    if (this.isPointerLocked) document.exitPointerLock();
    this.ui.showBuyMenu();
  }

  closeBuyMenu() {
    this.state = 'playing';
    this.ui.hideBuyMenu();
    document.body.requestPointerLock();
  }

  // ═══════════════════════════════════════════════════════
  //  GAME LOOP
  // ═══════════════════════════════════════════════════════

  _loop() {
    const clock = new THREE.Clock();
    const tick = () => {
      requestAnimationFrame(tick);
      const delta = Math.min(clock.getDelta(), 0.05);
      this._update(delta);

      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
      this.renderer.clearDepth();
      this.renderer.render(this.weaponScene, this.weaponCamera);
    };
    tick();
  }

  _update(dt) {
    if (this.state !== 'playing') return;

    this._updateMovement(dt);

    // Auto-fire
    if (this.mouseButtons[0] && this.isPointerLocked) {
      const w = this.getCurrentWeapon();
      if (w?.auto) this._tryShoot();
    }

    // Sync camera
    this.camera.position.copy(this.player.pos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;

    this._updateWeaponAnim(dt);
    this.ui.setCrosshairMoving(this.player.isMoving);
  }

  _updateMovement(dt) {
    const speed = 5.2;
    const dir   = new THREE.Vector3();

    if (this.keys['KeyW']) dir.z -= 1;
    if (this.keys['KeyS']) dir.z += 1;
    if (this.keys['KeyA']) dir.x -= 1;
    if (this.keys['KeyD']) dir.x += 1;

    this.player.isMoving = dir.lengthSq() > 0;

    if (this.player.isMoving) {
      dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
      const next = this.player.pos.clone().addScaledVector(dir, speed * dt);
      next.x = Math.max(-37, Math.min(37, next.x));
      next.z = Math.max(-37, Math.min(37, next.z));
      this.player.pos.copy(next);
    }

    // Jump
    if (this.keys['Space'] && this.player.onGround) {
      this.player.vel.y = 5.5;
      this.player.onGround = false;
    }

    if (!this.player.onGround) {
      this.player.vel.y -= 16 * dt;
      this.player.pos.y += this.player.vel.y * dt;
      if (this.player.pos.y <= 1.65) {
        this.player.pos.y    = 1.65;
        this.player.vel.y    = 0;
        this.player.onGround = true;
      }
    }
  }

  _updateWeaponAnim(dt) {
    if (this.player.isMoving) this.weaponBobT += dt * 9;

    const bobX = Math.sin(this.weaponBobT)        * 0.012;
    const bobY = Math.abs(Math.sin(this.weaponBobT)) * 0.006;

    // Recoil kick
    if (this.weaponKickT > 0) {
      this.weaponKickT = Math.max(0, this.weaponKickT - dt * 12);
    }
    const kickZ = this.weaponKickT * 0.04;

    let targetY = -0.21 + bobY;
    if (this.weaponReloadAnim) targetY -= 0.12;

    this.weaponGroup.position.x = 0.19 + bobX;
    this.weaponGroup.position.y += (targetY - this.weaponGroup.position.y) * 0.25;
    this.weaponGroup.position.z = -0.38 + kickZ;
    this.weaponGroup.rotation.x = this.weaponKickT * 0.06;
  }
}
