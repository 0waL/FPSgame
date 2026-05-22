const WEAPONS = {
  // ── SNIPERS ──────────────────────────────────────────
  marshal: {
    id: 'marshal', name: 'Kar98k', type: 'sniper', slot: 'primary',
    price: 950, damage: 150, fireRate: 1100,
    magazineSize: 5, reserveAmmo: 20, reloadTime: 3000,
    spread: 0.005, movementSpread: 0.03, adsSpread: 0.00075, pellets: 1, auto: false,
    color: 0x886622, barrelTipZ: -0.85,
    description: '경량 스나이퍼. 빠른 조준 속도.',
  },
  operator: {
    id: 'operator', name: 'AWP', type: 'sniper', slot: 'primary',
    price: 4700, damage: 150, fireRate: 1500,
    magazineSize: 5, reserveAmmo: 20, reloadTime: 3700,
    spread: 0.003, movementSpread: 0.02, adsSpread: 0.00045, pellets: 1, auto: false,
    color: 0x224466, barrelTipZ: -0.98,
    description: '몸샷도 즉사. 최강의 스나이퍼.',
  },
};

const WEAPON_CATEGORIES = [
  { name: 'SNIPER', icon: '🔭', weapons: ['marshal', 'operator'] },
];
