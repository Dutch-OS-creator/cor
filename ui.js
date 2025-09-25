import { gameState, cardData, allCards, arenaData, getCanvas, rareCards } from './state.js';
import { startBattle, stopBattle, sendEmote, createConfetti, castSpell } from './battle.js';
import { playSound } from './audio.js';

const STORAGE_KEY = 'clashRoyaleGameState';
const DAILY_SHOP_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
let shopRefreshIntervalId = null;
let chestTimerIntervalId = null; // NEW: For chest timers
// ADMIN KEYS: map password -> tier config (tier number, label, cards granted)
const ADMIN_KEYS = {
  "ROWANISCOOL": { tier: 3, label: "God", cards: ['rowan','landon','ty'] },          // top-tier: now grants rowan + landon + ty and full admin
  "ADMINTIER2":  { tier: 2, label: "Overlord", cards: ['mega-knight','pekka','royal-ghost'] },
  "ADMINTIER1":  { tier: 1, label: "Mod", cards: ['bowler','wizard'] },
  "LANDONISCOOL": { tier: 1, label: "Landon", cards: ['landon'] },
  "TYISCOOL": { tier: 1, label: "Ty", cards: ['ty'] }
};
const ADMIN_ONLY_CARDS = [
  'mega-knight','pekka','dark-miner','royal-ghost','bowler',
  'electro-wizard','royal-giant','dark-knight','goblin-giant','skeleton-army',
  'mega-prince','phantom-king','arcane-mage','siege-beast','arc-archer',
  'stormcaller','iron-golem','shadow-assassin','flame-witch','crystal-guard',
  'bowler','wizard',
  'rowan' // admin-only OP custom card
]; // Expanded admin-only cards list

// NEW: State for chest opening sequence
let chestOpeningState = {
    chestType: null,
    rewards: [],
    currentIndex: 0,
};

// NEW: Account system storage key
const ACCOUNTS_KEY = 'clashRoyaleAccounts';
let currentAccount = null; // will hold username when logged in

export function saveGame() {
  // Safe stringify that strips functions, DOM nodes, and avoids circular references.
  try {
    const seen = new WeakSet();
    const safe = JSON.stringify(gameState, function (key, value) {
      // Remove functions
      if (typeof value === 'function') return undefined;
      // Remove DOM nodes / events (they have nodeType or target referencing DOM)
      if (value && (value instanceof Node || value instanceof Window)) return undefined;
      if (value && value.target && (value instanceof Object) && typeof value.target === 'object') {
        // Likely an Event object or similar — skip
        return undefined;
      }
      // Avoid circular refs
      if (value && typeof value === 'object') {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    });
    localStorage.setItem(STORAGE_KEY, safe);
    console.log('Game saved!');
  } catch (err) {
    console.warn('Safe save failed, attempting minimal save fallback.', err);
    try {
      // Minimal fallback: save only player and top-level simple fields
      const minimal = {
        player: gameState.player,
        chests: gameState.chests,
        shop: gameState.shop,
        pass: gameState.pass,
        isAdmin: gameState.isAdmin,
        adminGrantedCards: gameState.adminGrantedCards
      };
      const seen = new WeakSet();
      const safeMin = JSON.stringify(minimal, function (k, v) {
        if (typeof v === 'function') return undefined;
        if (v && (v instanceof Node || v instanceof Window)) return undefined;
        if (v && typeof v === 'object') {
          if (seen.has(v)) return undefined;
          seen.add(v);
        }
        return v;
      });
      localStorage.setItem(STORAGE_KEY, safeMin);
      console.log('Minimal game state saved as fallback.');
    } catch (e) {
      console.error('Failed to save game state.', e);
    }
  }
}

export function loadGame() {
  // Require login/account selection for offline use
  const storedAccount = localStorage.getItem('currentAccount');
  if (!storedAccount) {
    // show login modal and halt game init flow until login
    showAccountModal();
    return;
  } else {
    currentAccount = storedAccount;
  }
  const savedState = localStorage.getItem(STORAGE_KEY);
  if (savedState) {
    const loaded = JSON.parse(savedState);
    
    // Deep merge to ensure new properties are added and old ones are not lost
    // Also ensure complex objects like cards maintain their structure

    // Merge player data, ensuring cards object is merged deeply
    gameState.player = { ...gameState.player, ...loaded.player };
    gameState.player.cards = { ...gameState.player.cards, ...loaded.player.cards };
    // NEW: Load evolution data
    gameState.player.evoShards = loaded.player.evoShards || {};
    gameState.player.equippedEvo = loaded.player.equippedEvo || null;

    // Ensure `isGolden` property exists on loaded cards
    if (gameState.player.cards) {
        for (const cardId in gameState.player.cards) {
            gameState.player.cards[cardId].isGolden = gameState.player.cards[cardId].isGolden || false;
            // NEW: Ensure evoUnlocked exists
            gameState.player.cards[cardId].evoUnlocked = gameState.player.cards[cardId].evoUnlocked || false;
        }
    }
    gameState.player.starPoints = Math.max(500, loaded.player.starPoints || 0); // Ensure everyone starts with at least 500 star points
    gameState.player.level = loaded.player.level !== undefined ? loaded.player.level : 1; // Load or default player level
    gameState.player.totalCrowns = loaded.player.totalCrowns !== undefined ? loaded.player.totalCrowns : 0; // Load or default total crowns
    gameState.player.avatarUrl = loaded.player.avatarUrl || 'https://images.websim.com/avatar/default_avatar'; // Load or default avatar
    gameState.player.joinDate = loaded.player.joinDate || new Date().toISOString(); // Load or set join date
    gameState.player.totalWins = loaded.player.totalWins || 0;
    
    // NEW: Load chest cycle position
    gameState.player.chestCyclePosition = loaded.player.chestCyclePosition || 0;

    // NEW: Load daily reward state and check for new day
    const today = new Date().toDateString();
    const lastLogin = loaded.player.lastLoginDate;
    
    if (lastLogin !== today) {
        gameState.player.dailyRewardClaimed = false; // It's a new day, allow claiming
        gameState.player.lastLoginDate = today; // Update last login
    } else {
        gameState.player.dailyRewardClaimed = loaded.player.dailyRewardClaimed || false;
        gameState.player.lastLoginDate = loaded.player.lastLoginDate; // Keep existing date if same day
    }

    // Reset battle state on load (don't load active battle)
    gameState.battle = {
        elixir: 5, maxElixir: 10, elixirRate: 2800,
        selectedCard: null, troops: [], buildings: [], spells: [], projectiles: [],
        towers: null, drawQueue: [], hand: [], overtime: false, emotes: [], particles: [],
        spells: [],
        isSandboxMode: false, // Ensure reset on load
        elixirRateMultiplier: 1, // Ensure reset on load
        isInfiniteElixir: false // Ensure reset on load
    };
    gameState.draft = { // Ensure draft state is reset on load
      isActive: false, playerDeck: [], enemyDeck: [],
      cardChoices: [], draftPool: [], currentPick: 0
    };
    
    // Direct assignment for other top-level properties
    gameState.chests = loaded.chests || []; // Ensure chests is an array
    gameState.pass = { ...gameState.pass, ...loaded.pass };
    gameState.starBoxesAvailable = loaded.starBoxesAvailable;
    gameState.starBoxTaps = loaded.starBoxTaps;
    gameState.shop = { ...gameState.shop, ...loaded.shop }; // Load shop state
    gameState.player.unlockedArenas = loaded.player.unlockedArenas || ['arena1']; // Ensure unlockedArenas is loaded
    gameState.isAdmin = !!loaded.isAdmin; // NEW: restore admin flag
    gameState.adminGrantedCards = loaded.adminGrantedCards || {}; // NEW: restore admin-only grants

    // Ensure that new cards from game updates are added to player.cards if missing
    // But ONLY if they are not specified as rare/locked cards
    allCards.forEach(card => {
      // Find the card in the full cardData to get all base properties (like splash info)
      const fullCardData = cardData[card.id];
      if (!fullCardData) {
        console.warn(`Missing full cardData for card ID: ${card.id}`);
        return;
      }

      // Check if the card's type is 'special-chest'. If so, we don't add it to player.cards directly.
      if (card.type === 'special-chest') {
        return; 
      }

      const isRareOrLocked = rareCards.some(rare => rare.id === card.id);
      if (!isRareOrLocked && !gameState.player.cards[card.id]) {
        gameState.player.cards[card.id] = { ...fullCardData, id: card.id, name: card.name, cost: card.cost, type: card.type, emoji: card.emoji, level: 1, count: 0, rarity: card.rarity, isGolden: false };
      } else if (gameState.player.cards[card.id]) {
        // Ensure existing cards also get updated properties from cardData (like new splash info, rarity)
        gameState.player.cards[card.id] = { ...fullCardData, ...gameState.player.cards[card.id], rarity: card.rarity || gameState.player.cards[card.id].rarity, isGolden: gameState.player.cards[card.id].isGolden || false };
      }
    });

    // Add new cards to player's collection if they don't exist, but with 0 count
    const newCards = ['wizard', 'witch', 'valkyrie', 'giant', 'balloon', 'miner', 'goblin-hut', 'spear-goblins', 'barbarian-hut', 'poison', 'freeze', 'electro-wizard', 'royal-giant'];
    newCards.forEach(cardId => {
      if (!gameState.player.cards[cardId]) {
        const cardInfo = allCards.find(c => c.id === cardId);
        const fullCardData = cardData[cardId];
        if (cardInfo && fullCardData) {
          gameState.player.cards[cardId] = { ...fullCardData, id: cardId, name: cardInfo.name, cost: cardInfo.cost, type: cardInfo.type, emoji: cardInfo.emoji, level: 1, count: 0, rarity: cardInfo.rarity, isGolden: false };
        }
      }
    });

    // Set initial active deck from these cards
    gameState.player.activeDeck = ['knight', 'archers', 'musketeer', 'hog'];

    // Set default avatar for new players
    gameState.player.avatarUrl = 'https://images.websim.com/avatar/default_avatar';

    // NEW: Initialize daily reward state for a new player
    gameState.player.lastLoginDate = new Date().toDateString();
    gameState.player.dailyRewardClaimed = false;
    gameState.player.joinDate = new Date().toISOString();
    gameState.player.totalWins = 0;

    // Set star points for new players
    gameState.player.starPoints = 500;

    console.log('New game initialized!');
  }
  // Always ensure shop is refreshed or its timer starts
  generateDailyShopOffers();

  // NEW: After game is loaded/initialized, check for daily reward
  if (!gameState.player.dailyRewardClaimed) {
      showDailyRewardScreen();
  }
}

export function showScreen(screenId){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active'); gameState.screen=screenId;
  
  // NEW: Update active state on nav buttons
  document.querySelectorAll('#bottomNav .nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.action === `show${screenId.charAt(0).toUpperCase() + screenId.slice(1, -6)}`);
  });

  if (screenId === 'shopScreen') {
    startShopRefreshTimer();
  } else {
    stopShopRefreshTimer();
  }

  if (screenId === 'chestsScreen') {
      startChestTimers();
  } else {
      stopChestTimers();
  }

  // ADMIN: show small admin button while in battle for quick access
  if (screenId === 'battleScreen') {
    // create floating admin button if admin and doesn't exist
    if (gameState.isAdmin && !document.getElementById('battleAdminBtn')) {
      const btn = document.createElement('button');
      btn.id = 'battleAdminBtn';
      btn.className = 'menu-button-small';
      btn.style.position = 'absolute';
      btn.style.right = '14px';
      btn.style.top = '90px';
      btn.style.zIndex = 2000;
      btn.textContent = 'Admin';
      btn.addEventListener('click', () => document.getElementById('adminPanelModal').style.display = 'flex');
      document.body.appendChild(btn);
    }
  } else {
    const bbtn = document.getElementById('battleAdminBtn');
    if (bbtn) bbtn.remove();
  }

  if (screenId === 'battleScreen') {
    startShopRefreshTimer();
  } else {
    stopShopRefreshTimer();
  }
}

export function showMainMenu(){
  showScreen('mainMenu'); stopBattle(); updateMainMenuDisplay();
  // NEW: Clear active state from nav buttons when returning to main menu
  document.querySelectorAll('#bottomNav .nav-btn').forEach(btn => btn.classList.remove('active'));
  saveGame(); // Save game state when returning to main menu
}

export function endBattle(result, crownsWon = 0){
  stopBattle(); // This will reset sandbox flags
  const victoryScreenEl = document.getElementById('victoryScreen');
  const victoryTitle = document.getElementById('victoryTitle');
  const crownsDisplay = document.querySelector('#victoryScreen .crowns');
  const trophiesDisplay = document.querySelector('#victoryScreen .trophies');
  const chestRewardEl = document.querySelector('#victoryScreen .chest-reward');
  const starBoxEl = document.getElementById('starBox');
  
  let trophyChange=0, passGain=(result==='victory'?20:(result==='defeat'?5:10));
  
  // Reset screen classes
  victoryScreenEl.classList.remove('defeat');

  // Logic for normal battles vs sandbox battles
  if (!gameState.battle.isSandboxMode) { // Only apply arena progression and total crowns in non-sandbox mode
      if (result === 'victory'){ 
        victoryTitle.textContent='Victory!'; 
        crownsDisplay.textContent=`👑 +${crownsWon}`; 
        trophyChange=30; // Base trophy gain
        
        // Only add chest if not Sudden Death (Sudden Death may not always grant chests)
        if (!gameState.battle.isSuddenDeathMode) {
            if (gameState.chests.length < 4) {
                const chestType = gameState.chestCycle[gameState.player.chestCyclePosition];
                const chestInfo = cardData[chestType];
                gameState.chests.push({ 
                    type: chestType, 
                    unlockStartTime: null, 
                    unlockDuration: (chestInfo.unlockTime || 0) * 60 * 60 * 1000 
                });
                gameState.player.chestCyclePosition = (gameState.player.chestCyclePosition + 1) % gameState.chestCycle.length;
                chestRewardEl.style.display='block'; 
                const chestRewardName = chestRewardEl.querySelector('.chest-name');
                if (chestRewardName) chestRewardName.textContent = `${chestType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Chest`;
            } else {
                chestRewardEl.style.display='none';
            }
        } else {
            chestRewardEl.style.display='none';
        }

        gameState.starBoxesAvailable++; // Give a star box on victory
        gameState.player.winsInCurrentArena++; // Increment wins for arena progression
        gameState.player.totalWins++; // Increment total wins
        
        // Trigger animations
        triggerVictoryAnimation();
        if (crownsWon === 3) {
          triggerConfetti(); // Use the canvas-based confetti
        }
        playSound('win');
      } else if (result === 'defeat'){ 
        victoryTitle.textContent='Defeat!'; 
        crownsDisplay.textContent='👑 +0'; 
        trophyChange=-20; 
        chestRewardEl.style.display='none'; 
        starBoxEl.style.display='none'; // No star box on defeat
        victoryScreenEl.classList.add('defeat'); // Apply defeat style
        playSound('lose');
      } else { // Draw
        victoryTitle.textContent='Draw!'; 
        crownsDisplay.textContent='👑 +0'; 
        chestRewardEl.style.display='none'; 
        starBoxEl.style.display='none'; // No star box on draw
        playSound('hit');
      }
      
      gameState.player.trophies += trophyChange;
      gameState.player.totalCrowns += crownsWon; // NEW: Add crowns won to total crowns
      trophiesDisplay.textContent = `🏆 ${trophyChange>0?'+':''}${trophyChange}`;
      updateBattlePass(passGain); 
    
      checkArenaProgression(); // Check for arena progression BEFORE showing screen
  } else { // Sandbox mode specific logic
    let modeText = '';
    if (gameState.battle.isSuddenDeathMode) modeText = 'Sudden Death ';
    else if (gameState.battle.isInfiniteElixir) modeText = 'Infinite Elixir ';
    else if (gameState.battle.isSandboxMode) modeText = 'Sandbox '; // Generic sandbox label

    if (result === 'victory') {
        victoryTitle.textContent = `${modeText} Victory!`;
        crownsDisplay.textContent = '👑 +0 (No Trophies)';
        trophiesDisplay.textContent = '🏆 +0 (No Trophies)';
        chestRewardEl.style.display = 'none'; // No chests in sandbox/modes
        starBoxEl.style.display = 'none'; // No star box in sandbox/modes
        playSound('win');
        triggerConfetti(); // Still give visual celebration
    } else if (result === 'defeat') {
        victoryTitle.textContent = `${modeText} Defeat!`;
        crownsDisplay.textContent = '👑 +0 (No Trophies)';
        trophiesDisplay.textContent = '🏆 +0 (No Trophies)';
        chestRewardEl.style.display = 'none';
        starBoxEl.style.display = 'none';
        victoryScreenEl.classList.add('defeat');
        playSound('lose');
    } else { // Draw
        victoryTitle.textContent = `${modeText} Draw!`;
        crownsDisplay.textContent = '👑 +0 (No Trophies)';
        trophiesDisplay.textContent = '🏆 +0 (No Trophies)';
        chestRewardEl.style.display = 'none';
        starBoxEl.style.display = 'none';
        playSound('hit');
    }
    // No arena progression, trophies, or total crowns update for sandbox
    updateBattlePass(passGain * 0.5); // Half points for special modes
  }

  showScreen('victoryScreen'); 
  saveGame(); // Save after battle ends
  
  // Sandbox specific flags are already reset by stopBattle()
}

