import * as Game from './game.js' //We can use the functions in game.js through importing.

// This controls changing from instruction page to home page
function startGame() {
  // Hide the instruction div
  document.querySelector('.instruction').style.display = 'none';

  
  // Show the rest of the body content
  document.querySelector('.whole').style.display = 'block';
}

// This is the clicking sound effect
function playClickSound() {
  if (!userPausedSound){
    const clickSound = new Audio('clicking.wav');
    clickSound.play();
  }
}


let bgmusic; //initialize the bgmusic as a boolean to keep track of the background music is on or off.
let audioContext; //initialize the audio context
let sheepSound; //initialize the sheep sound
let userPausedMusic = false; //store user action with pausing the music
let userPausedSound = false; //store user action with pausing the soudn effects

//Make the music and sound effect in the same pace with the colour changing: when it's off, change the text into red; when it's on, change it back to the original color.
//Store user preferences with the music and sound effect. When user paused and the music and exit the game, when they come back, the music will stay paused.
if (localStorage.getItem("userPausedMusic") == undefined) {
  localStorage.setItem("userPausedMusic", "false")
} else {
  userPausedMusic = (localStorage.getItem("userPausedMusic") == "true")
  if (userPausedMusic) { document.querySelector('.musicControl').style.color = 'maroon'; }
}

if (localStorage.getItem("userPausedSound") == undefined) {
  localStorage.setItem("userPausedSound", "false")
} else {
  userPausedSound = (localStorage.getItem("userPausedSound") == "true")
  if (userPausedSound) { document.querySelector('.sound').style.color = 'maroon'; }
}

// Initialize the audio context for background music
function initAudioContext() {
  // Create an AudioContext only if it hasn't been created yet
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Attempt to resume the AudioContext within a user-triggered event
  if (audioContext.state === 'suspended') {
    const resumeContext = () => {
      audioContext.resume();
    };

    // Listen for a click event to resume the AudioContext
    document.addEventListener('click', resumeContext, { once: true });
  }
}

// Play or pause the background music based on user preferences and visibility
function playBgMusic() {
  if (!bgmusic) {
    // If audio is not initialized, create a new Audio element
    bgmusic = new Audio("bgMusic.mp3");
    bgmusic.loop = true;
  }

  // Initialize the audio context
  initAudioContext();

  // Toggle between play and pause
  if (document.hidden) {
    // Pause music if the screen is not visible
    bgmusic.pause();
  } else {
    // If the screen is visible
    if (userPausedMusic) {
      // If user prefers paused state, pause the music
      bgmusic.pause();
    } else {
      // If user prefers playing state or it's the initial play, play the music
      bgmusic.play();
    }
  }
}

// Play or pause the sheep background sound effect based on user preferences and visibility
function playsheepMusic() {
  if (!sheepSound) {
    // If audio is not initialized, create a new Audio element
    sheepSound = new Audio('sheepAudio.mp3')
    sheepSound.loop = true;
  }

  //Intialize the audio context
  initAudioContext();
  
  //Toggle between play and pause based on visibility and user preferences.
  if (document.hidden) {
    // Pause music if the screen is not visible
    sheepSound.pause();
  } else {
    // If the screen is visible
    if (userPausedSound) {
      // If user prefers paused state, pause the music
      sheepSound.pause();
    } else {
      // If user prefers playing state or it's the initial play, play the music
      sheepSound.play();
    }
  }
}

// Listen for visibility change and adjust background music and sheep sound accordingly
document.addEventListener("visibilitychange", () => {
  playBgMusic();
  playsheepMusic();
});


// When you click on the quit and exit button, it will take you to the instruction page
function showInstruction(){
  const wholeDiv = document.querySelector('.whole');
  const instructionDiv = document.querySelector('.instruction');
  
  wholeDiv.style.display = 'none';
  instructionDiv.style.display = 'block';
}


// HTML should ideally focus on the structure and content of the document.
// JavaScript should handle the behavior and interactivity of the page.
// Using addEventListener allows you to keep JavaScript separate from HTML, promoting a cleaner and more maintainable code structure.
// With addEventListener, you can easily attach multiple event listeners to the same element for the same event.

