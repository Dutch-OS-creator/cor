export const gameState = {
  screen: 'mainMenu',
  player: { 
    username: 'Player', trophies: 1250, gold: 2450, gems: 50, starPoints: 500,
    level: 1, // NEW: Player's overall level
    totalCrowns: 0, // NEW: Total crowns collected by the player
    totalWins: 0, // NEW stat for profile
    joinDate: null, // NEW: For profile
    arena: 1, // Current arena number (for display, derived from currentArenaIndex)
    currentArenaIndex: 0, // Index in arenaData array
    winsInCurrentArena: 0, // Wins needed to progress to next arena
    unlockedArenas: ['arena1'], // List of arena IDs unlocked by player
    newArenaChestAvailable: false, // Flag to indicate if an arena chest can be opened
    avatarUrl: 'https://images.websim.com/avatar/default_avatar', // NEW: Player's avatar URL
    chestCyclePosition: 0, // NEW: Player's position in the chest cycle
    cards: { // Refactored to hold player's owned cards, their level and count
      knight: { id: 'knight', name: 'Knight', cost: 3, type: 'troop', emoji: '⚔️', level: 1, count: 0, isGolden: false },
      archers: { id: 'archers', name: 'Archers', cost: 3, type: 'troop', emoji: '🏹', level: 1, count: 0, isGolden: false },
      musketeer: { id: 'musketeer', name: 'Musketeer', cost: 4, type: 'troop', emoji: '🔫', level: 1, count: 0, isGolden: false },
      hog: { id: 'hog', name: 'Hog Rider', cost: 4, type: 'troop', emoji: '🐷', level: 1, count: 0, isGolden: false },
      fireball: { id: 'fireball', name: 'Fireball', cost: 4, type: 'spell', emoji: '🔥', level: 1, count: 0, isGolden: false },
      zap: { id: 'zap', name: 'Zap', cost: 2, type: 'spell', emoji: '⚡', level: 1, count: 0, isGolden: false },
      cannon: { id: 'cannon', name: 'Cannon', cost: 3, type: 'building', emoji: '💥', level: 1, count: 0, isGolden: false }, // Changed cannon emoji to explosion
      dragon: { id: 'dragon', name: 'Baby Dragon', cost: 4, type: 'troop', emoji: '🐲', level: 1, count: 0, isGolden: false },
      'mini-pekka': { id: 'mini-pekka', name: 'Mini P.E.K.K.A', cost: 4, type: 'troop', emoji: '🤖', level: 1, count: 0, isGolden: false }
    },
    activeDeck: ['knight', 'archers', 'musketeer', 'hog'], // Stores card IDs currently in battle deck
    evoShards: {}, // NEW: Player's evolution shards for each card, e.g., { 'knight': 2 }
    equippedEvo: null, // NEW: Card ID of the currently equipped evolution
    lastLoginDate: null, // NEW: Track last login date for daily rewards
    dailyRewardClaimed: false // NEW: Track if daily reward has been claimed for the current day
  },
  battle: { 
    elixir:5,
    maxElixir:10,
    elixirRate:2800, // This will be the base rate, adjusted by elixirRateMultiplier
    timer:180,
    selectedCard:null,
    troops:[],
    buildings:[], // Active deployable buildings on the battlefield (e.g., Cannon, Goblin Hut)
    spells:[], // This is for general spell effects, not troop-spawned spells like log.
    projectiles:[],
    towers:null,
    drawQueue:[],
    hand:[],
    overtime:false, 
    emotes:[],
    particles:[],
    spells: [], // Initialize new spells array
    playerDeploymentYBoundary: null, // Will be initialized in initBattle
    hoverTarget: null, // For placement visualization {x, y, radius, type}
    isSandboxMode: false, // NEW: Flag for sandbox mode
    elixirRateMultiplier: 1, // NEW: Elixir rate multiplier for different modes
    isInfiniteElixir: false, // NEW: Flag for infinite elixir mode
    isSuddenDeathMode: false, // NEW: Flag for Sudden Death mode
    evoState: { // NEW: Tracks evolution readiness in battle
        cardId: null,
        cyclesNeeded: 1,
        currentCycles: 0,
    }
  },
  draft: { // NEW: State for Mega Draft mode
    isActive: false,
    playerDeck: [],
    enemyDeck: [],
    cardChoices: [],
    draftPool: [],
    currentPick: 0
  },
  chests: [], // Chests are now objects: {type, unlockStartTime, unlockDuration}
  chestCycle: [ // NEW: A simplified chest cycle
      'silver', 'silver', 'gold', 'silver', 'silver', 'gold', 'silver', 'giant', 
      'silver', 'silver', 'gold', 'silver', 'magical', 'silver', 'gold', 'silver', 
      'silver', 'gold', 'silver', 'silver'
  ],
  shop: {
    offers: [],
    lastRefresh: 0 // Timestamp of last shop refresh
  },
  isAdmin: false, // NEW: admin unlock flag
  adminGrantedCards: {}, // NEW: track admin-only granted cards
  // NEW: Daily Rewards Configuration
  dailyRewards: [
      { day: 1, type: 'gold', value: 100 },
      { day: 2, type: 'card', cardId: 'knight', count: 5 },
      { day: 3, type: 'gold', value: 200 },
      { day: 4, type: 'gem', value: 5 },
      { day: 5, type: 'card', cardId: 'archers', count: 10 },
      { day: 6, type: 'gold', value: 300 },
      { day: 7, type: 'chest', chestType: 'gold' }
  ]
};

