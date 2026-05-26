class FPSGame {
  constructor() {
    // ── Player ──────────────────────────────────────────
    this.player = {
      health: 150,
      maxHealth: 150,
      armor: 0,
      pos: new THREE.Vector3(0, 1.65, 5),
      vel: new THREE.Vector3(),
      yaw: 0,
      pitch: 0,
      onGround: true,
      isMoving: false,
    };

    // ── Weapons ─────────────────────────────────────────
    this.weapons = {
      primary: 'marshal',
      secondary: null,
      currentSlot: 'primary',
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

    // ── Weapon animation state ───────────────────────────
    this.weaponAnim = { raiseT: 0, kickT: 0, adsT: 0, reloadT: 0 };

    // ── Slide state ──────────────────────────────────────
    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDir = new THREE.Vector3();
    this.slideSpeed = 0;
    this.slideCooldown = 0;

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

    // ── Collision boxes (AABB list) ──────────────────────
    this.colliders = [];

    // ── Environment meshes & bullet holes ────────────────
    this.envMeshes   = [];
    this.bulletHoles = [];
    this._bulletHoleTex = null;

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

    this._bulletHoleTex = this._createBulletHoleTexture();

    // Give starting sniper ammo
    this._initAmmo('marshal');
    this.weapons.currentSlot = 'primary';

    this.ui = new GameUI(this);
    this._buildWeaponModel('marshal');
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

    this.weaponScene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const wDir = new THREE.DirectionalLight(0xffffff, 0.9);
    wDir.position.set(1, 2, 2);
    this.weaponScene.add(wDir);
    const wDir2 = new THREE.DirectionalLight(0x8899bb, 0.4);
    wDir2.position.set(-2, 0, 1);
    this.weaponScene.add(wDir2);
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
    this.envMeshes.push(floor);

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
      this.envMeshes.push(mesh);
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
      this.envMeshes.push(mesh);
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

    const legs = [];
    [-0.2, 0.2].forEach(x => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.8, 6), legMat.clone());
      leg.position.set(x, 0.4, 0);
      leg.castShadow = true;
      leg.userData = { targetId: id, hitbox: 'leg' };
      group.add(leg);
      legs.push(leg);
    });

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.1, 8), baseMat);
    base.position.y = 0.05;
    group.add(base);

    this.scene.add(group);

    body.userData = { targetId: id, hitbox: 'body' };
    head.userData = { targetId: id, hitbox: 'head' };

    return { id, group, body, head, legs,
             bodyMat, headMat, legMat: legs[0].material,
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
    // MeshPhongMaterial for metallic sheen
    const gMat = new THREE.MeshPhongMaterial({ color: w.color,     shininess: 90, specular: 0x666666 });
    const dMat = new THREE.MeshPhongMaterial({ color: 0x111111,    shininess: 70, specular: 0x444444 });
    const hMat = new THREE.MeshPhongMaterial({ color: 0xBB8855,    shininess: 15, specular: 0x110800 });
    const wdMat= new THREE.MeshPhongMaterial({ color: 0x6B3A1F,    shininess: 20, specular: 0x220E00 }); // wood

    // Hand / grip
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.09), hMat);
    hand.position.set(0.04, -0.13, -0.08);
    this.weaponGroup.add(hand);

    // Second hand for long guns
    if (['rifle', 'smg', 'mg', 'sniper'].includes(w.type)) {
      const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.07), hMat);
      hand2.position.set(0.02, -0.11, -0.26);
      this.weaponGroup.add(hand2);
    }

    switch (w.type) {
      case 'pistol':   this._buildPistol(gMat, dMat, w.id); break;
      case 'smg':      this._buildSMG(gMat, dMat, w.id); break;
      case 'rifle':    this._buildRifle(gMat, dMat, wdMat, w.id); break;
      case 'sniper':   this._buildSniper(gMat, dMat, wdMat, w.id); break;
      case 'shotgun':  this._buildShotgun(gMat, dMat, wdMat, w.id); break;
      case 'mg':       this._buildMG(gMat, dMat); break;
      default:         this._buildPistol(gMat, dMat, w.id);
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

  _buildPistol(g, d, id) {
    if (id === 'sheriff') {
      // Desert Eagle — large, angular, imposing
      this._add(new THREE.BoxGeometry(0.072, 0.088, 0.26), g, 0, 0.01, 0);             // wide slide
      this._add(new THREE.BoxGeometry(0.068, 0.055, 0.21), g, 0, -0.025, 0.01);       // frame
      this._add(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8), d, 0, 0.01, -0.18, Math.PI/2);  // barrel
      this._add(new THREE.BoxGeometry(0.065, 0.155, 0.055), g, 0, -0.11, 0.05);       // grip
      this._add(new THREE.BoxGeometry(0.005, 0.088, 0.002), d,  0.037, 0.01, 0);      // left rail
      this._add(new THREE.BoxGeometry(0.005, 0.088, 0.002), d, -0.037, 0.01, 0);      // right rail
      this._add(new THREE.BoxGeometry(0.004, 0.012, 0.007), d, 0, 0.055, -0.115);     // front sight
      this._add(new THREE.BoxGeometry(0.004, 0.012, 0.007), d, -0.014, 0.055, 0.11);  // rear sight L
      this._add(new THREE.BoxGeometry(0.004, 0.012, 0.007), d,  0.014, 0.055, 0.11);  // rear sight R
    } else {
      // Glock-17 — slim polymer pistol
      this._add(new THREE.BoxGeometry(0.056, 0.068, 0.21), g, 0, 0.024, 0);           // slide
      this._add(new THREE.BoxGeometry(0.054, 0.040, 0.17), g, 0, -0.016, 0.01);       // frame
      this._add(new THREE.CylinderGeometry(0.011, 0.011, 0.065, 8), d, 0, 0.024, -0.15, Math.PI/2); // barrel tip
      this._add(new THREE.BoxGeometry(0.052, 0.140, 0.048), g, 0, -0.098, 0.038);     // grip
      this._add(new THREE.BoxGeometry(0.004, 0.010, 0.006), d, 0, 0.060, -0.09);      // front sight
      this._add(new THREE.BoxGeometry(0.004, 0.010, 0.006), d, -0.01, 0.060, 0.08);   // rear sight L
      this._add(new THREE.BoxGeometry(0.004, 0.010, 0.006), d,  0.01, 0.060, 0.08);   // rear sight R
      for (let i = 0; i < 5; i++) { // slide serrations
        this._add(new THREE.BoxGeometry(0.058, 0.055, 0.002), d, 0, 0.024, 0.05 + i * 0.011);
      }
    }
  }

  _buildSMG(g, d, id) {
    if (id === 'spectre') {
      // MP5-SD — integrated suppressor dominates profile
      this._add(new THREE.BoxGeometry(0.065, 0.075, 0.34), g, 0, 0, 0);              // receiver
      this._add(new THREE.CylinderGeometry(0.026, 0.026, 0.30, 10), d, 0, 0.005, -0.32, Math.PI/2); // suppressor
      this._add(new THREE.BoxGeometry(0.055, 0.038, 0.10), g, 0, 0, 0.27);           // stock base
      this._add(new THREE.BoxGeometry(0.014, 0.014, 0.18), d, 0.02, 0.006, 0.38);    // stock tube top
      this._add(new THREE.BoxGeometry(0.014, 0.014, 0.18), d,-0.02, 0.006, 0.38);    // stock tube bot
      this._add(new THREE.BoxGeometry(0.055, 0.016, 0.01), d, 0, 0.006, 0.47);       // stock end
      this._add(new THREE.BoxGeometry(0.048, 0.150, 0.040), d, 0, -0.108, 0.04);     // magazine
    } else {
      // MP9 — very compact, minimal stock
      this._add(new THREE.BoxGeometry(0.062, 0.072, 0.30), g, 0, 0, 0);              // receiver
      this._add(new THREE.CylinderGeometry(0.013, 0.013, 0.10, 8), d, 0, 0.005, -0.22, Math.PI/2); // barrel
      this._add(new THREE.BoxGeometry(0.052, 0.040, 0.08), g, 0, 0, 0.20);           // stub stock
      this._add(new THREE.BoxGeometry(0.048, 0.130, 0.036), d, 0, -0.095, 0.04);     // curved mag
      this._add(new THREE.BoxGeometry(0.060, 0.012, 0.12), d, 0, 0.044, -0.06);      // top rail
    }
  }

  _buildRifle(g, d, wd, id) {
    if (id === 'vandal') {
      // AK-47 — iconic curved mag, wooden furniture
      this._add(new THREE.BoxGeometry(0.068, 0.080, 0.54), g, 0, 0, 0);              // receiver
      this._add(new THREE.BoxGeometry(0.062, 0.068, 0.22), wd, 0,-0.006,-0.20);      // wood handguard
      this._add(new THREE.CylinderGeometry(0.011, 0.011, 0.26, 8), d, 0, 0.01,-0.48, Math.PI/2); // barrel
      this._add(new THREE.BoxGeometry(0.032, 0.016, 0.05), d, 0, 0.01,-0.62);        // muzzle brake
      this._add(new THREE.BoxGeometry(0.050, 0.060, 0.24), wd, 0,-0.01, 0.39);       // wood stock
      this._add(new THREE.BoxGeometry(0.048, 0.080, 0.05), wd, 0,-0.01, 0.52);       // stock butt
      // Curved banana magazine
      this._add(new THREE.BoxGeometry(0.056, 0.080, 0.052), d, 0,-0.09, 0.04, 0.18);
      this._add(new THREE.BoxGeometry(0.056, 0.080, 0.052), d, 0,-0.15,-0.02, 0.10);
      this._add(new THREE.BoxGeometry(0.028, 0.012, 0.22), d, 0, 0.048, 0);          // top rail
    } else if (id === 'phantom') {
      // M4A1-S — suppressor + collapsible stock
      this._add(new THREE.BoxGeometry(0.066, 0.078, 0.50), g, 0, 0, 0);              // receiver
      this._add(new THREE.BoxGeometry(0.060, 0.062, 0.22), d, 0,-0.005,-0.21);       // handguard
      this._add(new THREE.CylinderGeometry(0.011, 0.011, 0.18, 8), d, 0, 0.01,-0.44, Math.PI/2); // barrel
      this._add(new THREE.CylinderGeometry(0.020, 0.020, 0.18, 10), d, 0, 0.01,-0.60, Math.PI/2); // suppressor
      this._add(new THREE.BoxGeometry(0.030, 0.012, 0.14), d, 0, 0.048, 0.05);       // top rail
      this._add(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6), d, 0, 0.002, 0.38, Math.PI/2); // buffer tube
      this._add(new THREE.BoxGeometry(0.048, 0.048, 0.07), g, 0,-0.002, 0.50);       // stock
      this._add(new THREE.BoxGeometry(0.052, 0.165, 0.048), d, 0,-0.13, 0.05);       // magazine
    } else {
      // FAMAS — bullpup: mag behind grip
      this._add(new THREE.BoxGeometry(0.068, 0.080, 0.48), g, 0, 0, 0);              // receiver (bullpup)
      this._add(new THREE.CylinderGeometry(0.011, 0.011, 0.20, 8), d, 0, 0.01,-0.42, Math.PI/2); // barrel
      this._add(new THREE.BoxGeometry(0.066, 0.058, 0.14), d, 0,-0.008,-0.18);       // handguard
      this._add(new THREE.BoxGeometry(0.036, 0.080, 0.12), g, 0, 0.030, 0.02);       // carry handle
      this._add(new THREE.BoxGeometry(0.050, 0.150, 0.046), d, 0,-0.10, 0.16);       // magazine (behind grip)
      this._add(new THREE.BoxGeometry(0.028, 0.012, 0.18), d, 0, 0.046, 0.04);       // rail
    }
  }

  _buildSniper(g, d, wd, id) {
    const isAWP = id === 'operator';
    // Receiver
    this._add(new THREE.BoxGeometry(0.058, 0.074, isAWP ? 0.82 : 0.68), g, 0, 0, 0);
    // Barrel
    this._add(new THREE.CylinderGeometry(0.012, 0.012, isAWP ? 0.50 : 0.38, 10), d, 0, 0.010, isAWP ? -0.68 : -0.60, Math.PI/2);
    // Muzzle brake
    this._add(new THREE.BoxGeometry(0.030, 0.022, 0.06), d, 0, 0.010, isAWP ? -0.95 : -0.81);
    // Stock (wood)
    this._add(new THREE.BoxGeometry(0.044, 0.058, 0.28), wd, 0,-0.010, isAWP ? 0.55 : 0.48);
    this._add(new THREE.BoxGeometry(0.042, 0.082, 0.06), wd, 0,-0.010, isAWP ? 0.69 : 0.62); // butt
    // Pistol grip
    this._add(new THREE.BoxGeometry(0.048, 0.120, 0.046), d, 0,-0.090, isAWP ? 0.16 : 0.12);
    // Magazine
    this._add(new THREE.BoxGeometry(0.038, 0.090, 0.040), d, 0,-0.082, isAWP ? 0.26 : 0.22);
    // Scope body
    const scopeZ = isAWP ? 0.0 : -0.02;
    this._add(new THREE.CylinderGeometry(0.026, 0.026, isAWP ? 0.28 : 0.24, 12), d, 0, 0.058, scopeZ, Math.PI/2);
    // Scope objective (big lens)
    const lMat = new THREE.MeshPhongMaterial({ color: 0x1133AA, shininess: 200, specular: 0x8899FF, transparent: true, opacity: 0.7 });
    this._add(new THREE.CylinderGeometry(0.024, 0.024, 0.010, 12), lMat, 0, 0.058, scopeZ - (isAWP ? 0.145 : 0.125), Math.PI/2);
    this._add(new THREE.CylinderGeometry(0.018, 0.018, 0.010, 12), lMat, 0, 0.058, scopeZ + (isAWP ? 0.145 : 0.125), Math.PI/2);
    // Scope adjustment turrets
    this._add(new THREE.CylinderGeometry(0.007, 0.007, 0.030, 6), d, 0,  0.088, scopeZ);  // top turret
    this._add(new THREE.CylinderGeometry(0.007, 0.007, 0.030, 6), d, 0.038, 0.058, scopeZ); // side turret
    // Bolt handle
    this._add(new THREE.CylinderGeometry(0.006, 0.006, 0.060, 6), d, 0.048, 0.030, isAWP ? 0.08 : 0.06, 0, 0, Math.PI/2);
    // Bipod (AWP only)
    if (isAWP) {
      const bMat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 40 });
      [-0.028, 0.028].forEach(x => {
        this._add(new THREE.CylinderGeometry(0.005, 0.005, 0.18, 4), bMat, x,-0.09,-0.38, 0, 0, x > 0 ? -0.35 : 0.35);
      });
    }
  }

  _buildShotgun(g, d, wd, id) {
    if (id === 'judge') {
      // AA-12 — auto shotgun, drum mag
      this._add(new THREE.BoxGeometry(0.085, 0.095, 0.44), g, 0, 0, 0);              // receiver
      this._add(new THREE.CylinderGeometry(0.022, 0.022, 0.30, 8), d, 0, 0.01,-0.38, Math.PI/2); // barrel
      this._add(new THREE.BoxGeometry(0.080, 0.080, 0.18), d, 0,-0.001,-0.16);       // handguard
      this._add(new THREE.BoxGeometry(0.058, 0.060, 0.20), g, 0,-0.010, 0.34);       // stock
      this._add(new THREE.CylinderGeometry(0.068, 0.068, 0.070, 14), d, 0,-0.085, 0.06, Math.PI/2); // drum mag
      this._add(new THREE.BoxGeometry(0.028, 0.012, 0.22), d, 0, 0.050, 0);          // rail
    } else {
      // Remington 870 — classic pump
      this._add(new THREE.BoxGeometry(0.080, 0.090, 0.44), g, 0, 0, 0);              // receiver
      this._add(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 8), d, 0, 0.014,-0.42, Math.PI/2); // barrel
      this._add(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 6), d, 0,-0.032,-0.18, Math.PI/2); // mag tube
      this._add(new THREE.BoxGeometry(0.074, 0.072, 0.14), wd, 0,-0.001,-0.17);      // pump wood
      this._add(new THREE.BoxGeometry(0.056, 0.075, 0.26), wd, 0,-0.010, 0.35);      // wood stock
      this._add(new THREE.BoxGeometry(0.054, 0.095, 0.06), wd, 0,-0.010, 0.49);      // butt pad
    }
  }

  _buildMG(g, d) {
    const isOdin = this.weapons?.[this.weapons.currentSlot] === 'odin';
    this._add(new THREE.BoxGeometry(0.098, 0.102, 0.62), g, 0, 0, 0);                // receiver
    this._add(new THREE.BoxGeometry(0.090, 0.090, 0.26), d, 0,-0.004,-0.22);         // heat shield
    // Perforated barrel shroud
    this._add(new THREE.CylinderGeometry(0.016, 0.016, isOdin ? 0.44 : 0.38, 10), d, 0, 0.010, isOdin ? -0.56 : -0.50, Math.PI/2);
    // Flash hider
    this._add(new THREE.CylinderGeometry(0.020, 0.014, 0.04, 8), d, 0, 0.010, isOdin ? -0.79 : -0.70, Math.PI/2);
    // Stock
    this._add(new THREE.BoxGeometry(0.070, 0.072, 0.24), g, 0,-0.004, 0.44);
    this._add(new THREE.BoxGeometry(0.068, 0.090, 0.06), g, 0,-0.004, 0.57);         // butt
    // Ammo box / drum
    if (isOdin) {
      this._add(new THREE.BoxGeometry(0.080, 0.095, 0.130), d, 0.065,-0.05, 0.08);   // ammo box
    } else {
      this._add(new THREE.CylinderGeometry(0.065, 0.065, 0.072, 14), d, 0.062,-0.062, 0.08, Math.PI/2); // drum
    }
    // Bipod
    const bMat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 50 });
    [-0.036, 0.036].forEach(x => {
      this._add(new THREE.CylinderGeometry(0.005, 0.005, 0.20, 4), bMat, x,-0.10,-0.30, 0, 0, x > 0 ? -0.38 : 0.38);
    });
    this._add(new THREE.BoxGeometry(0.028, 0.012, 0.20), d, 0, 0.058, 0.02);         // top rail
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
      case 'KeyR':   this.startReload(); break;
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

  _onWheel(_e) {
    // single weapon type — no slot switching needed
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
    this._initAmmo(wid);
    this.weapons.primary = wid;
    this.switchSlot('primary');
  }

  switchSlot(slot) {
    if (!this.weapons[slot]) return;
    this.weapons.currentSlot = slot;
    this._buildWeaponModel(this.weapons[slot]);
    this.weaponAnim.raiseT = 0;
    this.ui?.updateHUD();
  }

  buyWeapon(wid) {
    const w = WEAPONS[wid];
    this.equipWeapon(wid);
    this.ui.showMessage(`${w.name} 장착!`, 'success');
    this.ui.updateHUD();
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
    const spread = this.isADS
      ? wdef.adsSpread
      : (moving ? wdef.movementSpread : wdef.spread);

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
      this.targets.forEach(t => { if (t.alive) meshes.push(t.body, t.head, ...t.legs); });

      const hits = raycaster.intersectObjects(meshes);
      let targetHitDist = Infinity;

      if (hits.length > 0) {
        const hit    = hits[0];
        const hitbox = hit.object.userData.hitbox;
        const isHead = hitbox === 'head';
        const tid    = hit.object.userData.targetId;
        const target = this.targets[tid];
        targetHitDist = hit.distance;

        if (target?.alive) {
          let dmg;
          if (hitbox === 'head') dmg = 300;
          else if (hitbox === 'body') dmg = 150;
          else dmg = 100; // legs
          this._hitTarget(target, dmg, hitbox);
        }

        this._bulletTrace(this.camera.position.clone(), shotDir, hit.distance);
        this.ui.showHitMarker(isHead);
      } else {
        this._bulletTrace(this.camera.position.clone(), shotDir, 120);
      }

      // Bullet hole on environment
      const envHits = raycaster.intersectObjects(this.envMeshes);
      if (envHits.length > 0 && envHits[0].distance < targetHitDist) {
        const eh = envHits[0];
        const worldNormal = eh.face.normal.clone().transformDirection(eh.object.matrixWorld);
        this._createBulletHole(eh.point.clone(), worldNormal);
      }
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
      map: this._bulletHoleTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position).addScaledVector(normal, 0.006);
    mesh.lookAt(mesh.position.clone().add(normal));
    mesh.rotateZ(Math.random() * Math.PI * 2);
    this.scene.add(mesh);
    this.bulletHoles.push(mesh);

    if (this.bulletHoles.length > 120) {
      const old = this.bulletHoles.shift();
      this.scene.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }
  }

  _createBulletHoleTexture() {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Dark outer ring with blast marks
    const grad = ctx.createRadialGradient(32, 32, 6, 32, 32, 30);
    grad.addColorStop(0,   'rgba(0,0,0,1)');
    grad.addColorStop(0.4, 'rgba(15,10,5,0.95)');
    grad.addColorStop(0.75,'rgba(30,20,10,0.7)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    // Center hole
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.arc(32, 32, 8, 0, Math.PI * 2);
    ctx.fill();

    // Crack lines
    ctx.strokeStyle = 'rgba(20,15,10,0.8)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.moveTo(32 + Math.cos(a) * 9,  32 + Math.sin(a) * 9);
      ctx.lineTo(32 + Math.cos(a) * (20 + Math.random() * 8), 32 + Math.sin(a) * (20 + Math.random() * 8));
      ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
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
    this.weaponAnim.kickT = 1.0;
  }

  // ── Target damage ────────────────────────────────────

  _hitTarget(target, dmg, hitbox) {
    target.health -= dmg;
    const isHead = hitbox === 'head';
    this.ui.showDamageNumber(dmg, isHead);

    if (hitbox === 'head') {
      target.head.material.color.setHex(0xFF2200);
      setTimeout(() => { if (target.alive) target.head.material.color.setHex(0xFFBB88); }, 90);
    } else if (hitbox === 'leg') {
      target.legs.forEach(l => {
        l.material.color.setHex(0xFF8800);
        setTimeout(() => { if (target.alive) l.material.color.setHex(0x334455); }, 90);
      });
    } else {
      target.body.material.color.setHex(0xFF4400);
      setTimeout(() => { if (target.alive) target.body.material.color.setHex(0xFF6600); }, 90);
    }

    if (target.health <= 0) this._killTarget(target, isHead);
  }

  _killTarget(target, isHead) {
    target.alive = false;
    target.group.visible = false;

    this.score += isHead ? 150 : 100;

    this.ui.showKillFeed(isHead);
    this.ui.updateHUD();

    clearTimeout(target.respawnTimer);
    target.respawnTimer = setTimeout(() => {
      target.health = target.maxHealth;
      target.alive  = true;
      target.group.visible = true;
      target.bodyMat.color.setHex(0xFF6600);
      target.headMat.color.setHex(0xFFBB88);
      target.legs.forEach(l => l.material.color.setHex(0x334455));
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
    this.ui.showReloadBar(w.reloadTime);

    clearTimeout(this.weapons.reloadTimer);
    this.weapons.reloadTimer = setTimeout(() => {
      const needed = w.magazineSize - ammo.magazine;
      const fill   = Math.min(needed, ammo.reserve);
      ammo.magazine          += fill;
      ammo.reserve           -= fill;
      this.weapons.isReloading = false;
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

    this._updateADS(dt);
    this._updateWeaponAnim(dt);
    this.ui.setCrosshairMoving(this.player.isMoving);
  }

  _updateADS(dt) {
    const target = this.isADS ? 1 : 0;
    this.weaponAnim.adsT += (target - this.weaponAnim.adsT) * Math.min(1, dt * 14);

    const wdef = this.getCurrentWeapon();
    const isSniper = wdef?.type === 'sniper';
    const fovTarget = 75 - this.weaponAnim.adsT * (isSniper ? 50 : 28);
    this.camera.fov += (fovTarget - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();

    // 스나이퍼 스코프 오버레이
    const scopeEl = document.getElementById('scope-overlay');
    if (scopeEl) {
      scopeEl.classList.toggle('visible', isSniper && this.weaponAnim.adsT > 0.88);
      document.getElementById('crosshair').style.opacity = isSniper && this.weaponAnim.adsT > 0.88 ? '0' : '1';
    }
  }

  _updateMovement(dt) {
    // Cooldown tick
    if (this.slideCooldown > 0) this.slideCooldown -= dt;

    const isWalking = !!this.keys['ShiftLeft'];
    const dir = new THREE.Vector3();
    if (this.keys['KeyW']) dir.z -= 1;
    if (this.keys['KeyS']) dir.z += 1;
    if (this.keys['KeyA']) dir.x -= 1;
    if (this.keys['KeyD']) dir.x += 1;

    const wasMoving = this.player.isMoving;
    this.player.isMoving = dir.lengthSq() > 0;

    // Start slide: moving + ControlLeft, not already sliding, no cooldown
    if (this.keys['ControlLeft'] && wasMoving && !this.isSliding && this.slideCooldown <= 0 && this.player.onGround) {
      this.isSliding  = true;
      this.slideTimer = 0.85;
      this.slideSpeed = 9.5;
      // Lock slide direction to current facing
      const slideInput = dir.clone().normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
      this.slideDir.copy(slideInput);
    }

    if (this.isSliding) {
      this.slideTimer -= dt;
      // Decelerate slower in air to preserve momentum
      const decel = this.player.onGround ? 11 : 3;
      this.slideSpeed = Math.max(0, this.slideSpeed - dt * decel);
      const next = this.player.pos.clone().addScaledVector(this.slideDir, this.slideSpeed * dt);
      next.x = Math.max(-37, Math.min(37, next.x));
      next.z = Math.max(-37, Math.min(37, next.z));
      this.player.pos.x = next.x;
      this.player.pos.z = next.z;

      // Camera low only while on ground
      if (this.player.onGround) {
        this.player.pos.y += (0.75 - this.player.pos.y) * Math.min(1, dt * 12);
      }

      if (this.slideTimer <= 0 || this.slideSpeed <= 0.2) {
        this.isSliding     = false;
        this.slideCooldown = 0.7;
      }
    } else {
      // Normal movement
      const speed = 5.2 * (isWalking ? 0.55 : 1.0) * (this.weaponAnim.adsT > 0.1 ? 0.85 : 1.0);
      if (this.player.isMoving) {
        dir.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);
        const next = this.player.pos.clone().addScaledVector(dir, speed * dt);
        next.x = Math.max(-37, Math.min(37, next.x));
        next.z = Math.max(-37, Math.min(37, next.z));
        this.player.pos.x = next.x;
        this.player.pos.z = next.z;
      }

      // Stand height
      const targetFloor = 1.65;
      if (this.player.onGround) {
        this.player.pos.y += (targetFloor - this.player.pos.y) * Math.min(1, dt * 10);
      }
    }

    // Jump — allowed during sliding (preserves horizontal momentum)
    if (this.keys['Space'] && this.player.onGround) {
      // Snap to stand height first so the landing check (pos.y <= 1.65) doesn't
      // trigger immediately when jumping from the low slide camera position.
      this.player.pos.y    = 1.65;
      this.player.vel.y    = 5.5;
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
    const anim = this.weaponAnim;

    // 무기 들기 애니메이션 (0→1, 빠르게)
    anim.raiseT = Math.min(1, anim.raiseT + dt * 7);

    // 반동 감소
    if (anim.kickT > 0) anim.kickT = Math.max(0, anim.kickT - dt * 14);

    // 재장전 애니메이션 진행
    const wdef = this.getCurrentWeapon();
    if (this.weapons.isReloading) {
      anim.reloadT = Math.min(1, anim.reloadT + dt * (1000 / (wdef?.reloadTime || 2000)));
    } else {
      anim.reloadT = Math.max(0, anim.reloadT - dt * 6);
    }

    // 밥 (ADS 중엔 없앰)
    const bobMult = 1 - anim.adsT;
    if (this.player.isMoving) this.weaponBobT += dt * 9;
    const bobX = Math.sin(this.weaponBobT) * 0.012 * bobMult;
    const bobY = Math.abs(Math.sin(this.weaponBobT)) * 0.006 * bobMult;

    // 위치 계산
    const raiseOff  = (1 - anim.raiseT) * 0.4;
    const reloadOff = Math.sin(anim.reloadT * Math.PI) * 0.13;
    const reloadRot = Math.sin(anim.reloadT * Math.PI) * 0.3;
    const kickZ     = anim.kickT * 0.04;

    const px = (0.19 + (0 - 0.19) * anim.adsT) + bobX;
    const py = (-0.21 + (-0.14 - (-0.21)) * anim.adsT) + bobY - raiseOff - reloadOff;

    this.weaponGroup.position.set(px, py, -0.38 + kickZ);
    this.weaponGroup.rotation.x = anim.kickT * 0.06 + reloadRot;

    // 스나이퍼 완전 조준 시 총 모델 숨김
    const isSniper = wdef?.type === 'sniper';
    this.weaponGroup.visible = !(isSniper && anim.adsT > 0.9);
  }
}
