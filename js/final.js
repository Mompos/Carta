const COLA_FINAL = 24;
const TIEMPO_REINICIO = 2000;
const PALABRAS_SUELTAS = new Set(
  "a al ante así aunque bajo con cuando cuánto de del desde e el en es la las le les lo los me mi ni no o para pero por porque que qué se si sin sobre su te tu tú un una unos unas y yo ya".split(" ")
);

const despedida = document.getElementById("despedida");
const lluvia = document.getElementById("lluvia");
const FRAGMENTOS = [...document.querySelectorAll("#paginas .lagrimas p")].map((p) => p.textContent.trim()).filter(Boolean);
const papel = document.getElementById("papel");

let papelListo = 0;
let lagrimasDichas = false;
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
  const { vivas, dano } = resumenCarta();
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
  llorar();
}

function avanzarFinal() {
  if (estadoFinal === "lagrimas" && lagrimasDichas && tiempoRestante() <= COLA_FINAL) mostrarPapel();
  else if (estadoFinal === "papel" && papelListo && performance.now() - papelListo > 6000 && tiempoRestante() <= 1.5) guardarEnSobre();
}

function llorar() {
  estadoFinal = "lagrimas";
  const espacio = Math.max(0, tiempoRestante() - COLA_FINAL - 4);
  const pausa = Math.min(6000, Math.max(2600, (espacio * 1000) / Math.max(1, FRAGMENTOS.length)));
  let n = 0;

  (function caer() {
    if (estadoFinal !== "lagrimas") return;
    if (n < FRAGMENTOS.length) {
      soltarLagrima(FRAGMENTOS[n], n, pausa);
      n++;
      if (n === FRAGMENTOS.length) setTimeout(() => (lagrimasDichas = true), Math.min(pausa * 2, 7000));
      setTimeout(caer, pausa);
    } else {
      soltarLagrima(null, n++, pausa);
      setTimeout(caer, 1600 + Math.random() * 2400);
    }
  })();
}

const SVG = "http://www.w3.org/2000/svg";
const activas = [];
let numeroGota = 0;

function azar(a, b) {
  return a + Math.random() * (b - a);
}

function zonaLluvia() {
  const arriba = document.querySelector("header").getBoundingClientRect().bottom + 10;
  const abajo = document.querySelector("footer").getBoundingClientRect().top - 6;
  return { izq: 14, der: window.innerWidth - 14, arriba, abajo };
}

function escalaGotas() {
  return Math.min(1.35, Math.max(0.8, Math.min(window.innerWidth, window.innerHeight * 0.62) / 375));
}

function buscarLugar(radio, cajaTexto) {
  const zona = zonaLluvia();
  const ahora = performance.now();
  for (let i = activas.length - 1; i >= 0; i--) if (activas[i].hasta < ahora) activas.splice(i, 1);
  const medioAncho = Math.max(radio, cajaTexto ? cajaTexto.w / 2 : 0);
  const medioAlto = Math.max(radio, cajaTexto ? cajaTexto.h / 2 : 0);
  let mejor = null;
  let mejorPuntaje = -Infinity;
  for (let intento = 0; intento < 40; intento++) {
    const x = azar(zona.izq + medioAncho, Math.max(zona.izq + medioAncho, zona.der - medioAncho));
    const y = azar(zona.arriba + medioAlto, Math.max(zona.arriba + medioAlto, zona.abajo - medioAlto));
    let puntaje = Infinity;
    activas.forEach((a) => {
      const holgura = Math.hypot(x - a.x, y - a.y) - (radio + a.radio);
      let choqueTexto = Infinity;
      if (cajaTexto && a.caja) {
        const dx = Math.abs(x - a.x) - (cajaTexto.w + a.caja.w) / 2;
        const dy = Math.abs(y - a.y) - (cajaTexto.h + a.caja.h) / 2;
        choqueTexto = Math.max(dx, dy);
      }
      puntaje = Math.min(puntaje, holgura, choqueTexto * 1.5);
    });
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = { x, y };
    }
    if (puntaje > 30) break;
  }
  return mejor;
}

