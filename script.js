// ====== GLOBAL STATE ======
let audioContext = null;
let masterVolume = 0.8;
let isMuted = false;
let spotlightEnabled = false;

// Cache for verified custom audio files
const availableAudioFiles = {};

// ====== AUDIO HELPERS ======
function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Check and play custom file or fallback to realistic procedural sound
function playSquishySound(id) {
    ensureAudioContext();

    if (availableAudioFiles[id] === true) {
        playFileSound(id);
        return;
    }
    if (availableAudioFiles[id] === false) {
        playRealisticSynthesizedSound(id);
        return;
    }

    // Probe for custom file
    const wav = `squishy${id}.wav`;
    const audio = new Audio();
    audio.volume = isMuted ? 0 : masterVolume;
    audio.src = wav;

    audio.oncanplaythrough = () => {
        availableAudioFiles[id] = true;
        audio.play().catch(() => {});
    };

    audio.onerror = () => {
        const mp3 = `squishy${id}.mp3`;
        const audioMp3 = new Audio(mp3);
        audioMp3.volume = isMuted ? 0 : masterVolume;
        audioMp3.oncanplaythrough = () => {
            availableAudioFiles[id] = true;
            audioMp3.play().catch(() => {});
        };
        audioMp3.onerror = () => {
            availableAudioFiles[id] = false;
            playRealisticSynthesizedSound(id);
        };
        audioMp3.play().catch(() => {
            availableAudioFiles[id] = false;
            playRealisticSynthesizedSound(id);
        });
    };

    audio.play().catch(() => {});
}

function playFileSound(id) {
    const audio = new Audio(`squishy${id}.wav`);
    audio.volume = isMuted ? 0 : masterVolume;
    audio.play().catch(() => {
        const audioMp3 = new Audio(`squishy${id}.mp3`);
        audioMp3.volume = isMuted ? 0 : masterVolume;
        audioMp3.play().catch(() => {});
    });
}

// Ultra-realistic multi-stage Web Audio squishy sound synthesizer
function playRealisticSynthesizedSound(id) {
    const ctx = audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();

    // Frequency shaping for realistic foam compression feel
    let baseFreq = 140 + ((id * 23) % 180);
    osc.type = (id % 2 === 0) ? "triangle" : "sine";

    // Pitch drop and slow-rise simulation
    osc.frequency.setValueAtTime(baseFreq * 1.6, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.35);

    // Lowpass filter for muffled, soft foam texture
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(400, now + 0.35);

    const vol = isMuted ? 0 : masterVolume;
    const duration = 0.38;

    // Amplitude envelope: smooth squeeze attack and slow-release bounce
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol * 0.95, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Filtered noise buffer for authentic squishy air/friction sound
    const bufferSize = 512;
    const noise = ctx.createScriptProcessor(bufferSize, 1, 1);
    noise.onaudioprocess = function(e) {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * 0.3;
        }
    };

    noiseGain.gain.setValueAtTime(vol * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    // Connections
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    setTimeout(() => {
        try {
            noise.disconnect();
            noiseGain.disconnect();
        } catch(e) {}
    }, (duration + 0.1) * 1000);
}

// Visualizer pulse
function triggerVisualizer() {
    const pulse = document.getElementById("visualizer-pulse");
    pulse.classList.add("active");
    setTimeout(() => pulse.classList.remove("active"), 220);
}

// Random border-radius morph
function randomMorph(squishy) {
    const r = () => Math.floor(Math.random() * 40) + 30;
    const br = `${r()}% ${100 - r()}% ${r()}% ${100 - r()}% / ${100 - r()}% ${r()}% ${100 - r()}% ${r()}%`;
    const inner = squishy.querySelector(".sq-inner");
    if (inner && !squishy.classList.contains('sq-needle')) {
        inner.style.borderRadius = br;
    }
}

// Spotlight modal management
function openSpotlight(squishy) {
    const modal = document.getElementById("spotlight-modal");
    const spotSq = document.getElementById("spotlight-squishy");
    const spotEmoji = document.getElementById("spotlight-emoji");
    const nameEl = document.getElementById("spotlight-name");
    const descEl = document.getElementById("spotlight-desc");
    const audioEl = document.getElementById("spotlight-audio");

    const id = squishy.getAttribute("data-id");
    const name = squishy.getAttribute("data-name");
    const info = squishy.getAttribute("data-info");
    const emojiText = squishy.querySelector("span") ? squishy.querySelector("span").textContent : "";

    const inner = squishy.querySelector(".sq-inner");
    const style = window.getComputedStyle(inner || squishy);
    spotSq.style.background = style.background;
    spotSq.style.borderRadius = style.borderRadius;
    spotEmoji.textContent = emojiText;

    nameEl.textContent = name;
    descEl.textContent = info;
    audioEl.textContent = availableAudioFiles[id] === true 
        ? `🎵 Custom Audio File Active (ID ${id})` 
        : `✨ Realistic Synthesized Audio Active (ID ${id})`;

    modal.classList.add("active");
}

