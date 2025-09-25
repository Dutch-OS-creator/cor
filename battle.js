import { gameState, cardData, setCanvas, getCanvas, setCtx, getCtx, BRIDGE_HALF, BRIDGES } from './state.js';
import { renderBattle, getCardEmoji } from './render.js';
import { dist } from './utils.js';
import { playSound, startMusic, stopMusic } from './audio.js';
import { spawnAI } from './ai.js';
import { endBattle, saveGame, checkArenaProgression } from './ui.js';

let battleInterval, elixirInterval, timerInterval;

// NEW: Define restricted cards and the arena threshold
const RESTRICTED_CARDS_EARLY_ARENAS = ['pekka', 'mega-knight', 'dark-knight', 'skeleton-army', 'dark-miner', 'freeze', 'poison'];
const ARENA_RESTRICTION_THRESHOLD = 4; // Arenas 1-4 (indices 0-3)

export function initGame() {
  const canvas = document.getElementById('battleCanvas');
  setCanvas(canvas); setCtx(canvas.getContext('2d'));
  resizeCanvas(); window.addEventListener('resize', resizeCanvas);
  canvas.addEventListener('mousedown', handleMouseDown);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('mouseup', handleMouseUp);
}

function resizeCanvas() { const c = getCanvas(); c.width = window.innerWidth; c.height = window.innerHeight; }

export function setupCardHand() {
  const cardHandContainer = document.querySelector('.card-hand');
  cardHandContainer.innerHTML = ''; // Clear previous hand cards

  for (let i = 0; i < 4; i++) {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');
    cardEl.dataset.handIndex = i;
    cardEl.innerHTML = `
      <div class="card-cost-banner"><span class="card-cost"></span></div>
      <div class="card-art"></div>
      <div class="card-name-banner"></div>
    `;
    cardEl.addEventListener('click', (event) => {
      // Prevent mousedown on canvas from deploying immediately when clicking card
      event.stopPropagation(); 
      selectCard(cardEl)
    });
    cardHandContainer.appendChild(cardEl);
  }
  updateCardDisplay(); // Initial display of cards
}

export function selectCard(cardElement) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
  const cardType = cardElement.dataset.type; const cardCost = parseInt(cardElement.dataset.cost);
  if (gameState.battle.elixir >= cardCost) {
    cardElement.classList.add('selected');
    gameState.battle.selectedCard = { type: cardType, cost: cardCost, element: cardElement, handIndex: parseInt(cardElement.dataset.handIndex) };
    // Clear hover target if a new card is selected
    gameState.battle.hoverTarget = null;
  }
}

// NEW: Mouse event handlers for card placement visuals
function handleMouseDown(e) {
  if (!gameState.battle.selectedCard) return;
  const rect = getCanvas().getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const cardType = gameState.battle.selectedCard.type;
  const cardBaseData = cardData[cardType];
  if (!cardBaseData) {
    console.error(`Card data not found for card type: ${cardType}. Aborting deployment.`);
    // Deselect card to prevent further errors
    gameState.battle.selectedCard.element.classList.remove('selected');
    gameState.battle.selectedCard = null;
    gameState.battle.hoverTarget = null;
    return;
  }
  const isBuilding = cardBaseData.type === 'building';
  const isSpell = cardBaseData.type === 'spell';

  let radius = 0;
  if (cardType === 'the-log') {
    radius = (cardBaseData.width || 80) / 2; // Approximate half-width for placement indicator
  } else if (isSpell) { // For Fireball, Zap, Freeze, Poison, Goblin Barrel
    radius = (cardBaseData.radius || 2.5) * 30; // Spells have a radius, scaled to pixels
  } else if (isBuilding) {
    radius = 30; // Default visual radius for buildings
  }
  else {
    radius = 20; // Default visual radius for troops
  }
  
  gameState.battle.hoverTarget = { x, y, radius, type: cardType };
}

function handleMouseMove(e) {
  if (!gameState.battle.selectedCard || !gameState.battle.hoverTarget) return;
  const rect = getCanvas().getBoundingClientRect();
  gameState.battle.hoverTarget.x = e.clientX - rect.left;
  gameState.battle.hoverTarget.y = e.clientY - rect.top;
}

function handleMouseUp(e) {
  if (!gameState.battle.selectedCard || !gameState.battle.hoverTarget) return;

  const rect = getCanvas().getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  // NEW: Special placement rules for certain cards
  const cardType = gameState.battle.selectedCard.type;
  const cardBaseData = cardData[cardType];
  if (!cardBaseData) {
    console.error(`Card data not found for card type: ${cardType}. Aborting deployment.`);
    // Deselect card to prevent further errors
    gameState.battle.selectedCard.element.classList.remove('selected');
    gameState.battle.selectedCard = null;
    gameState.battle.hoverTarget = null;
    return;
  }
  const canPlaceAnywhere = ['goblin-barrel', 'freeze', 'miner'].includes(cardType) || cardBaseData.deployAnywhere;

  // Check against playerDeploymentYBoundary, unless the card can be placed anywhere
  if (canPlaceAnywhere || y >= gameState.battle.playerDeploymentYBoundary) {
    deployCard(x, y, gameState.battle.selectedCard);
  } else {
    // If not a valid deployment zone, just deselect the card
    gameState.battle.selectedCard.element.classList.remove('selected');
    gameState.battle.selectedCard = null;
  }
  gameState.battle.hoverTarget = null; // Clear hover target after deployment attempt
}

export function deployCard(x, y, cardInfo) {
  if (gameState.battle.elixir < cardInfo.cost) return;

  // NEW: Prevent deployment of restricted cards in early arenas for player
  if (gameState.player.currentArenaIndex < ARENA_RESTRICTION_THRESHOLD && RESTRICTED_CARDS_EARLY_ARENAS.includes(cardInfo.type)) {
      alert(`Card "${cardInfo.type}" cannot be played in Arena ${gameState.player.currentArenaIndex + 1}.`);
      cardInfo.element.classList.remove('selected');
      gameState.battle.selectedCard = null;
      gameState.battle.hoverTarget = null;
      return;
  }

  // NEW: Evolution logic
  let isEvolvedDeployment = false;
  if (cardInfo.type === gameState.battle.evoState.cardId && gameState.battle.evoState.currentCycles <= 0) {
    isEvolvedDeployment = true;
  }

  gameState.battle.elixir -= cardInfo.cost; updateElixirDisplay();
  const cardBaseData = cardData[cardInfo.type];

  if (cardBaseData.type === 'spell') {
    castSpell(cardInfo.type, x, y, 'player');
    // Specific sound for each spell
    if (cardInfo.type === 'freeze') playSound('freeze');
    else if (cardInfo.type === 'poison') playSound('poison');
    else playSound('shot'); // Generic spell sound
  } else if (cardBaseData.type === 'building') {
    const building = createUnit(cardInfo.type, x, y, 'player', isEvolvedDeployment); // Use createUnit for buildings too
    gameState.battle.buildings.push(building); // Add to buildings array
    playSound('spawn');
  } else { // Troop type
    const unitCount = cardBaseData.count || 1; // Default to 1 if not specified
    for (let i = 0; i < unitCount; i++) {
      // Spawn units with slight random offset for spread
      const spawnX = x + (Math.random() - 0.5) * 40;
      const spawnY = y + (Math.random() - 0.5) * 40;
      const unit = createUnit(cardInfo.type, spawnX, spawnY, 'player', isEvolvedDeployment);
      gameState.battle.troops.push(unit);
    }
    playSound('spawn');
  }

  // Update evo cycle
  if (cardInfo.type === gameState.battle.evoState.cardId) {
    if (isEvolvedDeployment) {
      // Reset after using
      gameState.battle.evoState.currentCycles = gameState.battle.evoState.cyclesNeeded;
    } else if (gameState.battle.evoState.currentCycles > 0) {
      gameState.battle.evoState.currentCycles--;
    }
  }

  cardInfo.element.classList.remove('selected'); gameState.battle.selectedCard = null;
  cycleCard(cardInfo.handIndex); 
  updateCardDisabledStates();
}