export const cardData = {
  knight: { hp: 1200, damage: 120, speed: 1, range: 1, attackSpeed: 1200, targets: 'ground', rarity: 'common', starPointValue: 1, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}], 
    evolution: { 
      requiredShards: 6, 
      description: "Gains a shield while moving, absorbing damage.",
      boost: { shieldHp: 400, damage: 1.2 } 
    }
  },
  archers: { hp: 200, damage: 80, speed: 1, range: 5, attackSpeed: 1250, targets: 'both', count: 2, rarity: 'common', starPointValue: 1, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}],
    evolution: {
      requiredShards: 6,
      description: "Fires a powerful Power Shot that travels further and deals more damage.",
      boost: { range: 1.5, damage: 1.5 }
    }
  },
  musketeer: { hp: 400, damage: 160, speed: 1, range: 6, attackSpeed: 1000, targets: 'both', rarity: 'rare', starPointValue: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  hog: { hp: 800, damage: 200, speed: 2.5, range: 1, attackSpeed: 1500, targets: 'buildings', rarity: 'rare', starPointValue: 3, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  dragon: { hp: 800, damage: 120, speed: 1.5, range: 3.5, attackSpeed: 1600, targets: 'both', splash: true, splashRadius: 2, splashDamage: 0.7, rarity: 'rare', starPointValue: 3, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] }, // Added splash properties
  'mini-pekka': { hp: 600, damage: 300, speed: 2, range: 1, attackSpeed: 1800, targets: 'ground', rarity: 'rare', starPointValue: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] }, 
  cannon: { hp: 600, damage: 100, range: 5.5, attackSpeed: 800, targets: 'ground', lifetime: 30000, rarity: 'rare', starPointValue: 1, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  fireball: { damage: 500, radius: 2.5, targets: 'both', rarity: 'epic', starPointValue: 2, goldenBoost: {damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  zap: { damage: 200, radius: 2.5, targets: 'both', stun: 1, rarity: 'epic', starPointValue: 1, goldenBoost: {damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  // New arena specific cards
  goblin: { hp: 100, damage: 40, speed: 2.5, range: 1, attackSpeed: 1100, targets: 'ground', count: 4, rarity: 'common', starPointValue: 1, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  skeletons: { hp: 50, damage: 30, speed: 3, range: 1, attackSpeed: 1000, targets: 'ground', count: 4, rarity: 'common', starPointValue: 1, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}],
    evolution: {
      requiredShards: 6,
      description: "Continuously spawn more skeletons until the initial group is defeated.",
      boost: { spawnInterval: 3000, maxSpawn: 8 }
    }
  },
  barbarians: { hp: 300, damage: 80, speed: 1.5, range: 1, attackSpeed: 1400, targets: 'ground', count: 5, rarity: 'rare', starPointValue: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}],
    evolution: {
      requiredShards: 6,
      description: "Gain a rage effect for a few seconds after hitting their first target.",
      boost: { rageDuration: 4000, speedMultiplier: 1.4, attackSpeedMultiplier: 0.6 }
    }
  },
  'inferno-tower': { hp: 800, damage: 50, range: 6, attackSpeed: 400, targets: 'both', lifetime: 40000, rampUpDamage: true, rarity: 'epic', starPointValue: 3, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  icegolem: { hp: 1000, damage: 0, speed: 2, range: 1, attackSpeed: 1, targets: 'buildings', deathDamage: 100, rarity: 'rare', starPointValue: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  giantskeleton: { hp: 1500, damage: 200, speed: 1, range: 1, attackSpeed: 1500, targets: 'ground', deathBombDamage: 500, rarity: 'epic', starPointValue: 4, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  lavahound: { hp: 3000, damage: 0, speed: 0.5, range: 1, attackSpeed: 1, targets: 'buildings', pups: true, rarity: 'legendary', starPointValue: 5, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  minion: { hp: 100, damage: 50, speed: 2.5, range: 2.5, attackSpeed: 1000, targets: 'both', count: 3, flying: true, rarity: 'common', starPointValue: 1, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  // New card: The Log
  'the-log': { damage: 200, cost: 2, type: 'spell', speed: 8, duration: 1500, targets: 'ground', rarity: 'epic', starPointValue: 3, goldenBoost: {damage: 1.1}, width: 80, height: 40, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  // NEW RARE CARDS
  pekka: { hp: 2600, damage: 600, speed: 0.8, range: 1, attackSpeed: 1800, targets: 'ground', rarity: 'legendary', starPointValue: 4, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200},{cards:30,gold:2000}] },
  'mega-knight': { hp: 3000, damage: 300, speed: 1, range: 1.5, attackSpeed: 1700, targets: 'ground', splash: true, splashRadius: 1.5, splashDamage: 0.5, spawnDamage: 700, jumpDamage: 1000, rarity: 'legendary', starPointValue: 5, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200},{cards:30,gold:2000}] }, // Added splash properties
  'dark-knight': { hp: 1800, damage: 180, speed: 1.2, range: 1, attackSpeed: 1300, targets: 'ground', shieldHp: 800, rarity: 'epic', starPointValue: 3, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200},{cards:30,gold:2000}] },
  'skeleton-army': { hp: 40, damage: 60, speed: 2, range: 1, attackSpeed: 1000, targets: 'ground', count: 15, rarity: 'epic', starPointValue: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200},{cards:30,gold:2000}] },
  'goblin-barrel': { damage: 100, cost: 3, type: 'spell', targets: 'ground', spawnCount: 3, spawnCard: 'goblin', rarity: 'epic', starPointValue: 3, goldenBoost: {damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  'dark-miner': { hp: 900, damage: 700, speed: 1.5, range: 1, targets: 'ground', attackSpeed: 6500, rarity: 'legendary', starPointValue: 3, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200},{cards:30,gold:2000}] },
  // NEW CARDS
  'prince': { hp: 1400, damage: 220, speed: 1.5, range: 1, attackSpeed: 1500, targets: 'ground', rarity: 'epic', starPointValue: 3, chargeSpeedMultiplier: 2, chargeDamageMultiplier: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200},{cards:30,gold:2000}] },
  'elite-barbarians': { hp: 700, damage: 200, speed: 3, range: 1, attackSpeed: 1400, targets: 'ground', count: 2, rarity: 'common', starPointValue: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  'arrows': { damage: 240, radius: 4, targets: 'both', rarity: 'common', starPointValue: 1, goldenBoost: {damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  'golem': { hp: 4200, damage: 250, speed: 0.8, range: 1, attackSpeed: 2500, targets: 'buildings', deathDamage: 250, spawnOnDeath: 'golemite', spawnOnDeathCount: 2, rarity: 'epic', starPointValue: 4, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200},{cards:30,gold:2000}] },
  'golemite': { hp: 800, damage: 50, speed: 0.8, range: 1, attackSpeed: 2500, targets: 'buildings', deathDamage: 50, rarity: 'internal' }, // Not a collectible card
  // NEW CARDS FROM USER PROMPT
  'wizard': { hp: 755, damage: 281, speed: 1, range: 5.5, attackSpeed: 1400, targets: 'both', splash: true, splashRadius: 1.5, splashDamage: 1, rarity: 'rare', starPointValue: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}] },
  'witch': { hp: 839, damage: 135, speed: 1, range: 5.5, attackSpeed: 1100, targets: 'both', spawnCard: 'skeletons', spawnInterval: 7000, spawnCount: 4, rarity: 'epic', starPointValue: 3, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}] },
  'valkyrie': { hp: 1907, damage: 266, speed: 1.2, range: 1.2, attackSpeed: 1500, targets: 'ground', splash: true, splashRadius: 1.5, splashDamage: 1, aoe: '360', rarity: 'rare', starPointValue: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}] },
  'giant': { hp: 4090, damage: 253, speed: 1, range: 1.2, attackSpeed: 1500, targets: 'buildings', rarity: 'rare', starPointValue: 2, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}] },
  'balloon': { hp: 1679, damage: 640, speed: 1, range: 0.1, attackSpeed: 2000, targets: 'buildings', flying: true, deathDamage: 240, deathDamageRadius: 2, rarity: 'epic', starPointValue: 3, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}] },
  'miner': { hp: 1210, damage: 194, speed: 1.5, range: 1.2, attackSpeed: 1300, targets: 'ground', deployAnywhere: true, rarity: 'legendary', starPointValue: 5, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:1, gold:1000},{cards:2,gold:2000},{cards:4,gold:5000},{cards:10,gold:10000}] },
  'goblin-hut': { hp: 600, lifetime: 30000, spawnCard: 'spear-goblins', spawnInterval: 1900, spawnCount: 1, type: 'building', rarity: 'rare', starPointValue: 2, goldenBoost: {hp: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}], visualSize: 50 },
  'spear-goblins': { hp: 133, damage: 81, speed: 2, range: 5, attackSpeed: 1700, targets: 'both', count: 3, rarity: 'common', starPointValue: 1, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  'barbarian-hut': { hp: 1164, lifetime: 30000, spawnCard: 'barbarians', spawnInterval: 15000, spawnCount: 3, type: 'building', rarity: 'rare', starPointValue: 3, goldenBoost: {hp: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}] },
  'poison': { damagePerSecond: 92, duration: 8000, radius: 3.5, tickRate: 1000, targets: 'both', rarity: 'epic', starPointValue: 2, goldenBoost: {damage: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}] },
  'freeze': { duration: 4000, stunDuration: 4000, damage: 115, radius: 3, targets: 'both', rarity: 'epic', starPointValue: 2, goldenBoost: {damage: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}] },
  // NEW CARDS ADDED
  'electro-wizard': { hp: 590, damage: 100, speed: 1, range: 5, attackSpeed: 1800, targets: 'both', rarity: 'legendary', starPointValue: 5, spawnDamage: 192, stun: 0.5, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:1, gold:1000},{cards:2,gold:2000},{cards:4,gold:5000},{cards:10,gold:10000}]},
  'royal-giant': { hp: 2544, damage: 159, speed: 0.9, range: 6.5, attackSpeed: 1700, targets: 'buildings', rarity: 'rare', starPointValue: 3, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}]},
  'bomber': { hp: 200, damage: 150, speed: 1, range: 4.5, attackSpeed: 1900, targets: 'ground', splash: true, splashRadius: 1.5, splashDamage: 1, rarity: 'common', starPointValue: 1, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2, gold:50},{cards:4,gold:150},{cards:10,gold:500},{cards:20,gold:1200}] },
  'bowler': { hp: 1300, damage: 240, speed: 0.8, range: 5, attackSpeed: 2100, targets: 'ground', splash: true, splashRadius: 1.2, splashDamage: 0.8, rarity: 'epic', starPointValue: 3, goldenBoost: {hp:1.1, damage:1.1}, upgrade: [{cards:2,gold:100},{cards:4,gold:200},{cards:10,gold:600},{cards:20,gold:1400}] },
  'goblin-giant': { hp: 2200, damage: 150, speed: 1.2, range: 1, attackSpeed: 1700, targets: 'buildings', spawnOnDeath: 'spear-goblins', spawnOnDeathCount: 2, rarity: 'epic', starPointValue: 3, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:2,gold:200},{cards:4,gold:400},{cards:10,gold:1200},{cards:20,gold:2800}] },
  'royal-ghost': { hp: 1000, damage: 210, speed: 1.5, range: 1, attackSpeed: 1800, targets: 'ground', rarity: 'legendary', starPointValue: 5, goldenBoost: {hp: 1.1, damage: 1.1}, upgrade: [{cards:1, gold:1000},{cards:2,gold:2000},{cards:4,gold:5000},{cards:10,gold:10000}] },
  // NEW: Added additional authentic Clash-style cards + custom OP \"rowan\"
  'bandit': { hp: 950, damage: 220, speed: 2.6, range: 1, attackSpeed: 900, dashDamage: 2.0, dashRange: 120, targets: 'ground', rarity: 'epic', starPointValue: 3, goldenBoost: {hp:1.1, damage:1.1}, upgrade:[{cards:2,gold:100},{cards:4,gold:300},{cards:10,gold:1000}] },
  'night-witch': { hp: 680, damage: 120, speed: 1.1, range: 2.5, attackSpeed: 1300, spawnCard: 'bat', spawnInterval: 4000, spawnCount: 2, targets: 'both', rarity: 'epic', starPointValue: 4, goldenBoost:{hp:1.1,damage:1.1}, upgrade:[{cards:2,gold:150},{cards:4,gold:400},{cards:10,gold:1200}] },
  'electro-dragon': { hp: 1500, damage: 220, speed: 1.0, range: 5, attackSpeed: 1600, chainTargets: 3, chainRange: 3.5, chainDamageMultiplier: 0.75, targets: 'both', rarity: 'legendary', starPointValue: 5, goldenBoost:{hp:1.1,damage:1.1}, upgrade:[{cards:1,gold:1000},{cards:2,gold:3000}] },
  'skeleton-barrel': { damage: 120, cost: 3, type: 'spell', targets: 'ground', spawnCount: 6, spawnCard: 'skeletons', rarity: 'epic', starPointValue: 3, goldenBoost: {damage:1.1}, upgrade:[{cards:2,gold:100},{cards:4,gold:300},{cards:10,gold:1000}] },
  'royal-hogs': { hp: 650, damage: 140, speed: 2.2, range: 1, attackSpeed: 1200, targets: 'buildings', count: 6, rarity: 'rare', starPointValue: 3, goldenBoost:{hp:1.1,damage:1.1}, upgrade:[{cards:2,gold:100},{cards:4,gold:300},{cards:10,gold:1000}] },
  // CUSTOM OP CARD: ROWAN - intentionally extremely powerful for fun/admin testing
  'rowan': { hp: 99999, damage: 9999, speed: 3.0, range: 6, attackSpeed: 400, targets: 'both', splash: true, splashRadius: 5, splashDamage: 1.0, flying: false, rarity: 'mythic', starPointValue: 999, goldenBoost: {hp:1.25, damage:1.25}, upgrade:[{cards:1,gold:1}], evolution: { requiredShards: 1, description: "Ascends into pure devastation.", boost: { damage: 10, hp: 10 } } },
  // Added missing custom admin cards 'landon' and 'ty' so admin grants and deck-building/rendering won't fail
  'landon': { hp: 4800, damage: 420, speed: 0.9, range: 1.5, attackSpeed: 1600, targets: 'ground', rarity: 'mythic', starPointValue: 20, goldenBoost: {hp:1.1, damage:1.1}, upgrade:[{cards:1,gold:10}] },
  'ty': { hp: 2200, damage: 900, speed: 2.8, range: 1, attackSpeed: 900, targets: 'ground', rarity: 'mythic', starPointValue: 20, goldenBoost: {hp:1.1, damage:1.1}, upgrade:[{cards:1,gold:10}] },
  // Chest Data
  'silver': { unlockTime: 3 },
  'gold': { unlockTime: 8 },
  'giant': { unlockTime: 12 },
  'magical': { unlockTime: 12 },
  'epic-chest': { unlockTime: 12 },
  'legendary': { unlockTime: 24 },
  'legendary-king-chest': { unlockTime: 24 }
};

