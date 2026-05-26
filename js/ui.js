class GameUI {
  constructor(game) {
    this.game = game;
    this.crosshairBaseSize = 8;
    this.currentCrosshairSize = 8;
    this.hitMarkerTimer = null;
    this.crosshairTimer = null;
    this.msgTimer = null;
    this.setupHUD();
    this.setupStartScreen();
    this.updateHUD();
  }

  setupHUD() {
    this.els = {
      health:      document.getElementById('health'),
      ammoCurrent: document.getElementById('ammo-current'),
      ammoReserve: document.getElementById('ammo-reserve'),
      weaponName:  document.getElementById('weapon-name'),
      slot1:       document.getElementById('slot-primary'),
      kills:       document.getElementById('kills'),
      deaths:      document.getElementById('deaths'),
      reloadBar:   document.getElementById('reload-bar'),
      reloadFill:  document.getElementById('reload-fill'),
      killFeed:    document.getElementById('kill-feed'),
      dmgNums:     document.getElementById('damage-numbers'),
      message:     document.getElementById('message'),
      crosshair:   document.getElementById('crosshair'),
      hitMarker:   document.getElementById('hit-marker'),
    };
  }

  updateHUD() {
    const g    = this.game;
    const p    = g.player;
    const wid  = g.weapons.current;
    const wdef = WEAPONS[wid];
    const ammo = g.weapons.ammoState[wid];

    this.els.health.textContent  = Math.max(0, p.health);
    this.els.kills.textContent   = p.kills;
    this.els.deaths.textContent  = p.deaths;

    if (wdef && ammo) {
      this.els.weaponName.textContent  = wdef.name;
      this.els.ammoCurrent.textContent = ammo.magazine;
      this.els.ammoReserve.textContent = ammo.reserve;
      this.els.ammoCurrent.classList.toggle('low', ammo.magazine <= Math.floor(wdef.magazineSize * 0.25));
    }

    if (this.els.slot1) {
      this.els.slot1.innerHTML = wdef
        ? `<span class="sname">${wdef.name}</span><span class="sammo">${ammo?.magazine ?? 0}</span>`
        : '';
      this.els.slot1.classList.add('active');
    }
  }

  // ── CROSSHAIR ──────────────────────────────────────────

  expandCrosshair(amount = 10) {
    this.currentCrosshairSize = Math.min(50, this.currentCrosshairSize + amount);
    this._applyCrosshair();
    clearTimeout(this.crosshairTimer);
    this.crosshairTimer = setTimeout(() => {
      this.currentCrosshairSize = this.crosshairBaseSize;
      this._applyCrosshair();
    }, 250);
  }

  setCrosshairMoving(moving) {
    const target = moving ? this.crosshairBaseSize + 6 : this.crosshairBaseSize;
    this.currentCrosshairSize = Math.max(this.currentCrosshairSize, target);
    this._applyCrosshair();
  }

  _applyCrosshair() {
    this.els.crosshair.style.setProperty('--gap', `${this.currentCrosshairSize}px`);
  }

  // ── HIT MARKER ─────────────────────────────────────────

  showHitMarker(isHeadshot) {
    const hm = this.els.hitMarker;
    hm.className = 'visible' + (isHeadshot ? ' headshot' : '');
    clearTimeout(this.hitMarkerTimer);
    this.hitMarkerTimer = setTimeout(() => { hm.className = ''; }, 200);
  }

  // ── DAMAGE NUMBERS ─────────────────────────────────────

  showDamageNumber(damage, isHeadshot) {
    const el = document.createElement('div');
    el.className = 'dmg-num' + (isHeadshot ? ' hs' : '');
    el.textContent = isHeadshot ? `${damage} ☠` : damage;
    const x = (Math.random() - 0.5) * 160;
    const y = (Math.random() - 0.5) * 60;
    el.style.cssText = `left:calc(50% + ${x}px);top:calc(50% + ${y}px)`;
    this.els.dmgNums.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  // ── DAMAGE FLASH (player takes damage) ─────────────────

  showDamageFlash() {
    const el = document.getElementById('damage-flash');
    if (!el) return;
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
  }

  // ── RELOAD BAR ─────────────────────────────────────────

  showReloadBar(duration) {
    const bar  = this.els.reloadBar;
    const fill = this.els.reloadFill;
    bar.style.display = 'block';
    fill.style.transition = 'none';
    fill.style.width = '0%';
    requestAnimationFrame(() => {
      fill.style.transition = `width ${duration}ms linear`;
      fill.style.width = '100%';
    });
    setTimeout(() => { bar.style.display = 'none'; }, duration + 50);
  }

  // ── KILL FEED ──────────────────────────────────────────

  showKillFeed(isHeadshot, name) {
    const el = document.createElement('div');
    el.className = 'kill-item';
    el.innerHTML = isHeadshot
      ? `☠️ <b>HEADSHOT</b> — ${name}`
      : `💀 Killed ${name}`;
    this.els.killFeed.prepend(el);
    setTimeout(() => el.remove(), 3500);
  }

  // ── MESSAGE ────────────────────────────────────────────

  showMessage(text, type = 'info') {
    const el = this.els.message;
    el.textContent = text;
    el.className = `show ${type}`;
    clearTimeout(this.msgTimer);
    this.msgTimer = setTimeout(() => { el.className = ''; }, 2200);
  }

  // ── DEATH OVERLAY ──────────────────────────────────────

  showDeathOverlay(killerName) {
    const el = document.getElementById('death-overlay');
    if (!el) return;
    const killerEl   = document.getElementById('death-killer');
    const countEl    = document.getElementById('death-countdown');
    if (killerEl) killerEl.textContent = `Killed by ${killerName}`;
    el.classList.add('visible');
    let count = 3;
    if (countEl) {
      countEl.textContent = `Respawning in ${count}...`;
      const iv = setInterval(() => {
        count--;
        if (count <= 0) { clearInterval(iv); countEl.textContent = ''; }
        else countEl.textContent = `Respawning in ${count}...`;
      }, 1000);
    }
  }

  hideDeathOverlay() {
    const el = document.getElementById('death-overlay');
    if (el) el.classList.remove('visible');
  }

  // ── START SCREEN ───────────────────────────────────────

  setupStartScreen() {
    // Sensitivity slider
    const slider  = document.getElementById('sens-slider');
    const sensVal = document.getElementById('sens-val');
    if (slider) {
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        if (sensVal) sensVal.textContent = v.toFixed(1);
        this.game.mouseSens = 0.002 * v;
      });
    }

    // Weapon choice buttons
    document.querySelectorAll('.weapon-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.weapon-choice').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const wid = btn.dataset.weapon;
        this.game.weapons.current = wid;
        this.game._initAmmo(wid);
        this.game._buildWeaponModel(wid);
        this.game.weaponAnim.raiseT = 0;
        this.updateHUD();
      });
    });

    document.getElementById('start-btn').addEventListener('click', () => {
      document.getElementById('start-screen').style.display = 'none';
      this.game.state = 'playing';
      document.body.requestPointerLock();
    });
  }
}
