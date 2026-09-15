/* ==================================================================
   CELESTIAL FM 106.7 — Lógica del reproductor
   ================================================================== */

// -------- CONFIGURACIÓN --------
const ZENO_MOUNT = '75fyk31hk48uv';
const API_URL = `https://api.zeno.fm/mounts/metadata/subscribe/${ZENO_MOUNT}`;
const ITUNES_API = 'https://itunes.apple.com/search';

// -------- ELEMENTOS DOM --------
const audio        = document.getElementById('audioPlayer');
const btnPlay      = document.getElementById('btnPlay');
const playIcon     = document.getElementById('playIcon');
const vinylDisc    = document.getElementById('vinylDisc');
const vinylCover   = document.getElementById('vinylCover');
const songTitle    = document.getElementById('songTitle');
const songArtist   = document.getElementById('songArtist');
const bgBlur       = document.getElementById('bg-blur');
const visualizer   = document.getElementById('visualizer');
const btnVolume    = document.getElementById('btnVolume');
const volumePop    = document.getElementById('volumePop');
const volumeSlider = document.getElementById('volumeSlider');
const tickerText   = document.getElementById('tickerText');

// -------- ESTADO --------
let isPlaying       = false;
let audioCtx        = null;
let analyser        = null;
let sourceNode      = null;
let currentSongKey  = '';
let barCount        = 0;
let visualizerRAF   = null;

// ================================================================
// 1. TICKER DE VERSÍCULOS (cambio diario automático)
// ================================================================
const VERSICULOS = [
  "Juan 3:16 — Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito...",
  "Salmos 23:1 — Jehová es mi pastor; nada me faltará.",
  "Filipenses 4:13 — Todo lo puedo en Cristo que me fortalece.",
  "Proverbios 3:5 — Fíate de Jehová de todo tu corazón...",
  "Isaías 40:31 — Pero los que esperan a Jehová tendrán nuevas fuerzas...",
  "Romanos 8:28 — Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien.",
  "Mateo 11:28 — Venid a mí todos los que estáis trabajados y cargados...",
  "Josué 1:9 — Mira que te mando que te esfuerces y seas valiente...",
  "Salmos 46:1 — Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.",
  "Jeremías 29:11 — Porque yo sé los pensamientos que tengo acerca de vosotros...",
  "Salmos 111:10 — El principio de la sabiduría es el temor de Jehová...",
  "Isaías 51:11 — Porque Jehová consolará a Sion; consolará todas sus soledades...",
  "Salmos 34:8 — Gustad, y ved que es bueno Jehová; Dichoso el hombre que confía en él.",
  "Mateo 6:33 — Mas buscad primeramente el reino de Dios y su justicia...",
  "Juan 14:6 — Jesús le dijo: Yo soy el camino, y la verdad, y la vida...",
  "Romanos 12:2 — No os conforméis a este siglo, sino transformaos...",
  "Gálatas 5:22 — Mas el fruto del Espíritu es amor, gozo, paz, paciencia...",
  "Salmos 121:1-2 — Alzaré mis ojos a los montes; ¿De dónde vendrá mi socorro? Mi socorro viene de Jehová...",
  "Proverbios 16:9 — El corazón del hombre piensa su camino; Mas Jehová endereza sus pasos.",
  "Isaías 41:10 — No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios...",
  "Salmos 37:4 — Deléitate asimismo en Jehová, Y él te concederá las peticiones de tu corazón.",
  "Mateo 5:16 — Así alumbre vuestra luz delante de los hombres...",
  "Juan 8:12 — Yo soy la luz del mundo; el que me sigue, no andará en tinieblas...",
  "Salmos 91:1-2 — El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente...",
  "Romanos 15:13 — Y el Dios de esperanza os llene de todo gozo y paz en el creer...",
  "Isaías 26:3 — Tú guardarás en completa paz a aquel cuyo pensamiento en ti persevera...",
  "Salmos 30:5 — Porque un momento será su ira, Pero su favor dura toda la vida...",
  "Proverbios 18:10 — El nombre de Jehová es torre fuerte; A él correrá el justo, y será levantado.",
  "Filipenses 4:6-7 — Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios...",
  "Salmos 119:105 — Lámpara es a mis pies tu palabra, Y lumbre a mi camino.",
  "Mateo 7:7 — Pedid, y se os dará; buscad, y hallaréis; llamad, y se os abrirá."
];

function obtenerVersiculoDelDia() {
  const hoy = new Date();
  const inicioAno = new Date(hoy.getFullYear(), 0, 0);
  const diff = hoy - inicioAno;
  const unDia = 1000 * 60 * 60 * 24;
  const diaDelAno = Math.floor(diff / unDia);
  return VERSICULOS[diaDelAno % VERSICULOS.length];
}

(function iniciarTicker() {
  tickerText.textContent = ' ✝ ' + obtenerVersiculoDelDia() + '   •   ';
})();

// ================================================================
// 2. VISUALIZADOR
// ================================================================
function initVisualizer() {
  const numBars = 28;
  visualizer.innerHTML = '';
  for (let i = 0; i < numBars; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    visualizer.appendChild(bar);
  }
  barCount = numBars;
}

function animateVisualizer() {
  if (!analyser) return;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  const bars = visualizer.querySelectorAll('.bar');
  const step = Math.floor(dataArray.length / barCount);
  for (let i = 0; i < barCount; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
    const avg = sum / step;
    bars[i].style.height = Math.max(3, (avg / 255) * 40) + 'px';
  }
  visualizerRAF = requestAnimationFrame(animateVisualizer);
}

