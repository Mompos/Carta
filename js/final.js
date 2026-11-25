const COLA_FINAL = 24;
const TIEMPO_REINICIO = 2000;
const PALABRAS_SUELTAS = new Set(
  "a al ante así aunque bajo con cuando cuánto de del desde e el en es la las le les lo los me mi ni no o para pero por porque que qué se si sin sobre su te tu tú un una unos unas y yo ya".split(" ")
);

const despedida = document.getElementById("despedida");
const cenizas = document.getElementById("cenizas");
const papel = document.getElementById("papel");

let papelListo = 0;
let reinicio = null;

function tiempoRestante() {
  return Math.max(0, duracionHistoria() - tiempoHistoria());
}

function palabrasVistas() {
  return [...memoria.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([pagina, m]) => m.palabras.map((p) => Object.assign(p, { pagina })));
}

function resumenCarta() {
  const vistas = palabrasVistas();
  const vivas = vistas.filter((p) => p.viva);
  const perdidas = [...memoria.values()].reduce((n, m) => n + m.perdidas, 0);
  const total = vistas.length + perdidas;
  return { vistas, vivas, dano: total ? 1 - vivas.length / total : 0 };
}

function leyoLaCarta() {
  return (memoria.size === paginas.length && registro.leyendo >= 15) || registro.leyendo >= 60;
}

function elegirFinal() {
  const { vivas, dano } = resumenCarta();
  const roturas = registro.cortes + registro.arrugadas;
  if (!vivas.length && memoria.size === paginas.length) return "nada";
  if (registro.quemada && !leyoLaCarta()) return "sinLeer";
  if (dano < 0.08 && !roturas) return "intacta";
  if (rabiaMedia() >= 0.45 || roturas >= 2) return "rabia";
  if (registro.borradas && registro.borradas >= registro.tachadas) return "calma";
  if (registro.tachadas) return "tachada";
  return roturas ? "rabia" : "intacta";
}

function describirHuella() {
  const { vivas, vistas, dano } = resumenCarta();
  const { tachadas, borradas, cortes, arrugadas } = registro;
  const frases = [];
  if (!vivas.length) frases.push("No dejaste ninguna palabra.");
  else if (!tachadas && !borradas) frases.push("No tachaste ni borraste nada.");
  else if (dano < 0.08) frases.push("Solo heriste unas pocas palabras.");
  else if (tachadas > borradas * 1.2) frases.push("Tachaste más de lo que borraste.");
  else if (borradas > tachadas * 1.2) frases.push("Borraste más de lo que tachaste.");
  else frases.push("Tachaste y borraste por igual.");
  if (cortes && arrugadas) frases.push("La partiste y la arrugaste.");
  else if (cortes) frases.push("La partiste en dos.");
  else if (arrugadas) frases.push("La arrugaste en el puño.");
  if (vistas.some((p) => p.salvada)) frases.push("Y aun así salvaste algo del fuego.");
  return frases.join(" ");
}

async function iniciarDespedida() {
  if (estadoFinal) return;
  estadoFinal = "apagando";
  cancelarPresion();
  soltarTodos();
  ocultarCerillas();
  cerrarReverso();
  sonido.apagarFuego();
  fuera = null;
  pista.textContent = "";
  if (getComputedStyle(carta).opacity !== "0") {
    await carta.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1200, fill: "forwards" }).finished;
  }
  carta.style.visibility = "hidden";
  despedida.hidden = false;
  if (tiempoRestante() > COLA_FINAL + 4) levantarCenizas();
  else mostrarPapel();
}

function avanzarFinal() {
  if (estadoFinal === "cenizas" && tiempoRestante() <= COLA_FINAL) mostrarPapel();
  else if (estadoFinal === "papel" && papelListo && performance.now() - papelListo > 6000 && tiempoRestante() <= 1.5) guardarEnSobre();
}

