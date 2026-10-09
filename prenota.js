/* =========================================================
   CRIMI STUDIO - prenota.js
   Calendario, orari, calcolo del totale e richiesta su WhatsApp.
   ========================================================= */

/* ---------------------------------------------------------
   CONFIGURAZIONE  (qui cambi tariffe, orari e giorni bloccati)
   --------------------------------------------------------- */
const CONFIG = {
  // numero WhatsApp dello studio, in formato internazionale senza "+"
  whatsappNumber: "393451084063",

  // orari: si può iniziare dalle 10:00 e finire entro le 02:00 della notte.
  // Le ore dopo la mezzanotte si scrivono oltre 24: 24 = 00:00, 25 = 01:00, 26 = 02:00
  // (l'ultimo orario di inizio selezionabile è quindi 01:00, per una sessione di 1 ora)
  openHour: 10,
  closeHour: 26,

  // PREZZI DELL'AFFITTO SENZA FONICO: ore -> euro
  // (1 ora 20 €, 2 ore 30 €, 3 ore 40 € ... +10 € per ogni ora in più)
  priceTable: { 1: 20, 2: 30, 3: 40, 4: 50, 5: 60 },

  // supplementi facoltativi (euro in più sull'intera sessione). 0 = nessuno
  weekendExtra: 0,     // sessioni di sabato e domenica
  lateExtra: 0,        // sessioni che iniziano da lateFromHour in poi
  lateFromHour: 22,

  // giorni della settimana in cui lo studio è chiuso: 0 = domenica ... 6 = sabato
  // esempio: [0] per chiudere la domenica
  closedWeekdays: [],

  // giorni interi non disponibili, formato "AAAA-MM-GG"
  // esempio: ["2026-12-25", "2027-01-01"]
  blockedDates: [],

  // orari già confermati: giorno -> ore di INIZIO occupate
  // esempio: { "2026-11-03": [14, 15, 16], "2026-11-04": [10, 11] }
  // (14, 15, 16 significa occupato dalle 14:00 alle 17:00)
  bookedSlots: {},

  // quanti mesi in avanti si può prenotare
  monthsAhead: 6,
};

/* ---------------------------------------------------------
   Utilità
   --------------------------------------------------------- */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const hoursLabel = (h) => `${h} ${h === 1 ? "ora" : "ore"}`;

// 24 diventa 00:00, 25 diventa 01:00, ...
const clock = (h) => `${pad(h % 24)}:00`;

