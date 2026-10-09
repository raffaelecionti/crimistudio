/* =========================================================
   CRIMI STUDIO - script.js
   ========================================================= */

const track = document.getElementById("heroTrack");
const media = document.getElementById("heroMedia");
const logo = document.getElementById("heroLogo");
const cue = document.querySelector(".scroll-cue");
const nav = document.getElementById("nav");
const video = document.getElementById("heroVideo");

/* ---------- 1. Scroll: il video si chiude dal basso ---------- */
// p va da 0 (in cima) a 1 (fine dello spazio riservato alla hero).
// - il video viene ritagliato dal basso fino a lasciare ~54% dello schermo
// - il logo sale un po' (e viene tagliato insieme al video)
// - sotto compaiono la scritta che scorre e il pulsante

const MAX_CUT = 46;      // % di altezza che il video perde alla fine
const LOGO_LIFT = 14;    // vh di cui sale il logo

let ticking = false;

function update() {
  ticking = false;
  if (!track || !media) return;

  const total = track.offsetHeight - window.innerHeight;
  const top = track.getBoundingClientRect().top;
  const p = Math.min(Math.max(-top / total, 0), 1);

  media.style.setProperty("--cut", `${(p * MAX_CUT).toFixed(2)}%`);
  logo.style.setProperty("--ly", `${(-p * LOGO_LIFT * window.innerHeight) / 100}px`);
  if (cue) cue.style.setProperty("--cue", String(Math.max(1 - p * 4, 0)));

  // finita la hero, la barra diventa leggibile su qualsiasi sfondo
  nav.classList.toggle("is-solid", top < -total);
}

function requestUpdate() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(update);
  }
}

window.addEventListener("scroll", requestUpdate, { passive: true });
window.addEventListener("resize", requestUpdate);
update();

/* ---------- 2. Video: parte sempre, con rete di sicurezza ---------- */
const toggle = document.getElementById("videoToggle");
let userPaused = false; // vero solo se è la persona a mettere in pausa

function playVideo() {
  if (!video || userPaused) return;
  const p = video.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => armFirstGesture()); // autoplay bloccato dal browser
  }
}

// Se il browser blocca l'autoplay (es. risparmio energetico), il video
// parte al primo tocco, click o tasto premuto.
function armFirstGesture() {
  const events = ["pointerdown", "touchend", "click", "keydown"];
  const resume = () => {
    events.forEach((ev) => window.removeEventListener(ev, resume));
    playVideo();
  };
  events.forEach((ev) => window.addEventListener(ev, resume, { once: true }));
}

if (video) {
  video.addEventListener("error", () => {
    console.warn("Il video non si carica: controlla che esista media/hero.mp4");
  });

  playVideo();

  // il video si ferma quando la hero esce dallo schermo (risparmio batteria)
  if ("IntersectionObserver" in window && track) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) playVideo();
        else video.pause();
      });
    }).observe(track);
  }
}

// Pulsante pausa/play: serve a chi non vuole movimento (accessibilità)
if (toggle && video) {
  toggle.addEventListener("click", () => {
    userPaused = !video.paused;
    if (userPaused) {
      video.pause();
    } else {
      playVideo();
    }
    toggle.textContent = userPaused ? "PLAY" : "PAUSA";
    toggle.setAttribute("aria-label", userPaused ? "Riprendi il video" : "Metti in pausa il video");
  });
}


/* =========================================================
   3. PAGINA informazioni.html
   ========================================================= */

// segnala al CSS che JavaScript è attivo (serve per l'apparizione graduale)
document.documentElement.classList.add("js");

/* ---------- 3a. Apparizione graduale al passaggio ---------- */
const revealItems = document.querySelectorAll("[data-reveal]");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target); // una volta sola
        }
      });
    },
    { threshold: 0.15 }
  );
  revealItems.forEach((el) => revealObserver.observe(el));
} else {
  revealItems.forEach((el) => el.classList.add("is-visible"));
}

/* ---------- 3b. Galleria: ingrandisci le foto ---------- */
const lightbox = document.getElementById("lightbox");

if (lightbox && typeof lightbox.showModal === "function") {
  const lbImg = document.getElementById("lbImg");
  const lbCount = document.getElementById("lbCount");
  const shots = [...document.querySelectorAll(".shot")];

  let group = [];  // foto della sede aperta (Milano o Alessandria)
  let index = 0;

  function show(i) {
    index = (i + group.length) % group.length; // dopo l'ultima si torna alla prima
    const img = group[index].querySelector("img");
    lbImg.src = img.src;
    lbImg.alt = img.alt;
    lbCount.textContent = `${index + 1} / ${group.length}`;
  }

  shots.forEach((shot) => {
    shot.addEventListener("click", () => {
      group = shots.filter((s) => s.dataset.group === shot.dataset.group);
      show(group.indexOf(shot));
      lightbox.showModal();
    });
  });

  document.getElementById("lbClose").addEventListener("click", () => lightbox.close());
  document.getElementById("lbPrev").addEventListener("click", () => show(index - 1));
  document.getElementById("lbNext").addEventListener("click", () => show(index + 1));

  // clic sullo sfondo scuro = chiudi
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) lightbox.close();
  });

  // frecce della tastiera (Esc chiude da solo)
  lightbox.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });

  // scorrimento col dito sul telefono
  let touchStartX = 0;
  lightbox.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
  lightbox.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

