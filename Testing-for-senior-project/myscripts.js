// This controls the audio
document.addEventListener('DOMContentLoaded', function () {
    let audio = document.getElementById("audio");

    window.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
            audio.currentTime = 0; 
        }
    });
});

// This controls changing from instruction page to home page
function startGame() {
    // Hide the instruction div
    document.querySelector('.instruction').style.display = 'none';
    
    // Show the rest of the body content
    document.querySelector('.whole').style.display = 'block';
}

// This controls the setting page pop out
function showWhiteBoard() {
    const whiteBoard = document.querySelector('.whiteBoard');
    whiteBoard.classList.toggle('hidden');
  
    if (whiteBoard.classList.contains('hidden')) {
      whiteBoard.style.height = '0';
    } else {
    //   whiteBoard.style.height = window.innerHeight + 'px';
    whiteBoard.style.height = whiteBoard.clientHeight === 0 ?  window.innerHeight + 'px' : '0';
    }
  }
  
function hideWhiteBoard() {
    const whiteBoard = document.querySelector('.whiteBoard');
    whiteBoard.classList.add('hidden');
    whiteBoard.style.height = '0';
}
  
function playClickSound() {
    const clickSound = new Audio('clicking.wav');
    clickSound.play();
}

  