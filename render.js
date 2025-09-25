import { gameState, getCtx, getCanvas, BRIDGES, allCards, arenaData, cardData } from './state.js';

export function getCardEmoji(type){
  const card = allCards.find(c => c.id === type);
  return card ? card.emoji : '🔷';
}

// NEW HELPER FUNCTIONS FOR ARENA DECORATIONS
function drawTree(ctx, x, y, size) {
    // Trunk
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - size * 0.1, y - size * 0.5, size * 0.2, size * 0.5);
    // Leaves
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.arc(x, y - size * 0.5, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - size * 0.15, y - size * 0.4, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + size * 0.15, y - size * 0.4, size * 0.25, 0, Math.PI * 2);
    ctx.fill();
}

function drawPineTree(ctx, x, y, size) {
    // Trunk
    ctx.fillStyle = '#5A3A22';
    ctx.fillRect(x - size * 0.08, y - size * 0.2, size * 0.16, size * 0.2);
    // Leaves
    ctx.fillStyle = '#006400';
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.4, y - size * 0.4);
    ctx.lineTo(x + size * 0.4, y - size * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y - size * 0.6);
    ctx.lineTo(x - size * 0.5, y - size * 0.1);
    ctx.lineTo(x + size * 0.5, y - size * 0.1);
    ctx.closePath();
    ctx.fill();
    // Snow
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size * 0.2, y - size * 0.6);
    ctx.lineTo(x + size * 0.2, y - size * 0.6);
    ctx.closePath();
    ctx.fill();
}

function drawRock(ctx, x, y, size, color = '#808080') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size * 0.8, y - size * 0.5);
    ctx.lineTo(x + size * 0.2, y - size * 0.6);
    ctx.closePath();
    ctx.fill();
}

function drawCactus(ctx, x, y, size) {
    ctx.fillStyle = '#2E8B57';
    ctx.strokeStyle = '#225B3E';
    ctx.lineWidth = 2;
    // Main body
    ctx.fillRect(x - size * 0.1, y - size, size * 0.2, size);
    ctx.strokeRect(x - size * 0.1, y - size, size * 0.2, size);
    // Arm
    ctx.fillRect(x + size * 0.1, y - size * 0.7, size * 0.3, size * 0.15);
    ctx.strokeRect(x + size * 0.1, y - size * 0.7, size * 0.3, size * 0.15);
    ctx.fillRect(x + size * 0.3, y - size * 0.7, size * 0.1, size * 0.4);
    ctx.strokeRect(x + size * 0.3, y - size * 0.7, size * 0.1, size * 0.4);
}

function drawBone(ctx, x, y, size, type) {
    ctx.fillStyle = '#FDF5E6';
    ctx.strokeStyle = '#D2B48C';
    ctx.lineWidth = 1;
    if (type === 'skull') {
        ctx.beginPath();
        ctx.arc(x, y - size * 0.2, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(x - size * 0.1, y - size * 0.25, size * 0.05, 0, Math.PI * 2);
        ctx.arc(x + size * 0.1, y - size * 0.25, size * 0.05, 0, Math.PI * 2);
        ctx.fill();
    } else { // Generic bone pile
        ctx.fillRect(x, y, size, size * 0.2);
        ctx.strokeRect(x, y, size, size * 0.2);
        ctx.fillRect(x + size * 0.2, y - size * 0.1, size * 0.6, size * 0.4);
        ctx.strokeRect(x + size * 0.2, y - size * 0.1, size * 0.6, size * 0.4);
    }
}

function drawBridge(ctx, x, y, width, height) {
    // Main bridge planks (wood)
    ctx.fillStyle = '#A0522D'; // Sienna
    ctx.fillRect(x - width / 2, y - height / 2, width, height);

    // Plank lines for texture
    ctx.strokeStyle = '#5E2C04'; // Darker brown
    ctx.lineWidth = 2;
    const numPlanks = 6;
    for (let i = 1; i < numPlanks; i++) {
        const plankX = x - width / 2 + (i * width / numPlanks);
        ctx.beginPath();
        ctx.moveTo(plankX, y - height / 2);
        ctx.lineTo(plankX, y + height / 2);
        ctx.stroke();
    }
    // Side ropes/rails
    ctx.fillStyle = '#D2B48C'; // Tan
    ctx.fillRect(x - width / 2 - 5, y - height / 2, 5, height);
    ctx.fillRect(x + width / 2, y - height / 2, 5, height);
    // Rope details
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - width / 2 - 2.5, y - height / 2);
    ctx.lineTo(x - width / 2 - 2.5, y + height / 2);
    ctx.moveTo(x + width / 2 + 2.5, y - height / 2);
    ctx.lineTo(x + width / 2 + 2.5, y + height / 2);
    ctx.stroke();
}