function soltarLagrima(texto, n, pausa) {
  const escala = escalaGotas();
  const radio = (texto ? azar(40, 60) : Math.random() < 0.6 ? azar(10, 22) : azar(24, 38)) * escala;
  let frase = null;
  let caja = null;
  if (texto) {
    frase = document.createElement("p");
    frase.className = "frase-lagrima";
    frase.textContent = texto;
    lluvia.appendChild(frase);
    caja = { w: frase.offsetWidth + 16, h: frase.offsetHeight + 10 };
  }
  const { x: cx, y: cy } = buscarLugar(radio * 2.2, caja);
  const vida = frase ? Math.min(16000, pausa * 3.4) : azar(4500, 8000);
  activas.push({ x: cx, y: cy, radio: radio * 1.5, caja, hasta: performance.now() + vida * 0.8 });
  if (frase) frase.style.transform = `translate(${cx - frase.offsetWidth / 2}px, ${cy - frase.offsetHeight / 2}px)`;

  const gota = document.createElement("i");
  gota.className = "lagrima";
  const lado = Math.max(14, radio * 0.55);
  gota.style.width = gota.style.height = lado + "px";
  lluvia.appendChild(gota);
  const centroX = window.innerWidth / 2;
  const centroY = window.innerHeight / 2;
  const desde = `translate(${cx - lado / 2 + (cx - centroX) * 0.45}px, ${cy - lado / 2 + (cy - centroY) * 0.45}px) scale(4)`;
  const hasta = `translate(${cx - lado / 2}px, ${cy - lado / 2}px) scale(0.6)`;
  gota
    .animate(
      [
        { transform: desde, filter: "blur(9px)", opacity: 0 },
        { opacity: 0.55, offset: 0.25 },
        { transform: hasta, filter: "blur(0px)", opacity: 0.95 },
      ],
      { duration: azar(650, 850), easing: "cubic-bezier(0.55, 0, 0.9, 0.45)", fill: "forwards" }
    )
    .finished.then(() => {
      gota.remove();
      salpicar(cx, cy, radio, frase, vida);
    })
    .catch(() => gota.remove());
}