// These are querySelector buttons and there eventlisteners.
// This is the start game button
document.querySelector('.btnInstruction-popup').addEventListener('click', function() {
  // This button starts locked untill the game is initilized. `game.js` unlocks it at the end of `game_init()`.
  // Future devs: If you change the element selector here, remember to also change it in `game_init()`. 
  playClickSound(); //when you click on the button, it will have a clicking sound.
  startGame(); //it will show the game world.
  //When you click on play game button, it should reset the score, counter and timer.
  Game.resetScoreAndCounter();

  //autoplay when refresh the page
  if (!userPausedMusic) { playBgMusic(); }
  if (!userPausedSound) { playsheepMusic();; }

  Game.playGame();//the playGame function is imported from the game.js, it will start the timer, counter and score tracter, and intialize the sheep and shepherd, so it's ready for the user to play.
  Game.awayEndGamePopup(); //awayEndGamePopup is when user finish the game, the end game animation will be disabled.

  //The following code will make the game world slide up when the user click on the play game button.
  const gameLabelsCanvas = document.getElementById('game_labels_canvas');
  gameLabelsCanvas.classList.add('slide-up');
});


// This is the resume game button
document.querySelectorAll('.return').forEach(function(button) {
  button.addEventListener('click', function() {
    playClickSound();
    document.querySelector('.pauseGame').classList.remove('fade-in');
    Game.resumeGame() //the resumeGame function will resume the game and timer, so that user can keep playing from wherever they left.
  });
});

// this is exit game button
document.querySelectorAll('.exitGame').forEach(function(button) {
  button.addEventListener('click', function() {
    playClickSound();
    document.querySelector('.pauseGame').classList.remove('fade-in');
    showInstruction(); //This will take you back to the instruction page
    Game.stopGame(); //This will stop the game 
  });
});

// this is pause game button
document.querySelector('.pause').addEventListener('click', function() {
  playClickSound(); 
  document.querySelector('.pauseGame').classList.add('fade-in'); //Make the pause game div fade in
  Game.pauseGame(); //This will pause the game and the timer, so that user won't be able to play the game until they click on resume game.
});

// this is the music button on the pause game pop out
document.querySelector('.musicControl').addEventListener('click', function() {
  userPausedMusic = !userPausedMusic //set userPausedMusic to true
  playBgMusic(); //call play background music function
  if (userPausedMusic) {
    localStorage.setItem("userPausedMusic", "true"); // Save user preference to local storage
    this.style.color = 'maroon'; // Set button color to indicate paused state
  } else {
    localStorage.setItem("userPausedMusic", "false"); // Save user preference to local storage
    this.style.color = ''; // Set button color to default (indicating playing state)
  }
});

//Sound effect button click event listener
document.querySelector('.sound').addEventListener('click', function() {
  userPausedSound = !userPausedSound //set userPausedSound to true
  playClickSound(); // Play click sound effect
  playsheepMusic(); // Play or pause sheep background sound effect
  if (userPausedSound) {
    localStorage.setItem("userPausedSound", "true"); // Save user preference to local storage
    this.style.color = 'maroon'; // Set button color to indicate paused state
  } else {
    localStorage.setItem("userPausedSound", "false"); // Save user preference to local storage
    this.style.color = ''; // Set button color to default (indicating playing state)
  }
});

// Play agian button click event listener
document.querySelector('.replay').addEventListener('click', async function() {
  playClickSound(); // Play click sound effect
  await Game.stopGame(); // Stop the game (async function)
  Game.playGame(); //Start the game
  Game.awayEndGamePopup(); //Close the end game popout
  Game.resetScoreAndCounter(); //Reset game score and counter
});

// PlaySheep button click event listener
document.querySelector('.playSheep').addEventListener('click', function() {
  playClickSound(); //Play click sound effect
  Game.resumeGame(); //Resume the game
  Game.awayEndGamePopup(); //Close the end game popup
});