export function createUnit(type, x, y, owner, isEvolved = false) {
  const data = cardData[type];
  const playerCard = gameState.player.cards[type];
  const level = playerCard ? playerCard.level : 1; // Get player's card level
  // Apply level scaling (simple example: 10% increase per level)
  // Ensure initial data.hp and data.damage are the base values for a single unit
  let hp = data.hp * (1 + (level - 1) * 0.1);
  let damage = data.damage * (1 + (level - 1) * 0.1) * 0.9; // Apply 0.9 damage multiplier

  // NEW: Apply golden skin boost if applicable (only for player units)
  if (owner === 'player' && playerCard && playerCard.isGolden && data.goldenBoost) {
      hp *= data.goldenBoost.hp;
      damage *= data.goldenBoost.damage;
  }

  const newUnit = { 
    id: Math.random().toString(36), 
    type, x, y, 
    hp, maxHp: hp, damage, 
    speed: data.speed || 0, 
    range: data.range || 1, 
    owner, 
    target: null, 
    lastAttack: 0, 
    attackSpeed: data.attackSpeed || 1000,
    collisionRadius: data.collisionRadius || 25, // NEW: Add collision radius, default 25px
    isFrozen: false, // NEW: For freeze spell effect
    frozenUntil: 0,
    isPoisoned: false, // NEW: For poison spell effect
    poisonedUntil: 0, // NEW: When poison effect should visually end
    // NEW: For Prince's charge
    isCharging: false,
    moveDistance: 0,
    stun: data.stun || 0, // NEW: Add stun duration for Electro Wizard or other units
    // NEW: For Barbarians evolution rage
    hasHitTarget: false, 
    isRaging: false,
    rageUntil: 0,
  };

  // NEW: Apply evolution properties
  if (isEvolved && data.evolution) {
    const evo = data.evolution.boost;
    if (evo.damage) damage *= evo.damage;
    if (evo.hp) hp *= evo.hp;
    if (evo.range) newUnit.range *= evo.range;

    newUnit.isEvolved = true;
    newUnit.evolution = evo; // Store evo data for abilities

    // Specific evo abilities setup
    if (type === 'knight' && evo.shieldHp) {
      newUnit.shieldHp = evo.shieldHp;
      newUnit.maxShieldHp = evo.shieldHp;
      newUnit.shieldActive = false; // Shield only active when moving
    }
    if (type === 'skeletons' && evo.spawnInterval) {
        newUnit.lastSpawn = performance.now();
        newUnit.spawnedSkeletons = 0; // Track spawned count for this unit
    }
  }

  // NEW: Add specific properties for Witch or any unit-spawning buildings
  if (type === 'witch' || type === 'goblin-hut') { // Added goblin-hut
    newUnit.lastSpawn = performance.now(); // Initialize last spawn time
    newUnit.spawnInterval = data.spawnInterval;
    newUnit.spawnCount = data.spawnCount;
    newUnit.spawnCard = data.spawnCard;
  }

  // Add lifetime for buildings
  if (data.type === 'building') {
    newUnit.spawnTime = performance.now();
    newUnit.lifetime = data.lifetime;
    newUnit.destroyed = false; // Flag to indicate if building is destroyed
  }

  return newUnit;
}

export function cycleCard(handIndex) {
  const playedCardId = gameState.battle.hand[handIndex].id;
  
  // Add the played card back to the end of the draw queue to complete the cycle.
  gameState.battle.drawQueue.push(playedCardId);

  // Get the next card from the front of the queue.
  const nextCardId = gameState.battle.drawQueue.shift();
  
  // This check prevents a crash if the draw queue is unexpectedly empty or contains an invalid card.
  if (!nextCardId || !gameState.player.cards[nextCardId]) {
    console.error("Error cycling card: next card is invalid or missing.", nextCardId);
    // As a fallback, try to draw another card. If still fails, log and exit.
    const fallbackCardId = gameState.battle.drawQueue.shift();
    if (!fallbackCardId || !gameState.player.cards[fallbackCardId]) {
      console.error("Fallback failed. Halting card cycle.");
      return;
    }
    gameState.battle.hand[handIndex] = gameState.player.cards[fallbackCardId];
  } else {
    gameState.battle.hand[handIndex] = gameState.player.cards[nextCardId];
  }


  const newCardInHand = gameState.battle.hand[handIndex];
  const el = document.querySelector(`.card[data-hand-index="${handIndex}"]`);
  el.dataset.type = newCardInHand.id;
  el.dataset.cost = newCardInHand.cost;
  el.querySelector('.card-cost').textContent = newCardInHand.cost;
  el.querySelector('.card-art').textContent = newCardInHand.emoji;
  el.querySelector('.card-name-banner').textContent = newCardInHand.name;
  // NEW: toggle golden styling on cycled-in card
  el.classList.toggle('golden', !!newCardInHand.isGolden);

  // NEW: Check for evolved state
  const isEvoReady = newCardInHand.id === gameState.battle.evoState.cardId && gameState.battle.evoState.currentCycles <= 0;
  el.classList.toggle('evolved', isEvoReady);

  updateNextCardDisplay();
}

export function updateNextCardDisplay() {
  const nextCardId = gameState.battle.drawQueue[0];
  const nextCardEl = document.getElementById('nextCard');
  if (nextCardId && nextCardEl) {
    const nextCardData = gameState.player.cards[nextCardId];
    // Add a defensive check to prevent the crash
    if (nextCardData) {
        nextCardEl.querySelector('.card-cost').textContent = nextCardData.cost;
        nextCardEl.querySelector('.card-art').textContent = nextCardData.emoji;
        // NEW: toggle golden styling on next-card preview
        nextCardEl.classList.toggle('golden', !!nextCardData.isGolden);
    } else {
        console.warn(`Next card data not found for ID: ${nextCardId}. This could be due to arena restrictions.`);
        nextCardEl.querySelector('.card-cost').textContent = '?';
        nextCardEl.querySelector('.card-art').textContent = '?';
    }
  } else if (nextCardEl) { // If draw queue is empty, show empty next card
    nextCardEl.querySelector('.card-cost').textContent = '?';
    nextCardEl.querySelector('.card-art').textContent = '?';
  }
}

export function startElixirGeneration() {
  if (elixirInterval) clearInterval(elixirInterval);
  elixirInterval = setInterval(() => {
    if (gameState.battle.elixir < gameState.battle.maxElixir) {
      gameState.battle.elixir = Math.min(gameState.battle.maxElixir, gameState.battle.elixir + 1);
      updateElixirDisplay();
    }
  }, gameState.battle.elixirRate);
}

export function updateElixirDisplay() {
  const elixirBar = document.querySelector('.elixir-bar');
  const elixirCount = document.getElementById('elixirCount');
  const elixir = Math.floor(gameState.battle.elixir);

  elixirCount.textContent = elixir;

  for (let i = 0; i < 10; i++) {
      const pip = elixirBar.children[i];
      if (pip) {
          pip.classList.toggle('active', i < elixir);
      }
  }
  updateCardDisabledStates();
}

export function startBattleLoop() {
  battleInterval = setInterval(() => { updateBattleState(); renderBattle(); }, 1000 / 60);
}

function updateBattleState() {
  const now = performance.now();
  updateTroops(now);
  updateBuildings(now); // NEW: Update deployable buildings
  updateSpells(now); // Process ongoing spell effects
  updateProjectiles();
  
  // Filter out dead troops and buildings
  gameState.battle.troops = gameState.battle.troops.filter(t => t.hp > 0);
  gameState.battle.buildings = gameState.battle.buildings.filter(b => b.hp > 0 && !b.destroyed); // Filter out destroyed buildings
  checkTowerStates();
  updateHUD(); // NEW: Update the HUD health bars
}