// nota da aggiungere quando la sessione arriva oltre la mezzanotte
function nightNote(start, hours) {
  if (start >= 24) return " — dopo la mezzanotte, nella notte successiva alla data scelta";
  if (start + hours > 24) return " — termina dopo la mezzanotte";
  return "";
}
const euro = (n) => `€ ${n.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

/* ---------------------------------------------------------
   Disponibilità
   --------------------------------------------------------- */
// un'ora di inizio è libera se non è già confermata e, oggi, se è ancora futura
function isHourFree(iso, h) {
  const booked = CONFIG.bookedSlots[iso] || [];
  if (booked.includes(h)) return false;
  if (iso === toISO(today) && h < now.getHours() + 1) return false;
  return true;
}

// la sessione di "hours" ore che parte alle "start" ci sta tutta?
function canFit(iso, start, hours) {
  if (start < CONFIG.openHour || start + hours > CONFIG.closeHour) return false;
  for (let h = start; h < start + hours; h++) {
    if (!isHourFree(iso, h)) return false;
  }
  return true;
}

// un giorno è disponibile se non è passato/chiuso/bloccato e ha almeno un'ora libera
function isDayAvailable(date) {
  if (date < today) return false;
  if (CONFIG.closedWeekdays.includes(date.getDay())) return false;
  const iso = toISO(date);
  if (CONFIG.blockedDates.includes(iso)) return false;
  for (let h = CONFIG.openHour; h < CONFIG.closeHour; h++) {
    if (isHourFree(iso, h)) return true;
  }
  return false;
}

/* ---------------------------------------------------------
   Prezzo dell'affitto: tabella per durata + eventuali supplementi
   --------------------------------------------------------- */
function rentalPrice(iso, start, hours) {
  let total = CONFIG.priceTable[hours];
  if ([0, 6].includes(fromISO(iso).getDay())) total += CONFIG.weekendExtra;
  if (start >= CONFIG.lateFromHour) total += CONFIG.lateExtra;
  return total;
}

/* ---------------------------------------------------------
   Stato della pagina
   --------------------------------------------------------- */
const state = {
  year: today.getFullYear(),
  month: today.getMonth(),
  date: null,      // "AAAA-MM-GG"
  start: null,     // ora di inizio (numero)
  duration: null,  // 1..4
};

/* ---------------------------------------------------------
   Elementi
   --------------------------------------------------------- */
const calTitle = document.getElementById("calTitle");
const calGrid = document.getElementById("calGrid");
const calPrev = document.getElementById("calPrev");
const calNext = document.getElementById("calNext");
const slotsBox = document.getElementById("slots");
const durGroup = document.getElementById("durGroup");
const totalValue = document.getElementById("totalValue");
const rentBtn = document.getElementById("rentBtn");
const offerNote = document.getElementById("offerNote");

const dialog = document.getElementById("bkDialog");

/* ---------------------------------------------------------
   Calendario
   --------------------------------------------------------- */
function renderCalendar() {
  const first = new Date(state.year, state.month, 1);
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // la settimana parte da lunedì

  const monthName = first.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  calTitle.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  calGrid.innerHTML = "";

  for (let i = 0; i < offset; i++) {
    calGrid.appendChild(document.createElement("span"));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(state.year, state.month, d);
    const iso = toISO(date);
    const available = isDayAvailable(date);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-day";
    btn.textContent = d;
    btn.disabled = !available;

    const longDate = date.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    btn.setAttribute("aria-label", available ? longDate : `${longDate}, non disponibile`);

    if (!available) btn.classList.add("is-off");
    if (iso === toISO(today)) btn.classList.add("is-today");
    if (iso === state.date) {
      btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", "true");
    }

    btn.addEventListener("click", () => {
      state.date = iso;
      state.start = null; // cambiando giorno, gli orari possono cambiare
      renderCalendar();
      renderSlots();
      updateTotal();
    });

    calGrid.appendChild(btn);
  }

  // non si va prima del mese attuale né oltre i mesi consentiti
  const current = today.getFullYear() * 12 + today.getMonth();
  const shown = state.year * 12 + state.month;
  calPrev.disabled = shown <= current;
  calNext.disabled = shown >= current + CONFIG.monthsAhead;
}

calPrev.addEventListener("click", () => {
  state.month--;
  if (state.month < 0) { state.month = 11; state.year--; }
  renderCalendar();
});

calNext.addEventListener("click", () => {
  state.month++;
  if (state.month > 11) { state.month = 0; state.year++; }
  renderCalendar();
});

/* ---------------------------------------------------------
   Orari di inizio
   --------------------------------------------------------- */
function renderSlots() {
  slotsBox.innerHTML = "";

  if (!state.date) {
    const p = document.createElement("p");
    p.className = "slots-empty";
    p.textContent = "Scegli prima una data.";
    slotsBox.appendChild(p);
    return;
  }

  const needed = state.duration || 1; // senza durata scelta controllo almeno 1 ora

  // se l'orario scelto non ci sta più (es. durata cambiata), lo tolgo
  if (state.start !== null && !canFit(state.date, state.start, needed)) {
    state.start = null;
  }

  for (let h = CONFIG.openHour; h < CONFIG.closeHour; h++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "slot";
    btn.textContent = clock(h);
    if (h >= 24) {
      // orari dopo la mezzanotte: appartengono alla notte successiva alla data scelta
      const tag = document.createElement("small");
      tag.textContent = "notte";
      btn.appendChild(tag);
      btn.setAttribute("aria-label", `${clock(h)}, notte successiva`);
    }
    btn.disabled = !canFit(state.date, h, needed);
    if (state.start === h) {
      btn.classList.add("is-selected");
      btn.setAttribute("aria-pressed", "true");
    }

    btn.addEventListener("click", () => {
      state.start = h;
      renderSlots();
      updateTotal();
    });

    slotsBox.appendChild(btn);
  }
}

/* ---------------------------------------------------------
   Durata
   --------------------------------------------------------- */
durGroup.addEventListener("change", (e) => {
  if (e.target.name !== "durata") return;
  state.duration = Number(e.target.value);
  renderSlots();
  updateTotal();
});

/* ---------------------------------------------------------
   Totale
   --------------------------------------------------------- */
function updateTotal() {
  const ready = state.date && state.start !== null && state.duration;

  if (ready) {
    totalValue.textContent = euro(rentalPrice(state.date, state.start, state.duration));
  } else {
    totalValue.textContent = "€ —";
  }

  rentBtn.disabled = !ready;
  offerNote.textContent = "";
}

/* ---------------------------------------------------------
   Popup di riepilogo + messaggio WhatsApp
   --------------------------------------------------------- */
function openSummary({ service, iso, start, hours, totalText }) {
  const dateText = iso
    ? fromISO(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Da concordare su WhatsApp";

  const timeText = iso && start !== null
    ? `${clock(start)} – ${clock(start + hours)} (${hoursLabel(hours)})${nightNote(start, hours)}`
    : hours
      ? `${hoursLabel(hours)}, orario da concordare`
      : "Da concordare su WhatsApp";

  document.getElementById("sumService").textContent = service;
  document.getElementById("sumDate").textContent = dateText;
  document.getElementById("sumTime").textContent = timeText;
  document.getElementById("sumTotal").textContent = totalText;

  const message = [
    "Ciao! Vorrei richiedere una prenotazione:",
    `• Servizio: ${service}`,
    `• Data: ${dateText}`,
    `• Orario e durata: ${timeText}`,
    `• Totale: ${totalText}`,
    "",
    "Attendo la tua conferma. Grazie!",
  ].join("\n");

  document.getElementById("bkWhatsapp").href =
    `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;

  dialog.showModal();
}

