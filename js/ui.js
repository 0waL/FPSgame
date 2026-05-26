class GameUI {
  constructor(game) {
    this.game = game;
    this.crosshairBaseSize = 8;
    this.currentCrosshairSize = 8;
    this.hitMarkerTimer = null;
    this.crosshairTimer = null;
    this.msgTimer = null;
    this.setupHUD();
    this.setupBuyMenu();
    this.setupStartScreen();
    this.updateHUD();
  }

  // ── HUD ────────────────────────────────────────────────

  setupHUD() {
    this.els = {
      health:      document.getElementById('health'),
      armor:       document.getElementById('armor'),
      ammoCurrent: document.getElementById('ammo-current'),
      ammoReserve: document.getElementById('ammo-reserve'),
      weaponName:  document.getElementById('weapon-name'),
      slot1:       document.getElementById('slot-primary'),
      slot2:       document.getElementById('slot-secondary'),
      score:       document.getElementById('score'),
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
    const g = this.game;
    const p = g.player;
    const w = g.weapons;

    this.els.health.textContent = p.health;
    this.els.armor.textContent  = p.armor;
    this.els.score.textContent  = g.score;

    const wid  = w[w.currentSlot];
    const wdef = wid ? WEAPONS[wid] : null;
    const ammo = wid ? w.ammoState[wid] : null;

    if (wdef && ammo) {
      this.els.weaponName.textContent  = wdef.name;
      this.els.ammoCurrent.textContent = ammo.magazine;
      this.els.ammoReserve.textContent = ammo.reserve;
      this.els.ammoCurrent.classList.toggle('low', ammo.magazine <= Math.floor(wdef.magazineSize * 0.25));
    }

    // Slot display
    const pri = w.primary ? WEAPONS[w.primary] : null;

    this.els.slot1.innerHTML = pri
      ? `<span class="sname">${pri.name}</span><span class="sammo">${w.ammoState[w.primary]?.magazine ?? 0}</span>`
      : `<span class="sempty">— 무기 없음</span>`;
    this.els.slot2.innerHTML = '';

    this.els.slot1.classList.toggle('active', w.currentSlot === 'primary');
    this.els.slot2.classList.remove('active');
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

  showKillFeed(isHeadshot) {
    const el = document.createElement('div');
    el.className = 'kill-item';
    el.innerHTML = isHeadshot ? '☠️ <b>HEADSHOT</b>' : '💀 Kill';
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

  // ── ARSENAL MENU ───────────────────────────────────────

  setupBuyMenu() {
    const grid = document.getElementById('buy-grid');
    this._buildBuyGrid(grid);
    document.getElementById('buy-close').addEventListener('click', () => this.game.closeBuyMenu());
  }

  _buildBuyGrid(grid) {
    grid.innerHTML = '';
    WEAPON_CATEGORIES.forEach(cat => {
      const col = document.createElement('div');
      col.className = 'buy-col';

      const hdr = document.createElement('div');
      hdr.className = 'buy-col-hdr';
      hdr.textContent = cat.name;
      col.appendChild(hdr);

      cat.weapons.forEach(wid => {
        const w = WEAPONS[wid];
        const isEquipped = this.game.weapons.primary === wid;

        const card = document.createElement('div');
        card.className = 'wcard' + (isEquipped ? ' equipped' : '');

        card.innerHTML = `
          <div class="wsil type-${w.type}"></div>
          <div class="wcard-body">
            <span class="wcard-name">${w.name}</span>
            <span class="wcard-desc">${w.description}</span>
          </div>
          ${isEquipped ? '<div class="wcard-owned">✓</div>' : ''}
        `;

        if (!isEquipped) {
          card.addEventListener('click', () => {
            this.game.buyWeapon(wid);
            this._buildBuyGrid(grid);
          });
        }

        col.appendChild(card);
      });

      grid.appendChild(col);
    });
  }

  showBuyMenu() {
    document.getElementById('buy-menu').classList.add('visible');
    this._buildBuyGrid(document.getElementById('buy-grid'));
  }

  hideBuyMenu() {
    document.getElementById('buy-menu').classList.remove('visible');
  }

  // ── START SCREEN ───────────────────────────────────────

  setupStartScreen() {
    const slider  = document.getElementById('sens-slider');
    const sensVal = document.getElementById('sens-val');
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      sensVal.textContent = v.toFixed(1);
      this.game.mouseSens = 0.002 * v;
    });

    document.getElementById('start-btn').addEventListener('click', () => {
      document.getElementById('start-screen').style.display = 'none';
      this.game.state = 'playing';
      document.body.requestPointerLock();
    });
  }
}