// NEW: updateTroops function to process troop logic
function updateTroops(now) {
  gameState.battle.troops.forEach(t => {
    if (t.hp <= 0) return; // Skip dead troops

    // 1. Check for freeze effect
    if (t.isFrozen && now < t.frozenUntil) {
      return; // Troop is frozen, skip movement and attacking
    } else if (t.isFrozen && now >= t.frozenUntil) {
      t.isFrozen = false;
      t.frozenUntil = 0;
    }

    // 2. Check for poison effect (only for visuals; damage applied by updateSpells)
    if (t.isPoisoned && now >= t.poisonedUntil) {
      t.isPoisoned = false;
      t.poisonedUntil = 0;
    }

    // 3. Handle specific troop mechanics (unit spawning, evolutions)
    const baseCard = cardData[t.type];
    
    // Witch and other unit-spawning troops
    if (baseCard && baseCard.spawnCard && t.hp > 0 && !t.isFrozen) { // Only spawn if not frozen
        if (!t.lastSpawn || (now - t.lastSpawn) > t.spawnInterval) {
            for (let i = 0; i < t.spawnCount; i++) {
                const spawnX = t.x + (Math.random() - 0.5) * 30;
                const spawnY = t.y + (Math.random() - 0.5) * 30;
                const spawnedUnit = createUnit(baseCard.spawnCard, spawnX, spawnY, t.owner);
                gameState.battle.troops.push(spawnedUnit);
            }
            t.lastSpawn = now;
            playSound('spawn');
        }
    }
    // Evolved Skeletons continuous spawn
    if (t.isEvolved && t.type === 'skeletons' && t.evolution && t.evolution.spawnInterval && t.spawnedSkeletons < t.evolution.maxSpawn && !t.isFrozen) {
        if (!t.lastSpawn || (now - t.lastSpawn) > t.evolution.spawnInterval) {
            const spawnX = t.x + (Math.random() - 0.5) * 20;
            const spawnY = t.y + (Math.random() - 0.5) * 20;
            const spawnedUnit = createUnit('skeletons', spawnX, spawnY, t.owner); // Spawn regular skeletons
            gameState.battle.troops.push(spawnedUnit);
            t.lastSpawn = now;
            t.spawnedSkeletons++;
            playSound('spawn');
        }
    }
    // Evolved Barbarians Rage: Apply on first hit
    if (t.isEvolved && t.type === 'barbarians' && t.isRaging && now >= t.rageUntil) {
        t.isRaging = false;
        // Revert speed and attack speed to original values (might need to store original values)
        // For simplicity, let's assume direct division by multiplier is fine for now
        t.speed /= t.evolution.boost.speedMultiplier;
        t.attackSpeed /= t.evolution.boost.attackSpeedMultiplier;
    }

    // 4. Target acquisition (enemy troops, buildings, then towers)
    let target = null;

    // Preserve current tower target if unit is actively attacking that tower
    const unitRange = (cardData[t.type]?.range || 1) * 30;
    const currentlyHasTowerTarget = t.target && typeof t.target.king === 'boolean';
    if (currentlyHasTowerTarget && dist(t.x, t.y, t.target.x, t.target.y) <= unitRange) {
        // Keep current tower target (don't retarget to newly placed enemy units)
        target = t.target;
    } else {
        const allEnemies = gameState.battle.troops.filter(u => u.owner !== t.owner && u.hp > 0 && (baseCard.targets === 'both' || !u.flying))
                                    .concat(gameState.battle.buildings.filter(b => b.owner !== t.owner && b.hp > 0 && (baseCard.targets === 'both' || !b.flying)));

        if (allEnemies.length > 0) {
            target = findClosestTarget(t, allEnemies);
        }

        // If no troop/building target, target towers
        if (!target) {
            const enemyTowers = gameState.battle.towers[t.owner === 'player' ? 'enemy' : 'player']
                                    .filter(tower => tower.hp > 0); // Only target active towers

            // Prioritize princess towers over king tower if they are active
            const princessTowers = enemyTowers.filter(tw => !tw.king && !tw.destroyed);
            if (princessTowers.length > 0) {
                target = findClosestTarget(t, princessTowers);
            } else { // Target king tower if princess towers are destroyed or if unit explicitly targets buildings (like hog)
                const kingTower = enemyTowers.find(tw => tw.king);
                if (kingTower && kingTower.hp > 0) {
                    const targetBuildingsOnly = baseCard.targets === 'buildings';
                    const allPrincessTowersDestroyed = enemyTowers.filter(tw => !tw.king).every(pt => pt.hp <= 0);

                    if (targetBuildingsOnly || allPrincessTowersDestroyed) {
                        target = kingTower;
                    }
                }
            }
        }
    }

    t.target = target; // Set target for rendering/debugging

    // 5. Move towards or attack target
    if (target && !t.isFrozen) { // Do not move or attack if frozen
        pathfindAndAttack(t, target, now);
    } else {
        // If no target or frozen, unit might just stand still
        // Evolved Knight stops moving, deactivate shield
        if (t.isEvolved && t.type === 'knight') {
            t.shieldActive = false;
        }
        if (t.isCharging) {
          t.isCharging = false;
          t.moveDistance = 0;
        }
    }
  });
}

function updateBuildings(now) {
  gameState.battle.buildings.forEach(b => {
    // Check for lifetime expiration
    if (b.lifetime && (now - b.spawnTime) > b.lifetime) {
        b.hp = 0; // Mark for removal
        b.destroyed = true;
        return;
    }

    // Check for freeze effect
    if (b.isFrozen && now < b.frozenUntil) {
        return; // Building is frozen, skip logic
    } else if (b.isFrozen && now >= b.frozenUntil) {
        b.isFrozen = false;
        b.frozenUntil = 0;
    }

    // Check for poison effect (only for visuals; damage applied by updateSpells)
    if (b.isPoisoned && now >= b.poisonedUntil) {
      b.isPoisoned = false;
      b.poisonedUntil = 0;
    }

    const baseCard = cardData[b.type];

    // Handle unit spawning for spawner buildings
    if (baseCard.spawnCard && b.hp > 0 && !b.isFrozen) { // Only spawn if not frozen
        if (!b.lastSpawn || (now - b.lastSpawn) > b.spawnInterval) {
            for (let i = 0; i < b.spawnCount; i++) {
                const spawnX = b.x + (Math.random() - 0.5) * 30;
                const spawnY = b.y + (Math.random() - 0.5) * 30;
                const spawnedUnit = createUnit(b.spawnCard, spawnX, spawnY, b.owner);
                gameState.battle.troops.push(spawnedUnit);
            }
            b.lastSpawn = now;
            playSound('spawn');
        }
    }

    // Handle attacking for defensive buildings
    if (baseCard.damage > 0 && !b.isFrozen) { // Only attack if not frozen
        const potentialTargets = gameState.battle.troops.filter(t => t.owner !== b.owner && t.hp > 0 && (baseCard.targets === 'both' || !t.flying));
        const target = findClosestTarget(b, potentialTargets);

        if (target) {
            const buildingRange = (baseCard.range || 1) * 30;
            if (dist(b.x, b.y, target.x, target.y) <= buildingRange) {
                if (!b.lastAttack || now - b.lastAttack > b.attackSpeed) {
                    // Buildings are ranged and fire projectiles
                    const projectileOptions = { from: 'building' };
                    fireProjectile(b.x, b.y, target, b.damage, b.owner, projectileOptions);
                    b.lastAttack = now;
                }
            }
        }
    }
  });
}

// New function to update spells
export function updateSpells(now) {
  // Filter out expired spells
  gameState.battle.spells = gameState.battle.spells.filter(s => now - s.startTime < s.duration);

  gameState.battle.spells.forEach(s => {
    if (s.type === 'the-log') {
      // Log rolls forward (towards enemy side)
      if (s.owner === 'player') {
        s.y -= s.speed;
      } else { // AI log
        s.y += s.speed;
      }
      s.rotation += 0.1; // Rotate for rolling effect

      // Collect all potential targets: enemy troops, enemy buildings, and ALIVE enemy towers (except king tower initially)
      const potentialTargets = gameState.battle.troops.filter(t => t.owner !== s.owner && t.hp > 0)
        .concat(gameState.battle.buildings.filter(b => b.owner !== s.owner && b.hp > 0))
        .concat(gameState.battle.towers[s.owner === 'player' ? 'enemy' : 'player'].filter(t => t.hp > 0 && !t.king)); // <-- Filter here, and king tower specific logic is fine

      potentialTargets.forEach(target => {
        // Simple rectangular collision detection for the log (or use its current position)
        const logRight = s.x + s.width / 2;
        const logLeft = s.x - s.width / 2;
        const logBottom = s.y + s.height / 2;
        const logTop = s.y - s.height / 2;

        const targetRadius = target.collisionRadius || 15; // Assume units have radius 15, towers/buildings have range property (visual size)
        const targetRight = target.x + targetRadius;
        const targetLeft = target.x - targetRadius;
        const targetBottom = target.y + targetRadius;
        const targetTop = target.y - targetRadius;

        if (logLeft < targetRight && logRight > targetLeft && logTop < targetBottom && logBottom > targetTop) {
          // Check if target has already been hit by this log instance
          if (!s.hits.includes(target.id)) {
            // Knight shield logic for log damage
            let damageToApply = s.damage;
            if (target.isEvolved && target.type === 'knight' && target.shieldActive && target.shieldHp > 0) {
                if (target.shieldHp >= damageToApply) {
                    target.shieldHp -= damageToApply;
                    damageToApply = 0;
                } else {
                    damageToApply -= target.shieldHp;
                    target.shieldHp = 0;
                }
            }
            target.hp -= damageToApply;
            s.hits.push(target.id); // Mark target as hit
            playSound('hit');
            if (target.hp <= 0) { // Check for death after taking damage
                handleUnitDeath(target);
            }
          }
        }
      });
    } else if (s.type === 'freeze') {
        const affectedUnits = gameState.battle.troops.filter(t => t.owner !== s.owner && t.hp > 0 && dist(s.x, s.y, t.x, t.y) <= s.radius * 30);
        const affectedBuildings = gameState.battle.buildings.filter(b => b.owner !== s.owner && b.hp > 0 && dist(s.x, s.y, b.x, b.y) <= s.radius * 30);
        // FIX: Filter enemy towers for HP > 0 when collecting targets
        const affectedTowers = gameState.battle.towers[s.owner === 'player' ? 'enemy' : 'player'].filter(t => t.hp > 0 && dist(s.x, s.y, t.x, s.y) <= s.radius * 30);

        [...affectedUnits, ...affectedBuildings, ...affectedTowers].forEach(target => {
            if (!target.isFrozen || target.frozenUntil < now + s.duration) { // Extend or apply freeze
                target.isFrozen = true;
                target.frozenUntil = now + s.stunDuration; // stunDuration is from cardData
                if (s.damage > 0 && !s.initialDamageDealtTo?.includes(target.id)) { // Apply initial damage once
                    // Knight shield logic for initial freeze damage
                    let damageToApply = s.damage;
                    if (target.isEvolved && target.type === 'knight' && target.shieldActive && target.shieldHp > 0) {
                        if (target.shieldHp >= damageToApply) {
                            target.shieldHp -= damageToApply;
                            damageToApply = 0;
                        } else {
                            damageToApply -= target.shieldHp;
                            target.shieldHp = 0;
                        }
                    }
                    target.hp -= damageToApply;
                    if (!s.initialDamageDealtTo) s.initialDamageDealtTo = [];
                    s.initialDamageDealtTo.push(target.id);
                    if (target.hp <= 0) { // Check for death after taking damage
                        handleUnitDeath(target);
                    }
                }
            }
        });
    } else if (s.type === 'poison') {
        // Apply damage over time
        if (!s.lastTick || (now - s.lastTick) >= s.tickRate) {
            const affectedUnits = gameState.battle.troops.filter(t => t.owner !== s.owner && t.hp > 0 && dist(s.x, s.y, t.x, t.y) <= s.radius * 30);
            const affectedBuildings = gameState.battle.buildings.filter(b => b.owner !== s.owner && b.hp > 0 && dist(s.x, s.y, b.x, b.y) <= s.radius * 30);
            // FIX: Filter enemy towers for HP > 0 when collecting targets
            const affectedTowers = gameState.battle.towers[s.owner === 'player' ? 'enemy' : 'player'].filter(t => t.hp > 0 && dist(s.x, s.y, t.x, t.y) <= s.radius * 30);

            [...affectedUnits, ...affectedBuildings, ...affectedTowers].forEach(target => {
                // Knight shield logic for poison damage
                let damageToApply = s.damagePerSecond;
                if (target.isEvolved && target.type === 'knight' && target.shieldActive && target.shieldHp > 0) {
                    if (target.shieldHp >= damageToApply) {
                        target.shieldHp -= damageToApply;
                        damageToApply = 0;
                    } else {
                        damageToApply -= target.shieldHp;
                        target.shieldHp = 0;
                    }
                }
                target.hp -= damageToApply;
                target.isPoisoned = true; // Mark as poisoned for visual effect, etc.
                target.poisonedUntil = s.startTime + s.duration; // Mark when the effect should visually end
                if (target.hp <= 0) { // Check for death after taking damage
                    handleUnitDeath(target);
                }
            });
            s.lastTick = now;
        }
    }
  });
}

