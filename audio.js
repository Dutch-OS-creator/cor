let audioCtx, musicNode, musicEl;

function getCtx(){ 
  if(!audioCtx) 
    audioCtx = new (window.AudioContext||window.webkitAudioContext)(); 
  return audioCtx; 
}

function beep(freq=440, dur=0.06, type='sine', vol=0.015){
  const ctx=getCtx(), o=ctx.createOscillator(), g=ctx.createGain(); 
  o.type=type; 
  o.frequency.value=freq;
  g.gain.value=vol; 
  o.connect(g); 
  g.connect(ctx.destination); 
  o.start(); 
  o.stop(ctx.currentTime+dur);
}

export function playSound(name){
  if(name==='spawn') 
    beep(520,0.06,'sine',0.02);
  else if(name==='arrow') 
    beep(1200, 0.04, 'triangle', 0.01);
  else if(name==='shot') 
    beep(420,0.05,'sine',0.02);
  else if(name==='hit') 
    beep(180,0.07,'sine',0.025);
  else if(name==='win') 
    beep(660,0.12,'sine',0.03);
  else if(name==='lose') 
    beep(140,0.18,'sine',0.03);
  else if(name==='tower_destroyed') {
      beep(100, 0.2, 'sawtooth', 0.04);
      setTimeout(() => beep(80, 0.3, 'square', 0.04), 100);
  } else if(name==='chest_open') { 
      beep(700, 0.1, 'triangle', 0.03);
      setTimeout(() => beep(900, 0.15, 'triangle', 0.03), 50);
      setTimeout(() => beep(1200, 0.2, 'triangle', 0.03), 100);
  } else if(name==='log_roll') {
      beep(150, 0.1, 'sawtooth', 0.02);
      setTimeout(() => beep(120, 0.1, 'square', 0.015), 50);
  } else if (name === 'reward_reveal') { // NEW: Sound for revealing individual rewards
      beep(800, 0.05, 'sine', 0.02);
      setTimeout(() => beep(900, 0.05, 'sine', 0.02), 50);
  } else if (name === 'freeze') { // NEW: Freeze spell sound
      beep(1500, 0.3, 'triangle', 0.02);
      setTimeout(() => beep(2000, 0.2, 'sine', 0.01), 100);
  } else if (name === 'poison') { // NEW: Poison spell sound
      beep(100, 0.4, 'square', 0.02);
      setTimeout(() => beep(80, 0.2, 'sine', 0.01), 150);
  }
}

export function startMusic(){
  const ctx=getCtx(); 
  if(musicNode){ 
    musicNode.stop(); 
    musicNode.disconnect(); 
    musicNode=null; 
  }
  if(!musicEl){
    musicEl = new Audio('https://files.freemusicarchive.org/storage-freemusicarchive-org/music/no_curator/Komiku/Poupis_Adventure/Komiku_-_07_-_Battle_of_Pogs.mp3');
    musicEl.loop = true; 
    musicEl.volume = 0.35;
  }
  musicEl.currentTime = 0; 
  musicEl.play().catch(()=>{ /* ignore autoplay block */ });
}

export function stopMusic(){ 
  if(musicEl){ 
    musicEl.pause(); 
  } 
}