function startVisualizer() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (visualizerRAF) cancelAnimationFrame(visualizerRAF);
  animateVisualizer();
}

function stopVisualizer() {
  if (visualizerRAF) {
    cancelAnimationFrame(visualizerRAF);
    visualizerRAF = null;
  }
  visualizer.querySelectorAll('.bar').forEach(b => b.style.height = '3px');
}
initVisualizer();

// ================================================================
// 3. PLAY / PAUSA
// ================================================================
btnPlay.addEventListener('click', async () => {
  if (isPlaying) {
    audio.pause();
    return;
  }
  btnPlay.classList.add('loading');
  audio.volume = parseFloat(volumeSlider.value);
  try {
    await audio.play();
    isPlaying = true;
    btnPlay.classList.remove('loading');
    btnPlay.classList.add('playing');
    vinylDisc.classList.add('playing');
    playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    startVisualizer();
    actualizarAhoraSuena();
  } catch (e) {
    console.warn('Error al reproducir:', e);
    btnPlay.classList.remove('loading');
    setTimeout(() => {
      audio.play().then(() => {
        isPlaying = true;
        btnPlay.classList.add('playing');
        vinylDisc.classList.add('playing');
        playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        startVisualizer();
      }).catch(() => {});
    }, 1000);
  }
});

// Sincronización UI con eventos del audio
audio.addEventListener('play', () => {
  if (!isPlaying) {
    isPlaying = true;
    btnPlay.classList.add('playing');
    vinylDisc.classList.add('playing');
    playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
    startVisualizer();
  }
});
audio.addEventListener('pause', () => {
  isPlaying = false;
  btnPlay.classList.remove('playing');
  vinylDisc.classList.remove('playing');
  playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  stopVisualizer();
});
audio.addEventListener('waiting', () => btnPlay.classList.add('loading'));
audio.addEventListener('playing', () => btnPlay.classList.remove('loading'));
audio.addEventListener('error', () => btnPlay.classList.remove('loading'));

// ================================================================
// 4. VOLUMEN
// ================================================================
btnVolume.addEventListener('click', (e) => {
  e.stopPropagation();
  volumePop.classList.toggle('open');
});
document.addEventListener('click', (e) => {
  if (!volumePop.contains(e.target) && e.target !== btnVolume) {
    volumePop.classList.remove('open');
  }
});
volumeSlider.addEventListener('input', () => {
  audio.volume = parseFloat(volumeSlider.value);
});

// ================================================================
// 5. METADATOS "AHORA SUENA" + CARÁTULA
// ================================================================
function formatearNombreCancion(raw) {
  if (!raw) return { artist: 'Celestial FM 106.7', title: 'Radio Cristiana' };
  let partes = raw.split(' - ');
  if (partes.length >= 2) {
    return { artist: partes[0].trim(), title: partes.slice(1).join(' - ').trim() };
  }
  partes = raw.split('|');
  if (partes.length >= 2) {
    return { artist: partes[0].trim(), title: partes[1].trim() };
  }
  return { artist: 'Celestial FM 106.7', title: raw.trim() };
}

function buscarCaratula(artist, title) {
  const query = encodeURIComponent(`${artist} ${title}`);
  return fetch(`${ITUNES_API}?term=${query}&entity=song&limit=1`)
    .then(r => r.json())
    .then(data => {
      if (data.results && data.results.length > 0) {
        return data.results[0].artworkUrl100.replace('100x100', '600x600');
      }
      return null;
    })
    .catch(() => null);
}

function actualizarAhoraSuena() {
  fetch(API_URL)
    .then(r => r.json())
    .then(data => {
      const raw = data.currentSong || data.title || '';
      if (raw === currentSongKey) return;
      currentSongKey = raw;

      const { artist, title } = formatearNombreCancion(raw);
      songTitle.textContent  = title  || '—';
      songArtist.textContent = artist || 'Celestial FM 106.7';

      buscarCaratula(artist, title).then(coverUrl => {
        if (coverUrl) {
          vinylCover.src = coverUrl;
          bgBlur.style.backgroundImage = `url(${coverUrl})`;
        } else {
          vinylCover.src = 'logo.png';
          bgBlur.style.backgroundImage = 'none';
        }
      });
    })
    .catch(() => {});
}

setInterval(() => { if (isPlaying) actualizarAhoraSuena(); }, 15000);
setTimeout(actualizarAhoraSuena, 1000);

// ================================================================
// 6. MEDIA SESSION API
// ================================================================
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: 'Celestial FM 106.7',
    artist: 'Campo Grande, Misiones',
    album: 'Una Radio con Propósito',
    artwork: [{ src: 'logo.png', sizes: '512x512', type: 'image/png' }]
  });
  navigator.mediaSession.setActionHandler('play',  () => btnPlay.click());
  navigator.mediaSession.setActionHandler('pause', () => btnPlay.click());
}

// ================================================================
// 7. ATAJOS DE TECLADO
// ================================================================
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space')     { e.preventDefault(); btnPlay.click(); }
  if (e.code === 'ArrowUp')   { e.preventDefault(); audio.volume = Math.min(1, audio.volume + 0.1); volumeSlider.value = audio.volume; }
  if (e.code === 'ArrowDown') { e.preventDefault(); audio.volume = Math.max(0, audio.volume - 0.1); volumeSlider.value = audio.volume; }
});

// ================================================================
// 8. VOLUMEN INICIAL
// ================================================================
audio.volume = parseFloat(volumeSlider.value);

console.log('🎵 Celestial FM 106.7 — Reproductor iniciado');