function levantarCenizas() {
  estadoFinal = "cenizas";
  const vivas = resumenCarta().vivas;
  pista.textContent = vivas.length ? "Toca las palabras que quieras salvar" : "No quedó ninguna palabra";
  const pausa = Math.min(3200, Math.max(900, ((tiempoRestante() - COLA_FINAL) * 1000) / Math.max(1, vivas.length)));
  let turno = 0;

  (function soltarPalabra() {
    if (estadoFinal !== "cenizas") return;
    const libres = vivas.filter((p) => !p.salvada);
    if (libres.length && cenizas.querySelectorAll(".ceniza-palabra").length < 12) {
      for (let i = 0; i < vivas.length; i++) {
        const palabra = vivas[turno++ % vivas.length];
        if (palabra.salvada) continue;
        elevarPalabra(palabra);
        break;
      }
    }
    setTimeout(soltarPalabra, pausa);
  })();

  (function soltarHojuela() {
    if (estadoFinal !== "cenizas") return;
    elevarHojuela();
    setTimeout(soltarHojuela, 420);
  })();
}

function franja(anchoElemento) {
  const util = Math.min(window.innerWidth - 24, 560) - anchoElemento;
  return (window.innerWidth - Math.min(window.innerWidth - 24, 560)) / 2 + Math.random() * Math.max(0, util);
}

function elevar(el, x, duracion, opacidad) {
  const desde = window.innerHeight * (0.74 + Math.random() * 0.1);
  const hasta = window.innerHeight * 0.1;
  const vaiven = 14 + Math.random() * 22;
  const tramos = 6;
  const cuadros = Array.from({ length: tramos + 1 }, (_, i) => {
    const f = i / tramos;
    const dx = Math.sin(f * Math.PI * 3) * vaiven * (i === 0 ? 0 : 1);
    const y = desde + (hasta - desde) * f;
    return {
      transform: `translate(${x + dx}px, ${y}px) rotate(${Math.sin(f * 7) * 7}deg)`,
      opacity: f === 0 || f === 1 ? 0 : opacidad * (f < 0.7 ? 1 : (1 - f) / 0.3),
    };
  });
  el.animate(cuadros, { duration: duracion, easing: "linear", fill: "both" }).finished.then(() => el.remove()).catch(() => {});
}

function elevarPalabra(palabra) {
  const el = document.createElement("span");
  el.className = "ceniza-palabra";
  el.textContent = palabra.texto;
  cenizas.appendChild(el);
  elevar(el, franja(el.offsetWidth), 9000 + Math.random() * 3000, 0.95);
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    salvar(el, palabra);
  });
}

function elevarHojuela() {
  const el = document.createElement("i");
  el.className = "hojuela";
  const lado = 2 + Math.random() * 4;
  el.style.width = lado + "px";
  el.style.height = lado * 0.7 + "px";
  cenizas.appendChild(el);
  elevar(el, franja(lado), 6000 + Math.random() * 4000, 0.5);
}

function salvar(el, palabra) {
  if (palabra.salvada || estadoFinal !== "cenizas") return;
  palabra.salvada = true;
  vibrar();
  sonido.brasa();
  const lugar = getComputedStyle(el).transform;
  el.classList.add("salvada");
  quitarAnimaciones(el);
  el.animate(
    [
      { transform: lugar, opacity: 1 },
      { transform: `${lugar} scale(1.25)`, opacity: 1, offset: 0.35 },
      { transform: `${lugar} translateY(60px) scale(0.7)`, opacity: 0 },
    ],
    { duration: 1400, easing: "ease-in-out", fill: "both" }
  ).finished.then(() => el.remove()).catch(() => {});
}

