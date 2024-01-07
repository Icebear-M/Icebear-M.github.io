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
    whiteBoard.style.height = whiteBoard.clientHeight === 0 ?  window.innerHeight + 'px' : '0';
}