export const allCards = [ // This list is for initial card generation or reference, real card data is in cardData.
  { id:'knight', name:'Knight', cost:3, type:'troop', emoji:'⚔️', rarity:'common' },
  { id:'archers', name:'Archers', cost:3, type:'troop', emoji:'🏹', rarity:'common' },
  { id:'musketeer', name:'Musketeer', cost:4, type:'troop', emoji:'🔫', rarity:'rare' },
  { id:'hog', name:'Hog Rider', cost:4, type:'troop', emoji:'🐷', rarity:'rare' },
  { id:'fireball', name:'Fireball', cost:4, type:'spell', emoji:'🔥', rarity:'epic' },
  { id:'zap', name:'Zap', cost:2, type:'spell', emoji:'⚡', rarity:'epic' },
  { id:'cannon', name:'Cannon', cost:3, type:'building', emoji:'💥', rarity:'rare' }, // Changed cannon emoji to explosion
  { id:'dragon', name:'Baby Dragon', cost:4, type:'troop', emoji:'🐲', rarity:'rare' },
  { id:'mini-pekka', name:'Mini P.E.K.K.A', cost:4, type:'troop', emoji:'🤖', rarity:'rare' },
  { id:'inferno-tower', name:'Inferno Tower', cost:5, type:'building', emoji:'🗼', rarity:'epic' },
  // Arena 1 specific cards
  { id:'goblin', name:'Goblins', cost:2, type:'troop', emoji:'👹', rarity:'common' },
  // Arena 2 specific cards
  { id:'skeletons', name:'Skeletons', cost:1, type:'troop', emoji:'💀', rarity:'common' },
  // Arena 3 specific cards
  { id:'barbarians', name:'Barbarians', cost:5, type:'troop', emoji:'🧔', rarity:'rare' },
  // Arena 4 (Snow) specific cards
  { id:'icegolem', name:'Ice Golem', cost:2, type:'troop', emoji:'🧊', rarity:'rare' },
  // Arena 5 (Desert) specific cards
  { id:'giantskeleton', name:'Giant Skeleton', cost:6, type:'troop', emoji:'☠️', rarity:'epic' },
  // Arena 6 (Lava/Volcano) specific cards
  { id:'lavahound', name:'Lava Hound', cost:7, type:'troop', emoji:'🌋', rarity:'legendary' },
  { id:'minion', name:'Minions', cost:3, type:'troop', emoji:'🦇', rarity:'common' },
  // New card: The Log
  { id:'the-log', name:'The Log', cost:2, type:'spell', emoji:'🪵', rarity:'epic' },
  // NEW RARE CARDS
  { id:'pekka', name:'P.E.K.K.A', cost:7, type:'troop', emoji:'🦋', rarity:'legendary' },
  { id:'mega-knight', name:'Mega Knight', cost:7, type:'troop', emoji:'💥', rarity:'legendary' },
  { id:'dark-knight', name:'Dark Knight', cost:4, type:'troop', emoji:'🛡️', rarity:'epic' }, // Changed emoji for Dark Knight
  { id:'skeleton-army', name:'Skeleton Army', cost:9, type:'troop', emoji:'💀💀', rarity:'epic' }, // Changed emoji for Skeleton Army and increased cost to 9
  { id:'goblin-barrel', name:'Goblin Barrel', cost:3, type:'spell', emoji:'🛢️', rarity:'epic' },
  { id:'dark-miner', name:'Dark Miner', cost:6, type:'troop', emoji:'⛏️', rarity:'legendary' }, // NEW: Dark Miner card
  // NEW CARDS
  { id:'prince', name:'Prince', cost:5, type:'troop', emoji:'🐴', rarity:'epic' },
  { id:'elite-barbarians', name:'Elite Barbarians', cost:6, type:'troop', emoji:'💪🧔', rarity:'common' },
  { id:'arrows', name:'Arrows', cost:3, type:'spell', emoji:'🎯', rarity:'common' },
  { id:'golem', name:'Golem', cost:8, type:'troop', emoji:'🗿', rarity:'epic' },
  // NEW CARDS FROM USER PROMPT
  { id:'wizard', name:'Wizard', cost:5, type:'troop', emoji:'🧙‍♂️', rarity:'rare' },
  { id:'witch', name:'Witch', cost:5, type:'troop', emoji:'🧙‍♀️', rarity:'epic' },
  { id:'valkyrie', name:'Valkyrie', cost:4, type:'troop', emoji:'👩‍🦰', rarity:'rare' },
  { id:'giant', name:'Giant', cost:5, type:'troop', emoji:'💪', rarity:'rare' },
  { id:'balloon', name:'Balloon', cost:5, type:'troop', emoji:'🎈', rarity:'epic' },
  { id:'miner', name:'Miner', cost:3, type:'troop', emoji:'⛏️', rarity:'legendary' },
  { id:'goblin-hut', name:'Goblin Hut', cost:4, type:'building', emoji:'🛖', rarity:'rare' },
  { id:'spear-goblins', name:'Spear Goblins', cost:2, type:'troop', emoji:'👺', rarity:'common' },
  { id:'barbarian-hut', name:'Barbarian Hut', cost:6, type:'building', emoji:'🎪', rarity:'rare' },
  { id:'poison', name:'Poison', cost:4, type:'spell', emoji:'🧪', rarity:'epic' },
  { id:'freeze', name:'Freeze', cost:4, type:'spell', emoji:'❄️', rarity:'epic' },
  // NEW CARDS ADDED
  { id: 'electro-wizard', name: 'Electro Wizard', cost: 4, type: 'troop', emoji: '⚡️', rarity: 'legendary' },
  { id: 'royal-giant', name: 'Royal Giant', cost: 6, type: 'troop', emoji: '👑🏹', rarity: 'rare' },
  // NEWEST CARDS
  { id: 'bomber', name: 'Bomber', cost: 2, type: 'troop', emoji: '💣', rarity: 'common' },
  { id: 'goblin-giant', name: 'Goblin Giant', cost: 6, type: 'troop', emoji: '🟢👹', rarity: 'epic' },
  { id: 'royal-ghost', name: 'Royal Ghost', cost: 3, type: 'troop', emoji: '👻', rarity: 'legendary' },
  // NEW SPECIAL CHESTS
  { id: 'silver', name: 'Silver Chest', type: 'special-chest', emoji: '🥈', rarity: 'common' },
  { id: 'gold', name: 'Golden Chest', type: 'special-chest', emoji: '🥇', rarity: 'rare' },
  { id: 'giant', name: 'Giant Chest', type: 'special-chest', emoji: '📦', rarity: 'epic' },
  { id: 'magical', name: 'Magical Chest', type: 'special-chest', emoji: '🔮', rarity: 'epic' },
  { id: 'legendary', name: 'Legendary Chest', type: 'special-chest', emoji: '✨', rarity: 'legendary' },
  { id: 'epic-chest', name: 'Epic Chest', type: 'special-chest', emoji: '💜', rarity: 'epic' },
  { id: 'legendary-king-chest', name: 'Legendary King\'s Chest', type: 'special-chest', emoji: '🌟', rarity: 'legendary' },
  { id: 'gold-rush-chest', name: 'Gold Rush Chest', type: 'special-chest', emoji: '💰', rarity: 'rare' },
  // Added new entries to reference list (collection)
  { id:'bandit', name:'Bandit', cost:3, type:'troop', emoji:'🏇', rarity:'epic' },
  { id:'night-witch', name:'Night Witch', cost:4, type:'troop', emoji:'🌙', rarity:'epic' },
  { id:'electro-dragon', name:'Electro Dragon', cost:5, type:'troop', emoji:'⚡🐉', rarity:'legendary' },
  { id:'skeleton-barrel', name:'Skeleton Barrel', cost:3, type:'spell', emoji:'🛢️💀', rarity:'epic' },
  { id:'royal-hogs', name:'Royal Hogs', cost:5, type:'troop', emoji:'🐗🐗', rarity:'rare' },
  { id:'rowan', name:'Rowan', cost:0, type:'troop', emoji:'👑', rarity:'mythic' },
  { id:'landon', name:'Landon', cost:0, type:'troop', emoji:'⛵', rarity:'mythic' },
  { id:'ty', name:'Ty', cost:0, type:'troop', emoji:'🏈', rarity:'mythic' },
];

