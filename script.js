// ====== FIREBASE & GLOBAL STATE ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, updateDoc, increment, onSnapshot, addDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCB-OWr3iWA3MKOxBwt5sWrdBJxnSvML3M",
    authDomain: "squishy-database.firebaseapp.com",
    projectId: "squishy-database",
    storageBucket: "squishy-database.firebasestorage.app",
    messagingSenderId: "1084662244177",
    appId: "1:1084662244177:web:75f21e85089360be8ba970"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let audioContext = null;
let masterVolume = 0.8;
let isMuted = false;
let spotlightEnabled = false;
let selectedSquishyId = null;
let sessionSqueezes = 0;

const discoveredSquishies = [];
const squishyStats = {};

// Reference-accurate models matching your provided images (Butter Blocks, NeeDoh Cubes, Dumplings)
const defaultPresets = [
    { name: "Steam Dumpling", info: "Realistic translucent dim sum dumpling with pinched pleats.", emoji: "🥟", class: "sq-dumpling" },
    { name: "NeeDoh Cube", info: "Tactile soft square squishy with debossed lettering and squeeze bevels.", emoji: "🧊", class: "sq-needle" },
    { name: "Golden Butter Block", info: "Creamy salted 4oz baking butter block with sharp beveled edges.", emoji: "🧈", class: "sq-butter" },
    { name: "Swiss Cheese Wedge", info: "Classic cartoon swiss cheese with realistic air holes.", emoji: "🧀", class: "sq-cheese" },
    { name: "Taro Boba Pearl", info: "Chewy purple taro milk tea bubble tea squishy ball.", emoji: "🧋", class: "sq-boba" },
    { name: "Strawberry Macaron", info: "French almond pastry sandwich with thick creamy filling.", emoji: "🧁", class: "sq-macaron" },
    { name: "Caramel Pudding", info: "Wobbly Japanese custard pudding with glossy caramel syrup top.", emoji: "🍮", class: "sq-pudding" },
    { name: "Kitty Toe Beans", info: "Super-soft pink cat paw pad plush squishy.", emoji: "🐾", class: "sq-paw" },
    { name: "Velvet Peach", info: "Fuzzy sweet Japanese summer peach squishy.", emoji: "🍑", class: "sq-peach" },
    { name: "Magical Star", info: "Glowing cosmic star squishy filled with slow-rise foam.", emoji: "⭐", class: "sq-star" }
];

function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Smart audio slicing (takes first 1.5s - 2.5s for long sounds or standard clips)
function playTrimmedFileSound(id) {
    const trimEnabled = document.getElementById("setting-audio-trim").checked;
    ensureAudioContext();
    const wavUrl = `squishy${id}.wav`;
    const mp3Url = `squishy${id}.mp3`;

    fetch(wavUrl)
        .then(res => {
            if (!res.ok) throw new Error();
            return res.arrayBuffer();
        })
        .catch(() => {
            return fetch(mp3Url).then(res => {
                if (!res.ok) throw new Error();
                return res.arrayBuffer();
            });
        })
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;

            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(isMuted ? 0 : masterVolume, audioContext.currentTime);

            source.connect(gainNode);
            gainNode.connect(audioContext.destination);

            let startTime = 0;
            const channelData = audioBuffer.getChannelData(0);
            for (let i = 0; i < channelData.length; i++) {
                if (Math.abs(channelData[i]) > 0.15) {
                    startTime = Math.max(0, (i / audioBuffer.sampleRate) - 0.04);
                    break;
                }
            }

            const maxDuration = trimEnabled ? (audioBuffer.duration > 10 ? 2.0 : 2.5) : audioBuffer.duration;
            const durationToPlay = Math.min(maxDuration, audioBuffer.duration - startTime);
            source.start(audioContext.currentTime, startTime, durationToPlay);
        })
        .catch(() => {
            playRealisticSynthesizedSound(id);
        });
}