function closeSpotlight() {
    document.getElementById("spotlight-modal").classList.remove("active");
}

// Random highlight
function highlightRandomSquishy() {
    const squishies = Array.from(document.querySelectorAll(".squishy"));
    if (!squishies.length) return;
    const random = squishies[Math.floor(Math.random() * squishies.length)];

    squishies.forEach(s => s.classList.remove("highlighted"));
    random.classList.add("highlighted");

    random.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => random.classList.remove("highlighted"), 900);
}

// Shuffle styles
function shuffleStyles() {
    const squishies = Array.from(document.querySelectorAll(".squishy"));
    squishies.forEach(s => {
        if (!s.classList.contains('sq-needle')) {
            randomMorph(s);
        }
    });
}

// Update info panel
function updateInfoPanel(squishy) {
    const name = squishy.getAttribute("data-name");
    const info = squishy.getAttribute("data-info");
    const id = squishy.getAttribute("data-id");
    const audioType = availableAudioFiles[id] === true 
        ? `Custom Audio File (squishy${id}.wav/.mp3)` 
        : `High-Fidelity Procedural Squish Sound`;

    document.getElementById("info-name").textContent = name;
    document.getElementById("info-desc").textContent = info;
    document.getElementById("info-audio").textContent = audioType;
    document.getElementById("info-id").textContent = id;
}

// UI controls setup
function setupSizeSlider() {
    const slider = document.getElementById("size-slider");
    slider.addEventListener("input", () => {
        const scale = parseFloat(slider.value);
        document.querySelectorAll(".squishy").forEach(s => {
            s.style.transform = `scale(${scale})`;
        });
    });
}

function setupThemeSelector() {
    const select = document.getElementById("theme-select");
    select.addEventListener("change", () => {
        document.documentElement.setAttribute("data-theme", select.value);
    });
}

function setupDarkToggle() {
    const toggle = document.getElementById("dark-toggle");
    toggle.addEventListener("change", () => {
        document.body.classList.toggle("dark-mode", toggle.checked);
    });
}

function setupAudioControls() {
    const volSlider = document.getElementById("volume-slider");
    const muteBtn = document.getElementById("mute-btn");

    volSlider.addEventListener("input", () => {
        masterVolume = parseFloat(volSlider.value);
    });

    muteBtn.addEventListener("click", () => {
        isMuted = !isMuted;
        muteBtn.textContent = isMuted ? "Unmute" : "Mute";
    });
}

function setupSpotlightToggle() {
    const btn = document.getElementById("spotlight-toggle");
    btn.addEventListener("click", () => {
        spotlightEnabled = !spotlightEnabled;
        btn.textContent = spotlightEnabled ? "Spotlight: ON" : "🔍 Spotlight";
    });

    document.getElementById("spotlight-close").addEventListener("click", closeSpotlight);
    document.getElementById("spotlight-modal").addEventListener("click", e => {
        if (e.target.id === "spotlight-modal") closeSpotlight();
    });
}

function setupTabs() {
    const buttons = document.querySelectorAll(".tab-btn");
    const contents = {
        squishies: document.getElementById("tab-squishies"),
        info: document.getElementById("tab-info"),
        settings: document.getElementById("tab-settings"),
        about: document.getElementById("tab-about")
    };

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            Object.keys(contents).forEach(key => {
                contents[key].classList.toggle("active", key === tab);
            });
        });
    });
}

function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    overlay.style.opacity = "0";
    setTimeout(() => overlay.style.display = "none", 400);
}

// MAIN INIT
document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupSizeSlider();
    setupThemeSelector();
    setupDarkToggle();
    setupAudioControls();
    setupSpotlightToggle();

    document.getElementById("random-btn").addEventListener("click", highlightRandomSquishy);
    document.getElementById("shuffle-btn").addEventListener("click", shuffleStyles);

    // Squishy interaction handler
    document.querySelectorAll(".squishy").forEach(squishy => {
        squishy.addEventListener("click", () => {
            const id = parseInt(squishy.getAttribute("data-id"), 10);

            // Trigger realistic multi-directional top-down squish animation
            squishy.classList.remove("clicked");
            void squishy.offsetWidth;
            squishy.classList.add("clicked");

            // Morph shape slightly
            if (!squishy.classList.contains('sq-needle')) {
                randomMorph(squishy);
            }

            // Play realistic sound
            playSquishySound(id);

            // Pulse visualizer
            triggerVisualizer();

            // Update info panel
            updateInfoPanel(squishy);

            // Spotlight modal if enabled
            if (spotlightEnabled) {
                openSpotlight(squishy);
            }
        });
    });

    setTimeout(hideLoadingOverlay, 850);
});