export function findClosestTarget(unit, targets) {
  if (!targets.length) return null;
  // targets array is now expected to already be filtered for hp > 0.
  return targets.sort((a, b) => dist(unit.x, unit.y, a.x, a.y) - dist(unit.x, unit.y, b.x, b.y))[0];
}

function pathfindAndAttack(unit, target, now) {
  const unitRange = (cardData[unit.type]?.range || 1) * 30; // Scale range from grid units to pixels
  const distanceToTarget = dist(unit.x, unit.y, target.x, target.y);

  if (distanceToTarget <= unitRange) {
    // Evolved Knight stops moving, deactivate shield
    if (unit.isEvolved && unit.type === 'knight') {
        unit.shieldActive = false;
    }
    if (unit.isCharging) { // Prince loses charge if it stops to attack
      unit.isCharging = false;
      unit.moveDistance = 0;
    }
    if (!unit.lastAttack || now - unit.lastAttack > unit.attackSpeed) { // Use unit.attackSpeed
      attackTarget(unit, target);
      unit.lastAttack = now;
    }
  } else {
    moveTowards(unit, target);
  }
}

// Helper function to apply splash damage to multiple targets
function applySplashDamage(attacker, centerX, centerY, splashRadius, splashDamageMultiplier, primaryTargetId = null) {
  const allUnitsAndBuildings = gameState.battle.troops.concat(gameState.battle.buildings);
  // FIX: Filter enemy towers for HP > 0 when checking for splash damage
  const enemyTowers = gameState.battle.towers[attacker.owner === 'player' ? 'enemy' : 'player'].filter(t => t.hp > 0);

  const potentialTargets = allUnitsAndBuildings.filter(u => 
      u.owner !== attacker.owner && u.hp > 0 && u.id !== primaryTargetId && dist(centerX, centerY, u.x, u.y) <= splashRadius
  ).concat(enemyTowers.filter(t => 
      t.hp > 0 && dist(centerX, centerY, t.x, t.y) <= splashRadius
  ));

  potentialTargets.forEach(target => {
      // Calculate actual splash damage based on attacker's damage and multiplier
      let damageToApply = attacker.damage * splashDamageMultiplier;

      // Knight shield logic for splash damage
      if (target.isEvolved && target.type === 'knight' && target.shieldActive && target.shieldHp > 0) {
          if (target.shieldHp >= damageToApply) {
              target.shieldHp -= damageToApply;
              damageToApply = 0; // All damage absorbed
          } else {
              damageToApply -= target.shieldHp;
              target.shieldHp = 0;
          }
      }

      target.hp -= damageToApply;
      playSound('hit');
      createExplosion(target.x, target.y, 5, 'rgba(255,165,0,0.7)', 5, 0.5); // Small orange sparks for splash hit
      if (target.hp <= 0) { // Check for death after taking damage
          handleUnitDeath(target);
      }
  });
}

function attackTarget(unit, target) {
  const isMelee = (cardData[unit.type]?.range || 1) * 30 <= 35; // True if range is effectively melee
  const unitCardData = cardData[unit.type]; // Get card data for splash properties
  let finalDamage = unit.damage;

  if (unit.type === 'prince' && unit.isCharging) {
    finalDamage *= unitCardData.chargeDamageMultiplier || 2;
    unit.isCharging = false; // Reset charge after attacking
    unit.moveDistance = 0;
  }
  
  // NEW: Valkyrie 360 attack
  if (unitCardData.aoe === '360') {
      applySplashDamage(unit, unit.x, unit.y, (unitCardData.range * 30) + 5, 1.0);
      return; // Damage is dealt by splash, so we return.
  }

  // Barbarians Evolution Rage: Apply on first hit
  if (unit.isEvolved && unit.type === 'barbarians' && !unit.hasHitTarget && unitCardData.evolution) {
    unit.isRaging = true;
    unit.rageUntil = performance.now() + unitCardData.evolution.boost.rageDuration;
    unit.speed *= unitCardData.evolution.boost.speedMultiplier;
    unit.attackSpeed *= unitCardData.evolution.boost.attackSpeedMultiplier; // Lower attackSpeed means faster attacks
    unit.hasHitTarget = true; // Mark as having hit a target
  }

  if (isMelee) {
    // Knight shield logic
    if (target.isEvolved && target.type === 'knight' && target.shieldActive && target.shieldHp > 0) {
        if (target.shieldHp >= finalDamage) {
            target.shieldHp -= finalDamage;
            finalDamage = 0; // All damage absorbed
        } else {
            finalDamage -= target.shieldHp;
            target.shieldHp = 0;
        }
    }
    target.hp -= finalDamage;
    playSound('hit');
    // Check for melee splash (e.g., Mega Knight has a small splash on primary attack)
    if (unitCardData.splash && unitCardData.splashRadius > 0 && unitCardData.splashDamage > 0) {
      applySplashDamage(unit, target.x, target.y, unitCardData.splashRadius * 30, unitCardData.splashDamage, target.id);
    }
    if (target.hp <= 0) { // Check for death after taking damage
        handleUnitDeath(target);
    }
  } else {
    // Ranged attack, fire projectile. Splash should happen on projectile impact.
    const projectileOptions = {};
    if (unitCardData.splash && unitCardData.splashRadius > 0 && unitCardData.splashDamage > 0) {
        projectileOptions.splash = true;
        projectileOptions.splashRadius = unitCardData.splashRadius * 30; // Convert to pixels
        projectileOptions.splashDamage = unitCardData.splashDamage;
    }
    // NEW: Apply stun for Electro Wizard
    if (unit.type === 'electro-wizard' && unitCardData.stun > 0) {
        projectileOptions.stunDuration = unitCardData.stun * 1000; // Convert to ms
    }
    // NEW: Archers evolution
    if (unit.isEvolved && unit.type === 'archers') {
        projectileOptions.isPowerShot = true;
    }
    fireProjectile(unit.x, unit.y, target, finalDamage, unit.owner, projectileOptions);
  }
}