function playRealisticSynthesizedSound(id) {
    const ctx = audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    let baseFreq = 140 + ((id * 23) % 180);
    osc.type = (id % 2 === 0) ? "triangle" : "sine";

    osc.frequency.setValueAtTime(baseFreq * 1.6, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, now + 0.35);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(400, now + 0.35);

    const vol = isMuted ? 0 : masterVolume;
    const duration = 0.38;

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol * 0.95, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);
}

function triggerVisualizer() {
    const pulse = document.getElementById("visualizer-pulse");
    pulse.classList.add("active");
    setTimeout(() => pulse.classList.remove("active"), 220);
}

function randomMorph(squishy) {
    const r = () => Math.floor(Math.random() * 40) + 30;
    const br = `${r()}% ${100 - r()}% ${r()}% ${100 - r()}% / ${100 - r()}% ${r()}% ${100 - r()}% ${r()}%`;
    const inner = squishy.querySelector(".sq-inner");
    if (inner && !squishy.classList.contains('sq-needle')) {
        inner.style.borderRadius = br;
    }
}

// Canvas Background Removal & Automatic Centering
function processImageBackgroundRemoval(imgElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const width = imgElement.naturalWidth || 300;
    const height = imgElement.naturalHeight || 300;
    canvas.width = width;
    canvas.height = height;

    ctx.drawImage(imgElement, 0, 0);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let rSum = 0, gSum = 0, bSum = 0;
    const corners = [0, width - 1, (height - 1) * width, (height * width) - 1];
    corners.forEach(idx => {
        rSum += data[idx * 4];
        gSum += data[idx * 4 + 1];
        bSum += data[idx * 4 + 2];
    });
    const bgR = rSum / 4, bgG = gSum / 4, bgB = bSum / 4;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i+1], b = data[i+2];
        let diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        if (diff < 55 && r > 170 && g > 170 && b > 170) {
            data[i + 3] = 0;
        }
    }
    ctx.putImageData(imgData, 0, 0);
    imgElement.src = canvas.toDataURL();
    imgElement.className = "squishy-bg-removed";
}

// ====== DATABASE SYNCHRONIZATION ======
async function recordSqueezeInDatabase(id, name, eventTarget) {
    try {
        sessionSqueezes++;
        document.getElementById("session-squeeze-count").textContent = sessionSqueezes.toLocaleString();

        const squishyRef = doc(db, "squishies", `squishy_${id}`);
        const globalRef = doc(db, "stats", "global");

        await setDoc(squishyRef, {
            id: id,
            name: name,
            squeezes: increment(1)
        }, { merge: true });

        await setDoc(globalRef, {
            totalSqueezes: increment(1)
        }, { merge: true });

        await addDoc(collection(db, "activityFeed"), {
            text: `🤲 Someone squeezed ${name}!`,
            timestamp: Date.now()
        });

        if (document.getElementById("setting-confetti").checked) {
            spawnConfetti(eventTarget);
        }
    } catch (err) {
        console.error("Firebase sync error:", err);
    }
}

async function favoriteCurrentSquishy() {
    if (!selectedSquishyId) return;
    try {
        const squishyRef = doc(db, "squishies", `squishy_${selectedSquishyId}`);
        await updateDoc(squishyRef, {
            favorites: increment(1)
        });
        alert("❤️ Added to cloud favorites!");
    } catch (err) {
        console.error("Favorite error:", err);
    }
}

async function sendReactionCloud() {
    if (!selectedSquishyId) return;
    try {
        await addDoc(collection(db, "activityFeed"), {
            text: `🎉 Sent a joyful reaction to Squishy #${selectedSquishyId}!`,
            timestamp: Date.now()
        });
        alert("🎉 Reaction broadcasted to the live feed!");
    } catch (err) {
        console.error("Reaction error:", err);
    }
}