export const rareCards = [
    { id:'dark-knight', name:'Dark Knight', cost:4, type:'troop', emoji:'🛡️', rarity:'epic' },
    { id:'skeleton-army', name:'Skeleton Army', cost:9, type:'troop', emoji:'💀💀', rarity:'epic' }, // Updated cost here too
    { id:'goblin-barrel', name:'Goblin Barrel', cost:3, type:'spell', emoji:'🛢️', rarity:'epic' },
    { id:'pekka', name:'P.E.K.K.A', cost:7, type:'troop', emoji:'🦋', rarity:'legendary' },
    { id:'mega-knight', name:'Mega Knight', cost:7, type:'troop', emoji:'💥', rarity:'legendary' },
    // Add new rare cards here if applicable
    { id:'wizard', name:'Wizard', cost:5, type:'troop', emoji:'🧙‍♂️', rarity:'epic' },
    { id:'goblin-giant', name:'Goblin Giant', cost:6, type:'troop', emoji:'🟢👹', rarity:'epic' },
    // NEW: Witch Card added to rare cards
    { id:'witch', name:'Witch', cost:5, type:'troop', emoji:'🧙‍♀️', rarity:'epic' },
    // NEW: Goblin Hut Card to rare cards
    { id:'goblin-hut', name:'Goblin Hut', cost:5, type:'building', emoji:'🛖', rarity:'epic' },
    { id:'bomber', name:'Bomber', cost:2, type:'troop', emoji:'💣', rarity:'rare' }, // Bomber card added
    // NEW SPELLS
    { id: 'freeze', name: 'Freeze', cost: 4, type: 'spell', emoji: '❄️', rarity:'epic' },
    { id: 'poison', name: 'Poison', cost: 4, type: 'spell', emoji: '🧪', rarity:'epic' },
    // NEW CARDS
    { id: 'prince', name: 'Prince', cost: 5, type: 'troop', emoji: '🐴', rarity: 'epic' },
    { id: 'golem', name: 'Golem', cost: 8, type: 'troop', emoji: '🗿', rarity: 'epic' },
    // NEW RARE/LEGENDARY CARDS ADDED
    { id: 'electro-wizard', name: 'Electro Wizard', cost: 4, type: 'troop', emoji: '⚡️', rarity: 'legendary' },
    { id: 'royal-giant', name: 'Royal Giant', cost: 6, type: 'troop', emoji: '👑🏹', rarity: 'rare' },
    // Add newly added rares/legendaries to lists so shop/chests can reference them
    { id:'bandit', name:'Bandit', cost:3, type:'troop', emoji:'🏇', rarity:'epic' },
    { id:'night-witch', name:'Night Witch', cost:4, type:'troop', emoji:'🌙', rarity:'epic' },
    { id:'electro-dragon', name:'Electro Dragon', cost:5, type:'troop', emoji:'⚡🐉', rarity:'legendary' },
    { id:'skeleton-barrel', name:'Skeleton Barrel', cost:3, type:'spell', emoji:'🛢️💀', rarity:'epic' },
    { id:'royal-hogs', name:'Royal Hogs', cost:5, type:'troop', emoji:'🐗🐗', rarity:'rare' },
    // NOTE: 'rowan' is a custom mythic/test card and is intentionally not included in normal rare pools
];