function moveTowards(unit, destination) {
  const riverY = BRIDGES.riverY();
  const isPlayerUnit = unit.owner === 'player';
  const cardBase = cardData[unit.type];

  // Prince charging logic
  if (unit.type === 'prince' && !unit.isCharging) {
    unit.moveDistance = (unit.moveDistance || 0) + unit.speed; // Use base speed for distance calc
    if (unit.moveDistance > 100) { // Charge after moving 100 pixels
      unit.isCharging = true;
    }
  }

  let speed = unit.speed;
  if (unit.isRaging && cardBase.evolution && cardBase.evolution.boost.speedMultiplier) { // Apply rage speed multiplier
    speed *= cardBase.evolution.boost.speedMultiplier;
  }
  if (unit.isCharging && cardBase.chargeSpeedMultiplier) {
    speed *= cardBase.chargeSpeedMultiplier;
  }

  // Evolved Knight is moving, activate shield
  if (unit.isEvolved && unit.type === 'knight') {
    unit.shieldActive = true;
  }

  let targetPos = { x: destination.x, y: destination.y };

  // Check if crossing river is necessary and unit is not already at the riverbank
  const onPlayerSide = unit.y > riverY;
  const onEnemySide = unit.y < riverY;
  const destinationOnPlayerSide = destination.y > riverY;
  const destinationOnEnemySide = destination.y < riverY;

  if ((isPlayerUnit && onPlayerSide && destinationOnEnemySide) || (!isPlayerUnit && onEnemySide && destinationOnPlayerSide)) {
    if (!unit.lane) {
      const distToLeftBridge = dist(unit.x, unit.y, BRIDGES.leftX(), riverY);
      const distToRightBridge = dist(unit.x, unit.y, BRIDGES.rightX(), riverY);
      unit.lane = (distToLeftBridge < distToRightBridge) ? 'left' : 'right';
    }
    const bridgeX = unit.lane === 'left' ? BRIDGES.leftX() : BRIDGES.rightX();

    const isApproachingBridge = isPlayerUnit ? (unit.y > riverY + 5) : (unit.y < riverY - 5);

    if (isApproachingBridge) {
      targetPos = { x: bridgeX, y: isPlayerUnit ? riverY - 1 : riverY + 1 };
    }
  }

  let dx = targetPos.x - unit.x;
  let dy = targetPos.y - unit.y;
  const distanceToTargetPos = dist(unit.x, unit.y, targetPos.x, targetPos.y);
  let angle = Math.atan2(dy, dx);

  let moveStep = Math.min(speed, distanceToTargetPos); // Don't overshoot
  let nextX = unit.x + Math.cos(angle) * moveStep;
  let nextY = unit.y + Math.sin(angle) * moveStep;

  // NEW: Collision avoidance with friendly units
  const friendlyUnits = gameState.battle.troops.filter(u => u.owner === unit.owner && u.id !== unit.id && u.hp > 0);
  friendlyUnits.forEach(otherUnit => {
      const minDistance = unit.collisionRadius + otherUnit.collisionRadius;
      const currentDistance = dist(nextX, nextY, otherUnit.x, otherUnit.y);

      if (currentDistance < minDistance) {
          // If already overlapping or would overlap, gently push away
          const overlap = minDistance - currentDistance;
          if (overlap > 0.1) { // Only apply if there's significant overlap
              const repelAngle = Math.atan2(nextY - otherUnit.y, nextX - otherUnit.x);
              // Adjust nextX, nextY to move away from the overlapping friendly unit
              nextX += Math.cos(repelAngle) * overlap * 0.5; // Push out by half the overlap
              nextY += Math.sin(repelAngle) * overlap * 0.5;
          }
      }
  });

  unit.x = nextX;
  unit.y = nextY;
}

export function moveAlongLane(t) {
  console.warn("moveAlongLane is deprecated, use moveTowards with a tower target instead.");
}

export function moveTowardsAndAttack(t, target, now) {
  console.warn("moveTowardsAndAttack is deprecated, use pathfindAndAttack instead.");
}

export function fireProjectile(x, y, target, damage, owner, opts = {}) {
  // Pass splash properties along with projectile
  const newProjectile = { 
    x, y, tx: target.x, ty: target.y, target, damage, owner, progress: 0, speed: 10, 
    arrow: opts.from === 'tower' || opts.from === 'building' || opts.isPowerShot,
    splash: opts.splash || false, // Whether this projectile causes splash damage
    splashRadius: opts.splashRadius || 0, // Radius in pixels
    splashDamage: opts.splashDamage || 0, // Multiplier for splash damage
    stunDuration: opts.stunDuration || 0, // NEW: Stun duration for projectile impact
    isPowerShot: opts.isPowerShot || false, // NEW: For Archers evolution
    powerShotHits: [] // NEW: Track hits for power shot
  };
  gameState.battle.projectiles.push(newProjectile);
  playSound(opts.from === 'tower' || opts.from === 'building' ? 'arrow' : 'shot');
}

export function updateProjectiles() {
  gameState.battle.projectiles.forEach(p => {
    if (p.target.hp <= 0 || p.done || p.target.destroyed) { // If target is destroyed or projectile is already marked as done
      p.done = true;
      return;
    }
    p.tx = p.target.x; p.ty = p.target.y; // Track target's current position
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const distanceToTarget = Math.hypot(dx, dy);

    if (distanceToTarget > p.speed) {
      p.x += (dx / distanceToTarget) * p.speed;
      p.y += (dy / distanceToTarget) * p.speed;

      // NEW: Power Shot logic for piercing
      if (p.isPowerShot) {
          const allEnemies = gameState.battle.troops.filter(t => t.owner !== p.owner && t.hp > 0)
                               .concat(gameState.battle.buildings.filter(b => b.owner !== p.owner && b.hp > 0));
          
          allEnemies.forEach(enemy => {
              if (!p.powerShotHits.includes(enemy.id) && dist(p.x, p.y, enemy.x, enemy.y) < 20) { // Check for collision
                  // Apply damage to enemy
                  let damageToApply = p.damage;
                  if (enemy.isEvolved && enemy.type === 'knight' && enemy.shieldActive && enemy.shieldHp > 0) {
                      if (enemy.shieldHp >= damageToApply) {
                          enemy.shieldHp -= damageToApply;
                          damageToApply = 0;
                      } else {
                          damageToApply -= enemy.shieldHp;
                          enemy.shieldHp = 0;
                      }
                  }
                  enemy.hp -= damageToApply;
                  p.powerShotHits.push(enemy.id); // Mark as hit to prevent multiple hits
                  playSound('hit');
                  if (enemy.hp <= 0) {
                      handleUnitDeath(enemy);
                  }
              }
          });
      }
    }
    else {
      // Knight shield logic for projectiles
      let damageToApply = p.damage;
      if (p.target.isEvolved && p.target.type === 'knight' && p.target.shieldActive && p.target.shieldHp > 0) {
          if (p.target.shieldHp >= damageToApply) {
              p.target.shieldHp -= damageToApply;
              damageToApply = 0; // All damage absorbed
          } else {
              damageToApply -= p.target.shieldHp;
              p.target.shieldHp = 0;
          }
      }
      p.target.hp -= damageToApply;
      
      // Power shot continues, doesn't stop on primary target hit unless it's the final target
      if (!p.isPowerShot) {
        p.done = true;
      }
      playSound('hit');

      // NEW: Apply stun on impact
      if (p.stunDuration > 0) {
          p.target.isFrozen = true; // Use isFrozen for stun for now, can separate later if needed
          p.target.frozenUntil = performance.now() + p.stunDuration;
      }

      // NEW: Apply splash damage on impact if projectile has splash properties
      if (p.splash && p.splashRadius > 0 && p.splashDamage > 0) {
        // Need to get the original attacker's full data to calculate level-scaled damage for splash
        // For now, let's assume `p.damage` is the unit's level-scaled primary damage.
        // The `splashDamage` stored on the projectile should be the *multiplier*.
        // The `attacker` for applySplashDamage needs to be constructed with proper `damage` value.
        // Let's create a temporary attacker object for `applySplashDamage`
        const tempAttacker = {
          owner: p.owner,
          damage: p.damage / 0.9 // Revert 0.9 damage multiplier to get base for splash calculation
          // this is a bit hacky, ideally projectile would also store the original unit's ID
          // and we'd look up its *current* damage based on state.
          // For now, p.damage has already been scaled for level and 0.9.
          // So let's re-calculate `splashDamage` from the base card data + level,
          // or just assume `p.damage` is the base for splash, multiplied by `p.splashDamage`.
        };
        // Use the primary target's coordinates for the center of the splash
        applySplashDamage(tempAttacker, p.target.x, p.target.y, p.splashRadius, p.splashDamage, p.target.id);
      }

      // Check for unit death and spawn-on-death effects
      if (p.target.hp <= 0) {
        handleUnitDeath(p.target);
      }
    }
  });
  gameState.battle.projectiles = gameState.battle.projectiles.filter(p => !p.done);
}

