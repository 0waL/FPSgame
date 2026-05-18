const WEAPONS = {
  // ── PISTOLS ──────────────────────────────────────────
  classic: {
    id: 'classic', name: 'Classic', type: 'pistol', slot: 'secondary',
    price: 0, damage: 26, headshotMult: 3.0, fireRate: 400,
    magazineSize: 12, reserveAmmo: 36, reloadTime: 1500,
    spread: 0.02, movementSpread: 0.05, pellets: 1, auto: false,
    color: 0x999999, barrelTipZ: -0.22,
    description: '무료 기본 권총. 가볍고 안정적.',
  },
  sheriff: {
    id: 'sheriff', name: 'Sheriff', type: 'pistol', slot: 'secondary',
    price: 800, damage: 55, headshotMult: 2.5, fireRate: 750,
    magazineSize: 6, reserveAmmo: 24, reloadTime: 2500,
    spread: 0.015, movementSpread: 0.04, pellets: 1, auto: false,
    color: 0xC8A050, barrelTipZ: -0.25,
    description: '고화력 리볼버. 한 발 한 발이 치명적.',
  },

  // ── SMGs ─────────────────────────────────────────────
  stinger: {
    id: 'stinger', name: 'Stinger', type: 'smg', slot: 'primary',
    price: 1100, damage: 27, headshotMult: 2.0, fireRate: 67,
    magazineSize: 20, reserveAmmo: 80, reloadTime: 2000,
    spread: 0.05, movementSpread: 0.08, pellets: 1, auto: true,
    color: 0x4488CC, barrelTipZ: -0.42,
    description: '빠른 연사력의 근접전 SMG.',
  },
  spectre: {
    id: 'spectre', name: 'Spectre', type: 'smg', slot: 'primary',
    price: 1600, damage: 26, headshotMult: 2.0, fireRate: 91,
    magazineSize: 30, reserveAmmo: 90, reloadTime: 2250,
    spread: 0.04, movementSpread: 0.07, pellets: 1, auto: true,
    color: 0x557799, barrelTipZ: -0.46,
    description: '소음기 장착 SMG. 중거리까지 유효.',
  },

  // ── RIFLES ───────────────────────────────────────────
  guardian: {
    id: 'guardian', name: 'Guardian', type: 'rifle', slot: 'primary',
    price: 2250, damage: 65, headshotMult: 2.5, fireRate: 285,
    magazineSize: 12, reserveAmmo: 36, reloadTime: 2500,
    spread: 0.01, movementSpread: 0.04, pellets: 1, auto: false,
    color: 0x228866, barrelTipZ: -0.68,
    description: '반자동 고화력 라이플. 정밀 사격 특화.',
  },
  phantom: {
    id: 'phantom', name: 'Phantom', type: 'rifle', slot: 'primary',
    price: 2900, damage: 39, headshotMult: 2.5, fireRate: 87,
    magazineSize: 30, reserveAmmo: 90, reloadTime: 2500,
    spread: 0.02, movementSpread: 0.06, pellets: 1, auto: true,
    color: 0x334488, barrelTipZ: -0.7,
    description: '소음기 장착 자동 라이플. 반동이 적음.',
  },
  vandal: {
    id: 'vandal', name: 'Vandal', type: 'rifle', slot: 'primary',
    price: 2900, damage: 40, headshotMult: 2.56, fireRate: 120,
    magazineSize: 25, reserveAmmo: 75, reloadTime: 2500,
    spread: 0.025, movementSpread: 0.07, pellets: 1, auto: true,
    color: 0xBB3322, barrelTipZ: -0.68,
    description: '모든 거리에서 헤드샷 즉사. 높은 반동.',
  },

  // ── SNIPERS ──────────────────────────────────────────
  marshal: {
    id: 'marshal', name: 'Marshal', type: 'sniper', slot: 'primary',
    price: 950, damage: 101, headshotMult: 2.0, fireRate: 1100,
    magazineSize: 5, reserveAmmo: 20, reloadTime: 3000,
    spread: 0.005, movementSpread: 0.03, pellets: 1, auto: false,
    color: 0x886622, barrelTipZ: -0.85,
    description: '경량 스나이퍼. 빠른 조준 속도.',
  },
  operator: {
    id: 'operator', name: 'Operator', type: 'sniper', slot: 'primary',
    price: 4700, damage: 150, headshotMult: 1.5, fireRate: 1500,
    magazineSize: 5, reserveAmmo: 20, reloadTime: 3700,
    spread: 0.003, movementSpread: 0.02, pellets: 1, auto: false,
    color: 0x224466, barrelTipZ: -0.98,
    description: '몸샷도 즉사. 최강의 스나이퍼.',
  },

  // ── HEAVY ────────────────────────────────────────────
  bucky: {
    id: 'bucky', name: 'Bucky', type: 'shotgun', slot: 'primary',
    price: 900, damage: 34, headshotMult: 1.25, fireRate: 650,
    magazineSize: 5, reserveAmmo: 15, reloadTime: 2500,
    spread: 0.10, movementSpread: 0.12, pellets: 7, auto: false,
    color: 0x885533, barrelTipZ: -0.6,
    description: '펌프 샷건. 근거리 최강 화력.',
  },
  judge: {
    id: 'judge', name: 'Judge', type: 'shotgun', slot: 'primary',
    price: 1850, damage: 34, headshotMult: 1.25, fireRate: 400,
    magazineSize: 7, reserveAmmo: 21, reloadTime: 2800,
    spread: 0.12, movementSpread: 0.14, pellets: 7, auto: true,
    color: 0x664411, barrelTipZ: -0.58,
    description: '자동 샷건. 벽돌 부수듯 적을 제압.',
  },
  ares: {
    id: 'ares', name: 'Ares', type: 'mg', slot: 'primary',
    price: 1600, damage: 30, headshotMult: 2.5, fireRate: 100,
    magazineSize: 50, reserveAmmo: 100, reloadTime: 3500,
    spread: 0.06, movementSpread: 0.10, pellets: 1, auto: true,
    color: 0x887755, barrelTipZ: -0.72,
    description: '50발 탄창의 경기관총.',
  },
  odin: {
    id: 'odin', name: 'Odin', type: 'mg', slot: 'primary',
    price: 3200, damage: 38, headshotMult: 2.5, fireRate: 133,
    magazineSize: 100, reserveAmmo: 200, reloadTime: 5000,
    spread: 0.07, movementSpread: 0.12, pellets: 1, auto: true,
    color: 0x444444, barrelTipZ: -0.75,
    description: '100발 탄창. 전장을 제압하는 중기관총.',
  },
};

const WEAPON_CATEGORIES = [
  { name: '권총', icon: '🔫', weapons: ['classic', 'sheriff'] },
  { name: 'SMG', icon: '⚡', weapons: ['stinger', 'spectre'] },
  { name: '라이플', icon: '🎯', weapons: ['guardian', 'phantom', 'vandal'] },
  { name: '스나이퍼', icon: '🔭', weapons: ['marshal', 'operator'] },
  { name: '헤비', icon: '💥', weapons: ['bucky', 'judge', 'ares', 'odin'] },
];