export const arenaData = [
  { id: 'arena1', name: 'Goblin Stadium', trophies: 0, requiredWins: 5, bgClass: 'arena-grass', specialCard: 'goblin', bgColor1: '#8BC34A', bgColor2: '#4CAF50' },
  { id: 'arena2', name: 'Bone Pit', trophies: 400, requiredWins: 5, bgClass: 'arena-bone', specialCard: 'skeletons', bgColor1: '#BDBDBD', bgColor2: '#757575' },
  { id: 'arena3', name: 'Barbarian Bowl', trophies: 800, requiredWins: 5, bgClass: 'arena-barbarian', specialCard: 'barbarians', bgColor1: '#FF9800', bgColor2: '#F44336' },
  { id: 'arena4', name: 'Frozen Peak', trophies: 1200, requiredWins: 5, bgClass: 'arena-snow', specialCard: 'icegolem', bgColor1: '#E0F2F7', bgColor2: '#B2EBF2' },
  { id: 'arena5', name: 'Desert Temple', trophies: 1600, requiredWins: 5, bgClass: 'arena-desert', specialCard: 'giantskeleton', bgColor1: '#FFCC80', bgColor2: '#FFB74D' },
  { id: 'arena6', name: 'Volcano Peak', trophies: 2000, requiredWins: 5, bgClass: 'arena-lava', specialCard: 'lavahound', bgColor1: '#FF6F00', bgColor2: '#E65100' },
  { id: 'arena7', name: 'Dark Mine', trophies: 2400, requiredWins: 5, bgClass: 'arena-mine', specialCard: 'dark-miner', bgColor1: '#424242', bgColor2: '#212121' },
  { id: 'arena8', name: 'Sky Ruins', trophies: 2800, requiredWins: 5, bgClass: 'arena-sky', specialCard: 'inferno-tower', bgColor1: '#90CAF9', bgColor2: '#5C6BC0' },
  { id: 'arena9', name: 'Shadow Keep', trophies: 3200, requiredWins: 5, bgClass: 'arena-shadow', specialCard: 'dark-knight', bgColor1: '#263238', bgColor2: '#000000' },
  { id: 'arena10', name: "Dragon's Den", trophies: 3600, requiredWins: 5, bgClass: 'arena-dragon', specialCard: 'dragon', bgColor1: '#FF5722', bgColor2: '#D84315' },
  { id: 'arena11', name: "Builder's Workshop", trophies: 4000, requiredWins: 5, bgClass: 'arena-builder', specialCard: 'cannon', bgColor1: '#795548', bgColor2: '#5D4037' },
  { id: 'arena12', name: "Royal Arena", trophies: 4400, requiredWins: 5, bgClass: 'arena-royal', specialCard: 'mini-pekka', bgColor1: '#42A5F5', bgColor2: '#1976D2' },
  { id: 'arena13', name: "Wizard's Tower", trophies: 4800, requiredWins: 5, bgClass: 'arena-wizard-tower', specialCard: 'wizard', bgColor1: '#673AB7', bgColor2: '#9C27B0' },
  { id: 'arena14', name: "Goblin Forest", trophies: 5200, requiredWins: 5, bgClass: 'arena-goblin-forest', specialCard: 'goblin-giant', bgColor1: '#4CAF50', bgColor2: '#388E3C' },
  // ADDING MORE ARENAS
  { id: 'arena15', name: 'Jungle Arena', trophies: 5600, requiredWins: 5, bgClass: 'arena-jungle', specialCard: 'arrows', bgColor1: '#00796B', bgColor2: '#004D40' },
  { id: 'arena16', name: 'Hog Mountain', trophies: 6000, requiredWins: 5, bgClass: 'arena-hog', specialCard: 'hog', bgColor1: '#F57C00', bgColor2: '#E65100' },
  { id: 'arena17', name: 'Electro Valley', trophies: 6400, requiredWins: 5, bgClass: 'arena-electro', specialCard: 'electro-wizard', bgColor1: '#0277BD', bgColor2: '#01579B' },
  { id: 'arena18', name: 'Spooky Town', trophies: 6800, requiredWins: 5, bgClass: 'arena-spooky', specialCard: 'witch', bgColor1: '#37474F', bgColor2: '#102027' },
  { id: 'arena19', name: 'Crystal Cavern', trophies: 7000, requiredWins: 5, bgClass: 'arena-crystal', specialCard: 'bowler', bgColor1: '#7E57C2', bgColor2: '#26C6DA' },
  { id: 'arena-max', name: 'Legendary Arena', trophies: 7200, requiredWins: 999, bgClass: 'arena-legendary', specialCard: 'the-log', bgColor1: '#D4AF37', bgColor2: '#FFD700' }
];

let canvas, ctx;
export function setCanvas(c){ canvas=c; } export function getCanvas(){ return canvas; }
export function setCtx(c){ ctx=c; } export function getCtx(){ return ctx; }
export const BRIDGE_HALF = 100;
export const BRIDGES = { riverY:()=>getCanvas()?.height*0.5||400, leftX:()=>getCanvas()?.width*0.33||250, rightX:()=>getCanvas()?.width*0.67||550 };