function createExplosion(x, y, count, color, size, velocityMultiplier = 1) {
  for (let i = 0; i < count; i++) {
    gameState.battle.particles.push({
      x, y,
      startTime: performance.now(),
      duration: 500 + Math.random() * 500,
      color,
      size: size + Math.random() * (size / 2),
      velocity: {
        x: (Math.random() - 0.5) * 2 * velocityMultiplier,
        y: (Math.random() - 0.5) * 2 * velocityMultiplier
      }
    });
  }
}

function handleUnitDeath(unit) {
  const cardBase = cardData[unit.type];
  if (!cardBase) return;

  // Handle death explosion damage (e.g., Golem)
  if (cardBase.deathDamage && cardBase.deathDamage > 0) {
    // For simplicity, using a generic splash damage function. 
    // This needs a temporary "attacker" object.
    const deathAttacker = { owner: unit.owner, damage: cardBase.deathDamage, type: unit.type };
    // Assuming death damage has a small radius, like 1.5 tiles (45px)
    const deathRadius = (cardBase.deathDamageRadius || 1.5) * 30;
    applySplashDamage(deathAttacker, unit.x, unit.y, deathRadius, 1.0); 
    createExplosion(unit.x, unit.y, 20, 'rgba(150, 75, 0, 0.8)', 8);
  }

  // Handle spawn on death (e.g., Golem -> Golemites)
  if (cardBase.spawnOnDeath && cardBase.spawnOnDeathCount > 0) {
    for (let i = 0; i < cardBase.spawnOnDeathCount; i++) {
      const spawnX = unit.x + (Math.random() - 0.5) * 40;
      const spawnY = unit.y + (Math.random() - 0.5) * 40;
      const spawnedUnit = createUnit(cardBase.spawnOnDeath, spawnX, spawnY, unit.owner);
      gameState.battle.troops.push(spawnedUnit);
    }
    playSound('spawn');
  }
}

export function createConfetti(numParticles, colors, centralX, centralY) {
  const spawnRadius = 150; // Spread around the central point for a burst
  for (let i = 0; i < numParticles; i++) {
    // Define xOffset and yOffset for random spread within the spawnRadius
    const xOffset = (Math.random() - 0.5) * spawnRadius;
    const yOffset = (Math.random() - 0.5) * spawnRadius;

    gameState.battle.particles.push({
      x: centralX + xOffset,
      y: centralY + yOffset,
      startTime: performance.now(),
      duration: 1500 + Math.random() * 1000,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 5 + Math.random() * 5, // Confetti pieces are small
      velocity: {
        x: (Math.random() - 0.5) * 5,
        y: -Math.random() * 8 // Initial upward burst
      },
      gravity: 0.3, // Confetti falls down
      type: 'confetti' // New particle type
    });
  }
}

function checkTowerStates() {
  const now = performance.now(); // Get current time for poison status
  const allTowers = [...gameState.battle.towers.enemy, ...gameState.battle.towers.player];
  let towerDestroyed = false;
  let enemyPrincessTowersDestroyedCount = 0; // NEW: Track destroyed enemy princess towers

  allTowers.forEach(tower => {
    // Check for poison effect (only for visuals; damage applied by updateSpells)
    if (tower.isPoisoned && now >= tower.poisonedUntil) {
      tower.isPoisoned = false;
      tower.poisonedUntil = 0;
    }

    if (tower.hp <= 0 && !tower.destroyed) {
      tower.destroyed = true;
      towerDestroyed = true;
      playSound('tower_destroyed');
      createExplosion(tower.x, tower.y, 50, '#ffcc00', 8);
      // NEW: Increment counter for enemy princess towers
      if (tower.owner === 'enemy' && !tower.king) {
        enemyPrincessTowersDestroyedCount++;
      }
    }
  });

  // NEW: Update playerDeploymentYBoundary based on destroyed enemy princess towers
  if (towerDestroyed) { // Only update if something was just destroyed
    const H = getCanvas().height;
    // Base player boundary is H * 0.5 (river line)
    // If 1 enemy princess tower down, allow deployment up to H * 0.4
    // If 2 enemy princess towers down, allow deployment up to H * 0.3
    if (enemyPrincessTowersDestroyedCount === 1) {
      gameState.battle.playerDeploymentYBoundary = Math.min(gameState.battle.playerDeploymentYBoundary, H * 0.4);
    } else if (enemyPrincessTowersDestroyedCount >= 2) {
      gameState.battle.playerDeploymentYBoundary = Math.min(gameState.battle.playerDeploymentYBoundary, H * 0.3);
    }
  }

  if (towerDestroyed) {
    document.body.style.animation = 'flash 0.3s ease-out';
    setTimeout(() => document.body.style.animation = '', 300);
  }

  const enemyKingTower = gameState.battle.towers.enemy.find(t => t.king);
  const playerKingTower = gameState.battle.towers.player.find(t => t.king);
  const enemyPrincessTowers = gameState.battle.towers.enemy.filter(t => !t.king);
  const playerPrincessTowers = gameState.battle.towers.player.filter(t => !t.king);

  let crownsWon = gameState.battle.towers.enemy.filter(t => t.hp <= 0).length;

  // NEW: Sudden Death Mode win condition
  if (gameState.battle.isSuddenDeathMode) {
      // If any enemy tower is destroyed (king or princess)
      if (enemyKingTower.hp <= 0 || enemyPrincessTowers.some(t => t.hp <= 0)) {
          endBattle('victory', 1); // Player wins with 1 crown (first tower)
          return;
      }
      // If any player tower is destroyed (king or princess)
      if (playerKingTower.hp <= 0 || playerPrincessTowers.some(t => t.hp <= 0)) {
          endBattle('defeat', 0); // Player loses
          return;
      }
  } else { // Normal battle conditions
      if (enemyKingTower.hp <= 0) {
          endBattle('victory', 3);
          return;
      }
      
      // Player King tower destroyed means defeat
      if (playerKingTower.hp <= 0) {
          endBattle('defeat', 0);
          return;
      }
  }
}

export function startBattleTimer() {
  gameState.battle.overtime = false;
  timerInterval = setInterval(() => {
    gameState.battle.timer--;
    updateTimerDisplay();

    // NEW: Double elixir in the last minute of regular time, unless Sudden Death
    if (!gameState.battle.isSuddenDeathMode && !gameState.battle.isInfiniteElixir && gameState.battle.timer <= 60 && !gameState.battle.overtime && gameState.battle.elixirRateMultiplier < 2) { // Only change if multiplier is not already 2x or more
      clearInterval(elixirInterval);
      gameState.battle.elixirRateMultiplier = Math.max(2, gameState.battle.elixirRateMultiplier); // Ensure at least 2x
      gameState.battle.elixirRate = 2800 / gameState.battle.elixirRateMultiplier; // Update elixir rate
      startElixirGeneration();
      // Optionally, add a visual cue for double elixir starting
    }

    if (gameState.battle.timer <= 0) {
      if (gameState.battle.isSuddenDeathMode) {
          // In Sudden Death, if timer runs out and no towers are destroyed, it's a draw
          endBattle('draw', 0);
          return;
      }

      if (!gameState.battle.overtime) {
        // Enter overtime
        gameState.battle.overtime = true;
        gameState.battle.timer = 60; // 1 minute overtime
        if (!gameState.battle.isInfiniteElixir) {
          clearInterval(elixirInterval);
          gameState.battle.elixirRateMultiplier = Math.max(2, gameState.battle.elixirRateMultiplier); // Ensure at least 2x
          gameState.battle.elixirRate = 2800 / gameState.battle.elixirRateMultiplier; // Update elixir rate
          startElixirGeneration();
        }
        return;
      }
      // End of overtime, determine winner
      const enemyTowersDestroyed = gameState.battle.towers.enemy.filter(t => t.hp <= 0).length;
      const playerTowersDestroyed = gameState.battle.towers.player.filter(t => t.hp <= 0).length;

      let crownsWon = 0;
      if (enemyTowersDestroyed > playerTowersDestroyed) {
          crownsWon = enemyTowersDestroyed; // Simple crown count based on tower difference
          endBattle('victory', crownsWon);
      } else if (playerTowersDestroyed > enemyTowersDestroyed) {
          endBattle('defeat', 0);
      } else {
          // SUDDEN DEATH: if tower counts are equal, lowest HP tower loses.
          const livingPlayerTowers = gameState.battle.towers.player.filter(t => t.hp > 0);
          const livingEnemyTowers = gameState.battle.towers.enemy.filter(t => t.hp > 0);

          if (livingPlayerTowers.length === 0 && livingEnemyTowers.length === 0) {
            endBattle('draw', 0); // All towers destroyed, true draw
          } else if (livingPlayerTowers.length === 0) {
            endBattle('defeat', 0); // All player towers down, but enemy has some standing
          } else if (livingEnemyTowers.length === 0) {
            endBattle('victory', 3); // All enemy towers down, but player has some standing
          } else {
            const lowestPlayerTowerHP = Math.min(...livingPlayerTowers.map(t => t.hp));
            const lowestEnemyTowerHP = Math.min(...livingEnemyTowers.map(t => t.hp));

            if (lowestPlayerTowerHP > lowestEnemyTowerHP) {
                endBattle('victory', enemyTowersDestroyed + 1);
            } else if (lowestEnemyTowerHP > lowestPlayerTowerHP) {
                endBattle('defeat', 0);
            } else {
                endBattle('draw', 0); // If still tied after overtime
            }
          }
      }
    }
  }, 1000);
}

