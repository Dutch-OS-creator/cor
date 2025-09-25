import { gameState, getCanvas, allCards, cardData } from './state.js';
import { createUnit, castSpell } from './battle.js';
import { playSound } from './audio.js';

const RESTRICTED_CARDS_EARLY_ARENAS = ['pekka', 'mega-knight', 'dark-knight', 'skeleton-army', 'dark-miner', 'freeze', 'poison'];
const ARENA_RESTRICTION_THRESHOLD = 4; // Arenas 1-4 (indices 0-3)

export function spawnAI(){
  // Only schedule next spawn if in battle screen
  if (gameState.screen === 'battleScreen'){
    setTimeout(()=>{
      const shouldSpawn = Math.random() < 0.8; // Increased chance for enemy to spawn
      if (shouldSpawn){
        const canvas = getCanvas();
        let availableEnemyCards = [];

        // NEW: Check if it's a Mega Draft game. If so, use the drafted deck for the AI.
        if (gameState.draft.isActive && gameState.draft.enemyDeck.length > 0) {
            availableEnemyCards = gameState.draft.enemyDeck.map(cardId => allCards.find(c => c.id === cardId)).filter(Boolean);
        } else {
            // Adjust enemy card selection logic
            availableEnemyCards = allCards.filter(c => 
              (c.type === 'troop' || c.type === 'building' || c.type === 'spell') && 
              c.id !== 'the-log' // AI doesn't use log yet, which needs more sophisticated targeting
            );

            // NEW: Filter out restricted cards for early arenas
            if (gameState.player.currentArenaIndex < ARENA_RESTRICTION_THRESHOLD) {
              availableEnemyCards = availableEnemyCards.filter(c => !RESTRICTED_CARDS_EARLY_ARENAS.includes(c.id));
            }

            // NEW: Ensure admin-only custom cards are never chosen by AI
            const ADMIN_ONLY_IDS = ['rowan','landon','ty'];
            availableEnemyCards = availableEnemyCards.filter(c => !ADMIN_ONLY_IDS.includes(c.id));
        }

        if (availableEnemyCards.length === 0) {
            console.warn("No available enemy cards for AI to spawn!");
            spawnAI(); // Still try to schedule next spawn
            return;
        }

        const c = availableEnemyCards[Math.floor(Math.random()*availableEnemyCards.length)];
        if (c){
          let x = Math.random()*canvas.width;
          let y;
          const isSpell = cardData[c.id].type === 'spell';

          // AI specific deployment logic
          if (isSpell) {
            // For AI spells, target player's territory more aggressively
            // Target between river (H*0.5) and player's king tower (H*0.85)
            const playerKingTower = gameState.battle.towers.player.find(t => t.king);
            const riverY = canvas.height * 0.5;
            y = Math.random() * (playerKingTower.y - riverY) + riverY;
          } else {
            // For AI troops/buildings, keep it in enemy territory (top half)
            y = Math.random()*(canvas.height*0.4 - 50) + 50; // Keep it in enemy territory
          }

          // Give AI troops slightly higher levels (simple example, can be more complex)
          // AI level scales with player's arena, max level 5 now and starts with a higher edge
          const aiLevel = Math.min(5, gameState.player.currentArenaIndex + 2); 
          
          // NEW: Correctly handle spells vs. troops/buildings
          if (isSpell) {
            castSpell(c.id, x, y, 'enemy');
            playSound('shot'); // Generic spell sound for AI cast
          } else {
            const unit = createUnit(c.id, x, y, 'enemy'); 
            // Override stats with AI's calculated level
            const data = cardData[c.id]; // Get base data again for level calculations
            if (data.hp) { unit.hp = data.hp * (1 + (aiLevel - 1) * 0.1); unit.maxHp = unit.hp; }
            if (data.damage) { unit.damage = data.damage * (1 + (aiLevel - 1) * 0.1); }

            gameState.battle.troops.push(unit);
            playSound('spawn');
          }
        }
      }
      spawnAI(); // Schedule the next spawn with a shorter, more consistent delay
    }, 3000 + Math.random()*3000); // 3-6 seconds delay for more AI spawns
  }
}