function contornoIrregular(radio, puntas) {
  const n = 18;
  const fase = Math.random() * 6.3;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = radio * (1 + 0.1 * Math.sin(a * 3 + fase) + 0.07 * Math.sin(a * 5 + fase * 2) + azar(-0.05, 0.05));
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
  puntas.forEach(({ a, largo }) => {
    const i = Math.round((a / (Math.PI * 2)) * n) % n;
    pts[i] = [Math.cos(a) * (radio + largo * 0.35), Math.sin(a) * (radio + largo * 0.35)];
  });
  const medio = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  let d = `M${medio(pts[n - 1], pts[0]).map((v) => v.toFixed(1)).join(" ")}`;
  for (let i = 0; i < n; i++) {
    const m = medio(pts[i], pts[(i + 1) % n]);
    d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + " Z";
}

function nodo(tipo, atributos, padre) {
  const el = document.createElementNS(SVG, tipo);
  Object.entries(atributos).forEach(([k, v]) => el.setAttribute(k, v));
  if (padre) padre.appendChild(el);
  return el;
}

function salpicar(cx, cy, radio, frase, vida) {
  if (estadoFinal !== "lagrimas" && estadoFinal !== "papel") return;
  sonido.gota(radio > 26);
  if (frase) vibrar();
  const id = "g" + numeroGota++;
  const alcance = radio * 2.6;
  const lado = alcance * 2;
  const svg = nodo("svg", { class: "salpicadura", width: lado, height: lado, viewBox: `${-alcance} ${-alcance} ${lado} ${lado}` });
  svg.style.left = cx - alcance + "px";
  svg.style.top = cy - alcance + "px";

  const defs = nodo("defs", {}, svg);
  const degradado = nodo("radialGradient", { id, gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: (radio * 1.08).toFixed(1), fx: (-radio * 0.2).toFixed(1), fy: (-radio * 0.25).toFixed(1) }, defs);
  [
    ["0", "rgba(80, 110, 150, 0.12)"],
    ["0.78", "rgba(95, 128, 170, 0.2)"],
    ["0.93", "rgba(165, 195, 232, 0.4)"],
    ["1", "rgba(210, 228, 250, 0.5)"],
  ].forEach(([offset, color]) => nodo("stop", { offset, "stop-color": color }, degradado));

  const puntas = Array.from({ length: Math.round(azar(6, 11)) }, () => ({ a: Math.random() * Math.PI * 2, largo: radio * azar(0.2, 0.85) }));

  const corona = nodo("g", { class: "corona" }, svg);
  puntas.forEach(({ a, largo }) => {
    const ancho_ = radio * azar(0.05, 0.12);
    const x1 = Math.cos(a) * radio * 0.98;
    const y1 = Math.sin(a) * radio * 0.98;
    const x2 = Math.cos(a) * (radio + largo);
    const y2 = Math.sin(a) * (radio + largo);
    const px = -Math.sin(a) * ancho_;
    const py = Math.cos(a) * ancho_;
    nodo("path", { d: `M${(x1 + px).toFixed(1)} ${(y1 + py).toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} L${(x1 - px).toFixed(1)} ${(y1 - py).toFixed(1)} Z`, fill: "rgba(160, 190, 230, 0.34)" }, corona);
    if (Math.random() < 0.75) {
      const rr = radio * azar(0.05, 0.11);
      nodo("circle", { cx: (Math.cos(a) * (radio + largo + rr * 1.4)).toFixed(1), cy: (Math.sin(a) * (radio + largo + rr * 1.4)).toFixed(1), r: rr.toFixed(1), fill: "rgba(150, 182, 225, 0.32)", stroke: "rgba(205,225,248,0.5)", "stroke-width": "0.8" }, corona);
    }
  });

  const mancha = nodo("g", { class: "mancha-agua" }, svg);
  nodo("path", { d: contornoIrregular(radio, puntas), fill: `url(#${id})`, stroke: "rgba(210, 228, 250, 0.55)", "stroke-width": "1.2" }, mancha);
  nodo("ellipse", { cx: (-radio * 0.32).toFixed(1), cy: (-radio * 0.36).toFixed(1), rx: (radio * 0.28).toFixed(1), ry: (radio * 0.16).toFixed(1), fill: "rgba(255,255,255,0.22)", transform: "rotate(-28)" }, mancha);

  const satelites = nodo("g", {}, svg);
  const gotitas = Array.from({ length: Math.round(azar(4, 9)) }, () => {
    const a = Math.random() * Math.PI * 2;
    const d = radio * azar(1.5, 2.4);
    const c = nodo("circle", { cx: 0, cy: 0, r: (radio * azar(0.04, 0.1)).toFixed(1), fill: "rgba(170, 200, 238, 0.5)", stroke: "rgba(220, 235, 252, 0.6)", "stroke-width": "0.7" }, satelites);
    return { c, x: Math.cos(a) * d, y: Math.sin(a) * d };
  });

  const onda = nodo("circle", { cx: 0, cy: 0, r: radio.toFixed(1), fill: "none", stroke: "rgba(210, 228, 250, 0.7)", "stroke-width": "1.4" }, svg);
  lluvia.insertBefore(svg, lluvia.firstChild);

  [mancha, corona, onda].forEach((g) => {
    g.style.transformBox = "view-box";
    g.style.transformOrigin = "0px 0px";
  });
  mancha.animate([{ transform: "scale(0.25)" }, { transform: "scale(1.08)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 380, easing: "ease-out", fill: "both" });
  corona.animate(
    [
      { transform: "scale(0.3)", opacity: 0 },
      { transform: "scale(1.12)", opacity: 1, offset: 0.45 },
      { transform: "scale(1)", opacity: 0.55 },
    ],
    { duration: 520, easing: "ease-out", fill: "both" }
  );
  gotitas.forEach(({ c, x, y }) =>
    c.animate([{ transform: "translate(0px, 0px)", opacity: 0 }, { transform: `translate(${x}px, ${y}px)`, opacity: 1 }], { duration: azar(260, 420), easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "both" })
  );
  onda.animate([{ transform: "scale(0.6)", opacity: 0.9 }, { transform: "scale(2.5)", opacity: 0 }], { duration: 1100, easing: "ease-out", fill: "both" });

  svg.animate(
    [{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }],
    { duration: vida, easing: "ease-in", fill: "forwards" }
  ).finished.then(() => svg.remove()).catch(() => {});

  if (frase) {
    frase.animate(
      [
        { opacity: 0, filter: "blur(4px)" },
        { opacity: 1, filter: "blur(0px)", offset: 0.1 },
        { opacity: 1, filter: "blur(0px)", offset: 0.72 },
        { opacity: 0, filter: "blur(2px)" },
      ],
      { duration: vida, delay: 250, fill: "both" }
    ).finished.then(() => frase.remove()).catch(() => {});
  }
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
  lluvia.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 2400, fill: "forwards" });

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