export function updateTimerDisplay() {
  const timer = document.querySelector('.timer');
  const minutes = Math.floor(gameState.battle.timer / 60);
  const seconds = gameState.battle.timer % 60;
  timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  if (gameState.battle.isSuddenDeathMode) {
    timer.style.backgroundColor = 'rgba(255, 69, 0, 0.7)'; // Orange background for Sudden Death timer
  } else if (gameState.battle.overtime) {
    timer.style.backgroundColor = 'rgba(139, 0, 0, 0.7)'; // Dark red for overtime
  } else if (gameState.battle.timer <= 60) {
    timer.style.backgroundColor = 'rgba(0, 100, 0, 0.7)'; // Dark green for double elixir
  } else {
    timer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'; // Default
  }
}

export function stopBattle() {
  clearInterval(battleInterval);
  clearInterval(elixirInterval);
  clearInterval(timerInterval);
  gameState.battle.elixirRate = 2800; // Reset elixir rate to base
  gameState.battle.elixirRateMultiplier = 1; // NEW: Reset multiplier
  gameState.battle.isSandboxMode = false; // NEW: Reset sandbox flag
  gameState.battle.isInfiniteElixir = false; // NEW: Reset infinite elixir flag
  gameState.battle.isSuddenDeathMode = false; // NEW: Reset Sudden Death flag
  gameState.draft.isActive = false; // NEW: Reset draft flag
  gameState.battle.troops = [];
  gameState.battle.buildings = []; // Clear active buildings
  gameState.battle.projectiles = [];
  gameState.battle.spells = []; // Clear active spells
  // NEW: Also reset playerDeploymentYBoundary and hoverTarget for next battle
  if (getCanvas()) { // Ensure canvas exists before trying to get height
    gameState.battle.playerDeploymentYBoundary = getCanvas().height * 0.5;
  }
  gameState.battle.hoverTarget = null;
  stopMusic();
}

export async function startBattle() {
  const { showScreen } = await import('./ui.js');
  showScreen('battleScreen');
  initBattle();
}

const enemyNames = ["Slayer", "Dr.Disrespect", "Terminator", "Ghost", "Zeus", "Viper"];

export function initBattle() {
  // Reset battle state
  // Preserve mode flags if already set from UI for a new battle setup
  const initialIsSandboxMode = gameState.battle.isSandboxMode || false;
  const initialElixirRateMultiplier = gameState.battle.elixirRateMultiplier || 1;
  const initialIsInfiniteElixir = gameState.battle.isInfiniteElixir || false;
  const initialIsSuddenDeathMode = gameState.battle.isSuddenDeathMode || false; // NEW: Preserve Sudden Death flag
  const isMegaDraft = gameState.draft.isActive; // Check if we are in a draft battle

  gameState.battle = {
    elixir: 5, maxElixir: 10, timer: 180,
    selectedCard: null, troops: [], buildings: [], spells: [], projectiles: [], // Initialize buildings array
    towers: null, drawQueue: [], hand: [], overtime: false, emotes: [], particles: [],
    spells: [], // Initialize new spells array
    playerDeploymentYBoundary: getCanvas().height * 0.5, // INITIALIZE HERE
    hoverTarget: null, // INITIALIZE HERE
    isSandboxMode: initialIsSandboxMode, 
    elixirRateMultiplier: initialElixirRateMultiplier,
    isInfiniteElixir: initialIsInfiniteElixir,
    isSuddenDeathMode: initialIsSuddenDeathMode, // NEW: Set Sudden Death flag
    isMegaDraft: isMegaDraft, // Store if it's a draft battle
    evoState: {
        cardId: gameState.player.equippedEvo,
        cyclesNeeded: 1,
        currentCycles: gameState.player.equippedEvo ? 1 : 0,
    }
  };
  
  // NEW: Create elixir pips
  const elixirBar = document.querySelector('.elixir-bar');
  elixirBar.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const pip = document.createElement('div');
    pip.classList.add('elixir-pip');
    elixirBar.appendChild(pip);
  }

  // Apply elixir rate multiplier based on the mode
  gameState.battle.elixirRate = 2800 / gameState.battle.elixirRateMultiplier; // Adjust elixir rate here

  updateElixirDisplay();
  
  // NEW: Adjust initial timer for Sudden Death
  if (gameState.battle.isSuddenDeathMode) {
      gameState.battle.timer = 120; // 2 minutes for Sudden Death mode
  } else {
      gameState.battle.timer = 180; // Default 3 minutes
  }

  updateTimerDisplay();
  startElixirGeneration();
  startBattleLoop();
  startBattleTimer();
  initTowers();
  setupCardHand();
  buildHandFromDeck();
  spawnAI();
  startMusic();

  // NEW: Set random enemy name and player name
  document.getElementById('enemyName').textContent = enemyNames[Math.floor(Math.random() * enemyNames.length)];
  document.getElementById('playerName').textContent = gameState.player.username;
}

export function initTowers() {
  const W = getCanvas().width, H = getCanvas().height, cx = W / 2;
  // NEW: Tower HP for all modes is 2000
  gameState.battle.towers = {
    enemy: [
      { id: 'e_king', x: cx, y: H * 0.15, hp: 2000, maxHp: 2000, range: 200, king: true, active: false, lastAttackTime: 0, owner: 'enemy' },
      { id: 'e_left', x: cx - 120, y: H * 0.25, hp: 2000, maxHp: 2000, range: 160, king: false, active: true, lastAttackTime: 0, owner: 'enemy' },
      { id: 'e_right', x: cx + 120, y: H * 0.25, hp: 2000, maxHp: 2000, range: 160, king: false, active: true, lastAttackTime: 0, owner: 'enemy' }
    ],
    player: [
      { id: 'p_left', x: cx - 120, y: H * 0.75, hp: 2000, maxHp: 2000, range: 160, king: false, active: true, lastAttackTime: 0, owner: 'player' },
      { id: 'p_right', x: cx + 120, y: H * 0.75, hp: 2000, maxHp: 2000, range: 160, king: false, active: true, lastAttackTime: 0, owner: 'player' },
      { id: 'p_king', x: cx, y: H * 0.85, hp: 2000, maxHp: 2000, range: 200, king: true, active: false, lastAttackTime: 0, owner: 'player' }
    ]
  };
  // Add destroyed flag and spell effect flags to towers
  Object.values(gameState.battle.towers).flat().forEach(t => {
      t.destroyed = false;
      t.isFrozen = false;
      t.frozenUntil = 0;
      t.isPoisoned = false;
      t.poisonedUntil = 0; // NEW: Initialize poisonedUntil
      t.collisionRadius = 40; // Collision radius for towers
  });
}

export function buildHandFromDeck() {
  // Clear hand and draw queue
  gameState.battle.hand = [];
  gameState.battle.drawQueue = [];

  // Initialize draw queue with active deck cards, then shuffle
  let tempDeck = [...gameState.player.activeDeck];

  // In Mega Draft, the deck is already set and should not be filtered.
  if (!gameState.battle.isMegaDraft) {
    // NEW: Filter out restricted cards for early arenas if player is in one
    if (gameState.player.currentArenaIndex < ARENA_RESTRICTION_THRESHOLD) {
        tempDeck = tempDeck.filter(cardId => !RESTRICTED_CARDS_EARLY_ARENAS.includes(cardId));
    }
  }

  // Ensure deck has enough cards for a valid hand + queue after filtering
  if (tempDeck.length < 4) {
      console.warn("Deck has fewer than 4 playable cards for this arena.");
      // Try to responsibly pad the deck by repeating existing chosen cards (avoid forcing 'knight')
      const source = Array.isArray(gameState.player.activeDeck) && gameState.player.activeDeck.length > 0
        ? [...gameState.player.activeDeck]
        : Object.keys(gameState.player.cards).filter(id => !!gameState.player.cards[id]);
      if (source.length === 0) {
        console.error("No available cards to pad the deck. Aborting hand build.");
        return;
      }
      // Cycle through source to reach a safe minimum (4) then enough for draw queue
      while (tempDeck.length < 8) {
        tempDeck.push(source[tempDeck.length % source.length]);
      }
  }

  tempDeck = shuffleArray(tempDeck);

  // Draw initial hand of 4 cards
  for (let i = 0; i < 4; i++) {
    if (tempDeck.length > 0) {
      const cardId = tempDeck.shift();
      gameState.battle.hand.push(gameState.player.cards[cardId]);
    } else {
      // Should not happen if activeDeck has at least 4 cards, but handle defensively
      console.warn('Not enough cards in active deck to fill initial hand!');
      break;
    }
  }
  // Remaining cards go into draw queue
  gameState.battle.drawQueue = tempDeck;

  updateCardDisplay();
  updateNextCardDisplay();
}