function spawnConfetti(targetElement) {
    const rect = targetElement.getBoundingClientRect();
    for (let i = 0; i < 8; i++) {
        const particle = document.createElement("div");
        particle.className = "confetti-particle";
        particle.style.left = `${rect.left + rect.width / 2}px`;
        particle.style.top = `${rect.top + rect.height / 2}px`;
        particle.style.background = ['#ff7675', '#74b9ff', '#55efc4', '#fdcb6e', '#a29bfe'][Math.floor(Math.random() * 5)];
        document.body.appendChild(particle);

        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 50;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${vx}px, ${vy}px) scale(0.2)`, opacity: 0 }
        ], {
            duration: 600,
            easing: 'cubic-bezier(0, .9, .57, 1)'
        }).onfinish = () => particle.remove();
    }
}

function listenToDatabaseStats() {
    onSnapshot(doc(db, "stats", "global"), (docSnap) => {
        const total = docSnap.exists() ? docSnap.data().totalSqueezes : 1245;
        document.getElementById("global-squeeze-count").textContent = total.toLocaleString();
    }, () => {
        document.getElementById("global-squeeze-count").textContent = "1,245 (Offline)";
    });

    onSnapshot(collection(db, "squishies"), (querySnapshot) => {
        let leaderboardArray = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            squishyStats[data.id] = {
                squeezes: data.squeezes || 0,
                favorites: data.favorites || 0
            };
            leaderboardArray.push(data);
        });

        if (leaderboardArray.length === 0) {
            leaderboardArray = discoveredSquishies.map(s => ({ id: s.id, name: s.name, squeezes: Math.floor(Math.random() * 50) + 5, favorites: Math.floor(Math.random() * 10) }));
        }

        leaderboardArray.sort((a, b) => (b.squeezes || 0) - (a.squeezes || 0));
        renderLeaderboard(leaderboardArray);

        if (selectedSquishyId) {
            updateInfoPanelElements(selectedSquishyId);
        }
    }, () => {
        // Fallback leaderboard if offline
        renderLeaderboard(discoveredSquishies.map(s => ({ id: s.id, name: s.name, squeezes: 42, favorites: 5 })));
    });

    const q = query(collection(db, "activityFeed"), orderBy("timestamp", "desc"), limit(25));
    onSnapshot(q, (querySnapshot) => {
        let feedHtml = "";
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            feedHtml += `<div class="feed-row"><span>${data.text}</span><span class="feed-time">${new Date(data.timestamp).toLocaleTimeString()}</span></div>`;
        });
        document.getElementById("live-activity-feed").innerHTML = feedHtml || '<div class="leaderboard-loading">No activity yet. Be the first to squeeze!</div>';
    }, () => {
        document.getElementById("live-activity-feed").innerHTML = `
            <div class="feed-row"><span>🤲 User squeezed Steam Dumpling!</span><span class="feed-time">Just now</span></div>
            <div class="feed-row"><span>🤲 User squeezed Golden Butter Block!</span><span class="feed-time">1m ago</span></div>
        `;
    });
}

function renderLeaderboard(data) {
    const listEl = document.getElementById("leaderboard-list");
    if (!data || data.length === 0) {
        listEl.innerHTML = '<div class="leaderboard-loading">No squeezes recorded yet. Start squishing!</div>';
        return;
    }

    listEl.innerHTML = data.map((item, index) => `
        <div class="leaderboard-row">
            <span class="rank">#${index + 1}</span>
            <span class="lb-name">${item.name || `Squishy #${item.id}`}</span>
            <span class="lb-count">🤲 ${(item.squeezes || 0).toLocaleString()} | ❤️ ${(item.favorites || 0).toLocaleString()}</span>
        </div>
    `).join('');
}

// Infinite asset scanner
async function scanFolderForAssets() {
    const progressBar = document.getElementById("loader-progress");
    const statusText = document.getElementById("loader-status");
    if (progressBar) progressBar.style.width = "20%";

    let faviconExists = await checkFileExists("icon.png") ? "icon.png" :
                        await checkFileExists("icon.jpg") ? "icon.jpg" : null;
    if (faviconExists) {
        document.getElementById("dynamic-favicon").href = faviconExists;
    }

    if (progressBar) progressBar.style.width = "50%";
    if (statusText) statusText.textContent = "Scanning folder for all sound files...";

    let checkPromises = [];
    for (let i = 1; i <= 100; i++) {
        checkPromises.push(
            Promise.all([
                checkFileExists(`squishy${i}.wav`),
                checkFileExists(`squishy${i}.mp3`),
                checkFileExists(`squishy${i}.png`),
                checkFileExists(`squishy${i}.jpg`)
            ]).then(([wav, mp3, png, jpg]) => {
                if (wav || mp3) {
                    let imageExists = png ? `squishy${i}.png` : (jpg ? `squishy${i}.jpg` : null);
                    let preset = defaultPresets[(i - 1) % defaultPresets.length];
                    return {
                        id: i,
                        name: imageExists ? `Custom Squishy #${i}` : preset.name,
                        info: imageExists ? `Custom uploaded asset with canvas isolation & smart audio slice.` : preset.info,
                        image: imageExists,
                        emoji: imageExists ? null : preset.emoji,
                        cssClass: imageExists ? 'sq-custom-wrapper' : preset.class
                    };
                }
                return null;
            })
        );
    }

    let results = await Promise.all(checkPromises);
    discoveredSquishies.push(...results.filter(item => item !== null));

    if (discoveredSquishies.length === 0) {
        for (let i = 1; i <= 10; i++) {
            let preset = defaultPresets[i - 1];
            discoveredSquishies.push({
                id: i,
                name: preset.name,
                info: preset.info,
                image: null,
                emoji: preset.emoji,
                cssClass: preset.class
            });
        }
    }

    if (progressBar) progressBar.style.width = "100%";
    if (statusText) statusText.textContent = `Loaded ${discoveredSquishies.length} squishies successfully!`;
    
    listenToDatabaseStats();
    setTimeout(renderSquishyGrid, 350);
}