export function returnToMenu(){
  showMainMenu(); updateMainMenuDisplay();
}

export function updateMainMenuDisplay(){
  document.querySelector('.username').textContent = gameState.player.username; // Ensure username is always correct
  document.getElementById('playerLevel').textContent = gameState.player.level; // NEW: Update player level display
  document.getElementById('playerTotalCrowns').textContent = gameState.player.totalCrowns; // NEW: Update total crowns display
  document.getElementById('playerTrophies').textContent = gameState.player.trophies; // Update trophies using new ID
  document.getElementById('mainMenuGold').textContent = gameState.player.gold;
  document.getElementById('mainMenuGems').textContent = gameState.player.gems;
  document.getElementById('mainMenuStarPoints').textContent = gameState.player.starPoints;
  renderArenaProgression();
  renderStarBoxMenu(); // Check and render star box if available
  renderArenaChestButton(); // Check and render arena chest button
  updateProfileIcon(); // Update player profile icon
  // NEW: show admin panel automatically if already unlocked previously?
  // keep hidden; only show when user clicks Admin
}

export function renderArenaProgression() {
  const currentArenaIndex = gameState.player.currentArenaIndex;
  const currentArena = arenaData[currentArenaIndex];
  const nextArena = arenaData[currentArenaIndex + 1]; // Will be undefined if max arena

  const currentArenaInfoEl = document.getElementById('currentArenaInfo');
  const arenaProgressFillEl = document.getElementById('arenaProgressFill');
  const mainMenuEl = document.getElementById('mainMenu');

  if (currentArenaInfoEl && arenaProgressFillEl && mainMenuEl) {
    let progressText;
    let progressPct;
    let nextArenaName = nextArena ? nextArena.name : 'Max Arena';

    // Remove existing arena classes from main menu
    arenaData.forEach(arena => mainMenuEl.classList.remove(arena.bgClass));
    // Add current arena's background class
    mainMenuEl.classList.add(currentArena.bgClass);

    if (currentArena.id === 'arena-max') {
      progressText = `Max Level!`;
      progressPct = 100;
      nextArenaName = 'Legendary';
    } else {
      progressText = `${gameState.player.winsInCurrentArena} / ${currentArena.requiredWins} Wins (Arena ${currentArenaIndex + 1})`;
      progressPct = (gameState.player.winsInCurrentArena / currentArena.requiredWins) * 100;
    }

    currentArenaInfoEl.innerHTML = `
      <span>${currentArena.name}</span>
      <span>${progressText}</span>
      <span>${nextArenaName}</span>
    `;
    arenaProgressFillEl.style.width = `${progressPct}%`;
  }
}

export function checkArenaProgression() {
    const currentArenaIndex = gameState.player.currentArenaIndex;
    const currentArena = arenaData[currentArenaIndex];

    if (currentArena.id === 'arena-max') return; // Already at max arena

    if (gameState.player.winsInCurrentArena >= currentArena.requiredWins) {
        // Unlock next arena
        const newArenaIndex = currentArenaIndex + 1;
        if (newArenaIndex < arenaData.length) {
            const nextArena = arenaData[newArenaIndex];
            gameState.player.currentArenaIndex = newArenaIndex;
            gameState.player.arena = newArenaIndex + 1; // Update display arena number
            gameState.player.winsInCurrentArena = 0; // Reset wins for new arena
            
            // Add to unlockedArenas only if not already present
            if (!gameState.player.unlockedArenas.includes(nextArena.id)) {
                gameState.player.unlockedArenas.push(nextArena.id);
            }
            gameState.player.newArenaChestAvailable = true; // Make arena chest available

            alert(`🎉 Arena Unlocked! Welcome to ${nextArena.name}!`);
            playSound('win'); // Play a celebratory sound
            saveGame(); // Save after arena progression
        }
    }
}

export function renderArenaChestButton() {
    const arenaChestButton = document.getElementById('arenaChestButton');
    if (arenaChestButton) {
        if (gameState.player.newArenaChestAvailable) {
            arenaChestButton.style.display = 'flex';
        } else {
            arenaChestButton.style.display = 'none';
        }
    }
}

export function openArenaChest() {
    const arenaChestButton = document.getElementById('arenaChestButton');
    if (!gameState.player.newArenaChestAvailable || !arenaChestButton) return;

    // Get the special card for the newly unlocked arena (the arena the player just left)
    const previousArenaIndex = gameState.player.currentArenaIndex - 1;
    const previousArena = arenaData[previousArenaIndex];
    const chestType = 'arena';

    if (previousArena && previousArena.specialCard) {
        const cardId = previousArena.specialCard;
        const cardCount = 1; // Arena Chest guarantees one new card
        
        const rewards = [];
        const playerCard = gameState.player.cards[cardId];
        const baseCardData = cardData[cardId];
        const maxLevel = baseCardData.upgrade ? (baseCardData.upgrade.length + 1) : (playerCard ? playerCard.level : 1); 

        if (playerCard && playerCard.level >= maxLevel) {
            // Card is maxed, convert to star points
            const starPointsEarned = cardCount * (baseCardData.starPointValue || 1); 
            gameState.player.starPoints += starPointsEarned;
            rewards.push({ type: 'starPoints', value: starPointsEarned });
        } else { // Card is not owned or not maxed
            // If not owned, add the card to player's collection
            if (!playerCard) {
                const cardInfo = allCards.find(c => c.id === cardId);
                if (cardInfo) {
                    // Make sure to get all base card data properties (like splash info)
                    const fullCardData = cardData[cardId];
                    gameState.player.cards[cardId] = { ...fullCardData, id: cardId, name: cardInfo.name, cost: cardInfo.cost, type: cardInfo.type, emoji: cardInfo.emoji, level: 1, count: cardCount, rarity: cardInfo.rarity, isGolden: false };
                }
            } else {
                playerCard.count += cardCount;
            }
            rewards.push({ type: 'card', cardId: cardId, count: cardCount });
        }
        
        startChestOpeningSequence(chestType, rewards);

        gameState.player.newArenaChestAvailable = false;
        arenaChestButton.style.display = 'none'; // Hide the button after opening
        playSound('chest_open'); // Play chest open sound
        updateMainMenuDisplay(); // Update cards and potentially other displays
        saveGame(); // Save after opening arena chest
    } else {
        alert('No special card found for this arena!');
        gameState.player.newArenaChestAvailable = false; // Consume the flag even if no card
        arenaChestButton.style.display = 'none';
        saveGame();
    }
}

// Star Box functions
export function renderStarBoxMenu(){
  const el = document.getElementById('starBoxMenu');
  if (!el) return;

  if (gameState.starBoxesAvailable > 0) {
    el.style.display = 'flex';
    el.querySelector('.card-title').textContent = `Star Box (${gameState.starBoxTaps} / 4 taps)`;
  } else {
    el.style.display = 'none';
  }
}

export function openStarBox(){
  const el = document.getElementById('starBoxMenu');
  if (gameState.starBoxesAvailable <= 0) return;

  gameState.starBoxTaps++;
  el.style.animation = 'shake 0.3s ease-in-out';
  setTimeout(() => { el.style.animation = 'bounce 2s infinite'; }, 300); // Reset animation
  playSound('hit'); // Use generic hit sound for taps

  if (gameState.starBoxTaps >= 4){
    el.style.display = 'none';
    gameState.starBoxesAvailable--;
    gameState.starBoxTaps = 0;
    
    // Grant rewards
    const rewards = [];
    const goldReward = Math.floor(Math.random() * 200) + 100;
    const gemReward = Math.floor(Math.random() * 5) + 1;
    rewards.push({ type: 'gold', value: goldReward });
    rewards.push({ type: 'gem', value: gemReward });
    gameState.player.gold += goldReward;
    gameState.player.gems += gemReward;

    // Grant a random card
    const randomCardData = allCards[Math.floor(Math.random() * allCards.length)];
    const cardId = randomCardData.id;
    const cardCount = Math.floor(Math.random() * 3) + 1; // 1-3 cards
    
    const playerCard = gameState.player.cards[cardId];
    const baseCardData = cardData[cardId];
    const maxLevel = baseCardData.upgrade ? (baseCardData.upgrade.length + 1) : (playerCard ? playerCard.level : 1);

    if (playerCard && playerCard.level >= maxLevel) {
        // Card is maxed, convert to star points
        const starPointsEarned = cardCount * (baseCardData.starPointValue || 1);
        gameState.player.starPoints += starPointsEarned;
        rewards.push({type: 'starPoints', value: starPointsEarned});
    } else { // Card is not owned or not maxed
        // If not owned, add the card to player's collection
        if (!playerCard) {
            const cardInfo = allCards.find(c => c.id === cardId);
            if (cardInfo) {
                // Make sure to get all base card data properties (like splash info)
                const fullCardData = cardData[cardId];
                gameState.player.cards[cardId] = { ...fullCardData, id: cardId, name: cardInfo.name, cost: cardInfo.cost, type: cardInfo.type, emoji: cardInfo.emoji, level: 1, count: cardCount, rarity: cardInfo.rarity, isGolden: false };
            }
        } else {
            playerCard.count += cardCount;
        }
        rewards.push({type: 'card', cardId: cardId, count: cardCount});
    }
    
    // NEW: Chance to get Evolution Shards
    const evoCards = Object.keys(cardData).filter(id => cardData[id].evolution);
    if (evoCards.length > 0 && Math.random() < 0.25) { // 25% chance to get shards from any chest
        const randomEvoCardId = evoCards[Math.floor(Math.random() * evoCards.length)];
        const shardAmount = 1;
        
        if (!gameState.player.evoShards[randomEvoCardId]) {
            gameState.player.evoShards[randomEvoCardId] = 0;
        }
        gameState.player.evoShards[randomEvoCardId] += shardAmount;
        rewards.push({ type: 'evoShard', cardId: randomEvoCardId, count: shardAmount });
    }
    
    playSound('chest_open'); // Use specific sound for opening
    startChestOpeningSequence('star-box', rewards);
    updateMainMenuDisplay();
    saveGame(); // Save after opening star box
  } else {
    el.querySelector('.card-title').textContent = `Star Box (${gameState.starBoxTaps} / 4 taps)`;
  }
}

// Battle Pass functions
export function showBattlePass(){
  showScreen('battlePassScreen');
  renderBattlePass();
  saveGame(); // Save when viewing Battle Pass (in case rewards were claimed)
}

export function updateBattlePass(gain){
  gameState.pass.points += gain;
  let currentLevelPoints = gameState.pass.points % gameState.pass.tierSize;
  const levelsGained = Math.floor(gameState.pass.points / gameState.pass.tierSize) - (gameState.pass.level - 1);

  if (levelsGained > 0) {
      gameState.pass.level = Math.min(gameState.pass.maxLevel, gameState.pass.level + levelsGained);
  }
  
  if (gameState.pass.level >= gameState.pass.maxLevel) {
      // If at max level, points stay at max tierSize
      currentLevelPoints = gameState.pass.tierSize; 
  } else if (currentLevelPoints === 0 && gameState.pass.points > 0) {
      currentLevelPoints = gameState.pass.tierSize; // If just leveled up, show full bar
  }

  const fill = document.getElementById('passFill'); // For victory screen display
  if (fill){ 
    const pct = (currentLevelPoints / gameState.pass.tierSize) * 100; 
    fill.style.width = `${pct}%`; 
  }

  renderBattlePass(); // Re-render battle pass screen if active
  saveGame(); // Save after battle pass update
}

export function renderBattlePass() {
    if (gameState.screen !== 'battlePassScreen') return;

    document.getElementById('bpCurrentLevel').textContent = gameState.pass.level;
    document.getElementById('bpPoints').textContent = gameState.pass.points;
    document.getElementById('bpNeeded').textContent = gameState.pass.tierSize;

    const progressPct = ((gameState.pass.points % gameState.pass.tierSize) / gameState.pass.tierSize) * 100;
    document.getElementById('bpProgressBar').style.width = `${progressPct}%`;

    const freeTrackScrollArea = document.querySelector('#freeTrack .rewards-scroll-area');
    const premiumTrackScrollArea = document.querySelector('#premiumTrack .rewards-scroll-area');
    const premiumUnlockSection = document.getElementById('premiumUnlockSection');

    // Clear previous rewards
    freeTrackScrollArea.innerHTML = '';
    premiumTrackScrollArea.innerHTML = '';
    premiumUnlockSection.innerHTML = '';

    // Render premium unlock button if not unlocked
    if (!gameState.pass.premiumUnlocked) {
        premiumUnlockSection.innerHTML = `<button class="buy-premium" onclick="buyPremiumPass()">Unlock Premium (500 Gems)</button>`;
        premiumUnlockSection.style.display = 'block';
    } else {
        premiumUnlockSection.style.display = 'none'; // Hide if unlocked
    }

    for (let i = 1; i <= gameState.pass.maxLevel; i++) {
        // Find rewards for current level
        const freeReward = gameState.pass.freeRewards.find(r => r.level === i);
        const premiumReward = gameState.pass.premiumRewards.find(r => r.level === i);

        // Render Free Track Level Card
        const freeLevelCard = document.createElement('div');
        freeLevelCard.classList.add('pass-level-card');
        if (i === gameState.pass.level) {
            freeLevelCard.classList.add('current-level'); // Highlight current level
        }
        freeLevelCard.innerHTML = `<div class="pass-level-number">${i}</div>`;
        freeLevelCard.appendChild(createRewardSlot('free', freeReward, i));
        freeTrackScrollArea.appendChild(freeLevelCard);

        // Render Premium Track Level Card
        const premiumLevelCard = document.createElement('div');
        premiumLevelCard.classList.add('pass-level-card');
        if (i === gameState.pass.level) {
            premiumLevelCard.classList.add('current-level'); // Highlight current level
        }
        premiumLevelCard.innerHTML = `<div class="pass-level-number" style="visibility:hidden;">${i}</div>`; // Hidden for premium track to align
        premiumLevelCard.appendChild(createRewardSlot('premium', premiumReward, i));
        premiumTrackScrollArea.appendChild(premiumLevelCard);
    }
}