// Fisher-Yates (Knuth) shuffle algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export function updateCardDisplay() {
  // Update card display
  document.querySelectorAll('.card-hand .card').forEach(cardEl => {
    const handIndex = parseInt(cardEl.dataset.handIndex);
    const cardData = gameState.battle.hand[handIndex];
    if (cardData) {
      cardEl.dataset.type = cardData.id;
      cardEl.dataset.cost = cardData.cost;
      cardEl.querySelector('.card-cost').textContent = cardData.cost;
      cardEl.querySelector('.card-art').textContent = getCardEmoji(cardData.id);
      cardEl.querySelector('.card-name-banner').textContent = cardData.name;
      // NEW: toggle golden styling
      cardEl.classList.toggle('golden', !!cardData.isGolden);
      // NEW: Check for evolved state
      const isEvoReady = cardData.id === gameState.battle.evoState.cardId && gameState.battle.evoState.currentCycles <= 0;
      cardEl.classList.toggle('evolved', isEvoReady);
    } else {
      // If a slot is empty (e.g., less than 4 cards in hand initially)
      cardEl.dataset.type = '';
      cardEl.dataset.cost = '';
      cardEl.querySelector('.card-cost').textContent = '';
      cardEl.querySelector('.card-art').textContent = '';
      cardEl.querySelector('.card-name-banner').textContent = '';
    }
  });
}

export function updateCardDisabledStates() {
  // Update card disabled states
  document.querySelectorAll('.card-hand .card').forEach(cardEl => {
    const handIndex = parseInt(cardEl.dataset.handIndex);
    const card = gameState.battle.hand[handIndex];
    if (card) {
      if (gameState.battle.elixir < card.cost) {
        cardEl.classList.add('disabled');
      } else {
        cardEl.classList.remove('disabled');
      }
    }
  });
}

export function sendEmote(emojiType) {
  const kingTower = gameState.battle.towers.player[2];
  if (!kingTower) return; // Should not happen if towers are initialized

  let emoji;
  switch (emojiType) {
    case 'cry': emoji = '😭👑'; break;
    case 'laugh': emoji = '😆👑'; break;
    case 'mad': emoji = '😡👑'; break;
    case 'thumbs': emoji = '👍👑'; break;
    default: return;
  }

  gameState.battle.emotes.push({
    x: kingTower.x,
    y: kingTower.y + 50, // Slightly above the king tower
    emoji: emoji,
    t: performance.now()
  });
}

export function castSpell(spellType, x, y, owner) {
  const spellBaseData = cardData[spellType];
  const playerCard = gameState.player.cards[spellType];
  const level = playerCard ? playerCard.level : 1;
  const damage = (spellBaseData.damage || 0) * (1 + (level - 1) * 0.1) * 0.9; // Apply 0.9 damage multiplier

  if (spellType === 'fireball' || spellType === 'zap' || spellType === 'arrows') {
    // For Fireball, Zap, and Arrows, deal AoE damage immediately
    const affectedTargets = gameState.battle.troops.filter(t => t.owner !== owner && dist(x, y, t.x, t.y) <= spellBaseData.radius * 30)
                                                .concat(gameState.battle.buildings.filter(b => b.owner !== owner && dist(x,y,b.x,b.y) <= spellBaseData.radius * 30));
    // FIX: Filter enemy towers for HP > 0 when checking for spell targets
    gameState.battle.towers[owner === 'player' ? 'enemy' : 'player'].filter(t => t.hp > 0).forEach(t => {
        if (dist(x, y, t.x, t.y) <= spellBaseData.radius * 30) { // All towers can be hit by spells now
            affectedTargets.push(t);
        }
    });

    affectedTargets.forEach(target => {
        // Knight shield logic for spell damage
        let damageToApply = damage;
        if (target.isEvolved && target.type === 'knight' && target.shieldActive && target.shieldHp > 0) {
            if (target.shieldHp >= damageToApply) {
                target.shieldHp -= damageToApply;
                damageToApply = 0;
            } else {
                damageToApply -= target.shieldHp;
                target.shieldHp = 0;
            }
        }
        target.hp -= damageToApply;
        if (spellType === 'zap' && target.stun) {
            // Placeholder for stun logic (e.g., set a 'stunnedUntil' timestamp on target)
            console.log(`${target.type} stunned!`);
        }
        if (target.hp <= 0) { // Check for death after taking damage
            handleUnitDeath(target);
        }
    });
    // Add an explosion particle effect for visual feedback
    createExplosion(x, y, 30, spellType === 'fireball' ? 'orange' : 'lightblue', 10);
    if (spellType === 'arrows') {
        playSound('arrow'); // Reuse arrow sound
    }

  } else if (spellType === 'the-log') {
    // The Log: rolls forwards, hits multiple targets
    gameState.battle.spells.push({
      id: Math.random().toString(36),
      type: 'the-log',
      x: x,
      y: y,
      owner: owner,
      damage: damage,
      speed: spellBaseData.speed,
      duration: spellBaseData.duration, // how long it rolls in ms
      startTime: performance.now(),
      hits: [], // To track units already hit by this log instance
      width: spellBaseData.width, // Visual size of the log
      height: spellBaseData.height,
      rotation: 0 // Initial rotation
    });
  } else if (spellType === 'goblin-barrel') {
    const spawnCount = spellBaseData.spawnCount || 1;
    const spawnCardId = spellBaseData.spawnCard; // Should be 'goblin'
    for (let i = 0; i < spawnCount; i++) {
        const spawnX = x + (Math.random() - 0.5) * 30; // Slightly spread
        const spawnY = y + (Math.random() - 0.5) * 30;
        const unit = createUnit(spawnCardId, spawnX, spawnY, owner);
        gameState.battle.troops.push(unit);
    }
    createExplosion(x, y, 15, 'green', 8); // Visual for barrel impact
    playSound('hit'); // Sound for barrel impact
  } else if (spellType === 'freeze') {
      gameState.battle.spells.push({
          id: Math.random().toString(36),
          type: 'freeze',
          x: x,
          y: y,
          owner: owner,
          radius: spellBaseData.radius,
          damage: damage, // Initial damage
          duration: spellBaseData.duration, // Total spell duration
          stunDuration: spellBaseData.stunDuration, // How long units are stunned for
          startTime: performance.now(),
          initialDamageDealtTo: [] // To track units that received initial damage
      });
      createExplosion(x, y, 20, 'white', 12); // Visual burst for freeze
  } else if (spellType === 'poison') {
      const damagePerTick = (spellBaseData.damagePerSecond * (1 + (level - 1) * 0.1) * 0.9); // Damage per second, scaled
      gameState.battle.spells.push({
          id: Math.random().toString(36),
          type: 'poison',
          x: x,
          y: y,
          owner: owner,
          radius: spellBaseData.radius,
          damagePerSecond: damagePerTick, // Scaled damage per second
          duration: spellBaseData.duration,
          tickRate: spellBaseData.tickRate,
          startTime: performance.now(),
          lastTick: performance.now() // Initial tick time
      });
      createExplosion(x, y, 15, 'purple', 8); // Visual burst for poison
  }
}

export function updateHUD() {
    if (gameState.screen !== 'battleScreen' || !gameState.battle.towers) return;

    // Helper to update a single tower's HP bar
    const updateTowerBar = (owner, towerIndex, towerData) => {
        let elementId;
        if (towerData.king) {
            elementId = `${owner}-king-hp`;
        } else {
            // This logic assumes princess towers are at specific indices.
            // enemy: left=1, right=2. player: left=0, right=1.
            if (owner === 'enemy') {
                elementId = towerIndex === 1 ? `${owner}-tower-1-hp` : `${owner}-tower-2-hp`;
            } else {
                elementId = towerIndex === 0 ? `${owner}-tower-1-hp` : `${owner}-tower-2-hp`;
            }
        }
        
        const wrapper = document.getElementById(elementId);
        if (wrapper) {
            const fill = wrapper.querySelector('.hp-fill');
            const percentage = (Math.max(0, towerData.hp) / towerData.maxHp) * 100;
            fill.style.width = `${percentage}%`;
            wrapper.style.display = towerData.hp <= 0 ? 'none' : 'flex';
        }
    };

    gameState.battle.towers.player.forEach((tower, index) => {
        updateTowerBar('player', index, tower);
    });
    gameState.battle.towers.enemy.forEach((tower, index) => {
        updateTowerBar('enemy', index, tower);
    });
}