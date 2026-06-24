// ====== GLOBAL STATE ======
let audioContext = null;
let masterVolume = 0.8;
let isMuted = false;
let spotlightEnabled = false;

// ====== AUDIO HELPERS ======
function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Play file-based sound (for squishy 1–10)
function playFileSound(id) {
    const wav = `squishy${id}.wav`;
    const mp3 = `squishy${id}.mp3`;
    const audio = new Audio();

    audio.volume = isMuted ? 0 : masterVolume;

    audio.src = wav;
    audio.onerror = () => {
        audio.src = mp3;
        audio.play().catch(() => {});
    };

    audio.play().catch(() => {});
}

// Play generated squishy sound (for squishy 11–30)
function playGeneratedSquishySound(id) {
    ensureAudioContext();
    const ctx = audioContext;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noiseGain = ctx.createGain();

    const now = ctx.currentTime;

    // Base frequency and character per ID
    let baseFreq = 220 + (id - 11) * 15;
    if (id % 5 === 0) baseFreq += 80;
    if (id % 7 === 0) baseFreq -= 60;

    const waves = ["sine", "triangle", "square", "sawtooth"];
    osc.type = waves[(id - 11) % waves.length];
    osc.frequency.setValueAtTime(baseFreq, now);

    // Volume envelope: fast attack, squishy decay
    const vol = isMuted ? 0 : masterVolume;
    const duration = 0.25 + ((id - 11) * 0.01);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Add a bit of noise for "squish" texture
    const bufferSize = 256;
    const noise = ctx.createScriptProcessor(bufferSize, 1, 1);
    noise.onaudioprocess = function(e) {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = (Math.random() * 2 - 1) * 0.2;
        }
    };

    noiseGain.gain.setValueAtTime(vol * 0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    setTimeout(() => {
        noise.disconnect();
        noiseGain.disconnect();
    }, (duration + 0.1) * 1000);
}

// Visualizer pulse
function triggerVisualizer() {
    const pulse = document.getElementById("visualizer-pulse");
    pulse.classList.add("active");
    setTimeout(() => pulse.classList.remove("active"), 200);
}

// Random border-radius morph
function randomMorph(squishy) {
    const r = () => Math.floor(Math.random() * 70) + 30; // 30–100
    const br = `${r()}% ${r()}% ${r()}% ${r()}%`;
    squishy.style.borderRadius = br;
}

// Spotlight modal
function openSpotlight(squishy) {
    const modal = document.getElementById("spotlight-modal");
    const spotSq = document.getElementById("spotlight-squishy");
    const nameEl = document.getElementById("spotlight-name");
    const descEl = document.getElementById("spotlight-desc");
    const audioEl = document.getElementById("spotlight-audio");

    const id = squishy.getAttribute("data-id");
    const name = squishy.getAttribute("data-name");
    const info = squishy.getAttribute("data-info");
    const audioType = squishy.getAttribute("data-audio") === "file"
        ? "Uses your audio file"
        : "Uses generated squishy sound";

    // Copy style
    const style = window.getComputedStyle(squishy);
    spotSq.style.background = style.background;
    spotSq.style.borderRadius = style.borderRadius;

    nameEl.textContent = name;
    descEl.textContent = info;
    audioEl.textContent = `Audio: ${audioType} (ID ${id})`;

    modal.classList.add("active");
}

function closeSpotlight() {
    document.getElementById("spotlight-modal").classList.remove("active");
}

// Random squishy highlight
function highlightRandomSquishy() {
    const squishies = Array.from(document.querySelectorAll(".squishy"));
    if (!squishies.length) return;
    const random = squishies[Math.floor(Math.random() * squishies.length)];

    squishies.forEach(s => s.classList.remove("highlighted"));
    random.classList.add("highlighted");

    random.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => random.classList.remove("highlighted"), 800);
}

// Shuffle styles (morph shapes)
function shuffleStyles() {
    const squishies = Array.from(document.querySelectorAll(".squishy"));
    squishies.forEach(s => randomMorph(s));
}

// Update info tab when squishy clicked
function updateInfoPanel(squishy) {
    const name = squishy.getAttribute("data-name");
    const info = squishy.getAttribute("data-info");
    const id = squishy.getAttribute("data-id");
    const audioType = squishy.getAttribute("data-audio") === "file"
        ? "File sound (your audio)"
        : "Generated squishy sound";

    document.getElementById("info-name").textContent = name;
    document.getElementById("info-desc").textContent = info;
    document.getElementById("info-audio").textContent = audioType;
    document.getElementById("info-id").textContent = id;
}

// Size slider
function setupSizeSlider() {
    const slider = document.getElementById("size-slider");
    slider.addEventListener("input", () => {
        const scale = parseFloat(slider.value);
        document.querySelectorAll(".squishy").forEach(s => {
            s.style.transform = `scale(${scale})`;
        });
    });
}

// Theme selector
function setupThemeSelector() {
    const select = document.getElementById("theme-select");
    select.addEventListener("change", () => {
        document.documentElement.setAttribute("data-theme", select.value);
    });
}

// Dark mode toggle
function setupDarkToggle() {
    const toggle = document.getElementById("dark-toggle");
    toggle.addEventListener("change", () => {
        document.body.classList.toggle("dark-mode", toggle.checked);
    });
}

// Volume + mute
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

// Spotlight toggle
function setupSpotlightToggle() {
    const btn = document.getElementById("spotlight-toggle");
    btn.addEventListener("click", () => {
        spotlightEnabled = !spotlightEnabled;
        btn.textContent = spotlightEnabled ? "Spotlight: ON" : "Spotlight mode";
    });

    document.getElementById("spotlight-close").addEventListener("click", closeSpotlight);
    document.getElementById("spotlight-modal").addEventListener("click", e => {
        if (e.target.id === "spotlight-modal") closeSpotlight();
    });
}

// Tabs
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

// Loading overlay
function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    overlay.style.opacity = "0";
    setTimeout(() => overlay.style.display = "none", 350);
}

// ====== MAIN INIT ======
document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupSizeSlider();
    setupThemeSelector();
    setupDarkToggle();
    setupAudioControls();
    setupSpotlightToggle();

    document.getElementById("random-btn").addEventListener("click", highlightRandomSquishy);
    document.getElementById("shuffle-btn").addEventListener("click", shuffleStyles);

    // Squishy click behavior
    document.querySelectorAll(".squishy").forEach(squishy => {
        squishy.addEventListener("click", () => {
            const id = parseInt(squishy.getAttribute("data-id"), 10);
            const audioType = squishy.getAttribute("data-audio");

            // Click animation
            squishy.classList.remove("clicked");
            void squishy.offsetWidth; // force reflow
            squishy.classList.add("clicked");

            // Random morph
            randomMorph(squishy);

            // Sound
            if (audioType === "file") {
                playFileSound(id);
            } else {
                playGeneratedSquishySound(id);
            }

            // Visualizer
            triggerVisualizer();

            // Update info panel
            updateInfoPanel(squishy);

            // Spotlight
            if (spotlightEnabled) {
                openSpotlight(squishy);
            }
        });
    });

    // Hide loading after short delay
    setTimeout(hideLoadingOverlay, 900);
});
