/* ==================================================================
   CELESTIAL FM 106.7 — PWA (Service Worker + Instalación)
   ================================================================== */

// -------- 1. REGISTRAR SERVICE WORKER --------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('✅ Service Worker registrado:', reg.scope))
      .catch(err => console.warn('⚠️ Error al registrar SW:', err));
  });
}

// -------- 2. BOTÓN "INSTALAR APP" --------
const btnInstall = document.getElementById('btnInstall');
let deferredPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!isStandalone() && btnInstall) btnInstall.hidden = false;
});

if (btnInstall) {
  btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) {
      alert('Para instalar la app:\n\n• En iPhone/iPad: toca Compartir → "Añadir a pantalla de inicio".\n• En Android: menú del navegador → "Instalar aplicación".');
      return;
    }
    btnInstall.hidden = true;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('Instalación:', outcome);
    deferredPrompt = null;
  });
}

window.addEventListener('appinstalled', () => {
  if (btnInstall) btnInstall.hidden = true;
  console.log('🎉 App instalada correctamente');
});

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (isIOS && !isStandalone() && btnInstall) {
  btnInstall.hidden = false;
}

if (isStandalone() && btnInstall) btnInstall.hidden = true;