function limpiarPalabra(t) {
  return t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function esSuelta(t) {
  return PALABRAS_SUELTAS.has(limpiarPalabra(t).toLowerCase());
}

function muestra(lista, n) {
  const elegidos = lista.map((v, i) => i);
  while (elegidos.length > n) elegidos.splice(Math.floor(Math.random() * elegidos.length), 1);
  return elegidos.map((i) => lista[i]);
}

function componerCarta() {
  const vistas = palabrasVistas();
  const salvadas = vistas.filter((p) => p.salvada);
  if (salvadas.length) {
    const elegidas = muestra(salvadas, 15).map((p) => limpiarPalabra(p.texto) || p.texto);
    const porLinea = elegidas.length <= 4 ? 1 : 3;
    const lineas = [];
    for (let i = 0; i < elegidas.length; i += porLinea) lineas.push(elegidas.slice(i, i + porLinea));
    return lineas;
  }

  const frases = [];
  let tramo = [];
  const cerrar = () => {
    while (tramo.length && esSuelta(tramo[tramo.length - 1])) tramo.pop();
    if (tramo.length >= 2) frases.push(tramo.map((t) => limpiarPalabra(t) || t));
    tramo = [];
  };
  vistas.forEach((p, i) => {
    const anterior = vistas[i - 1];
    if (!p.viva || (anterior && anterior.pagina !== p.pagina)) cerrar();
    if (!p.viva) return;
    tramo.push(p.texto);
    if (tramo.length >= 6 || /[.,:;]$/.test(p.texto)) cerrar();
  });
  cerrar();
  if (frases.length) return muestra(frases, 4);

  const solas = vistas.filter((p) => p.viva && !esSuelta(p.texto));
  const usar = solas.length ? solas : vistas.filter((p) => p.viva);
  return muestra(usar, 5).map((p) => [limpiarPalabra(p.texto) || p.texto]);
}

function bordeRoto(desgarro) {
  const n = 11;
  const puntos = [];
  const d = () => Math.random() * desgarro;
  for (let i = 0; i < n; i++) puntos.push([(i / n) * 100, d()]);
  for (let i = 0; i < n; i++) puntos.push([100 - d(), (i / n) * 100]);
  for (let i = 0; i < n; i++) puntos.push([100 - (i / n) * 100, 100 - d()]);
  for (let i = 0; i < n; i++) puntos.push([d(), 100 - (i / n) * 100]);
  return aCss(puntos);
}

async function mostrarPapel() {
  estadoFinal = "papel";
  pista.textContent = "";
  cenizas.querySelectorAll(".ceniza-palabra").forEach((el) => (el.style.pointerEvents = "none"));
  cenizas.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1800, fill: "forwards" });

  const cierre = FINALES[elegirFinal()];
  const quemado_ = registro.quemada;
  papel.classList.toggle("quemado", quemado_);
  papel.querySelector(".papel-borde").style.clipPath = bordeRoto(quemado_ ? 3.5 : 0.6);
  papel.querySelector(".papel-hoja").style.clipPath = bordeRoto(quemado_ ? 4 : 0.6);
  const carta_ = papel.querySelector(".ultima-carta");
  const lineas = componerCarta();
  lineas.forEach((linea) => {
    const p = document.createElement("p");
    linea.forEach((t, i) => {
      if (i) p.append(" ");
      const s = document.createElement("span");
      s.textContent = t;
      p.appendChild(s);
    });
    carta_.appendChild(p);
  });
  papel.classList.toggle("en-blanco", !lineas.length);
  papel.querySelector(".final-titulo").textContent = cierre.titulo;
  const frase = papel.querySelector(".final-frase");
  const letras = escribirEn(frase, cierre.frase);
  papel.querySelector(".final-huella").textContent = describirHuella();

  papel.hidden = false;
  ajustarPapel();
  sonido.pagina();
  papel.animate([{ opacity: 0, transform: "translateY(26px) rotate(-2deg)" }, { opacity: 1, transform: "none" }], { duration: 1600, easing: "ease-out", fill: "both" });
  await esperar(1500);

  const spans = [...carta_.querySelectorAll("span")];
  const paso = Math.min(320, 3600 / Math.max(1, spans.length));
  spans.forEach((s, i) =>
    s.animate(
      [
        { opacity: 0, transform: `translate(${(Math.random() - 0.5) * 40}px, -90px) rotate(${(Math.random() - 0.5) * 40}deg)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: 1300, delay: i * paso, easing: "ease-out", fill: "both" }
    )
  );
  await esperar(spans.length ? spans.length * paso + 1500 : 2200);

  mostrarSuave(papel.querySelector(".final-titulo"));
  await esperar(700);
  const ritmo = Math.min(45, 4500 / letras.length);
  letras.forEach((l, i) => l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: i * ritmo, fill: "both" }));
  await esperar(letras.length * ritmo + 500);
  mostrarSuave(papel.querySelector(".final-huella"));
  papelListo = performance.now();
}

function mostrarSuave(el) {
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, fill: "both" });
}

function escribirEn(el, frase) {
  el.textContent = "";
  el.setAttribute("aria-label", frase);
  const letras = [];
  frase.split(" ").forEach((palabra, i) => {
    if (i) el.append(" ");
    const bloque = document.createElement("span");
    bloque.className = "bloque";
    [...palabra].forEach((c) => {
      const l = document.createElement("span");
      l.className = "letra";
      l.textContent = c;
      bloque.appendChild(l);
      letras.push(l);
    });
    el.appendChild(bloque);
  });
  return letras;
}

function ajustarPapel() {
  if (papel.hidden) return;
  let f = Math.min(27, Math.max(20, window.innerWidth * 0.066));
  papel.style.setProperty("--fuente-papel", f + "px");
  while (papel.offsetHeight > escenario.offsetHeight - 10 && f > 13) {
    f -= 0.5;
    papel.style.setProperty("--fuente-papel", f + "px");
  }
}

async function guardarEnSobre() {
  estadoFinal = "sobre";
  clearInterval(reloj);
  quitarAnimaciones(escenaSobre);
  abrecartas.style.display = "none";
  sobre.classList.remove("sin-sello", "cortando");
  sobre.classList.add("abierto", "fuera");
  escenaSobre.style.display = "";
  papel.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(6%) scale(0.45)" }], { duration: 1500, easing: "ease-in", fill: "forwards" });
  await escenaSobre.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1700, delay: 500, fill: "both" }).finished;
  despedida.hidden = true;
  sonido.pagina();
  sobre.classList.remove("fuera");
  await esperar(1200);
  sonido.abrirSobre();
  sobre.classList.remove("abierto");
  await esperar(900);
  ponerSelloRoto();
  sonido.romperSello();
  vibrar();
  estadoFinal = "fin";
  pista.textContent = "Mantén el dedo sobre el sobre para volver a empezar";
}

function ponerSelloRoto() {
  [
    ["polygon(0 0, 52% 0, 46% 30%, 55% 44%, 44% 62%, 52% 80%, 48% 100%, 0 100%)", "translate(-56%, -50%) rotate(-7deg)"],
    ["polygon(52% 0, 100% 0, 100% 100%, 48% 100%, 52% 80%, 44% 62%, 55% 44%, 46% 30%)", "translate(-43%, -47%) rotate(6deg)"],
  ].forEach(([forma, lugar]) => {
    const mitad = sello.cloneNode(true);
    mitad.removeAttribute("id");
    Object.assign(mitad.style, { visibility: "visible", clipPath: forma, transform: lugar, pointerEvents: "none" });
    sobre.appendChild(mitad);
    mitad.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700 });
  });
}

function soltarReinicio() {
  if (!reinicio) return;
  clearTimeout(reinicio.reloj);
  reinicio = null;
  sobre.classList.remove("reiniciando");
}

escenaSobre.addEventListener("pointerdown", (e) => {
  if (estadoFinal !== "fin" || reinicio) return;
  e.preventDefault();
  sobre.classList.add("reiniciando");
  reinicio = { id: e.pointerId, x: e.clientX, y: e.clientY, reloj: setTimeout(() => location.reload(), TIEMPO_REINICIO) };
});
escenaSobre.addEventListener("pointermove", (e) => {
  if (reinicio && reinicio.id === e.pointerId && Math.hypot(e.clientX - reinicio.x, e.clientY - reinicio.y) > 30) soltarReinicio();
});
["pointerup", "pointercancel", "pointerleave"].forEach((tipo) => escenaSobre.addEventListener(tipo, soltarReinicio));
escenaSobre.addEventListener("contextmenu", (e) => e.preventDefault());
[escenaSobre, despedida].forEach((zona) =>
  zona.addEventListener("touchstart", (e) => {
    if (estadoFinal) e.preventDefault();
  }, { passive: false })
);
window.addEventListener("resize", ajustarPapel);