export function drawAllTowers(ctx){
    const drawTower = (tw, color) => {
        if (tw.hp <= 0) return;
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;

        const x = tw.x;
        const y = tw.y;

        if (tw.king) {
            // King Tower Shape
            const w = 50, h = 60;
            ctx.beginPath();
            ctx.moveTo(x - w / 2, y + h / 2);
            ctx.lineTo(x - w / 2, y - h / 4);
            ctx.lineTo(x - w / 4, y - h / 2);
            ctx.lineTo(x, y - h / 4);
            ctx.lineTo(x + w / 4, y - h / 2);
            ctx.lineTo(x + w / 2, y - h / 4);
            ctx.lineTo(x + w / 2, y + h / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Crown icon
            ctx.fillStyle = tw.active ? '#FFD700' : '#c0c0c0';
            ctx.font = '30px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('👑', x, y - 5);
        } else {
            // Princess Tower Shape
            const w = 40, h = 50;
            ctx.beginPath();
            ctx.moveTo(x - w/2, y + h/2);
            ctx.lineTo(x - w/2, y - h/3);
            ctx.lineTo(x, y - h/2);
            ctx.lineTo(x + w/2, y - h/3);
            ctx.lineTo(x + w/2, y + h/2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Castle icon
            ctx.fillStyle = 'white';
            ctx.font = '25px Arial';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('🏰', x, y);
        }

        // Health Bar
        const size = tw.king ? 50 : 40;
        const hpBarWidth = size + 10, hpBarHeight = 8, hpBarX = tw.x - hpBarWidth / 2, hpBarY = tw.y - (tw.king ? 45 : 40);
        ctx.fillStyle = '#222'; ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
        ctx.fillStyle = '#4CAF50'; ctx.fillRect(hpBarX, hpBarY, hpBarWidth * (Math.max(tw.hp,0) / tw.maxHp), hpBarHeight);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        ctx.strokeRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
        
        ctx.restore();
    };

    gameState.battle.towers.enemy.forEach(tw => drawTower(tw, '#F44336'));
    gameState.battle.towers.player.forEach(tw => drawTower(tw, '#2196F3'));
}

export function renderBattle(){
  const ctx = getCtx(); if (!ctx) return;
  const canvas = getCanvas();
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Dynamic Arena Background
  const currentArena = arenaData[gameState.player.currentArenaIndex];
  const bg = ctx.createLinearGradient(0,0,0,canvas.height);
  bg.addColorStop(0, currentArena.bgColor1);
  bg.addColorStop(1, currentArena.bgColor2);
  ctx.fillStyle = bg; ctx.fillRect(0,0,canvas.width,canvas.height);

  // Arena Decorations (drawn before paths and river)
  ctx.save();
  ctx.globalAlpha = 0.8;
  // Common elements
  const sidePadding = canvas.width * 0.05;
  const topPadding = canvas.height * 0.1;
  const bottomPadding = canvas.height * 0.9;

  switch (currentArena.id) {
      case 'arena1': // Goblin Stadium
          drawTree(ctx, sidePadding, topPadding, 80);
          drawTree(ctx, canvas.width - sidePadding, bottomPadding, 80);
          drawRock(ctx, sidePadding + 60, bottomPadding - 20, 40);
          break;
      case 'arena2': // Bone Pit
          drawBone(ctx, sidePadding, topPadding, 60, 'skull');
          drawBone(ctx, canvas.width - sidePadding, bottomPadding, 80, 'pile');
          break;
      case 'arena3': // Barbarian Bowl
          // Barbarian statue head
          ctx.fillStyle = '#CD853F';
          ctx.beginPath();
          ctx.arc(sidePadding, topPadding, 40, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#D2691E';
          ctx.fillRect(sidePadding - 5, topPadding - 45, 10, 20); // Horns
          ctx.fillRect(sidePadding - 25, topPadding - 35, 50, 10);
          break;
      case 'arena4': // Frozen Peak
          drawPineTree(ctx, sidePadding, topPadding + 60, 100);
          drawPineTree(ctx, canvas.width - sidePadding, bottomPadding, 100);
          drawRock(ctx, sidePadding, bottomPadding, 50, '#B0C4DE');
          break;
      case 'arena5': // Desert Temple
          drawCactus(ctx, sidePadding, topPadding + 50, 80);
          drawCactus(ctx, canvas.width - sidePadding, bottomPadding, 90);
          drawRock(ctx, sidePadding, bottomPadding, 60, '#D2B48C');
          break;
      case 'arena6': // Volcano Peak
          ctx.fillStyle = '#FF4500'; // Lava color
          ctx.beginPath();
          ctx.ellipse(sidePadding, topPadding, 50, 25, 0, 0, Math.PI * 2);
          ctx.fill();
          drawRock(ctx, canvas.width - sidePadding, bottomPadding, 70, '#404040');
          break;
  }
  ctx.restore();

  // Paths
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  const pathWidth = 120;
  ctx.fillRect(BRIDGES.leftX() - pathWidth/2, 0, pathWidth, canvas.height);
  ctx.fillRect(BRIDGES.rightX() - pathWidth/2, 0, pathWidth, canvas.height);

  // River and Bridges (common for all arenas)
  const riverY = BRIDGES.riverY();
  ctx.fillStyle = '#a9a9a9'; // Sandy/earthy shore color
  ctx.fillRect(0, riverY - 24 - 4, canvas.width, 4); // Top shore
  ctx.fillRect(0, riverY + 24, canvas.width, 4); // Bottom shore
  
  ctx.fillStyle = '#1976D2'; ctx.fillRect(0, riverY-24, canvas.width, 48);
  ctx.fillStyle = '#0d47a1'; ctx.fillRect(0, riverY-2, canvas.width, 4);
  
  // Bridges - NEW DETAILED DRAWING
  drawBridge(ctx, BRIDGES.leftX(), riverY, 88, 30);
  drawBridge(ctx, BRIDGES.rightX(), riverY, 88, 30);

  // NEW: Animated river highlights for "royale" feel
  const t = performance.now() * 0.002;
  ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = '#BBDEFB';
  for (let i = 0; i < 6; i++) {
    const offset = ((i * 150) + (t * 60)) % (canvas.width + 200) - 100;
    ctx.fillRect(offset, BRIDGES.riverY()-18, 80, 6);
  }
  ctx.restore();

  // Draw tower no-deploy zones
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "red";
  [...gameState.battle.towers.enemy, ...gameState.battle.towers.player].forEach(tw => {
      if(tw.hp > 0) {
          ctx.beginPath();
          ctx.arc(tw.x, tw.y, tw.king ? 60 : 50, 0, Math.PI * 2);
          ctx.fill();
      }
  });
  ctx.restore();

  // NEW: Draw player deployment boundary
  ctx.fillStyle = 'rgba(33, 150, 243, 0.1)'; // Light blue translucent
  ctx.fillRect(0, gameState.battle.playerDeploymentYBoundary, canvas.width, canvas.height - gameState.battle.playerDeploymentYBoundary);
  // NEW: Subtle arena field lines (pitch markings)
  ctx.save(); ctx.globalAlpha = 0.06; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  [0.25,0.5,0.75].forEach(r=>{
    const y = canvas.height * r;
    ctx.beginPath(); ctx.moveTo(canvas.width*0.08,y); ctx.lineTo(canvas.width*0.92,y); ctx.stroke();
  });
  ctx.restore();

  // NEW: Draw card placement indicator
  if (gameState.battle.selectedCard && gameState.battle.hoverTarget) {
    const ht = gameState.battle.hoverTarget;
    const cardType = gameState.battle.selectedCard.type;
    const cardBaseData = cardData[cardType];
    const isSpell = cardBaseData.type === 'spell';
    const isBuilding = cardBaseData.type === 'building';

    ctx.save();
    ctx.globalAlpha = 0.4;

    // Check if placement is valid (within player's deployable zone)
    const canPlaceAnywhere = cardBaseData.deployAnywhere || ['goblin-barrel', 'freeze', 'miner'].includes(cardType);
    const isValidPlacement = canPlaceAnywhere || ht.y >= gameState.battle.playerDeploymentYBoundary;

    // Draw placement indicator
    if (isSpell) {
        if (cardType === 'the-log') {
            ctx.fillStyle = isValidPlacement ? 'rgba(139, 69, 19, 0.5)' : 'rgba(255, 0, 0, 0.5)'; // Log color or red for invalid
            ctx.fillRect(ht.x - (cardBaseData.width || 80) / 2, ht.y - (cardBaseData.height || 40) / 2, (cardBaseData.width || 80), (cardBaseData.height || 40));
        } else if (cardType === 'goblin-barrel') {
            ctx.fillStyle = isValidPlacement ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'; // Green for valid, red for invalid
            ctx.beginPath();
            ctx.arc(ht.x, ht.y, (cardBaseData.radius || 2.5) * 30, 0, Math.PI * 2); // Approximate impact radius
            ctx.fill();
        } else if (cardType === 'freeze') {
            ctx.fillStyle = isValidPlacement ? 'rgba(173, 216, 230, 0.5)' : 'rgba(255, 0, 0, 0.5)'; // Light blue for freeze
            ctx.beginPath();
            ctx.arc(ht.x, ht.y, ht.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (cardType === 'poison') {
            ctx.fillStyle = isValidPlacement ? 'rgba(128, 0, 128, 0.5)' : 'rgba(255, 0, 0, 0.5)'; // Purple for poison
            ctx.beginPath();
            ctx.arc(ht.x, ht.y, ht.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            ctx.fillStyle = isValidPlacement ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 0, 0, 0.8)'; // Red for circular spells
            ctx.beginPath();
            ctx.arc(ht.x, ht.y, ht.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (isBuilding) {
        ctx.fillStyle = isValidPlacement ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'; // Green for valid building, red if invalid
        const buildingSize = ht.radius * 2 || 60; // Approximate building size
        ctx.fillRect(ht.x - buildingSize / 2, ht.y - buildingSize / 2, buildingSize, buildingSize);
    }
    else {
        ctx.fillStyle = isValidPlacement ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)'; // Green for troops/buildings, red if invalid
        // For troops, just a small circle indicating spawn point
        ctx.beginPath();
        ctx.arc(ht.x, ht.y, ht.radius || 15, 0, Math.PI * 2); // Default radius 15 for troops
        ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  drawAllTowers(ctx);

  // Render deployable buildings (like Cannon, Goblin Hut)
  gameState.battle.buildings.forEach(b => {
    if (b.hp <= 0) return;
    const baseCardData = cardData[b.type]; // Get card data for building
    // NEW: Soft shadow under buildings
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = 'black';
    const s = (baseCardData.visualSize || 60) * 0.55;
    ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, s, s * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = b.owner === 'player' ? '#2196F3' : '#F44336'; // Player blue, Enemy red
    const size = baseCardData.visualSize || 60; // Use visualSize from cardData, default to 60
    ctx.fillRect(b.x - size / 2, b.y - size / 2, size, size);
    ctx.font = '30px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'white';
    ctx.fillText(getCardEmoji(b.type), b.x, b.y + 2);

    // Draw health bar for buildings
    const hpBarWidth = size + 4, hpBarHeight = 6, hpBarX = b.x - hpBarWidth / 2, hpBarY = b.y - size / 2 - hpBarHeight - 5;
    ctx.fillStyle = '#222'; ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);
    ctx.fillStyle = '#4CAF50'; ctx.fillRect(hpBarX, hpBarY, hpBarWidth * (Math.max(b.hp,0) / b.maxHp), hpBarHeight);
    ctx.fillStyle = 'white'; ctx.font = '12px Noto Sans'; ctx.textAlign = 'center';
    ctx.fillText(String(Math.max(0, Math.floor(b.hp))), b.x, hpBarY - 6);

    // Render Freeze effect on buildings
    if (b.isFrozen && performance.now() < b.frozenUntil) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = 'lightblue';
        ctx.beginPath();
        ctx.arc(b.x, b.y, size * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // Render Poison effect on buildings
    if (b.isPoisoned) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'purple';
      ctx.beginPath();
      ctx.arc(b.x, b.y, size * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  // Render particles
  const now = performance.now();
  gameState.battle.particles = gameState.battle.particles.filter(p => now - p.startTime < p.duration);
  gameState.battle.particles.forEach(p => {
    const age = (now - p.startTime) / p.duration;
    ctx.globalAlpha = 1 - age;

    if (p.type === 'confetti') {
      // Confetti specific rendering
      p.x += p.velocity.x;
      p.y += p.velocity.y;
      p.velocity.y += p.gravity; // Apply gravity
      ctx.fillRect(p.x, p.y, p.size, p.size);
    } else {
      // Generic explosion particles
      ctx.fillStyle = p.color;
      p.x += p.velocity.x;
      p.y += p.velocity.y;
      const currentSize = p.size * (1 - age);
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;

  // Projectiles
  gameState.battle.projectiles.forEach(p=>{
    ctx.save();
    if (p.arrow){ const ang = Math.atan2(p.ty - p.y, p.tx - p.x); ctx.translate(p.x,p.y); ctx.rotate(ang);
      if (p.isPowerShot) { // Special look for Power Shot
        ctx.fillStyle = '#ffde7d'; // Golden color
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-12,4); ctx.lineTo(-12,-4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#c88f28'; ctx.lineWidth = 1; ctx.stroke();
      } else {
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8,3); ctx.lineTo(-8,-3); ctx.closePath(); ctx.fill();
      }
    } else { ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fillStyle='yellow'; ctx.fill(); }
    ctx.restore();
  });

  // Spells (like The Log, Freeze, Poison)
  gameState.battle.spells.forEach(s => {
    if (s.type === 'the-log') {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rotation); // Apply rotation for rolling effect
        
        const logWidth = s.width;
        const logHeight = s.height;

        // Main log body
        ctx.fillStyle = '#8B4513'; // Wood color
        ctx.strokeStyle = '#5A2C0A'; // Darker wood for outline
        ctx.lineWidth = 3;

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-logWidth / 2, -logHeight / 2, logWidth, logHeight, 15);
        } else {
            ctx.rect(-logWidth / 2, -logHeight / 2, logWidth, logHeight);
        }
        ctx.fill();
        ctx.stroke();

        // Wood grain lines
        ctx.strokeStyle = 'rgba(90, 44, 10, 0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(-logWidth / 2, -logHeight / 2 + (i * 8) + 4);
            ctx.bezierCurveTo(-logWidth / 4, -logHeight / 2 + (i * 8), logWidth / 4, -logHeight / 2 + (i * 8) + 8, logWidth / 2, -logHeight / 2 + (i * 8) + 4);
            ctx.stroke();
        }

        // Spikes
        ctx.fillStyle = '#C0C0C0'; // Silver color for spikes
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        
        const spikePoints = [-logHeight/2 + 5, 0, logHeight/2 - 5];
        spikePoints.forEach(spY => {
            // Left spikes
            ctx.beginPath();
            ctx.moveTo(-logWidth/2 - 8, spY); ctx.lineTo(-logWidth/2 + 2, spY - 4); ctx.lineTo(-logWidth/2 + 2, spY + 4);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
            
            // Right spikes
            ctx.beginPath();
            ctx.moveTo(logWidth/2 + 8, spY); ctx.lineTo(logWidth/2 - 2, spY - 4); ctx.lineTo(logWidth/2 - 2, spY + 4);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        });


        ctx.restore();
    } else if (s.type === 'freeze') {
        const age = (now - s.startTime) / s.duration;
        ctx.save();
        ctx.globalAlpha = 0.5 * (1 - age); // Fade out
        ctx.fillStyle = 'lightblue';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    } else if (s.type === 'poison') {
        const age = (now - s.startTime) / s.duration;
        ctx.save();
        ctx.globalAlpha = 0.4 * (1 - age); // Fade out
        ctx.fillStyle = 'purple';
        ctx.beginPath();
        // Create a 'cloud' like shape with multiple arcs or just a fuzzy circle
        ctx.arc(s.x, s.y, s.radius * 30, 0, Math.PI * 2);
        ctx.fill();
        // Optional: add some green for a noxious look
        ctx.globalAlpha = 0.3 * (1 - age);
        ctx.fillStyle = 'lightgreen';
        ctx.beginPath();
        ctx.arc(s.x + 10, s.y - 10, s.radius * 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
  });

  // Units
  gameState.battle.troops.forEach(t=>{
    // Determine unit size based on its cost
    const baseCard = cardData[t.type];
    let unitRadius = 15; // Default radius
    let emojiFontSize = '20px'; // Default font size

    if (baseCard) {
      if (baseCard.cost >= 7 || ['golem'].includes(t.type)) { // Very expensive cards like PEKKA, Mega Knight, Lava Hound, Golem
        unitRadius = 32;
        emojiFontSize = '30px';
      } else if (baseCard.cost >= 5) { // Moderately expensive cards like Barbarians, Giant Skeleton, Inferno Tower
        unitRadius = 25;
        emojiFontSize = '25px';
      } else if (baseCard.cost >= 3) { // Average cost cards like Knight, Musketeer, Baby Dragon
        unitRadius = 20;
        emojiFontSize = '20px';
      } else { // Cheap cards like Goblins, Skeletons, Zap
        unitRadius = 15;
        emojiFontSize = '18px';
      }
    }

    // Specific overrides
    if (['giantskeleton','pekka','mega-knight', 'golem'].includes(t.type)) { unitRadius = 32; emojiFontSize = '30px'; }
    if (['golemite'].includes(t.type)) { unitRadius = 22; emojiFontSize = '22px'; }
    if (['skeletons','skeleton-army'].includes(t.type)) { unitRadius = 10; emojiFontSize = '14px'; }
    // NEW: Soft shadow under troops
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = 'black';
    ctx.beginPath(); ctx.ellipse(t.x, t.y + Math.max(3, unitRadius*0.2), unitRadius*0.9, unitRadius*0.45, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
    ctx.fillStyle = t.owner==='player' ? '#2196F3' : '#F44336';
    ctx.beginPath(); ctx.arc(t.x,t.y,unitRadius,0,Math.PI*2); ctx.fill();
    // NEW: Team-colored outer ring for better visibility
    ctx.strokeStyle = t.owner==='player' ? 'rgba(0, 100, 255, 0.8)' : 'rgba(255, 50, 50, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font=emojiFontSize + ' Arial'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(getCardEmoji(t.type), t.x, t.y+2);

    // NEW: Render Knight's Shield
    if (t.isEvolved && t.type === 'knight' && t.shieldActive && t.shieldHp > 0) {
        ctx.save();
        ctx.strokeStyle = 'cyan';
        ctx.fillStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(t.x, t.y, unitRadius + 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Shield health bar
        const shieldBarWidth = unitRadius * 1.5;
        const shieldBarY = t.y + unitRadius + 2;
        ctx.fillStyle = '#222';
        ctx.fillRect(t.x - shieldBarWidth / 2, shieldBarY, shieldBarWidth, 3);
        ctx.fillStyle = 'cyan';
        ctx.fillRect(t.x - shieldBarWidth / 2, shieldBarY, shieldBarWidth * (Math.max(t.shieldHp, 0) / t.maxShieldHp), 3);
        ctx.restore();
    }

    // NEW: Render golden aura for player's golden units
    const playerCard = gameState.player.cards[t.type];
    if (t.owner === 'player' && playerCard && playerCard.isGolden) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)'; // Gold color
        ctx.lineWidth = 3;
        ctx.shadowColor = 'gold';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(t.x, t.y, unitRadius + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Draw health bar for units
    const hpBarWidth = unitRadius * 2; // Health bar width scales with unit size
    const hpBarHeight = 4; // Small health bar height
    const hpBarX = t.x - hpBarWidth / 2;
    const hpBarY = t.y - unitRadius - hpBarHeight - 2; // Position above the unit circle

    ctx.fillStyle = '#222'; // Background for health bar
    ctx.fillRect(hpBarX, hpBarY, hpBarWidth, hpBarHeight);

    // Green fill for current HP
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(hpBarX, hpBarY, hpBarWidth * (Math.max(t.hp, 0) / t.maxHp), hpBarHeight);

    // NEW: Render charge effect for Prince
    if (t.type === 'prince' && t.isCharging) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(t.x, t.y, unitRadius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Render Freeze effect on troops
    if (t.isFrozen && performance.now() < t.frozenUntil) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = 'lightblue';
        ctx.beginPath();
        ctx.arc(t.x, t.y, unitRadius * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    // Render Poison effect on troops
    if (t.isPoisoned) { // No expiry needed here, just check if marked
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = 'purple';
      ctx.beginPath();
      ctx.arc(t.x, t.y, unitRadius * 1.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  // Emotes (float and fade)
  const nowEmote = performance.now();
  gameState.battle.emotes = gameState.battle.emotes.filter(e => nowEmote - e.t < 2000);
  gameState.battle.emotes.forEach(e=>{
    const age = nowEmote - e.t; const alpha = 1 - age/2000; const dy = - (age/2000)*30;
    ctx.globalAlpha = Math.max(0,alpha);
    ctx.fillStyle = 'white'; ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    const w=50,h=40, x=e.x - w/2, y=e.y + dy - h/2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x,y,w,h,8) : ctx.fillRect(x,y,w,h);
    ctx.fill(); ctx.stroke();
    ctx.globalAlpha = Math.max(0,alpha);
    ctx.fillStyle = '#111'; ctx.font='20px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(e.emoji, e.x, e.y + dy);
    ctx.globalAlpha = 1;
  });
}