// affitto senza fonico
rentBtn.addEventListener("click", () => {
  if (rentBtn.disabled) return;
  openSummary({
    service: "Affitto studio senza fonico",
    iso: state.date,
    start: state.start,
    hours: state.duration,
    totalText: euro(rentalPrice(state.date, state.start, state.duration)),
  });
});

// offerte con fonico (nome, prezzo e ore sono scritti nei data- del pulsante in HTML)
document.querySelectorAll(".offer-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const hours = Number(btn.dataset.hours);
    const price = Number(btn.dataset.price);
    offerNote.textContent = "";

    // se data e orario sono già scelti sopra, li uso (controllando che l'offerta ci stia)
    if (state.date && state.start !== null) {
      if (!canFit(state.date, state.start, hours)) {
        offerNote.textContent =
          `Con questa offerta (${hoursLabel(hours)}) l'orario scelto sopra non è disponibile. Cambia orario nella sezione 01 oppure contattaci su WhatsApp.`;
        return;
      }
      openSummary({ service: btn.dataset.name, iso: state.date, start: state.start, hours, totalText: euro(price) });
    } else {
      openSummary({ service: btn.dataset.name, iso: null, start: null, hours, totalText: euro(price) });
    }
  });
});

// chiusura del popup
document.getElementById("bkClose").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) dialog.close(); // clic sullo sfondo
});

/* ---------------------------------------------------------
   Avvio
   --------------------------------------------------------- */
renderCalendar();
renderSlots();
updateTotal();