function checkFileExists(url) {
    return fetch(url, { method: 'HEAD' })
        .then(res => res.ok)
        .catch(() => false);
}

function renderSquishyGrid() {
    const grid = document.getElementById("squishy-grid");
    grid.innerHTML = "";

    discoveredSquishies.forEach(item => {
        const sqDiv = document.createElement("div");
        sqDiv.className = `squishy ${item.cssClass}`;
        sqDiv.setAttribute("data-id", item.id);
        sqDiv.setAttribute("data-name", item.name);
        sqDiv.setAttribute("data-info", item.info);

        const innerDiv = document.createElement("div");
        innerDiv.className = "sq-inner";

        if (item.image) {
            const img = document.createElement("img");
            img.src = item.image;
            img.alt = item.name;
            img.crossOrigin = "anonymous";
            img.onload = () => processImageBackgroundRemoval(img);
            innerDiv.appendChild(img);
        } else {
            const span = document.createElement("span");
            span.textContent = item.emoji;
            innerDiv.appendChild(span);
        }

        const shine = document.createElement("div");
        shine.className = "shine";
        innerDiv.appendChild(shine);

        sqDiv.appendChild(innerDiv);
        grid.appendChild(sqDiv);
    });

    attachSquishyListeners();
    hideLoadingOverlay();
}

function attachSquishyListeners() {
    document.querySelectorAll(".squishy").forEach(squishy => {
        squishy.addEventListener("click", (e) => {
            const id = parseInt(squishy.getAttribute("data-id"), 10);
            const name = squishy.getAttribute("data-name");

            squishy.classList.remove("clicked");
            void squishy.offsetWidth;
            squishy.classList.add("clicked");

            if (!squishy.classList.contains('sq-needle')) {
                randomMorph(squishy);
            }

            playTrimmedFileSound(id);
            triggerVisualizer();
            updateInfoPanel(squishy);

            recordSqueezeInDatabase(id, name, e.currentTarget);

            if (spotlightEnabled) {
                openSpotlight(squishy);
            }
        });
    });
}

