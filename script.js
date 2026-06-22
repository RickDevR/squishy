// Play sound for a given squishy ID (1–10)
function playSound(id) {
    const wav = `squishy${id}.wav`;
    const mp3 = `squishy${id}.mp3`;

    const audio = new Audio();

    // Try WAV first
    audio.src = wav;
    audio.onerror = () => {
        // If WAV fails, try MP3
        audio.src = mp3;
        audio.play().catch(() => {});
    };

    audio.play().catch(() => {});
}

// Add click behavior to all squishies
document.querySelectorAll(".squishy").forEach(squishy => {
    squishy.addEventListener("click", () => {
        const id = squishy.getAttribute("data-sound");

        // Play sound
        playSound(id);

        // Add squish animation
        squishy.classList.add("clicked");
        setTimeout(() => {
            squishy.classList.remove("clicked");
        }, 150);
    });
});
