import { initGame } from './battle.js';
import { showMainMenu, updateMainMenuDisplay, exposeUIToWindow, loadGame, attachGlobalEventListeners } from './ui.js';

document.addEventListener('DOMContentLoaded', ()=>{
  const splashScreen = document.getElementById('splashScreen');
  const loadingScreen = document.getElementById('loadingScreen');
  const appContainer = document.getElementById('app');

  // 1. Show Splash Screen
  splashScreen.classList.add('active');
  loadingScreen.classList.remove('active');
  appContainer.classList.add('app-hidden'); // Ensure main app is hidden

  setTimeout(() => {
    // 2. Hide Splash Screen, Show Loading Screen
    splashScreen.classList.remove('active');
    loadingScreen.classList.add('active');

    // Perform game initialization while loading screen is visible
    loadGame();
    initGame();
    exposeUIToWindow(); 
    attachGlobalEventListeners();

    setTimeout(() => {
      // 3. Hide Loading Screen, Show Main App
      loadingScreen.classList.remove('active');
      appContainer.classList.remove('app-hidden');
      
      // Ensure the main menu screen within the app is properly activated
      showMainMenu(); 
      updateMainMenuDisplay();
    }, 1500); // Simulate loading for 1.5 seconds, then transition to main menu
  }, 2000); // Show splash screen for 2 seconds
});