// Helper function to create a reward slot element
function createRewardSlot(trackType, reward, level) {
    const rewardSlot = document.createElement('div');
    rewardSlot.classList.add('pass-reward-slot');

    if (!reward) {
        rewardSlot.classList.add('locked');
        rewardSlot.innerHTML = `<div class="pass-reward-icon">❓</div><div class="pass-reward-name">No Reward</div>`;
        return rewardSlot;
    }

    if (reward.claimed) {
        rewardSlot.classList.add('claimed');
    } else if (gameState.pass.level >= reward.level) {
        rewardSlot.classList.add('unclaimed', 'available');
        rewardSlot.onclick = () => claimPassReward(trackType, reward.level);
    } else {
        rewardSlot.classList.add('locked');
    }

    let icon, name, iconClass = '';
    if (reward.type === 'gold') { icon = '💰'; name = `${reward.value} Gold`; }
    else if (reward.type === 'gem') { icon = '💎'; name = `${reward.value} Gems`; }
    else if (reward.type === 'card') {
        const card = allCards.find(c => c.id === reward.cardId);
        icon = card ? card.emoji : '🃏';
        name = `${reward.count} ${card ? card.name : 'Cards'}`;
    }
    else if (reward.type === 'starPoints') { icon = '⭐'; name = `${reward.value} Star Points`;}
    else if (reward.type === 'evoShard') {
        const card = allCards.find(c => c.id === reward.cardId);
        icon = '🟣';
        name = `${reward.count}x ${card ? card.name : ''} Shard`;
    }
    else if (reward.type === 'chest') {
        const chestCard = allCards.find(c => c.id === reward.chestType + '-chest') || { emoji: '📦' }; // Find special chest emoji or default
        icon = chestCard.emoji;
        name = `${reward.chestType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Chest`; // Format chest name
        iconClass = `chest-${reward.chestType}`; // For specific chest styling
    }
    
    rewardSlot.innerHTML = `<div class="pass-reward-icon ${iconClass}">${icon}</div><div class="pass-reward-name">${name}</div>`;
    return rewardSlot;
}

export function claimPassReward(trackType, level){
  const track = trackType === 'free' ? gameState.pass.freeRewards : gameState.pass.premiumRewards;
  const reward = track.find(r => r.level === level);

  if (reward && !reward.claimed && gameState.pass.level >= reward.level) {
    if (trackType === 'premium' && !gameState.pass.premiumUnlocked) {
      alert('Unlock premium pass to claim premium rewards!');
      return;
    }

    const rewardsDisplay = []; // To show in modal
    // Apply reward
    if (reward.type === 'gold') {
        gameState.player.gold += reward.value;
        rewardsDisplay.push({type: 'gold', value: reward.value});
    }
    else if (reward.type === 'gem') {
        gameState.player.gems += reward.value;
        rewardsDisplay.push({type: 'gem', value: reward.value});
    }
    else if (reward.type === 'card') { 
        const cardId = reward.cardId;
        const cardCount = reward.count;
        const playerCard = gameState.player.cards[cardId];
        const baseCardData = cardData[cardId];
        const maxLevel = baseCardData.upgrade ? (baseCardData.upgrade.length + 1) : (playerCard ? playerCard.level : 1);

        if (playerCard && playerCard.level >= maxLevel) {
            const starPointsEarned = cardCount * (baseCardData.starPointValue || 1);
            gameState.player.starPoints += starPointsEarned;
            rewardsDisplay.push({type: 'starPoints', value: starPointsEarned});
        } else { // Card is not owned or not maxed
            // If not owned, add the card to player's collection
            if (!playerCard) {
                const cardInfo = allCards.find(c => c.id === cardId);
                if (cardInfo) {
                    const fullCardData = cardData[cardId];
                    gameState.player.cards[cardId] = { ...fullCardData, id: cardId, name: cardInfo.name, cost: cardInfo.cost, type: cardInfo.type, emoji: cardInfo.emoji, level: 1, count: reward.count, rarity: cardInfo.rarity, isGolden: false };
                }
            } else {
                playerCard.count += reward.count;
            }
            rewardsDisplay.push({type: 'card', cardId: cardId, count: reward.count});
        }
    }
    else if (reward.type === 'starPoints') {
        gameState.player.starPoints += reward.value;
        rewardsDisplay.push({type: 'starPoints', value: reward.value});
    }
    else if (reward.type === 'chest') {
        gameState.chests.push({ type: reward.chestType });
        rewardsDisplay.push({type: 'chest', chestType: reward.chestType});
    }
    else if (reward.type === 'evoShard') {
        const card = allCards.find(c => c.id === reward.cardId);
        rewardsDisplay.push({type: 'evoShard', cardId: reward.cardId, count: reward.count});
    }

    reward.claimed = true;
    playSound('win'); // Reward claimed sound
    showRewardsModal('Battle Pass Reward!', rewardsDisplay); // Show rewards in modal
    updateMainMenuDisplay(); // Update currency and potentially card counts
    renderBattlePass(); // Re-render battle pass to show claimed status
    saveGame(); // Save after claiming pass reward
  }
}

export function buyPremiumPass(){
    if (gameState.player.gems >= 500) {
        gameState.player.gems -= 500;
        gameState.pass.premiumUnlocked = true;
        alert('Premium Battle Pass unlocked!');
        updateMainMenuDisplay();
        renderBattlePass();
        saveGame(); // Save after buying premium pass
    } else {
        alert('Not enough gems to unlock the Premium Battle Pass!');
    }
}

export function showChests(){
  showScreen('chestsScreen'); renderChests();
}

export function renderChests(){
  const chestSlots = document.querySelector('.chest-slots'); chestSlots.innerHTML='';
  document.getElementById('chestQueueInfo').style.display = 'none';

  for (let i=0;i<4;i++){
    const chest = gameState.chests[i];
    const slotEl = document.createElement('div');
    slotEl.classList.add('chest-slot');

    if (chest){
      const chestInfo = cardData[chest.type] || {};
      const chestCardInfo = allCards.find(c => c.id === chest.type);
      const chestEmoji = chestCardInfo ? chestCardInfo.emoji : '📦';
      const chestName = chest.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

      slotEl.classList.add(chest.type); // For special styling

      let contentHtml = `<div class="chest-visual">${chestEmoji}</div><div class="chest-name">${chestName} Chest</div>`;
      
      const now = Date.now();
      if (chest.unlockStartTime) {
        const timeElapsed = now - chest.unlockStartTime;
        const timeRemaining = chest.unlockDuration - timeElapsed;

        if (timeRemaining > 0) {
          // Unlocking
          const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
          const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
          const gemCost = Math.ceil(timeRemaining / 1000 / 60 / 10); // 1 gem per 10 mins

          contentHtml += `
            <div class="chest-timer">${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</div>
            <button class="chest-action-btn gem-unlock" onclick="unlockChestWithGems(${i})">💎 ${gemCost}</button>
          `;
        } else {
          // Ready to open
          contentHtml += `<button class="chest-action-btn open-now" onclick="openChest(${i})">Open</button>`;
        }
      } else {
        // Not unlocking
        const unlockHours = chest.unlockDuration / (1000 * 60 * 60);
        contentHtml += `<div class="chest-unlock-time">🕒 ${unlockHours}h</div>`;
        const actionButton = `<button class="chest-action-btn start-unlock" onclick="startChestUnlock(${i})">Start Unlock</button>`;
        contentHtml += actionButton;
      }
      slotEl.innerHTML = contentHtml;
    } else { 
      slotEl.classList.add('empty');
      slotEl.innerHTML = `<div class="plus">+</div>`;
    }
    chestSlots.appendChild(slotEl);
  }
}

export function startChestUnlock(index) {
    const chest = gameState.chests[index];
    if (chest && !chest.unlockStartTime) {
        chest.unlockStartTime = Date.now();
        renderChests();
        saveGame();
    }
}

export function unlockChestWithGems(index) {
    const chest = gameState.chests[index];
    if (!chest || !chest.unlockStartTime) return;
    
    const timeRemaining = chest.unlockDuration - (Date.now() - chest.unlockStartTime);
    const gemCost = Math.ceil(timeRemaining / 1000 / 60 / 10);

    if (gameState.player.gems >= gemCost) {
        gameState.player.gems -= gemCost;
        openChest(index); // This will also save the game
        updateMainMenuDisplay();
    } else {
        alert("Not enough gems!");
    }
}

function startChestTimers() {
    stopChestTimers(); // Ensure no multiple intervals
    chestTimerIntervalId = setInterval(renderChests, 1000);
}

function stopChestTimers() {
    if (chestTimerIntervalId) {
        clearInterval(chestTimerIntervalId);
        chestTimerIntervalId = null;
    }
}

export function openChest(index) {
    const chest = gameState.chests[index];
    if (!chest) return;

    const rewards = [];
    let goldReward = 0, gemReward = 0;
    let cardRewards = { common: 0, rare: 0, epic: 0, legendary: 0 };
    let cardSourceFilter = (c) => true; // Default to all cards

    // Get card pool available for the player's arena
    const availableCardsForReward = getAvailableCardsForArena(gameState.player.currentArenaIndex);
    const currentArenaMultiplier = gameState.player.currentArenaIndex + 1;

    // Define chest contents
    if (chest.type === 'silver') {
        goldReward = (Math.floor(Math.random() * 20) + 50) * currentArenaMultiplier;
        cardRewards.common = Math.floor(Math.random() * 3) + 5;
    } else if (chest.type === 'gold') {
        goldReward = (Math.floor(Math.random() * 50) + 150) * currentArenaMultiplier;
        cardRewards.common = Math.floor(Math.random() * 5) + 10;
        cardRewards.rare = Math.floor(Math.random() * 2) + 1;
    } else if (chest.type === 'giant') {
        goldReward = (Math.floor(Math.random() * 100) + 300) * currentArenaMultiplier;
        cardRewards.common = 20;
        cardRewards.rare = 10;
    } else if (chest.type === 'magical') {
        goldReward = (Math.floor(Math.random() * 200) + 500) * currentArenaMultiplier;
        cardRewards.common = 15;
        cardRewards.rare = 5;
        cardRewards.epic = 2;
    } else if (chest.type === 'epic-chest') {
        cardRewards.epic = 10;
    } else if (chest.type === 'legendary' || chest.type === 'legendary-king-chest') {
        cardRewards.legendary = 1;
    }

    // Apply gold reward
    gameState.player.gold += goldReward;
    if (goldReward > 0) rewards.push({ type: 'gold', value: goldReward });

    // Apply gem reward if any
    if (gemReward > 0) {
        gameState.player.gems += gemReward;
        rewards.push({ type: 'gem', value: gemReward });
    }
    
    // Grant cards based on rarity
    for (const rarity in cardRewards) {
        const count = cardRewards[rarity];
        if (count === 0) continue;

        const cardsOfRarity = availableCardsForReward.filter(c => c.rarity === rarity);
        if (cardsOfRarity.length === 0) continue;

        // Give 'count' total cards of this rarity, could be multiple stacks of different cards
        let tempRewards = {};
        for(let i=0; i<count; i++) {
            const randomCard = cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
            tempRewards[randomCard.id] = (tempRewards[randomCard.id] || 0) + 1;
        }

        for (const cardId in tempRewards) {
            const cardCount = tempRewards[cardId];
            const playerCard = gameState.player.cards[cardId];
            const baseCardData = cardData[cardId];
            const maxLevel = baseCardData.upgrade ? (baseCardData.upgrade.length + 1) : (playerCard ? playerCard.level : 1);

            if (playerCard && playerCard.level >= maxLevel) {
                const starPointsEarned = cardCount * (baseCardData.starPointValue || 1);
                gameState.player.starPoints += starPointsEarned;
                rewards.push({type: 'starPoints', value: starPointsEarned});
            } else {
                if (!playerCard) {
                    const cardInfo = allCards.find(c => c.id === cardId);
                    if (cardInfo) {
                        const fullCardData = cardData[cardId];
                        gameState.player.cards[cardId] = { ...fullCardData, id: cardId, name: cardInfo.name, cost: cardInfo.cost, type: cardInfo.type, emoji: cardInfo.emoji, level: 1, count: cardCount, rarity: cardInfo.rarity, isGolden: false };
                    }
                } else {
                    playerCard.count += cardCount;
                }
                rewards.push({type: 'card', cardId: cardId, count: cardCount});
            }
        }
    }

    // Legendary chance from non-legendary chests
    const legendaryChance = { silver: 0.001, gold: 0.005, giant: 0.01, magical: 0.05, 'epic-chest': 0 };
    if (legendaryChance[chest.type] && Math.random() < legendaryChance[chest.type]) {
        const legendaryCards = availableCardsForReward.filter(c => c.rarity === 'legendary');
        if (legendaryCards.length > 0) {
            const legendaryCard = legendaryCards[Math.floor(Math.random() * legendaryCards.length)];
            // Handle legendary reward logic (add to player cards etc.)
             if (!gameState.player.cards[legendaryCard.id]) {
                const fullCardData = cardData[legendaryCard.id];
                gameState.player.cards[legendaryCard.id] = { ...fullCardData, id: legendaryCard.id, name: legendaryCard.name, cost: legendaryCard.cost, type: legendaryCard.type, emoji: legendaryCard.emoji, level: 1, count: 1, rarity: legendaryCard.rarity, isGolden: false };
            } else {
                gameState.player.cards[legendaryCard.id].count += 1;
            }
            rewards.push({type: 'card', cardId: legendaryCard.id, count: 1});
        }
    }
    
    // NEW: Chance to get Evolution Shards
    const evoCards = Object.keys(cardData).filter(id => cardData[id].evolution);
    if (evoCards.length > 0 && Math.random() < 0.25) { // 25% chance to get shards from any chest
        const randomEvoCardId = evoCards[Math.floor(Math.random() * evoCards.length)];
        const shardAmount = 1;
        
        if (!gameState.player.evoShards[randomEvoCardId]) {
            gameState.player.evoShards[randomEvoCardId] = 0;
        }
        gameState.player.evoShards[randomEvoCardId] += shardAmount;
        rewards.push({ type: 'evoShard', cardId: randomEvoCardId, count: shardAmount });
    }

    gameState.chests.splice(index, 1); // Remove opened chest
    playSound('chest_open'); // Play chest open sound
    startChestOpeningSequence(chest.type, rewards);
    updateMainMenuDisplay();
    renderChests(); // Re-render chests display
    saveGame(); // Save after opening chest
}

function getAvailableCardsForArena(arenaIndex) {
    const unlockedArenas = arenaData.slice(0, arenaIndex + 1).map(a => a.id);
    const availableSpecialCards = arenaData
        .filter(arena => unlockedArenas.includes(arena.id))
        .map(arena => arena.specialCard);

    // All cards are available if they are common, or their special arena is unlocked
    return allCards.filter(card => {
        if (card.rarity === 'common') return true;

        // Prevent Rowan from appearing in normal reward pools unless admin or explicitly granted
        if (card.id === 'rowan' && !gameState.isAdmin && !gameState.adminGrantedCards['rowan']) {
            return false;
        }

        // Find which arena this card is a special card for
        const unlockArena = arenaData.find(a => a.specialCard === card.id);
        if (!unlockArena) return true; // Assume available if not a special reward
        
        return unlockedArenas.includes(unlockArena.id);
    });
}

export function closeChestRewardsModal() {
    document.getElementById('chestRewardsModal').style.display = 'none';
    // Clear state when closing
    chestOpeningState = { chestType: null, rewards: [], currentIndex: 0 };
}

