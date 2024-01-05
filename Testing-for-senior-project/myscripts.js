// window.addEventListener('click', ()=>{
//     document.getElementById("audio").play();
// });

document.addEventListener('DOMContentLoaded', function () {
    let audio = document.getElementById("audio");

    window.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
        } else {
            audio.pause();
            audio.currentTime = 0; // Rewind to the beginning
        }
    });
});

function startGame() {
    // Hide the instruction div
    document.querySelector('.instruction').style.display = 'none';
    
    // Show the rest of the body content
    document.querySelector('.whole').style.display = 'block';
}