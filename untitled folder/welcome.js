import * as Game from './game.js'

// This controls changing from instruction page to home page
function startGame() {
  // Hide the instruction div
  document.querySelector('.instruction').style.display = 'none';
  document.querySelector('.exitingGame').style.display = 'none';
  document.querySelector('.pauseGame').style.display = 'none';
  
  // Show the rest of the body content
  document.querySelector('.whole').style.display = 'block';
}

// This controls the setting page pop out
function showWhiteBoard() {
  const whiteBoard = document.querySelector('.whiteBoard');
  whiteBoard.classList.remove('hidden');

  console.log(whiteBoard.classList)

  if (whiteBoard.classList.contains('hidden')) {
    whiteBoard.style.height = '0';
  } else {
  //   whiteBoard.style.height = window.innerHeight + 'px';
  whiteBoard.style.height = whiteBoard.clientHeight === 0 ?  window.innerHeight + 'px' : '0';
  }
}

// This is the setting white board
function hideWhiteBoard() {
  returnToGame()
  const whiteBoard = document.querySelector('.whiteBoard');
  whiteBoard.classList.add('hidden');
  whiteBoard.style.height = '0';
}

// This is the clicking sound
function playClickSound() {
  const clickSound = new Audio('clicking.wav');
  clickSound.play();
}

//this controls the background music
let bgmusic;
let audioContext;
let sheepSound;

function initAudioContext() {
  // Create an AudioContext only if it hasn't been created yet
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Attempt to resume the AudioContext within a user-triggered event
  if (audioContext.state === 'suspended') {
    const resumeContext = () => {
      audioContext.resume().then(() => {
        if (bgmusic) {
          bgmusic.play();
        }
      });
    };

    document.addEventListener('click', resumeContext, { once: true });
  }
}

function playBgMusic() {
  if (!bgmusic) {
    // If audio is not initialized, create a new Audio element
    bgmusic = new Audio("public/bgMusic.mp3");
    bgmusic.loop = true;
  }

  initAudioContext();

  // Toggle between play and pause
  if (bgmusic.paused) {
    bgmusic.play();
  } else {
    bgmusic.pause();
  }
}

function initAudioC() {
  // Create an AudioContext only if it hasn't been created yet
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Attempt to resume the AudioContext within a user-triggered event
  if (audioContext.state === 'suspended') {
    const resumeContext = () => {
      audioContext.resume().then(() => {
        if (sheepSound) {
          sheepSound.play();
        }
      });
    };

    document.addEventListener('click', resumeContext, { once: true });
  }
}

//This is the sheep background sound effect
function playsheepMusic() {
  if (!sheepSound) {
    // If audio is not initialized, create a new Audio element
    sheepSound = new Audio('public/sheepAudio.mp3')
    sheepSound.loop = true;
  }

  initAudioC();

  // Toggle between play and pause
  if (sheepSound.paused) {
    sheepSound.play();
  } else {
    sheepSound.pause();
  }
}

// This the the return to game button from the pause and exit pop outs
function returnToGame(){
  const pauseGame = document.querySelector('.pauseGame');
  const exitGame = document.querySelector('.exitingGame');
  pauseGame.style.display = 'none';
  exitGame.style.display = 'none';
}

// When you click on the pause button, the pause block will pop out
function togglePauseGame(){
  returnToGame()
  const pauseGameDiv = document.querySelector('.pauseGame');
  
  // Toggle the visibility of the pauseGame div
  if (pauseGameDiv.style.display == 'none' || pauseGameDiv.style.display == '') {
    pauseGameDiv.style.display = 'block';
  } else {
    pauseGameDiv.style.display = 'none';
  }
}

// When you click on the exit button, the exit block will pop out
function toggleExitGame(){
  returnToGame()
  const exitGamediv = document.querySelector('.exitingGame');

  if (exitGamediv.style.display == 'none' || exitGamediv.style.display == '') {
      exitGamediv.style.display = 'block';
    } else {
      exitGamediv.style.display = 'none';
    }
}

// When you click on the quit and exit button, it will take you to the instruction page
function showInstruction(){
  const wholeDiv = document.querySelector('.whole');
  const instructionDiv = document.querySelector('.instruction');
  
  wholeDiv.style.display = 'none';
  instructionDiv.style.display = 'block';
}

playBgMusic();
playsheepMusic();

// function loadGameScript() {
//   // Create a new script element
//   var script = document.createElement('script');

//   // Set the type attribute
//   script.type = 'module';

//   // Set the src attribute to your bundle.js file
//   script.src = 'bundle.js';

//   // Append the script element to the body or head of the document
//   document.head.appendChild(script);

//   // Optionally, you can remove the "Play Game" button or hide the instruction page
//   // based on your game's logic
//   var instructionPage = document.querySelector('.instruction');
//   instructionPage.style.display = 'none';
// }

// This is the start game button
document.querySelector('.btnInstruction-popup').addEventListener('click', function() {
  playClickSound();
  startGame();
  loadGameScript();
  Game.playGame();
});

// This is the return to game button
document.querySelectorAll('.return').forEach(function(button) {
  button.addEventListener('click', function() {
    playClickSound();
    returnToGame();
    Game.resumeGame()
  });
});
// this is exit game button
document.querySelectorAll('.exitGame').forEach(function(button) {
  button.addEventListener('click', function() {
    playClickSound();
    showInstruction();
    Game.stopGame();
  });
});

// this is setting button
document.querySelector('.setting').addEventListener('click', function() {
  playClickSound();
  Game.pauseGame();
  showWhiteBoard();
});

// this is a bunch of button on the white board
document.querySelectorAll('.bunch').forEach(function(button) {
  button.addEventListener('click', function() {
    playClickSound();
  });
});

// this is pause game button
document.querySelector('.pause').addEventListener('click', function() {
  playClickSound();
  togglePauseGame();
  Game.pauseGame();
});

// this is exit button
document.querySelector('.exit').addEventListener('click', function() {
  playClickSound();
  toggleExitGame();
  Game.pauseGame();
});

// this is exit button on the white board
document.querySelector('.exit1').addEventListener('click', function() {
  playClickSound();
  hideWhiteBoard();
  Game.resumeGame()
});

// this is the music button on the white board
document.querySelector('.musicControl').addEventListener('click', function() {
  playBgMusic();
});

document.querySelector('.music').addEventListener('click', function() {
  playClickSound();
  showWhiteBoard();
});


if (import.meta.env.VITE_SKIPWELCOME === 'true') {
  console.log("here")
  // startGame()
  document.querySelector('.btnInstruction-popup').click()
}