function showRewardsModal(title, rewards) {
    // This function is now only for non-chest rewards (e.g., battle pass, shop)
    const modal = document.getElementById('chestRewardsModal');
    const rewardsTitle = document.getElementById('chestRewardsTitle');
    const rewardsContent = document.getElementById('revealedRewardsContainer'); // Use the new container
    const tapArea = document.getElementById('chestOpeningTapArea');
    const chestVisual = document.getElementById('chestOpeningVisual');
    const continueBtn = document.getElementById('closeChestRewardsModalBtn');

    rewardsTitle.textContent = title;
    rewardsContent.innerHTML = ''; // Clear previous rewards
    tapArea.style.display = 'none';
    chestVisual.style.display = 'none';
    continueBtn.style.display = 'block';

    rewards.forEach((reward, index) => {
        let rewardText = '';
        let icon = '';
        let rarity = 'common';
        if (reward.type === 'gold') { icon = '💰'; rewardText = `${reward.value} Gold`; }
        else if (reward.type === 'gem') { icon = '💎'; rewardText = `${reward.value} Gems`; }
        else if (reward.type === 'card') { 
            const card = allCards.find(c => c.id === reward.cardId);
            icon = card ? card.emoji : '🃏';
            rewardText = `${reward.count}x ${card ? card.name : 'Cards'}`;
            rarity = card ? card.rarity : 'common';
        }
        else if (reward.type === 'starPoints') { icon = '⭐'; rewardText = `${reward.value} SP`; }
        else if (reward.type === 'evoShard') {
            const card = allCards.find(c => c.id === reward.cardId);
            icon = '🟣';
            rewardText = `${reward.count}x ${card ? card.name : ''} Shard`;
            rarity = 'legendary';
        }
        else if (reward.type === 'chest') {
            const chestCard = allCards.find(c => c.id === reward.chestType) || { emoji: '📦' };
            icon = chestCard.emoji;
            rewardText = `${reward.chestType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
            rarity = 'epic';
        }
        
        const rewardEl = document.createElement('div');
        rewardEl.classList.add('reward-card', rarity);
        rewardEl.innerHTML = `
            <div class="reward-card-icon">${icon}</div>
            <div class="reward-card-text">${rewardText}</div>
        `;
        rewardsContent.appendChild(rewardEl);

        setTimeout(() => { playSound('reward_reveal'); }, index * 100);
    });

    modal.style.display = 'flex';
}

function startChestOpeningSequence(chestType, rewards) {
    chestOpeningState = {
        chestType,
        rewards: [...rewards], // Copy rewards array
        currentIndex: 0,
    };

    const modal = document.getElementById('chestRewardsModal');
    const titleEl = document.getElementById('chestRewardsTitle');
    const visualEl = document.getElementById('chestOpeningVisual');
    const tapArea = document.getElementById('chestOpeningTapArea');
    const rewardsContainer = document.getElementById('revealedRewardsContainer');
    const continueBtn = document.getElementById('closeChestRewardsModalBtn');

    const chestInfo = allCards.find(c => c.id === chestType) || { name: `${chestType} Chest`, emoji: '📦'};

    titleEl.textContent = `Opening ${chestInfo.name.replace(/-/g, ' ')}...`;
    visualEl.textContent = chestInfo.emoji;
    rewardsContainer.innerHTML = '';
    
    visualEl.style.display = 'block';
    tapArea.style.display = 'block';
    tapArea.textContent = `Tap to reveal (${rewards.length} left)`;
    continueBtn.style.display = 'none';

    modal.style.display = 'flex';
}

function revealNextReward() {
    const { rewards, currentIndex, chestType } = chestOpeningState;
    if (currentIndex >= rewards.length) return;

    const reward = rewards[currentIndex];
    const rewardsContainer = document.getElementById('revealedRewardsContainer');
    const tapArea = document.getElementById('chestOpeningTapArea');
    const continueBtn = document.getElementById('closeChestRewardsModalBtn');
    const visualEl = document.getElementById('chestOpeningVisual');

    // Add shake animation to chest
    visualEl.classList.add('shake');
    setTimeout(() => visualEl.classList.remove('shake'), 500);

    // Create and append reward card
    let icon = '', text = '', rarity = 'common';
    if (reward.type === 'gold') { icon = '💰'; text = `${reward.value} Gold`; }
    else if (reward.type === 'gem') { icon = '💎'; text = `${reward.value} Gems`; }
    else if (reward.type === 'card') {
        const card = allCards.find(c => c.id === reward.cardId);
        icon = card ? card.emoji : '🃏';
        text = `${reward.count}x ${card ? card.name : 'Cards'}`;
        rarity = card ? card.rarity : 'common';
    } else if (reward.type === 'starPoints') {
        icon = '⭐'; text = `${reward.value} SP`;
    } else if (reward.type === 'evoShard') {
        const card = allCards.find(c => c.id === reward.cardId);
        icon = '🟣';
        text = `${reward.count}x ${card ? card.name : ''} Shard`;
        rarity = 'legendary';
    }
    
    const rewardEl = document.createElement('div');
    rewardEl.classList.add('reward-card', rarity);
    rewardEl.innerHTML = `
        <div class="reward-card-icon">${icon}</div>
        <div class="reward-card-text">${text}</div>
    `;
    rewardsContainer.appendChild(rewardEl);

    playSound('reward_reveal');
    chestOpeningState.currentIndex++;

    const rewardsLeft = rewards.length - chestOpeningState.currentIndex;
    if (rewardsLeft > 0) {
        tapArea.textContent = `Tap to reveal (${rewardsLeft} left)`;
    } else {
        tapArea.style.display = 'none';
        visualEl.style.display = 'none';
        continueBtn.style.display = 'block';
    }
}

export function showCards(){
  showScreen('cardsScreen'); 
  renderCardsCollection();
  renderEquippedEvo();
}

export function renderCardsCollection(){
  const cardCollection = document.getElementById('cardCollection'); 
  cardCollection.innerHTML='';
  
  const ownedCardsArray = Object.values(gameState.player.cards)
                                .filter(card => card && card.id && card.name)
                                .sort((a,b) => a.name.localeCompare(b.name));

  ownedCardsArray.forEach(card => {
    const baseCard = cardData[card.id];
    // If baseCard is not found, this card data is likely corrupt or from an old version.
    // We should skip rendering it to prevent a crash.
    if (!baseCard) {
      console.warn(`Card data for "${card.id}" not found. Skipping render.`);
      return;
    }

    const el = document.createElement('div');
    el.classList.add('card-item', card.rarity || 'common');
    if (baseCard.evolution) {
        el.classList.add('has-evo');
    }
    if (card.isGolden) {
        el.classList.add('golden');
    }
    el.dataset.cardId = card.id;
    el.addEventListener('click', () => showCardDetails(card.id));
    
    const currentLevel = card.level;
    const maxLevel = baseCard.upgrade ? (baseCard.upgrade.length + 1) : 1; // max level is number of upgrade stages + 1 (base level)
    const nextUpgrade = baseCard.upgrade?.[currentLevel -1]; // Use optional chaining

    let progressHtml = '';
    let levelText = `Level ${card.level}`;

    if (currentLevel < maxLevel) {
        if (nextUpgrade) {
            const progressPct = Math.min(100, (card.count / nextUpgrade.cards) * 100);
            progressHtml = `
                <div class="card-progress">
                    <div class="card-progress-fill" style="width: ${progressPct}%;"></div>
                    <div class="card-progress-text">${card.count} / ${nextUpgrade.cards}</div>
                </div>
            `;
        } else {
            // Should not happen if currentLevel < maxLevel and baseCard.upgrade exists
            progressHtml = `<div class="card-progress-text">Ready for Upgrade (No cost data?)</div>`;
        }
    } else { // Max level reached
        progressHtml = `<div class="card-progress-text">Max Level</div>`;
        levelText = `Level ${card.level} (Max)`;
    }

    // Calculate effective stats for display
    let effectiveHp = baseCard.hp ? Math.floor(baseCard.hp * (1 + (currentLevel - 1) * 0.1)) : '-';
    let effectiveDamage = baseCard.damage ? Math.floor(baseCard.damage * (1 + (currentLevel - 1) * 0.1) * 0.9) : '-'; // Apply 0.9 damage multiplier here for display
    if(card.isGolden && baseCard.goldenBoost) {
        if(effectiveHp !== '-') effectiveHp = Math.floor(effectiveHp * baseCard.goldenBoost.hp);
        if(effectiveDamage !== '-') effectiveDamage = Math.floor(effectiveDamage * baseCard.goldenBoost.damage);
    }

    // Determine if Golden Skin is available or unlocked
    let goldenSkinStatusHtml = '';
    const starPointsCost = 500; // Example cost for golden skin
    if (currentLevel === maxLevel) { // Only allow golden skin for max level cards
        if (card.isGolden) {
            goldenSkinStatusHtml = `<div class="card-cosmetic-status">⭐ Golden Skin Unlocked!</div>`;
        } else {
            goldenSkinStatusHtml = `<div class="card-cosmetic-status">Unlock Golden Skin (Max Level)</div>`;
        }
    }

    el.innerHTML = `
        <div class="card-item-header">
            <div class="card-item-name">${card.name}</div>
            <div class="card-item-cost">${card.cost}</div>
        </div>
        <div class="card-item-visual ${card.isGolden ? 'golden' : ''}">${card.emoji}</div>
        <div class="card-item-info">
            <div class="card-level">${levelText}</div>
            <div class="card-item-stats">
                <span>HP: ${effectiveHp !== '-' ? Math.floor(effectiveHp) : '-'}</span>
                <span>DMG: ${effectiveDamage !== '-' ? Math.floor(effectiveDamage) : '-'}</span>
            </div>
            ${goldenSkinStatusHtml} <!-- Display golden skin status -->
            ${progressHtml}
        </div>
    `;
    cardCollection.appendChild(el);
  });
  // Update average elixir display
  const costs = gameState.player.activeDeck.map(id => {
      const card = gameState.player.cards[id];
      return card ? card.cost : 0;
  });
  const avg = costs.length > 0 ? (costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(1) : '0.0';
  const avgElixirEl = document.getElementById('avgElixirDisplay');
  if (avgElixirEl) avgElixirEl.textContent = `Avg Elixir: ${avg}`;
  saveGame(); // Save after deck changes
}

export function showCardDetails(cardId){
  const modal = document.getElementById('cardDetailModal');
  const content = document.getElementById('cardDetailContent');
  const playerCard = gameState.player.cards[cardId];
  const baseCard = cardData[cardId];
  const upgradeAnimationOverlay = document.getElementById('cardUpgradeAnimation');
  upgradeAnimationOverlay.classList.remove('active'); // Hide animation on new card details display

  // NEW: Handle Evolution display
  const evoContent = document.getElementById('cardEvoContent');
  const baseCardEvo = baseCard.evolution;

  if (baseCardEvo) {
      const currentShards = gameState.player.evoShards[cardId] || 0;
      const requiredShards = baseCardEvo.requiredShards;
      const progressPct = Math.min(100, (currentShards / requiredShards) * 100);
      
      let evoButtonHtml = '';
      if (playerCard.evoUnlocked) {
          const isEquipped = gameState.player.equippedEvo === cardId;
          evoButtonHtml = `<button class="evo-button" onclick="equipEvolution('${cardId}')">${isEquipped ? 'Unequip' : 'Equip Evolution'}</button>`;
      } else {
          const canUnlock = currentShards >= requiredShards;
          evoButtonHtml = `<button class="evo-button" onclick="unlockEvolution('${cardId}')" ${canUnlock ? '' : 'disabled'}>Unlock Evolution</button>`;
      }

      evoContent.innerHTML = `
          <h4>🟣 Evolution</h4>
          <p>${baseCardEvo.description}</p>
          <div class="shard-progress">
              <div class="shard-progress-fill" style="width: ${progressPct}%"></div>
              <div class="shard-progress-text">${currentShards} / ${requiredShards}</div>
          </div>
          ${evoButtonHtml}
      `;
      evoContent.style.display = 'block';
  } else {
      evoContent.style.display = 'none';
      evoContent.innerHTML = '';
  }

  if (!playerCard || !baseCard) {
      console.error('Card data not found for', cardId);
      return;
  }

  const currentLevel = playerCard.level;
  const maxLevel = baseCard.upgrade ? (baseCard.upgrade.length + 1) : 1; // If no upgrade path, current level is max
  const nextUpgrade = baseCard.upgrade?.[currentLevel -1]; // Use optional chaining

  let upgradeInfoHtml = '';
  // Only show upgrade section if there's actual upgrade data for the current level and card isn't max level
  if (currentLevel < maxLevel) { // Check if not max level
      if (nextUpgrade) { // Ensure nextUpgrade details are available
          const canUpgrade = playerCard.count >= nextUpgrade.cards && gameState.player.gold >= nextUpgrade.gold;
          upgradeInfoHtml = `
              <div class="card-upgrade-info">
                  <div class="upgrade-progress">Cards: ${playerCard.count} / ${nextUpgrade.cards}</div>
                  <div class="upgrade-cost">Gold: 💰 ${nextUpgrade.gold}</div>
                  <button class="upgrade-btn" ${canUpgrade ? '' : 'disabled'} onclick="upgradeCard('${cardId}')">Upgrade to Level ${currentLevel + 1}</button>
              </div>
          `;
      } else {
          // This case means card is not max level but has no defined upgrade path for current level
          // This typically implies an error in cardData.
          upgradeInfoHtml = `<div class="card-upgrade-info">No upgrade data found for Level ${currentLevel}.</div>`;
      }
  } else {
      upgradeInfoHtml = `<div class="card-upgrade-info">Max Level Reached!</div>`;
  }

  // Cosmetic upgrade section (Golden Skin)
  let cosmeticInfoHtml = '';
  const starPointsCost = 500; // Cost for golden skin
  if (currentLevel === maxLevel) { // Only allow golden skin for maxed cards
      if (playerCard.isGolden) {
          cosmeticInfoHtml = `
              <div class="card-cosmetic-info">
                  <div>⭐ Golden Skin Unlocked! ⭐</div>
                  <p>Provides a permanent 10% HP & Damage boost.</p>
              </div>
          `;
      } else {
          const canAffordCosmetic = gameState.player.starPoints >= starPointsCost;
          cosmeticInfoHtml = `
              <div class="card-cosmetic-info">
                  <div>Unlock a Golden Skin for a permanent 10% HP & Damage boost!</div>
                  <button class="cosmetic-btn" ${canAffordCosmetic ? '' : 'disabled'} onclick="applyCosmeticUpgrade('${cardId}', ${starPointsCost})">Unlock Golden Skin (${starPointsCost} ⭐)</button>
              </div>
          `;
      }
  }

  // Calculate effective HP/Damage for display, considering level and golden status
  let effectiveHp = baseCard.hp ? Math.floor(baseCard.hp * (1 + (currentLevel - 1) * 0.1)) : '-';
  let effectiveDamage = baseCard.damage ? Math.floor(baseCard.damage * (1 + (currentLevel - 1) * 0.1) * 0.9) : '-'; // Apply 0.9 damage multiplier here for display
  if(playerCard.isGolden && baseCard.goldenBoost) {
    if(effectiveHp !== '-') effectiveHp = Math.floor(effectiveHp * baseCard.goldenBoost.hp);
    if(effectiveDamage !== '-') effectiveDamage = Math.floor(effectiveDamage * baseCard.goldenBoost.damage);
  }

  const effectiveAttackSpeed = baseCard.attackSpeed ? (baseCard.attackSpeed / 1000).toFixed(1) + 's' : '-'; // Convert ms to seconds
  
  content.innerHTML = `
      <div class="card-visual ${playerCard.isGolden ? 'golden' : ''}">${playerCard.emoji}</div>
      <div class="card-name">${playerCard.name}</div>
      <div class="card-level">Level ${currentLevel}</div>
      <div class="card-stats">
          <div>HP: ${effectiveHp !== '-' ? Math.floor(effectiveHp) : '-'}</div>
          <div>Damage: ${effectiveDamage !== '-' ? Math.floor(effectiveDamage) : '-'}</div>
          <div>Speed: ${baseCard.speed || '-'}</div>
          <div>Range: ${baseCard.range || '-'}</div>
          <div>Attack Speed: ${effectiveAttackSpeed}</div>
          <div>Targets: ${baseCard.targets || '-'}</div>
          ${baseCard.splash ? `<div>Splash Radius: ${(baseCard.splashRadius * 30).toFixed(0)}px</div>` : ''}
          ${baseCard.splash ? `<div>Splash Dmg: ${(baseCard.splashDamage * 100).toFixed(0)}%</div>` : ''}
          ${baseCard.stun ? `<div>Stun: ${baseCard.stun}s</div>` : ''}
          ${baseCard.stunDuration ? `<div>Stun Duration: ${baseCard.stunDuration / 1000}s</div>` : ''}
          ${baseCard.damagePerSecond ? `<div>Damage/Sec: ${Math.floor(baseCard.damagePerSecond * (1 + (currentLevel - 1) * 0.1) * 0.9)}</div>` : ''}
          ${baseCard.count && baseCard.type === 'troop' ? `<div>Count: ${baseCard.count}</div>` : ''}
          ${baseCard.duration ? `<div>Duration: ${baseCard.duration / 1000}s</div>` : ''}
      </div>
      ${upgradeInfoHtml}
      ${cosmeticInfoHtml}
  `;
  modal.style.display = 'flex';
}

export function closeCardDetails(){
  document.getElementById('cardDetailModal').style.display = 'none';
}

export function upgradeCard(cardId){
  const playerCard = gameState.player.cards[cardId];
  const baseCard = cardData[cardId];
  const currentLevel = playerCard.level;
  const maxLevel = baseCard.upgrade ? (baseCard.upgrade.length + 1) : 1; // If no upgrade path, current level is max
  const nextUpgrade = baseCard.upgrade?.[currentLevel -1]; // Use optional chaining

  if (currentLevel < maxLevel && nextUpgrade) { // Ensure nextUpgrade exists and not max level
      if (playerCard.count >= nextUpgrade.cards && gameState.player.gold >= nextUpgrade.gold) {
          gameState.player.gold -= nextUpgrade.gold;
          playerCard.count -= nextUpgrade.cards; // Consume cards for upgrade
          playerCard.level++;
          playSound('win'); // Upgrade sound
          
          // After upgrade, if the card is now maxed, convert any remaining cards to star points
          if (playerCard.level === maxLevel && playerCard.count > 0) {
              const starPointsEarned = playerCard.count * (baseCard.starPointValue || 1);
              gameState.player.starPoints += starPointsEarned;
              playerCard.count = 0; // Clear card count after conversion
              alert(`Earned ${starPointsEarned} Star Points for excess ${playerCard.name} cards!`);
          }

          // Trigger upgrade animation
          const upgradeAnimationOverlay = document.getElementById('cardUpgradeAnimation');
          upgradeAnimationOverlay.classList.add('active');
          setTimeout(() => {
              upgradeAnimationOverlay.classList.remove('active');
              alert(`${playerCard.name} upgraded to Level ${playerCard.level}!`);
              updateMainMenuDisplay();
              renderCardsCollection(); // Re-render collection view
              showCardDetails(cardId); // Re-render details modal
              saveGame(); // Save after card upgrade
          }, 1500); // Match animation duration
      } else {
          alert('Not enough cards or gold for upgrade!');
      }
  } else {
      alert('Card is already at max level!');
  }
}

export function applyCosmeticUpgrade(cardId, cost) {
    const playerCard = gameState.player.cards[cardId];
    const baseCard = cardData[cardId];
    const maxLevel = baseCard.upgrade ? (baseCard.upgrade.length + 1) : 1;
    if (!playerCard || playerCard.level < maxLevel) return alert('Reach Max Level to unlock Golden Skin.'); // Only max level cards can be golden
    applyGoldenSkin(cardId, cost);
}

export function applyGoldenSkin(cardId, cost) {
    const playerCard = gameState.player.cards[cardId];
    if (playerCard && gameState.player.starPoints >= cost && !playerCard.isGolden) {
        gameState.player.starPoints -= cost;
        playerCard.isGolden = true;
        
        playSound('win'); // Play a success sound
        alert(`Golden Skin for ${playerCard.name} unlocked! It now has +10% HP and Damage.`);
        
        updateMainMenuDisplay();
        renderCardsCollection();
        showCardDetails(cardId); // Refresh the details modal
        saveGame();
    } else {
        if (playerCard.isGolden) {
            alert('Golden skin already unlocked!');
        } else {
            alert('Not enough Star Points!');
        }
    }
}

// NEW FUNCTIONS FOR EVOLUTION
export function unlockEvolution(cardId) {
    const playerCard = gameState.player.cards[cardId];
    const baseCard = cardData[cardId];
    if (!playerCard || !baseCard || !baseCard.evolution) return;

    const currentShards = gameState.player.evoShards[cardId] || 0;
    const requiredShards = baseCard.evolution.requiredShards;

    if (currentShards >= requiredShards && !playerCard.evoUnlocked) {
        playerCard.evoUnlocked = true;
        gameState.player.evoShards[cardId] -= requiredShards; // Consume shards
        playSound('win');
        alert(`Evolution unlocked for ${playerCard.name}!`);
        showCardDetails(cardId); // Refresh modal
        saveGame();
    } else {
        alert('Not enough shards to unlock evolution!');
    }
}

export function equipEvolution(cardId) {
    const playerCard = gameState.player.cards[cardId];
    if (!playerCard || !playerCard.evoUnlocked) {
        alert("Evolution not unlocked for this card!");
        return;
    }

    if (gameState.player.equippedEvo === cardId) {
        // Unequip
        gameState.player.equippedEvo = null;
    } else {
        // Equip
        gameState.player.equippedEvo = cardId;
    }
    
    playSound('spawn');
    renderEquippedEvo();
    showCardDetails(cardId); // Refresh modal to show button status
    saveGame();
}

export function renderEquippedEvo() {
    const slot = document.getElementById('equippedEvoCard');
    if (!slot) return;
    slot.innerHTML = ''; // Clear it

    const equippedId = gameState.player.equippedEvo;
    if (equippedId && gameState.player.cards[equippedId]) {
        const card = gameState.player.cards[equippedId];
        const cardName = allCards.find(c => c.id === card.id)?.name || card.name;
        slot.innerHTML = `
            <div class="equipped-evo-card-item" onclick="equipEvolution('${card.id}')">
                <div class="card-cost-banner">${card.cost}</div>
                <div class="card-art">${card.emoji}</div>
                <div class="card-name-banner">${cardName}</div>
            </div>
        `;
    } else {
        slot.innerHTML = `<div class="evo-slot-placeholder">Equip an unlocked Evolution card here</div>`;
    }
}

// Shop functions
export function showShop() {
    showScreen('shopScreen');
    generateDailyShopOffers(); // Ensures offers are fresh or generated
    renderShopOffers();
    // Shop refresh timer started by showScreen
    saveGame(); // Save on entering shop
}

export function generateDailyShopOffers() {
    const now = Date.now();
    // Refresh if no offers or if last refresh was more than DAILY_SHOP_REFRESH_INTERVAL ago
    if (!gameState.shop.offers.length || (now - gameState.shop.lastRefresh > DAILY_SHOP_REFRESH_INTERVAL)) {
        gameState.shop.offers = []; // Clear old offers
        
        // Always add all special chests to the shop
        const specialChestsDefinitions = [
            { id: 'epic-chest', cost: 100, currency: 'gems' },
            { id: 'legendary-king-chest', cost: 200, currency: 'gems' },
            { id: 'gold-rush-chest', cost: 10000, currency: 'gold' }
        ];

        specialChestsDefinitions.forEach(chestDef => {
            gameState.shop.offers.push({
                cardId: chestDef.id,
                count: 1, // Chests are generally 1 count
                currency: chestDef.currency,
                cost: chestDef.cost,
                sold: false
            });
        });

        const numAdditionalOffers = Math.floor(Math.random() * 3) + 3; // 3 to 5 additional offers
        let freeOfferAdded = false; 

        for (let i = 0; i < numAdditionalOffers; i++) {
            const randomCardIndex = Math.floor(Math.random() * allCards.length);
            const cardId = allCards[randomCardIndex].id;
            // ENSURE "rowan" never appears in normal shop offers unless admin
            if (cardId === 'rowan' && !gameState.isAdmin && !gameState.adminGrantedCards['rowan']) {
                i--; // skip this pick and retry
                continue;
            }
            const cardBase = allCards.find(c => c.id === cardId);
            
            // Skip if it's a special chest type (already handled above) or if it's a temporary card
            if (cardBase.type === 'special-chest') {
                i--; // Decrement i to retry for a regular card/item
                continue;
            }

            let count;
            let currency;
            let cost;

            // Ensure one free offer per refresh among the additional offers
            if (!freeOfferAdded && i === 0 && Math.random() < 0.7) { // 70% chance for first additional offer to be free
                currency = 'none';
                cost = 0;
                count = Math.floor(Math.random() * 5) + 3; // 3-7 free cards
                freeOfferAdded = true;
            } else {
                // Determine count based on card rarity/type
                if (cardBase.type === 'spell' || cardBase.type === 'building') {
                    count = Math.floor(Math.random() * 3) + 1; // 1-3 spells/buildings
                } else { // Troop cards
                    count = Math.floor(Math.random() * 8) + 5; // 5-12 troop cards
                }

                // Determine currency and cost
                if (Math.random() < 0.3) { // 30% chance for gems
                    currency = 'gems';
                    cost = count * (Math.floor(Math.random() * 3) + 1); // 1-3 gems per card
                } else { // Gold
                    currency = 'gold';
                    cost = count * (Math.floor(Math.random() * 15) + 5); // 5-20 gold per card
                }
            }
            
            gameState.shop.offers.push({
                cardId: cardId,
                count: count,
                currency: currency,
                cost: cost,
                sold: false
            });
        }
        gameState.shop.lastRefresh = now;
        saveGame(); // Save new shop offers
    }
}

export function renderShopOffers() {
    const shopOffersGrid = document.getElementById('shopOffersGrid');
    shopOffersGrid.innerHTML = ''; // Clear previous offers

    gameState.shop.offers.forEach((offer, index) => {
        const cardInfo = allCards.find(c => c.id === offer.cardId);
        if (!cardInfo) return; // Should not happen

        const offerCard = document.createElement('div');
        offerCard.classList.add('shop-offer-card');
        if (offer.sold) {
            offerCard.classList.add('sold');
        } else {
            offerCard.onclick = () => buyShopOffer(index);
        }

        let costDisplay;
        if (offer.currency === 'none' && offer.cost === 0) {
            costDisplay = `<div class="offer-cost free">FREE!</div>`;
        } else {
            costDisplay = `<div class="offer-cost ${offer.currency}">${offer.currency === 'gold' ? '💰' : '💎'} ${offer.cost}</div>`;
        }


        offerCard.innerHTML = `
            <div class="offer-card-icon">${cardInfo.emoji}</div>
            <div class="offer-card-name">${cardInfo.name}</div>
            <div class="offer-card-count">${cardInfo.type === 'special-chest' ? '' : 'x'}${offer.count}</div>
            ${costDisplay}
        `;
        shopOffersGrid.appendChild(offerCard);
    });
}

export function buyShopOffer(index) {
    const offer = gameState.shop.offers[index];
    if (!offer || offer.sold) return;

    let playerHasEnough = true;
    if (offer.cost > 0) { // If it's not a free offer, check currency
        playerHasEnough = offer.currency === 'gold' ? 
                                gameState.player.gold >= offer.cost : 
                                gameState.player.gems >= offer.cost;
    }

    if (playerHasEnough) {
        if (offer.cost > 0) { // Deduct cost if not free
            if (offer.currency === 'gold') {
                gameState.player.gold -= offer.cost;
            } else if (offer.currency === 'gems') {
                gameState.player.gems -= offer.cost;
            }
        }

        const cardId = offer.cardId;
        const cardCount = offer.count;
        const rewards = [];

        // Handle special chest purchases
        const cardInfo = allCards.find(c => c.id === cardId);
        if (cardInfo && cardInfo.type === 'special-chest') {
            gameState.chests.push({ type: cardId }); // Add the special chest to player's chests
            rewards.push({type: 'chest', chestType: cardId}); // Indicate chest reward
        } else {
            const playerCard = gameState.player.cards[cardId];
            const baseCardData = cardData[cardId];
            const maxLevel = baseCardData.upgrade ? (baseCardData.upgrade.length + 1) : (playerCard ? playerCard.level : 1);

            if (playerCard && playerCard.level >= maxLevel) {
                const starPointsEarned = cardCount * (baseCardData.starPointValue || 1);
                gameState.player.starPoints += starPointsEarned;
                rewards.push({type: 'starPoints', value: starPointsEarned});
            } else { // Card is not owned or not maxed
                // If not owned, add the card to player's collection
                if (!playerCard) {
                    const cardInfo = allCards.find(c => c.id === cardId);
                    if (cardInfo) {
                        const fullCardData = cardData[cardId];
                        gameState.player.cards[cardId] = { ...fullCardData, id: cardId, name: cardInfo.name, cost: cardInfo.cost, type: cardInfo.type, emoji: cardInfo.emoji, level: 1, count: cardCount, rarity: cardInfo.rarity, isGolden: false };
                    }
                } else {
                    playerCard.count += cardCount;
                }
                rewards.push({type: 'card', cardId: cardId, count: cardCount});
            }
        }
        
        offer.sold = true; // Mark offer as sold
        playSound('win'); // Play a success sound
        showRewardsModal('Purchase Successful!', rewards);
        updateMainMenuDisplay();
        renderShopOffers();
        saveGame();
    } else {
        alert(`Not enough ${offer.currency === 'gold' ? 'gold 💰' : 'gems 💎'} to buy this card!`);
    }
}

function startShopRefreshTimer() {
    if (shopRefreshIntervalId) clearInterval(shopRefreshIntervalId);

    const updateTimer = () => {
        const now = Date.now();
        const timeUntilRefresh = DAILY_SHOP_REFRESH_INTERVAL - (now - gameState.shop.lastRefresh);
        const timerElement = document.getElementById('shopRefreshTimer');

        if (timeUntilRefresh <= 0) {
            timerElement.textContent = "Refreshing shop...";
            generateDailyShopOffers(); // Regenerate offers
            renderShopOffers();
            startShopRefreshTimer(); // Restart timer
            return;
        }

        const hours = Math.floor(timeUntilRefresh / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilRefresh % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeUntilRefresh % (1000 * 60)) / 1000);

        timerElement.textContent = `Shop refreshes in: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    updateTimer();
    shopRefreshIntervalId = setInterval(updateTimer, 1000);
}

function stopShopRefreshTimer() {
    if (shopRefreshIntervalId) {
        clearInterval(shopRefreshIntervalId);
        shopRefreshIntervalId = null;
    }
}

export function showDeck(){
  showScreen('deckScreen'); renderDeckEditor();
}

export function renderDeckEditor() {
    const availableContainer = document.getElementById('availableCards');
    const currentContainer = document.getElementById('currentDeck');
    if (!availableContainer || !currentContainer) return;

    availableContainer.innerHTML = '';
    currentContainer.innerHTML = '';

    // Render cards in the current deck
    for (let i = 0; i < 8; i++) {
        const cardId = gameState.player.activeDeck[i];
        if (cardId && gameState.player.cards[cardId]) {
            const card = gameState.player.cards[cardId];
            const el = createDeckCardElement(card, false); // Not in the available list, so can be removed
            el.addEventListener('click', () => toggleCardInDeck(card.id));
            currentContainer.appendChild(el);
        } else {
            // Render an empty slot
            const emptySlot = document.createElement('div');
            emptySlot.classList.add('deck-slot');
            currentContainer.appendChild(emptySlot);
        }
    }

    // Render all owned cards in the available collection
    const ownedCardsArray = Object.values(gameState.player.cards)
        .filter(card => card && card.id && card.name) // Filter out invalid card data
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name)); // Sort by cost, then name

    ownedCardsArray.forEach(card => {
        const inDeck = gameState.player.activeDeck.includes(card.id);
        const el = createDeckCardElement(card, inDeck);
        if (!inDeck) {
            el.addEventListener('click', () => toggleCardInDeck(card.id));
        }
        availableContainer.appendChild(el);
    });

    updateAverageElixir();
}

function createDeckCardElement(card, isInDeck) {
    const el = document.createElement('div');
    el.classList.add('deck-card-item', card.rarity || 'common');
    el.dataset.cardId = card.id;

    if (isInDeck) {
        el.classList.add('in-deck');
    }

    el.innerHTML = `
        <div class="cost">${card.cost}</div>
        <div class="emoji">${card.emoji}</div>
        <div class="name">${card.name}</div>
    `;
    return el;
}

function updateAverageElixir() {
    const costs = gameState.player.activeDeck.map(id => {
        const card = gameState.player.cards[id];
        return card ? card.cost : 0;
    });
    const avg = costs.length > 0 ? (costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(1) : '0.0';
    const avgElixirEl = document.getElementById('avgElixirDisplay');
    if (avgElixirEl) avgElixirEl.textContent = `Avg Elixir: ${avg}`;
}

export function toggleCardInDeck(cardId){
  const idx = gameState.player.activeDeck.indexOf(cardId);
  if (idx !== -1) {
      // Card is in the deck, so remove it
      gameState.player.activeDeck.splice(idx,1);
  } else {
      // Card is not in the deck, try to add it
      if (gameState.player.activeDeck.length < 8) {
          gameState.player.activeDeck.push(cardId);
      } else {
          alert('Your deck is full! (Max 8 cards)');
      }
  }
  renderDeckEditor();
  saveGame(); // Save after deck changes
}

export function showClan(){
  alert('Clan functionality coming soon!');
}

// NEW: Player Profile Functionality
export function showProfile() {
    showScreen('profileScreen');
    renderProfile();
}

export function renderProfile() {
    // Update header info
    document.getElementById('profileAvatar').src = gameState.player.avatarUrl;
    document.getElementById('profilePlayerLevel').textContent = gameState.player.level;
    document.getElementById('profileUsername').textContent = gameState.player.username;
    const joinDate = new Date(gameState.player.joinDate);
    document.getElementById('profileJoinDate').textContent = `Joined: ${joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

    // Update stats grid
    document.getElementById('profileTrophies').textContent = gameState.player.trophies;
    document.getElementById('profileTotalCrowns').textContent = gameState.player.totalCrowns;
    document.getElementById('profileTotalWins').textContent = gameState.player.totalWins;
    const currentArena = arenaData[gameState.player.currentArenaIndex];
    document.getElementById('profileCurrentArena').textContent = currentArena ? currentArena.name : 'Unknown Arena';
    
    // Render current deck
    const deckContainer = document.getElementById('profileCurrentDeck');
    deckContainer.innerHTML = ''; // Clear previous
    for (let i = 0; i < 8; i++) {
        const cardId = gameState.player.activeDeck[i];
        if (cardId && gameState.player.cards[cardId]) {
            const card = gameState.player.cards[cardId];
            const el = createDeckCardElement(card, false);
            deckContainer.appendChild(el);
        } else {
            // Render an empty slot if deck is not full
            const emptySlot = document.createElement('div');
            emptySlot.classList.add('deck-slot');
            deckContainer.appendChild(emptySlot);
        }
    }
}

export function updateProfileIcon() {
    const profileIcon = document.getElementById('profileIcon');
    if (profileIcon) {
        const avatarImg = profileIcon.querySelector('img');
        if (avatarImg) {
            avatarImg.src = gameState.player.avatarUrl;
        }
    }
}

// NEW: Sandbox Battle Mode
export function startSandboxBattle() {
    gameState.battle.isSandboxMode = true;
    gameState.battle.elixirRateMultiplier = 3; // 3x elixir rate
    startBattle();
}

// NEW: Infinite Elixir Mode
export function startInfiniteElixirBattle() {
    gameState.battle.isSandboxMode = true; // Also a sandbox mode
    gameState.battle.elixirRateMultiplier = 999; // Effectively infinite
    gameState.battle.isInfiniteElixir = true;
    gameState.battle.elixir = 10; // Start with max elixir
    startBattle();
}

// NEW: Sudden Death Mode
export function startSuddenDeathBattle() {
    gameState.battle.isSuddenDeathMode = true;
    gameState.battle.isSandboxMode = true; // Treat as sandbox for reward purposes
    gameState.battle.elixirRateMultiplier = 1; // Normal elixir rate
    startBattle();
}

// NEW: Daily Reward functions
export function showDailyRewardScreen() {
    showScreen('dailyRewardScreen');
    renderDailyRewardTrack();
}

export function renderDailyRewardTrack() {
    const track = document.getElementById('dailyRewardTrack');
    const claimBtn = document.getElementById('claimDailyRewardBtn');
    const closeBtn = document.getElementById('closeDailyRewardScreenBtn');
    if (!track || !claimBtn) return;

    track.innerHTML = '';
    const day = (new Date().getDay() || 7); // 1-7, Sunday is 7

    gameState.dailyRewards.forEach((reward, index) => {
        const rewardDay = index + 1;
        const rewardItem = document.createElement('div');
        rewardItem.classList.add('daily-reward-item');

        if (rewardDay < day) {
            rewardItem.classList.add('claimed');
        } else if (rewardDay === day) {
            rewardItem.classList.add('today');
            if (!gameState.player.dailyRewardClaimed) {
                rewardItem.classList.add('claimable');
            } else {
                 rewardItem.classList.add('claimed');
            }
        } else {
            rewardItem.classList.add('future');
        }

        let icon = '', text = '';
        if (reward.type === 'gold') { icon = '💰'; text = `${reward.value} Gold`; }
        else if (reward.type === 'gem') { icon = '💎'; text = `${reward.value} Gems`; }
        else if (reward.type === 'card') {
            const card = allCards.find(c => c.id === reward.cardId);
            icon = card ? card.emoji : '🃏';
            text = `${reward.count}x ${card ? card.name : 'Cards'}`;
        }
        else if (reward.type === 'chest') {
            const chestCard = allCards.find(c => c.id === reward.chestType + '-chest') || { emoji: '📦' };
            icon = chestCard.emoji;
            text = `${reward.chestType.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Chest`;
        }
         else if (reward.type === 'evoShard') {
            const card = allCards.find(c => c.id === reward.cardId);
            icon = '🟣';
            text = `${reward.count}x ${card ? card.name : ''} Shard`;
        }
        
        rewardItem.innerHTML = `
            <div class="day-label">Day ${rewardDay}</div>
            <div class="reward-icon">${icon}</div>
            <div class="reward-text">${text}</div>
        `;
        track.appendChild(rewardItem);
    });

    if (!gameState.player.dailyRewardClaimed) {
        claimBtn.disabled = false;
        claimBtn.style.display = 'block';
        closeBtn.style.display = 'none';
    } else {
        claimBtn.disabled = true;
        claimBtn.style.display = 'none';
        closeBtn.style.display = 'block';
    }
}

export function claimDailyReward() {
    const day = (new Date().getDay() || 7);
    const reward = gameState.dailyRewards[day - 1];

    if (!reward || gameState.player.dailyRewardClaimed) {
        return; // Already claimed or no reward for today
    }

    // Apply reward
    if (reward.type === 'gold') {
        gameState.player.gold += reward.value;
    } else if (reward.type === 'gem') {
        gameState.player.gems += reward.value;
    } else if (reward.type === 'card') {
        const cardId = reward.cardId;
        const cardCount = reward.count;
        const playerCard = gameState.player.cards[cardId];
        const baseCardData = cardData[cardId];
        const maxLevel = baseCardData.upgrade ? (baseCardData.upgrade.length + 1) : (playerCard ? playerCard.level : 1);

        if (playerCard && playerCard.level >= maxLevel) {
            const starPointsEarned = cardCount * (baseCardData.starPointValue || 1);
            gameState.player.starPoints += starPointsEarned;
        } else {
            if (!playerCard) {
                const cardInfo = allCards.find(c => c.id === cardId);
                if (cardInfo) {
                    const fullCardData = cardData[cardId];
                    gameState.player.cards[cardId] = { ...fullCardData, id: cardId, name: cardInfo.name, cost: cardInfo.cost, type: cardInfo.type, emoji: cardInfo.emoji, level: 1, count: cardCount, rarity: cardInfo.rarity, isGolden: false };
                }
            } else {
                playerCard.count += cardCount;
            }
        }
    } else if (reward.type === 'chest') {
        gameState.chests.push({ type: reward.chestType });
    }
    else if (reward.type === 'evoShard') {
        const card = allCards.find(c => c.id === reward.cardId);
        if (card) {
            const currentShards = gameState.player.evoShards[reward.cardId] || 0;
            const requiredShards = cardData[card.id].evolution?.requiredShards || 0;
            if (currentShards < requiredShards) {
                gameState.player.evoShards[reward.cardId] = currentShards + reward.count;
            } else {
                gameState.player.evoShards[reward.cardId] = requiredShards;
            }
        }
    }

    gameState.player.dailyRewardClaimed = true;
    gameState.player.lastLoginDate = new Date().toDateString(); // Ensure date is updated to today
    
    playSound('win'); // Play a success sound
    renderDailyRewardTrack(); // Re-render to show claimed status
    updateMainMenuDisplay();
    saveGame();
}

// NEW: Arena Selection Functions
export function showArenaSelection() {
    showScreen('arenaSelectionScreen');
    renderArenaSelection();
    saveGame();
}

export function renderArenaSelection() {
    const arenaGrid = document.getElementById('arenaSelectionGrid');
    arenaGrid.innerHTML = ''; // Clear existing content

    const arenaIcons = {
        arena1: '🏟️', arena2: '💀', arena3: '⚔️', arena4: '❄️',
        arena5: '🏜️', arena6: '🌋', arena7: '⛏️', arena8: '☁️',
        arena9: '🏰', arena10: '🐉', arena11: '🛠️', arena12: '👑',
        arena13: '🧙', arena14: '🌳', 'arena-max': '🏆'
    };

    arenaData.forEach((arena, index) => {
        const isUnlocked = gameState.player.unlockedArenas.includes(arena.id);
        const arenaCard = document.createElement('div');
        arenaCard.classList.add('arena-selection-card');
        if (!isUnlocked) {
            arenaCard.classList.add('locked');
        } else {
            arenaCard.dataset.arenaIndex = index;
        }

        if (index === gameState.player.currentArenaIndex) {
            arenaCard.classList.add('current');
        }

        // Apply background gradient
        arenaCard.style.background = `linear-gradient(135deg, ${arena.bgColor1}, ${arena.bgColor2})`;

        let statusHtml = '';
        if (isUnlocked) {
            if (index === gameState.player.currentArenaIndex) {
                statusHtml = `<div class="arena-card-status current-status">CURRENT</div>`;
            } else {
                // The whole card is clickable, so no need for a separate button.
                statusHtml = `<div class="arena-card-status select-status">SELECT</div>`;
            }
        } else {
            statusHtml = `<div class="arena-card-status locked-status">LOCKED 🔒</div>`;
        }

        arenaCard.innerHTML = `
            <div class="arena-card-icon">${arenaIcons[arena.id] || '🌍'}</div>
            <div class="arena-card-info">
              <div class="arena-card-name">${arena.name}</div>
              <div class="arena-card-trophies">Requires 🏆 ${arena.trophies}</div>
            </div>
            ${statusHtml}
        `;
        arenaGrid.appendChild(arenaCard);
    });
}

export function selectArenaForBattle(arenaIndex) {
    if (arenaIndex < 0 || arenaIndex >= arenaData.length) {
        console.error("Invalid arena index selected:", arenaIndex);
        return;
    }
    const selectedArena = arenaData[arenaIndex];
    if (!gameState.player.unlockedArenas.includes(selectedArena.id)) {
        alert(`Arena ${selectedArena.name} is locked! You need ${selectedArena.trophies} trophies.`);
        return;
    }

    gameState.player.currentArenaIndex = arenaIndex;
    gameState.player.arena = arenaIndex + 1; // Update for display
    alert(`Battle in ${selectedArena.name}!`); // Confirm selection
    showMainMenu(); // Return to main menu to prepare for battle with selected arena
    updateMainMenuDisplay(); // Update arena display
    saveGame();
}

// NEW: Game Modes Screen
export function showModesScreen() {
    showScreen('modesScreen');
}

// NEW: Mega Draft Mode Logic
export function startMegaDraftBattle() {
    // 1. Initialize draft state
    gameState.draft = {
        isActive: true,
        playerDeck: [],
        enemyDeck: [],
        cardChoices: [],
        draftPool: shuffleArray([...allCards.filter(c => c.type !== 'special-chest').map(c => c.id)]),
        currentPick: 0
    };
    
    // 2. Show the draft screen
    showScreen('draftScreen');
    
    // 3. Present the first pick
    showNextDraftPick();
}

function showNextDraftPick() {
    const draftContent = document.getElementById('draftContent');
    const draftChoicesEl = document.getElementById('draftChoices');
    const instructionsEl = document.getElementById('draftInstructions');

    // Update deck previews
    updateDraftDeckPreviews();

    if (gameState.draft.currentPick >= 8) {
        // Drafting is complete
        instructionsEl.textContent = 'Draft complete! Starting battle...';
        draftChoicesEl.innerHTML = '';

        // Set the player's active deck to the drafted deck
        gameState.player.activeDeck = [...gameState.draft.playerDeck];
        
        // The AI's deck is already determined. We need a way for the battle logic to use it.
        // For now, we'll store it and have the AI logic pull from it. This requires modifying `ai.js`.
        
        setTimeout(() => {
            // Start a normal battle, but the decks are the drafted ones.
            startBattle();
        }, 2000);
        return;
    }

    // Present the next pick
    instructionsEl.textContent = `Pick ${gameState.draft.currentPick + 1} of 8`;
    
    const choice1Id = gameState.draft.draftPool.pop();
    const choice2Id = gameState.draft.draftPool.pop();

    if (!choice1Id || !choice2Id) {
        alert("Ran out of cards in draft pool!");
        showMainMenu();
        return;
    }

    gameState.draft.cardChoices = [choice1Id, choice2Id];
    
    const card1 = allCards.find(c => c.id === choice1Id);
    const card2 = allCards.find(c => c.id === choice2Id);

    draftChoicesEl.innerHTML = `
        <div class="draft-card-choice" onclick="handleDraftPick('${card1.id}')">
            <div class="card-cost">${card1.cost}</div>
            <div class="card-image">${card1.emoji}</div>
            <div class="card-name">${card1.name}</div>
        </div>
        <div class="draft-card-choice" onclick="handleDraftPick('${card2.id}')">
            <div class="card-cost">${card2.cost}</div>
            <div class="card-image">${card2.emoji}</div>
            <div class="card-name">${card2.name}</div>
        </div>
    `;
}

export function handleDraftPick(chosenCardId) {
    const [choice1, choice2] = gameState.draft.cardChoices;
    const unchosenCardId = chosenCardId === choice1 ? choice2 : choice1;

    // Add cards to respective decks
    gameState.draft.playerDeck.push(chosenCardId);
    gameState.draft.enemyDeck.push(unchosenCardId);

    // Increment pick count
    gameState.draft.currentPick++;
    
    // Show the next pick
    showNextDraftPick();
}

function updateDraftDeckPreviews() {
    const playerDeckEl = document.querySelector('#playerDraftDeck .deck-slots');
    const enemyDeckEl = document.querySelector('#enemyDraftDeck .deck-slots');

    playerDeckEl.innerHTML = '';
    enemyDeckEl.innerHTML = '';

    for (let i = 0; i < 8; i++) {
        const playerCardId = gameState.draft.playerDeck[i];
        const enemyCardId = gameState.draft.enemyDeck[i];
        
        if (playerCardId) {
            const card = allCards.find(c => c.id === playerCardId);
            playerDeckEl.innerHTML += `<div class="deck-slot filled">${card.emoji}</div>`;
        } else {
            playerDeckEl.innerHTML += `<div class="deck-slot"></div>`;
        }

        if (enemyCardId) {
            const card = allCards.find(c => c.id === enemyCardId);
            enemyDeckEl.innerHTML += `<div class="deck-slot filled">${card.emoji}</div>`;
        } else {
            enemyDeckEl.innerHTML += `<div class="deck-slot"></div>`;
        }
    }
}

// Fisher-Yates (Knuth) shuffle algorithm for draft pool
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function showNews() {
  showScreen('newsScreen');
  renderNews();
}

function renderNews() {
  const news = [
    { title: "Wassup Twn — Update", body: "wassup twn uhh new update just general improovement for AI and admin stuff" },
    { title: "New Card: Bowler", body: "Roll into battle with splash damage and stout HP. Unlockable in Crystal Cavern." },
    { title: "New Arena: Crystal Cavern", body: "Shimmering crystals and cool tones. Reach 7000 trophies to unlock." },
    { title: "Battle Pass Extended", body: "Levels 31-35 with Bowler cards, Legendary King's Chest and more." },
    { title: "Quality Updates", body: "Chest opening tap-to-reveal, better bridges, buildings & collisions and more fixes." }
  ];
  const container = document.getElementById('newsContent');
  container.innerHTML = news.map(n => `
    <div class="news-card">
      <h3>${n.title}</h3>
      <p>${n.body}</p>
    </div>
  `).join('');
}

// NEW: Account modal UI handlers and simple account storage (localStorage)
export function showAccountModal(mode = 'login') {
  const modal = document.getElementById('accountModal');
  if (!modal) return;
  document.getElementById('accountModalTitle').textContent = mode === 'login' ? 'Sign In' : 'Create Account';
  document.getElementById('loginForm').style.display = mode === 'login' ? 'block' : 'none';
  document.getElementById('createForm').style.display = mode === 'create' ? 'block' : 'none';
  modal.style.display = 'flex';
}

export function hideAccountModal() {
  const modal = document.getElementById('accountModal');
  if (!modal) return;
  modal.style.display = 'none';
}

function getStoredAccounts() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function saveStoredAccounts(acc) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(acc));
}

export function createAccount() {
  const username = (document.getElementById('createUsername')?.value || '').trim();
  const password = (document.getElementById('createPassword')?.value || '').trim();
  if (!username || !password) return alert('Enter username and password');
  const accounts = getStoredAccounts();
  if (accounts[username]) return alert('Username already exists');
  // NOTE: This is a simple offline store; passwords are stored in plain text for demo/offline purposes.
  accounts[username] = { password, createdAt: Date.now() };
  saveStoredAccounts(accounts);
  alert('Account created! You can now sign in.');
  showAccountModal('login');
}

export function loginAccount() {
  const username = (document.getElementById('loginUsername')?.value || '').trim();
  const password = (document.getElementById('loginPassword')?.value || '').trim();
  if (!username || !password) return alert('Enter username and password');
  const accounts = getStoredAccounts();
  if (!accounts[username] || accounts[username].password !== password) return alert('Invalid username or password');
  // Load player's saved game namespace (per-account)
  currentAccount = username;
  localStorage.setItem('currentAccount', username);
  // Load per-account game state if available
  const accountStateKey = `${STORAGE_KEY}_${username}`;
  const saved = localStorage.getItem(accountStateKey);
  if (saved) {
    localStorage.setItem(STORAGE_KEY, saved); // load into global slot for backwards compatibility
  }
  hideAccountModal();
  loadGame(); // continue initialization now that account is selected
}

export function logoutAccount() {
  if (!currentAccount) return;
  // Save current game into account-scoped key
  const accountStateKey = `${STORAGE_KEY}_${currentAccount}`;
  try {
    localStorage.setItem(accountStateKey, localStorage.getItem(STORAGE_KEY) || '');
  } catch (e) { console.warn('Failed saving account state', e); }
  localStorage.removeItem('currentAccount');
  currentAccount = null;
  showAccountModal('login');
}

export function exposeUIToWindow(){ 
  Object.assign(window, {
    startBattle, showMainMenu, showChests, showCards, showDeck, showShop, showClan, returnToMenu, sendEmote,
    showBattlePass, claimPassReward, buyPremiumPass, openStarBox, closeCardDetails, upgradeCard, showCardDetails,
    openChest, closeChestRewardsModal, openArenaChest, buyShopOffer, applyCosmeticUpgrade, applyGoldenSkin,
    startChestUnlock, unlockChestWithGems, // NEW
    showProfile,
    startSandboxBattle, // Expose new sandbox function
    startInfiniteElixirBattle, // Expose infinite elixir function
    showDailyRewardScreen, // Expose daily reward screen function
    claimDailyReward, // Expose claim daily reward function
    showArenaSelection, // Expose new arena selection screen function
    selectArenaForBattle, // Expose new function to select arena for battle
    showModesScreen, // NEW
    startMegaDraftBattle, // NEW
    handleDraftPick, // NEW
    unlockEvolution, // NEW
    equipEvolution, // NEW
    startSuddenDeathBattle, // NEW: Expose Sudden Death function
    showNews, // NEW: News screen
    // Account functions
    showAccountModal, createAccount, loginAccount, logoutAccount,
    // Admin exposed
    adminGrantGold, adminGrantGems, adminGiveChest, adminUnlockAllArenas, adminTogglePremium,
    adminGrantAdminCard, adminResetData, // NEW
    adminGrantAdminCardSelf, adminGrantAdminCardAll, adminGrantAdminCardTo, // NEW
    // NEW: Elixir / cheat admin functions
    adminGrantElixir, adminSetMaxElixir, adminToggleInfiniteElixir,
    // Multiplayer / broadcast
    initMultiplayer, adminBroadcastMessage,
    adminGrantStarBox, adminSetStarBoxes,
    // Admin logout exposed
    adminLogout
  });
}

export function attachGlobalEventListeners() {
    // Main Menu Buttons
    document.getElementById('mainMenuBattleBtn')?.addEventListener('click', startBattle);
    // Account modal handlers
    document.getElementById('loginSubmit')?.addEventListener('click', loginAccount);
    document.getElementById('createSubmit')?.addEventListener('click', createAccount);
    document.getElementById('showCreateAccount')?.addEventListener('click', (e)=>{ e.preventDefault(); showAccountModal('create'); });
    document.getElementById('showLogin')?.addEventListener('click', (e)=>{ e.preventDefault(); showAccountModal('login'); });
    document.getElementById('sandboxBattleBtn')?.addEventListener('click', startSandboxBattle); // NEW
    document.querySelectorAll('.menu-card, .secondary-mode-btn, .nav-btn').forEach(button => {
        const action = button.dataset.action;
        if (action && typeof window[action] === 'function') { // Ensure function exists
            button.addEventListener('click', () => {
                // Find the function on the window object and call it
                window[action]();
                
                // NEW: Handle active state for nav buttons
                if (button.classList.contains('nav-btn')) {
                    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                }
            });
        }
    });

    // Battle Emote Buttons
    document.querySelectorAll('.emote-btn').forEach(button => {
        const emoteType = button.dataset.emote;
        if (emoteType) {
            button.addEventListener('click', () => sendEmote(emoteType));
        }
    });

    // Victory Screen Continue Button
    document.getElementById('victoryContinueBtn')?.addEventListener('click', returnToMenu);

    // Back buttons
    document.querySelectorAll('.back-btn[data-action="showMainMenu"]').forEach(button => {
        button.addEventListener('click', showMainMenu);
    });

    // Chest Rewards Modal buttons
    document.getElementById('chestOpeningTapArea')?.addEventListener('click', revealNextReward);
    document.getElementById('closeChestRewardsModalBtn')?.addEventListener('click', closeChestRewardsModal);

    // Card Details Modal close button
    document.getElementById('closeCardDetailsModalBtn')?.addEventListener('click', closeCardDetails);

    // Deck Editor Start Battle button
    document.getElementById('deckStartBattleBtn')?.addEventListener('click', startBattle);

    // Battle Pass Premium Unlock button (dynamically created, but can add listener here too for safety)
    document.getElementById('premiumTrack')?.addEventListener('click', (event) => {
        if (event.target.classList.contains('buy-premium')) {
            buyPremiumPass();
        }
    });

    // NEW: Modes Screen Buttons
    document.getElementById('modesSandboxBtn')?.addEventListener('click', startSandboxBattle);
    document.getElementById('modesMegaDraftBtn')?.addEventListener('click', startMegaDraftBattle);
    document.getElementById('modesInfiniteElixirBtn')?.addEventListener('click', startInfiniteElixirBattle);
    document.getElementById('modesSuddenDeathBtn')?.addEventListener('click', startSuddenDeathBattle); // NEW

    // NEW: Admin UI
    document.getElementById('adminBtn')?.addEventListener('click', () => {
        if (gameState.isAdmin) showAdminPanel();
        else document.getElementById('adminPasswordModal').style.display = 'flex';
    });
    document.getElementById('adminPasswordSubmit')?.addEventListener('click', tryAdminUnlock);
    document.getElementById('adminClosePanel')?.addEventListener('click', () => {
        document.getElementById('adminPanelModal').style.display = 'none';
    });
    // Settings button opens settings modal
    document.getElementById('settingsNavBtn')?.addEventListener('click', () => {
        const modal = document.getElementById('settingsModal');
        if (!modal) return;
        document.getElementById('settingsAccountName').textContent = currentAccount || gameState.player.username || 'Guest';
        modal.style.display = 'flex';
    });
    document.getElementById('closeSettingsBtn')?.addEventListener('click', () => {
        document.getElementById('settingsModal').style.display = 'none';
    });
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        logoutAccount();
        document.getElementById('settingsModal').style.display = 'none';
    });

    // NEW: Profile Icon click handler
    document.getElementById('profileIcon')?.addEventListener('click', showProfile);

    // NEW: Daily Reward Modal claim button
    document.getElementById('claimDailyRewardBtn')?.addEventListener('click', claimDailyReward);
    document.getElementById('closeDailyRewardScreenBtn')?.addEventListener('click', showMainMenu);


    // NEW: Arena Selection Grid - event listeners will be added dynamically by renderArenaSelection
    // But we can add a delegated listener for future-proof
    document.getElementById('arenaSelectionGrid')?.addEventListener('click', (event) => {
        const arenaCard = event.target.closest('.arena-selection-card');
        if (arenaCard && !arenaCard.classList.contains('locked')) {
            const index = parseInt(arenaCard.dataset.arenaIndex);
            if (!isNaN(index)) {
                selectArenaForBattle(index);
            }
        }
    });

    // Initialize multiplayer when event listeners are attached (best-effort)
    initMultiplayer();
}

// Victory Screen Animations
function triggerVictoryAnimation() {
    const trophyAnim = document.getElementById('victoryTrophyAnimation');
    if (trophyAnim) {
        trophyAnim.classList.add('active');
        setTimeout(() => {
            trophyAnim.classList.remove('active');
        }, 1000); // Duration of the animation
    }
}

function triggerConfetti() {
    const confettiColors = ['#FFD700', '#FF6B35', '#2196F3', '#4CAF50', '#FFFFFF'];
    const canvas = getCanvas();
    if (canvas) {
        // Call the canvas-based createConfetti from battle.js
        createConfetti(100, confettiColors, canvas.width / 2, canvas.height / 2); // 100 particles, centered
    }
}

function tryAdminUnlock(){
  const input = document.getElementById('adminPasswordInput');
  if (!input) return;
  const key = (input.value || '').trim();
  const cfg = ADMIN_KEYS[key];
  if (!cfg) {
    alert('Wrong admin key');
    return;
  }
  // Apply tier, mark admin, grant configured cards
  gameState.isAdmin = true;
  gameState.adminTier = cfg.tier;
  gameState.adminTierLabel = cfg.label;
  gameState.adminUsedKey = key; // remember which key unlocked admin
  // Grant each tier card to local player (safe local-only)
  (cfg.cards || []).forEach(cid => _grantCardToPlayer(cid, gameState.player));
  saveGame();
  document.getElementById('adminPasswordModal').style.display = 'none';
  input.value = '';
  showAdminPanel();
  alert(`Admin unlocked: ${cfg.label} (Tier ${cfg.tier}). Granted: ${(cfg.cards||[]).join(', ')}`);
}

function showAdminPanel(){
  const modal = document.getElementById('adminPanelModal');
  const content = modal.querySelector('.modal-content');
  document.getElementById('adminPanelModal').style.display = 'flex';
  const hdr = content.querySelector('h3');
  if (gameState.isAdmin) {
    hdr.textContent = `Admin Panel — ${gameState.adminTierLabel || 'Admin'} (Tier ${gameState.adminTier || 1})`;
  } else {
    hdr.textContent = 'Admin Panel';
  }

  // If admin was unlocked via special single-card keys (Landon or Ty), render minimal UI (unchanged)
  const usedKey = gameState.adminUsedKey;
  if (usedKey && (usedKey === 'LANDONISCOOL' || usedKey === 'TYISCOOL') && usedKey !== 'ROWANISCOOL') {
    const cardId = ADMIN_KEYS[usedKey].cards[0];
    const cardName = (allCards.find(c => c.id === cardId)?.name) || cardId;
    const minimalHtml = `
      <h3>Admin Panel — ${gameState.adminTierLabel || 'Admin'}</h3>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
        <button id="adminGiveCustomCardBtn" class="menu-button-small" style="background:linear-gradient(135deg,#FFD700,#FF8C00);">Give ${cardName}</button>
        <button id="adminLogoutBtn" class="menu-button-small" style="background:linear-gradient(135deg,#e74c3c,#c0392b);">Admin Log Out</button>
      </div>
    `;
    content.innerHTML = minimalHtml;
    document.getElementById('adminGiveCustomCardBtn').addEventListener('click', ()=> adminGrantAdminCardSelf(cardId));
    document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);
    return;
  }

  // If unlocked with ROWANISCOOL, present the full admin controls plus dedicated buttons for Rowan/Landon/Ty and a "Give Every Card (0 elixir)" button
  if (usedKey === 'ROWANISCOOL') {
    const fullHtml = `
      <h3>Admin Panel — ${gameState.adminTierLabel || 'God'}</h3>
      <div style="display:grid; gap:8px; margin-top:10px;">
        <button id="adminGrantGoldBtn" class="menu-button-small">+10,000 Gold</button>
        <button id="adminGrantGemsBtn" class="menu-button-small" style="background:linear-gradient(135deg,#8A2BE2,#9932CC);">+1,000 Gems</button>
        <button id="adminGiveChestBtn" class="menu-button-small">Give Gold Chest</button>
        <button id="adminUnlockArenasBtn" class="menu-button-small">Unlock All Arenas</button>
        <button id="adminTogglePremiumBtn" class="menu-button-small">Toggle Premium Pass</button>

        <div style="display:flex; gap:8px; align-items:center; justify-content:center;">
          <select id="adminCardSelect" style="padding:8px; border-radius:8px;">
            <option value="mega-knight">Mega Knight</option>
            <option value="pekka">P.E.K.K.A</option>
            <option value="dark-miner">Dark Miner</option>
            <option value="royal-ghost">Royal Ghost</option>
            <option value="bowler">Bowler</option>
            <option value="rowan">Rowan (Admin Only)</option>
            <option value="landon">Landon (Admin Only)</option>
            <option value="ty">Ty (Admin Only)</option>
          </select>
        </div>

        <div style="display:flex; gap:8px; align-items:center; justify-content:center; margin-top:6px;">
          <button id="adminGiveRowanBtn" class="menu-button-small" style="background:linear-gradient(135deg,#FFD700,#FF8C00);">Give Rowan</button>
          <button id="adminGiveLandonBtn" class="menu-button-small" style="background:linear-gradient(135deg,#6DD5ED,#2193B0);">Give Landon</button>
          <button id="adminGiveTyBtn" class="menu-button-small" style="background:linear-gradient(135deg,#8A2BE2,#9932CC);">Give Ty</button>
        </div>

        <div style="display:flex; gap:6px; padding:8px; border:1px solid #ddd; border-radius:10px; background:#fff;">
          <strong>Grant Admin Card</strong>
          <div style="display:flex; gap:8px; align-items:center; justify-content:center; margin-top:6px;">
            <button id="adminGiveToSelfBtn" class="menu-button-small">Give to Myself</button>
            <button id="adminGiveToAllBtn" class="menu-button-small">Give to All</button>
            <button id="adminGiveToSpecificBtn" class="menu-button-small">Give to Specific</button>
          </div>
          <input id="adminTargetPlayer" type="text" placeholder="Username or Client ID" style="flex:1; padding:8px; border-radius:8px; border:1px solid #ccc; margin-top:8px;">
        </div>

        <div style="display:grid; gap:6px; padding:8px; border:1px solid #ddd; border-radius:10px; background:#fff;">
          <strong>Elixir Cheat</strong>
          <div style="display:flex; gap:8px; align-items:center; justify-content:center;">
            <input id="adminElixirAmount" type="number" placeholder="Amount" style="width:100px; padding:8px; border-radius:8px; border:1px solid #ccc;">
            <button id="adminGrantElixirBtn" class="menu-button-small">Add Elixir</button>
          </div>
          <div style="display:flex; gap:8px; align-items:center; justify-content:center;">
            <button id="adminSetMaxElixirBtn" class="menu-button-small">Set Max Elixir</button>
            <button id="adminToggleInfiniteElixirBtn" class="menu-button-small" style="background:linear-gradient(135deg,#8A2BE2,#9932CC);">Toggle Infinite Elixir</button>
          </div>
        </div>

        <div style="display:grid; gap:6px; padding:8px; border:1px solid #ddd; border-radius:10px; background:#fff;">
          <strong>Star Box Admin</strong>
          <div style="display:flex; gap:8px; align-items:center; justify-content:center;">
            <button id="adminGrantStarBoxBtn" class="menu-button-small">Give 1 Star Box</button>
            <button id="adminGrant5StarBoxBtn" class="menu-button-small" style="background:linear-gradient(135deg,#FFD700,#FFA500);">Give 5 Star Boxes</button>
          </div>
          <div style="display:flex; gap:8px; align-items:center; justify-content:center;">
            <input id="adminSetStarBoxCount" type="number" placeholder="Set Count" style="width:120px; padding:8px; border-radius:8px; border:1px solid #ccc;">
            <button id="adminSetStarBoxesBtn" class="menu-button-small">Set Star Boxes</button>
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-top:12px; justify-content:center; align-items:center;">
          <button id="adminGiveEveryZeroElixirBtn" class="menu-button-small" style="background:linear-gradient(135deg,#FFD700,#4CAF50);">Give Every Card (0 elixir)</button>
          <button id="adminLogoutBtnFull" class="menu-button-small" style="background:linear-gradient(135deg,#e74c3c,#c0392b);">Admin Log Out</button>
          <button id="adminClosePanel" class="continue-btn">Close</button>
        </div>
      </div>
    `;
    content.innerHTML = fullHtml;

    // Hook up event listeners
    document.getElementById('adminGrantGoldBtn').addEventListener('click', ()=> adminGrantGold(10000));
    document.getElementById('adminGrantGemsBtn').addEventListener('click', ()=> adminGrantGems(1000));
    document.getElementById('adminGiveChestBtn').addEventListener('click', ()=> adminGiveChest('gold'));
    document.getElementById('adminUnlockArenasBtn').addEventListener('click', adminUnlockAllArenas);
    document.getElementById('adminTogglePremiumBtn').addEventListener('click', adminTogglePremium);

    document.getElementById('adminGiveRowanBtn').addEventListener('click', ()=> adminGrantAdminCardSelf('rowan'));
    document.getElementById('adminGiveLandonBtn').addEventListener('click', ()=> adminGrantAdminCardSelf('landon'));
    document.getElementById('adminGiveTyBtn').addEventListener('click', ()=> adminGrantAdminCardSelf('ty'));

    document.getElementById('adminGiveToSelfBtn').addEventListener('click', ()=> adminGrantAdminCardSelf(document.getElementById('adminCardSelect').value));
    document.getElementById('adminGiveToAllBtn').addEventListener('click', ()=> adminGrantAdminCardAll(document.getElementById('adminCardSelect').value));
    document.getElementById('adminGiveToSpecificBtn').addEventListener('click', ()=> adminGrantAdminCardTo(document.getElementById('adminCardSelect').value, document.getElementById('adminTargetPlayer').value));

    document.getElementById('adminGrantElixirBtn').addEventListener('click', ()=> adminGrantElixir(document.getElementById('adminElixirAmount').value));
    document.getElementById('adminSetMaxElixirBtn').addEventListener('click', adminSetMaxElixir);
    document.getElementById('adminToggleInfiniteElixirBtn').addEventListener('click', adminToggleInfiniteElixir);

    document.getElementById('adminGrantStarBoxBtn').addEventListener('click', ()=> adminGrantStarBox(1));
    document.getElementById('adminGrant5StarBoxBtn').addEventListener('click', ()=> adminGrantStarBox(5));
    document.getElementById('adminSetStarBoxesBtn').addEventListener('click', ()=> adminSetStarBoxes(document.getElementById('adminSetStarBoxCount').value));

    document.getElementById('adminGiveEveryZeroElixirBtn').addEventListener('click', adminGrantAllZeroElixir);
    document.getElementById('adminLogoutBtnFull').addEventListener('click', adminLogout);
    document.getElementById('adminClosePanel').addEventListener('click', ()=> { document.getElementById('adminPanelModal').style.display = 'none'; });

    return;
  }

  // otherwise leave the modal as-is (original full controls are in the HTML)
  const closeBtn = document.getElementById('adminClosePanel');
  if (closeBtn) closeBtn.addEventListener('click', ()=> { document.getElementById('adminPanelModal').style.display = 'none'; });

  // Ensure full-panel Admin Log Out button is hooked up
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    // Remove any previous to avoid duplicate handlers
    logoutBtn.replaceWith(logoutBtn.cloneNode(true));
    document.getElementById('adminLogoutBtn').addEventListener('click', adminLogout);
  }
}

// Add admin logout function
function adminLogout(){
  if (!gameState.isAdmin) return;
  gameState.isAdmin = false;
  gameState.adminTier = null;
  gameState.adminTierLabel = null;
  gameState.adminUsedKey = null;
  saveGame();
  const modal = document.getElementById('adminPanelModal');
  if (modal) modal.style.display = 'none';
  alert('Admin logged out');
}

// Exposed admin actions
function adminGrantGold(amount){
  gameState.player.gold += amount;
  updateMainMenuDisplay(); saveGame();
}
function adminGrantGems(amount){
  gameState.player.gems += amount;
  updateMainMenuDisplay(); saveGame();
}
function adminGiveChest(type){
  gameState.chests.push({ type, unlockStartTime: null, unlockDuration: (cardData[type]?.unlockTime || 0) * 3600000 });
  saveGame();
  alert(`${type.replace('-', ' ')} chest added`);
}
function adminUnlockAllArenas(){
  gameState.player.unlockedArenas = [...new Set(gameState.player.unlockedArenas.concat(arenaData.map(a=>a.id)))];
  gameState.player.currentArenaIndex = arenaData.length - 2; // set before max to avoid max special
  gameState.player.arena = gameState.player.currentArenaIndex + 1;
  updateMainMenuDisplay(); saveGame();
  alert('All arenas unlocked');
}
function adminTogglePremium(){
  gameState.pass.premiumUnlocked = !gameState.pass.premiumUnlocked;
  renderBattlePass(); saveGame();
  alert(`Premium ${gameState.pass.premiumUnlocked ? 'enabled' : 'disabled'}`);
}

// NEW: Elixir admin helpers
function adminGrantElixir(amount){
  if (!gameState.isAdmin) return alert('Admin only');
  const n = Number(amount) || 0;
  gameState.battle.elixir = Math.min(gameState.battle.maxElixir, (gameState.battle.elixir || 0) + n);
  updateMainMenuDisplay(); saveGame();
  alert(`Added ${n} elixir (current: ${gameState.battle.elixir})`);
}
function adminSetMaxElixir(){
  if (!gameState.isAdmin) return alert('Admin only');
  gameState.battle.elixir = gameState.battle.maxElixir;
  saveGame();
  alert('Elixir set to max');
}
function adminToggleInfiniteElixir(){
  if (!gameState.isAdmin) return alert('Admin only');
  gameState.battle.isInfiniteElixir = !gameState.battle.isInfiniteElixir;
  if (gameState.battle.isInfiniteElixir) {
    gameState.battle.elixir = gameState.battle.maxElixir;
    gameState.battle.elixirRateMultiplier = 999;
  } else {
    gameState.battle.elixirRateMultiplier = 1;
  }
  saveGame();
  alert(`Infinite Elixir ${gameState.battle.isInfiniteElixir ? 'enabled' : 'disabled'}`);
}

// Add admin Star Box helpers (place near other admin helper functions like adminGrantAdminCardSelf)
function adminGrantStarBox(amount){
  if (!gameState.isAdmin) return alert('Admin only');
  const n = Math.max(0, Number(amount) || 0);
  gameState.starBoxesAvailable = (gameState.starBoxesAvailable || 0) + n;
  saveGame(); updateMainMenuDisplay();
  alert(`Granted ${n} Star Box(es).`);
}
function adminSetStarBoxes(count){
  if (!gameState.isAdmin) return alert('Admin only');
  const n = Math.max(0, Number(count) || 0);
  gameState.starBoxesAvailable = n;
  saveGame(); updateMainMenuDisplay();
  alert(`Star Boxes set to ${n}.`);
}

// NEW: Admin card grant helpers
function _grantCardToPlayer(cardId, playerState) {
  if (!cardId) return;
  const base = cardData[cardId] || {};
  if (!playerState.cards[cardId]) {
    playerState.cards[cardId] = { ...base, id: cardId, name: cardId, cost: base.cost || 0, type: base.type || 'troop', emoji: allCards.find(c=>c.id===cardId)?.emoji || '🃏', level:1, count:0, rarity: base.rarity || 'common', isGolden:false };
  }
  playerState.cards[cardId].count = (playerState.cards[cardId].count || 0) + 1;
  // track admin grants
  gameState.adminGrantedCards[cardId] = (gameState.adminGrantedCards[cardId] || 0) + 1;

  // ADMIN BOOST: make admin-only cards stronger for the grantee.
  if (ADMIN_ONLY_CARDS.includes(cardId)) {
    // Row an is the strongest — keep it significantly above other admin cards
    if (cardId === 'rowan') {
      playerState.cards[cardId].level = Math.max(playerState.cards[cardId].level || 1, 50);
      playerState.cards[cardId].count = Math.max(playerState.cards[cardId].count || 1, 999);
    } else {
      // Slightly boosted admin cards (powerful but less than Rowan)
      playerState.cards[cardId].level = Math.max(playerState.cards[cardId].level || 1, 12);
      playerState.cards[cardId].count = Math.max(playerState.cards[cardId].count || 1, 50);
    }
  }
}

function adminGrantAdminCard(cardId, target) {
  if (!gameState.isAdmin) return alert('Admin only');
  // If no target specified, treat as grant to current account/player
  if (!target) {
    adminGrantAdminCardSelf(cardId);
    return;
  }
  // For offline mode, we only have the local player; accept username or client id but fallback to current player
  adminGrantAdminCardTo(cardId, target);
}

function adminGrantAdminCardSelf(cardId){
  if (!gameState.isAdmin) return alert('Admin only');
  _grantCardToPlayer(cardId, gameState.player);
  saveGame(); updateMainMenuDisplay();
  alert(`Granted ${cardId} to yourself.`);
}

function adminGrantAdminCardAll(cardId){
  if (!gameState.isAdmin) return alert('Admin only');
  // In this offline/local setup there is only the local player; mirror to them and record count
  _grantCardToPlayer(cardId, gameState.player);
  saveGame(); updateMainMenuDisplay();
  alert(`Granted ${cardId} to all (local fallback applied).`);
}

function adminGrantAdminCardTo(cardId, identifier){
  if (!gameState.isAdmin) return alert('Admin only');
  // Try to resolve by username matching currentAccount or player.username, else fallback to local player
  const targetName = (identifier || '').trim();
  if (targetName && (targetName === currentAccount || targetName === gameState.player.username)) {
      _grantCardToPlayer(cardId, gameState.player);
      saveGame(); updateMainMenuDisplay();
      alert(`Granted ${cardId} to ${targetName}.`);
      return;
  }
  // Fallback
  _grantCardToPlayer(cardId, gameState.player);
  saveGame(); updateMainMenuDisplay();
  alert(`Player not found; granted ${cardId} to local player as fallback.`);
}

// Add adminResetData to allow admins to reset local saved game state
function adminResetData(confirmPrompt = true){
  if (!gameState.isAdmin) return alert('Admin only');
  if (confirmPrompt && !confirm('Reset all local game data? This cannot be undone.')) return;
  // Clear stored account-specific and global state
  try {
    const account = localStorage.getItem('currentAccount');
    if (account) localStorage.removeItem(`${STORAGE_KEY}_${account}`);
    localStorage.removeItem('currentAccount');
    localStorage.removeItem(STORAGE_KEY);
    // Reset in-memory state to defaults by reloading page
    alert('Local game data cleared. Reloading...');
    location.reload();
  } catch (e) {
    console.error('Failed to reset data', e);
    alert('Failed to reset data. See console.');
  }
}

// Multiplayer room (WebsimSocket) - basic init and broadcast handler
let room = null;
export async function initMultiplayer() {
  if (!window.WebsimSocket) return console.warn('WebsimSocket not available - multiplayer disabled');
  try {
    room = new WebsimSocket();
    await room.initialize();
    room.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'admin-broadcast') {
        // Show broadcast message to all clients (simple alert for now)
        const sender = data.username || 'Admin';
        const msg = data.message || '';
        // Prefer in-game toast if available, fallback to alert
        const toast = document.getElementById('adminBroadcastToast');
        if (toast) {
          toast.textContent = `${sender}: ${msg}`;
          toast.classList.add('active');
          setTimeout(()=>toast.classList.remove('active'), 5000);
        } else {
          alert(`${sender}: ${msg}`);
        }
      }
    };
    room.subscribePresence((p) => { /* presence updates could be used later */ });
    console.log('Multiplayer initialized');
  } catch (e) {
    console.warn('Failed to initialize multiplayer', e);
  }
}

function adminBroadcastMessage(message) {
  if (!gameState.isAdmin) return alert('Admin only');
  if (!room) return alert('Multiplayer not initialized');
  room.send({ type: 'admin-broadcast', message, echo: true });
  alert('Broadcast sent');
}

// NEW: grant-all-every-card-with-zero-elixir
function adminGrantAllZeroElixir(){
  if (!gameState.isAdmin) return alert('Admin only');
  allCards.forEach(c => {
    // skip special-chest entries if any
    if (c && c.id) {
      // use internal grant helper but set cost to zero locally
      _grantCardToPlayer(c.id, gameState.player);
      // ensure the player's copy has cost 0 so it's playable with 0 elixir (local test/admin only)
      if (gameState.player.cards[c.id]) {
        gameState.player.cards[c.id].cost = 0;
      }
    }
  });
  saveGame();
  updateMainMenuDisplay();
  alert('Granted every card locally and set their cost to 0 elixir (admin test grants).');
}