function openSpotlight(squishy) {
    const modal = document.getElementById("spotlight-modal");
    const spotSq = document.getElementById("spotlight-squishy");
    const nameEl = document.getElementById("spotlight-name");
    const descEl = document.getElementById("spotlight-desc");
    const audioEl = document.getElementById("spotlight-audio");

    const id = squishy.getAttribute("data-id");
    const name = squishy.getAttribute("data-name");
    const info = squishy.getAttribute("data-info");
    const innerHtml = squishy.querySelector(".sq-inner").innerHTML;

    spotSq.innerHTML = innerHtml;
    nameEl.textContent = name;
    descEl.textContent = info;
    audioEl.textContent = `🎵 Smart Audio Slice Active (ID ${id})`;

    modal.classList.add("active");
}

function closeSpotlight() {
    document.getElementById("spotlight-modal").classList.remove("active");
}

function highlightRandomSquishy() {
    const squishies = Array.from(document.querySelectorAll(".squishy"));
    if (!squishies.length) return;
    const random = squishies[Math.floor(Math.random() * squishies.length)];

    squishies.forEach(s => s.classList.remove("highlighted"));
    random.classList.add("highlighted");
    random.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => random.classList.remove("highlighted"), 900);
}

function shuffleStyles() {
    document.querySelectorAll(".squishy").forEach(s => {
        if (!s.classList.contains('sq-needle')) {
            randomMorph(s);
        }
    });
}

function updateInfoPanel(squishy) {
    const id = squishy.getAttribute("data-id");
    selectedSquishyId = id;
    document.getElementById("info-name").textContent = squishy.getAttribute("data-name");
    document.getElementById("info-desc").textContent = squishy.getAttribute("data-info");
    document.getElementById("info-audio").textContent = "Smart Trimmed Clip (First 1.5s–2.5s)";
    document.getElementById("info-id").textContent = id;
    updateInfoPanelElements(id);
}

function updateInfoPanelElements(id) {
    const stats = squishyStats[id] || { squeezes: 42, favorites: 5 };
    document.getElementById("info-squeezes").textContent = (stats.squeezes || 42).toLocaleString();
    document.getElementById("info-favorites").textContent = (stats.favorites || 5).toLocaleString();
}

function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        overlay.style.opacity = "0";
        setTimeout(() => overlay.style.display = "none", 400);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setupTabs();
    setupSizeSlider();
    setupThemeSelector();
    setupDarkToggle();
    setupAudioControls();
    setupSpotlightToggle();

    document.getElementById("random-btn").addEventListener("click", highlightRandomSquishy);
    document.getElementById("shuffle-btn").addEventListener("click", shuffleStyles);
    document.getElementById("favorite-btn").addEventListener("click", favoriteCurrentSquishy);
    document.getElementById("react-btn").addEventListener("click", sendReactionCloud);
    document.getElementById("reset-session-btn").addEventListener("click", () => {
        sessionSqueezes = 0;
        document.getElementById("session-squeeze-count").textContent = "0";
        alert("Session stats reset successfully!");
    });

    scanFolderForAssets();
});

function setupSizeSlider() {
    const slider = document.getElementById("size-slider");
    slider.addEventListener("input", () => {
        const scale = parseFloat(slider.value);
        document.querySelectorAll(".squishy").forEach(s => s.style.transform = `scale(${scale})`);
    });
}

function setupThemeSelector() {
    const select = document.getElementById("theme-select");
    select.addEventListener("change", () => document.documentElement.setAttribute("data-theme", select.value));
}

function setupDarkToggle() {
    const toggle = document.getElementById("dark-toggle");
    toggle.addEventListener("change", () => document.body.classList.toggle("dark-mode", toggle.checked));
}

function setupAudioControls() {
    const volSlider = document.getElementById("volume-slider");
    const muteBtn = document.getElementById("mute-btn");

    volSlider.addEventListener("input", () => masterVolume = parseFloat(volSlider.value));
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
        leaderboard: document.getElementById("tab-leaderboard"),
        feed: document.getElementById("tab-feed"),
        info: document.getElementById("tab-info"),
        settings: document.getElementById("tab-settings"),
        about: document.getElementById("tab-about")
    };

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.getAttribute("data-tab");
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            Object.keys(contents).forEach(key => contents[key].classList.toggle("active", key === tab));
        });
    });
}