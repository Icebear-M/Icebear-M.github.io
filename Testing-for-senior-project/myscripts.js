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

