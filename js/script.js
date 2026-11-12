const escenario = document.getElementById("escenario");
const carta = document.getElementById("carta");
const texto = document.getElementById("texto");
const lienzo = document.getElementById("tinta");
const ctx = lienzo.getContext("2d");
const arrugas = carta.querySelector(".arrugas");
const numero = document.getElementById("numero");
const pista = document.getElementById("pista");

const PROPORCION = 0.72;
const TINTA = "#1d2340";
const VENTANA_GESTO = 450;
const TIEMPO_GASTADA = 60000;
const ESPERA_ARRUGAR = 1200;
const TIEMPO_ARRUGAR = 10000;
const INICIO_PUENTE = 280;
const DURACION_CANCION = 343.6;
const FONDO = "#2b2622";
const PISTA_INICIAL = "Frota de lado a lado para rayar · Arriba y abajo para borrar · Mantén presionado para arrugar";
const PISTA_PUENTE = "Raspa una cerilla en la caja y lánzala al puente";
const paginas = [...document.querySelectorAll("#paginas .pagina:not(.puente)")].map((s) => s.innerHTML);
const paginaPuente = document.querySelector("#paginas .pagina.puente").innerHTML;
const quemado = document.getElementById("quemado");
const qctx = quemado.getContext("2d");
const cancion = document.getElementById("cancion");

let enPuente = false;
let ardiendo = false;
let historiaIniciada = false;

let ancho = 0;
let alto = 0;
let fuente = 20;
let actual = 0;
let palabras = [];
let trazos = [];
let tiempoActivo = 0;
let animando = false;
let presion = null;
let ultimaVibracion = 0;
const dedos = new Map();

function vibrar() {
  const ahora = performance.now();
  if (ahora - ultimaVibracion < 90) return;
  ultimaVibracion = ahora;
  if (navigator.vibrate) {
    navigator.vibrate(12);
    return;
  }
  const etiqueta = document.createElement("label");
  const interruptor = document.createElement("input");
  interruptor.type = "checkbox";
  interruptor.setAttribute("switch", "");
  etiqueta.appendChild(interruptor);
  etiqueta.style.display = "none";
  document.body.appendChild(etiqueta);
  etiqueta.click();
  etiqueta.remove();
}

function envolverPalabras() {
  const nodos = [];
  const caminante = document.createTreeWalker(texto, NodeFilter.SHOW_TEXT);
  while (caminante.nextNode()) nodos.push(caminante.currentNode);

  nodos.forEach((nodo) => {
    if (!nodo.textContent.trim()) return;
    const fragmento = document.createDocumentFragment();
    nodo.textContent.split(/(\s+)/).forEach((parte) => {
      if (!parte) return;
      if (/^\s+$/.test(parte)) {
        fragmento.appendChild(document.createTextNode(parte));
      } else {
        const span = document.createElement("span");
        span.className = "palabra";
        span.textContent = parte;
        fragmento.appendChild(span);
      }
    });
    nodo.replaceWith(fragmento);
  });

  palabras = [...texto.querySelectorAll(".palabra")].map((el) => ({
    el, raya: 0, borrado: 0, tachada: false, borrada: false, x: 0, y: 0, w: 0, h: 0,
  }));
}

function ajustar() {
  const caja = escenario.getBoundingClientRect();
  const estilo = getComputedStyle(escenario);
  const libreX = caja.width - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
  const libreY = caja.height - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom);

  const proporcion = Math.min(PROPORCION, Math.max(0.6, libreX / libreY));
  ancho = Math.floor(Math.min(libreX, libreY * proporcion));
  alto = Math.floor(ancho / proporcion);
  carta.style.width = ancho + "px";
  carta.style.height = alto + "px";

  fuente = ancho * 0.075;
  carta.style.setProperty("--fuente", fuente + "px");
  while ((texto.scrollHeight > texto.clientHeight + 1 || texto.scrollWidth > texto.clientWidth + 1) && fuente > 8) {
    fuente *= 0.96;
    carta.style.setProperty("--fuente", fuente + "px");
  }

  const dpr = window.devicePixelRatio || 1;
  lienzo.width = Math.round(ancho * dpr);
  lienzo.height = Math.round(alto * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  quemado.width = lienzo.width;
  quemado.height = lienzo.height;
  qctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  medir();
  redibujar();
}

function medir() {
  palabras.forEach((p) => {
    p.x = texto.offsetLeft + texto.clientLeft + p.el.offsetLeft;
    p.y = texto.offsetTop + texto.clientTop + p.el.offsetTop;
    p.w = p.el.offsetWidth;
    p.h = p.el.offsetHeight;
  });
}

function medio(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function dibujarTramo(puntos, i) {
  if (i < 1) return;
  const b = puntos[i - 1];
  const c = puntos[i];
  const inicio = i === 1 ? b : medio(puntos[i - 2], b);
  const fin = medio(b, c);
  ctx.save();
  ctx.strokeStyle = TINTA;
  ctx.lineWidth = c[2];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(inicio[0], inicio[1]);
  ctx.quadraticCurveTo(b[0], b[1], fin[0], fin[1]);
  ctx.stroke();
  ctx.restore();
}

function borrarEn(x, y, r) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const goma = ctx.createRadialGradient(x, y, 0, x, y, r);
  goma.addColorStop(0, "rgba(0,0,0,0.45)");
  goma.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = goma;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  const mancha = ctx.createRadialGradient(x, y, 0, x, y, r);
  mancha.addColorStop(0, "rgba(110,95,70,0.025)");
  mancha.addColorStop(1, "rgba(110,95,70,0)");
  ctx.fillStyle = mancha;
  ctx.fill();
  ctx.restore();
}

function enPixeles(puntos) {
  return puntos.map(([x, y, w]) => [x * ancho, y * ancho, w * ancho]);
}

function redibujar() {
  ctx.clearRect(0, 0, ancho, alto);
  trazos.forEach((t) => {
    if (t.tipo === "linea") {
      const pix = enPixeles(t.puntos);
      for (let i = 1; i < pix.length; i++) dibujarTramo(pix, i);
    } else {
      borrarEn(t.x * ancho, t.y * ancho, t.r * ancho);
    }
  });
}

function nuevaLinea() {
  const t = { tipo: "linea", puntos: [] };
  trazos.push(t);
  return t;
}

function agregarPunto(t, x, y, grosor) {
  t.puntos.push([x / ancho, y / ancho, grosor / ancho]);
  const pix = enPixeles(t.puntos.slice(-3));
  dibujarTramo(pix, pix.length - 1);
}

function palabrasEn(x, y, holgura) {
  return palabras.filter(
    (p) =>
      !p.borrada &&
      x > p.x - holgura && x < p.x + p.w + holgura &&
      y > p.y - holgura && y < p.y + p.h + holgura
  );
}

function tachar(p) {
  p.tachada = true;
  p.el.classList.add("tachada");
  vibrar();
  const t = nuevaLinea();
  const grosor = fuente * 0.13;
  const dientes = Math.max(4, Math.round(p.w / (fuente * 0.18)));
  const arriba = p.y + p.h * 0.25;
  const abajo = p.y + p.h * 0.8;
  for (let pasada = 0; pasada < 2; pasada++) {
    for (let i = 0; i <= dientes; i++) {
      const k = pasada ? dientes - i : i;
      const x = p.x + (p.w * k) / dientes + (Math.random() - 0.5) * fuente * 0.08;
      const y = ((i + pasada) % 2 ? arriba : abajo) + (Math.random() - 0.5) * fuente * 0.1;
      agregarPunto(t, x, y, grosor);
    }
  }
}

function intensidad(a, b) {
  const distancia = Math.hypot(b.x - a.x, b.y - a.y);
  const velocidad = distancia / Math.max(1, b.t - a.t);
  return { distancia, fuerza: Math.min(2.5, Math.max(0.5, velocidad / 0.5)) };
}

function rayar(dedo, a, b) {
  const { distancia, fuerza } = intensidad(a, b);
  const presionLapiz = b.tipo === "pen" && b.presion > 0 ? 0.5 + b.presion : 1;
  const grosor = fuente * (0.06 + 0.025 * fuerza) * presionLapiz;
  if (!dedo.trazo) {
    dedo.trazo = nuevaLinea();
    agregarPunto(dedo.trazo, a.x, a.y, grosor);
  }
  const temblor = fuente * 0.05;
  agregarPunto(dedo.trazo, b.x + (Math.random() - 0.5) * temblor, b.y + (Math.random() - 0.5) * temblor, grosor);

  const holgura = Math.max(fuente * 0.15, b.contacto * 0.25);
  palabrasEn(b.x, b.y, holgura).forEach((p) => {
    if (p.tachada) return;
    p.raya += (distancia * fuerza) / (Math.max(p.w, fuente) * 4);
    if (p.raya >= 1) tachar(p);
  });
}

function borrar(a, b) {
  const { distancia, fuerza } = intensidad(a, b);
  const r = Math.max(fuente * 0.9, b.contacto * 0.6);
  const pasos = Math.max(1, Math.ceil(distancia / (r * 0.35)));
  for (let i = 1; i <= pasos; i++) {
    const x = a.x + ((b.x - a.x) * i) / pasos;
    const y = a.y + ((b.y - a.y) * i) / pasos;
    trazos.push({ tipo: "goma", x: x / ancho, y: y / ancho, r: r / ancho });
    borrarEn(x, y, r);
  }

  palabrasEn(b.x, b.y, r * 0.6).forEach((p) => {
    p.borrado = Math.min(1, p.borrado + (distancia * fuerza) / (p.h * 14));
    p.el.style.opacity = 1 - p.borrado;
    p.el.style.filter = `blur(${p.borrado * 2}px)`;
    if (p.borrado >= 0.8) {
      p.borrada = true;
      p.el.classList.add("borrada");
      vibrar();
    }
  });

  if (!enPuente && palabras.length && palabras.every((p) => p.borrada)) siguientePagina();
}

function giros(valores, minimo) {
  let cuenta = 0;
  let direccion = 0;
  let extremo = valores[0];
  for (const v of valores) {
    if (direccion === 0) {
      if (Math.abs(v - extremo) > minimo) {
        direccion = Math.sign(v - extremo);
        extremo = v;
      }
    } else if ((v - extremo) * direccion > 0) {
      extremo = v;
    } else if (Math.abs(v - extremo) > minimo) {
      cuenta++;
      direccion = -direccion;
      extremo = v;
    }
  }
  return cuenta;
}

function clasificar(dedo) {
  const r = dedo.recorrido;
  let sx = 0;
  let sy = 0;
  for (let i = 1; i < r.length; i++) {
    sx += Math.abs(r[i].x - r[i - 1].x);
    sy += Math.abs(r[i].y - r[i - 1].y);
  }
  const minimo = fuente * 0.3;
  const gx = giros(r.map((p) => p.x), minimo);
  const gy = giros(r.map((p) => p.y), minimo);
  const umbral = fuente * 2;

  if (gx >= 2 && sx > umbral && sx > sy * 1.5) return "rayar";
  if (gy >= 2 && sy > umbral && sy > sx * 1.5) return "borrar";
  if (dedo.modo === "rayar" && gx === 0 && sx + sy > fuente * 4) return null;
  if (dedo.modo === "borrar" && gy === 0 && sx + sy > fuente * 4) return null;
  return dedo.modo;
}

function aplicar(dedo, a, b) {
  if (animando) return;
  tiempoActivo += Math.min(100, b.t - a.t);
  if (dedo.modo === "rayar") rayar(dedo, a, b);
  else if (dedo.modo === "borrar") borrar(a, b);
}

let inicioHistoria = 0;

function duracionHistoria() {
  const d = cancion.duration;
  return Number.isFinite(d) && d > INICIO_PUENTE + 30 ? d : DURACION_CANCION;
}

function tiempoReal() {
  return inicioHistoria ? (performance.now() - inicioHistoria) / 1000 : 0;
}

function tiempoHistoria() {
  const real = tiempoReal();
  if (cancion.paused && cancion.currentTime === 0) return real;
  return Math.min(cancion.currentTime, real + 5);
}

function actualizarDesgaste() {
  const avanceCancion = historiaIniciada ? Math.min(1, tiempoHistoria() / duracionHistoria()) : 0;
  const desgaste = Math.min(1, Math.max(tiempoActivo / TIEMPO_GASTADA, avanceCancion));
  carta.style.setProperty("--desgaste", desgaste.toFixed(3));
  return desgaste;
}

function actualizarPista() {
  if (animando || !historiaIniciada || ardiendo) return;
  const desgaste = actualizarDesgaste();
  const modos = [...dedos.values()].map((d) => d.modo);
  if (presion && presion.avance > 0) {
    const quedan = Math.ceil((TIEMPO_ARRUGAR - (performance.now() - presion.inicio)) / 1000);
    pista.textContent = `Arrugando la hoja… ${quedan}`;
  } else if (modos.includes("rayar")) pista.textContent = "Rayando…";
  else if (modos.includes("borrar")) pista.textContent = "Borrando…";
  else if (enPuente) pista.textContent = PISTA_PUENTE;
  else if (desgaste >= 1) pista.textContent = "La carta ya está gastada.";
  else pista.textContent = PISTA_INICIAL;
}

function punto(e) {
  const base = carta.offsetParent.getBoundingClientRect();
  return {
    x: e.clientX - base.left - carta.offsetLeft - carta.clientLeft,
    y: e.clientY - base.top - carta.offsetTop - carta.clientTop,
    t: e.timeStamp || performance.now(),
    tipo: e.pointerType,
    presion: e.pressure,
    contacto: Math.max(e.width || 0, e.height || 0),
  };
}

function procesar(dedo, p) {
  const anterior = dedo.recorrido[dedo.recorrido.length - 1];
  dedo.recorrido.push(p);
  while (dedo.recorrido.length > 2 && p.t - dedo.recorrido[0].t > VENTANA_GESTO) dedo.recorrido.shift();

  const nuevo = clasificar(dedo);
  if (nuevo !== dedo.modo) {
    dedo.modo = nuevo;
    dedo.trazo = null;
    if (nuevo) {
      for (let i = 1; i < dedo.recorrido.length; i++) aplicar(dedo, dedo.recorrido[i - 1], dedo.recorrido[i]);
    }
  } else if (dedo.modo && anterior) {
    aplicar(dedo, anterior, p);
  }
}

function poligonoRecto() {
  const puntos = [];
  const n = 6;
  for (let i = 0; i < n; i++) puntos.push([(i / n) * 100, 0]);
  for (let i = 0; i < n; i++) puntos.push([100, (i / n) * 100]);
  for (let i = 0; i < n; i++) puntos.push([100 - (i / n) * 100, 100]);
  for (let i = 0; i < n; i++) puntos.push([0, 100 - (i / n) * 100]);
  return puntos;
}

function poligonoBola() {
  const radio = Math.min(ancho, alto) * 0.5;
  return poligonoRecto().map(([px, py]) => {
    const angulo = Math.atan2(((py - 50) * alto) / 100, ((px - 50) * ancho) / 100);
    const r = radio * (0.72 + Math.random() * 0.28);
    return [50 + ((Math.cos(angulo) * r) / ancho) * 100, 50 + ((Math.sin(angulo) * r) / alto) * 100];
  });
}

function mezclar(a, b, t) {
  return a.map(([x, y], i) => [x + (b[i][0] - x) * t, y + (b[i][1] - y) * t]);
}

function aCss(puntos) {
  return `polygon(${puntos.map(([x, y]) => `${x.toFixed(2)}% ${y.toFixed(2)}%`).join(", ")})`;
}

function iniciarPresion(id, p) {
  presion = { id, x: p.x, y: p.y, inicio: performance.now(), avance: 0, bola: poligonoBola(), segundo: 0 };
  carta.style.transition = "none";
  arrugas.style.transition = "none";
  presion.raf = requestAnimationFrame(avanzarPresion);
}

function avanzarPresion() {
  if (!presion) return;
  const t = performance.now() - presion.inicio;
  const avance = Math.min(1, Math.max(0, (t - ESPERA_ARRUGAR) / (TIEMPO_ARRUGAR - ESPERA_ARRUGAR)));
  presion.avance = avance;
  if (avance > 0) {
    carta.style.clipPath = aCss(mezclar(poligonoRecto(), presion.bola, avance * 0.15));
    carta.style.transform = `scale(${1 - avance * 0.06}) rotate(${-avance * 2.5}deg)`;
    arrugas.style.opacity = avance * 0.85;
    const segundo = Math.floor(t / 1000);
    if (segundo !== presion.segundo) {
      presion.segundo = segundo;
      vibrar();
    }
  }
  actualizarPista();
  if (t >= TIEMPO_ARRUGAR) {
    arrugar();
    return;
  }
  presion.raf = requestAnimationFrame(avanzarPresion);
}

function cancelarPresion() {
  if (!presion) return;
  cancelAnimationFrame(presion.raf);
  const habiaAvance = presion.avance > 0;
  presion = null;
  if (habiaAvance) {
    carta.style.transition = "clip-path 0.25s ease-out, transform 0.25s ease-out";
    arrugas.style.transition = "opacity 0.25s ease-out";
    carta.style.clipPath = aCss(poligonoRecto());
    carta.style.transform = "";
    arrugas.style.opacity = "";
    setTimeout(() => {
      if (!presion && !animando) carta.style.clipPath = "";
    }, 300);
  }
  actualizarPista();
}

function limpiarForma() {
  carta.getAnimations().forEach((a) => a.cancel());
  carta.style.transition = "none";
  carta.style.clipPath = "";
  carta.style.transform = "";
  arrugas.style.transition = "none";
  arrugas.style.opacity = "";
}

function soltarTodos() {
  dedos.forEach((_, id) => {
    if (carta.hasPointerCapture(id)) carta.releasePointerCapture(id);
  });
  dedos.clear();
}

async function arrugar() {
  const bola = aCss(presion.bola);
  const desde = { clipPath: carta.style.clipPath, transform: carta.style.transform || "none" };
  presion = null;
  animando = true;
  soltarTodos();
  pista.textContent = "…";
  vibrar();
  arrugas.style.opacity = 1;

  await carta.animate(
    [desde, { clipPath: bola, transform: "scale(0.5) rotate(-30deg)" }],
    { duration: 650, easing: "cubic-bezier(0.5, 0, 0.3, 1)", fill: "forwards" }
  ).finished;
  await carta.animate(
    [
      { clipPath: bola, transform: "scale(0.5) rotate(-30deg)" },
      { clipPath: bola, transform: "translateY(-8%) scale(0.42) rotate(40deg)", offset: 0.3 },
      { clipPath: bola, transform: "translateY(120vh) scale(0.38) rotate(280deg)" },
    ],
    { duration: 950, easing: "ease-in", fill: "forwards" }
  ).finished;

  limpiarForma();
  cargarPagina(actual);
  await entrar([{ opacity: 0, transform: "translateY(18px) scale(0.97)" }, { opacity: 1, transform: "none" }]);
}

function siguientePagina() {
  return cambiarPagina((actual + 1) % paginas.length);
}

async function cambiarPagina(destino) {
  if (animando) return false;
  animando = true;
  cancelarPresion();
  soltarTodos();
  vibrar();
  await new Promise((r) => setTimeout(r, 450));
  await carta.animate(
    [{ transform: "none", opacity: 1 }, { transform: "translateX(-115%) rotate(-10deg)", opacity: 0 }],
    { duration: 700, easing: "ease-in", fill: "forwards" }
  ).finished;

  limpiarForma();
  carta.style.opacity = 0;
  cargarPagina(destino);
  carta.style.opacity = "";
  await entrar([{ opacity: 0, transform: "translateX(40px) rotate(3deg)" }, { opacity: 1, transform: "none" }]);
  return true;
}

async function entrar(cuadros) {
  await carta.animate(cuadros, { duration: 550, easing: "ease-out" }).finished;
  animando = false;
  actualizarPista();
}

function cargarPagina(i) {
  enPuente = i === "puente";
  document.body.classList.toggle("puente-activo", enPuente);
  if (!enPuente) actual = i;
  texto.innerHTML = enPuente ? paginaPuente : paginas[i];
  envolverPalabras();
  trazos = [];
  tiempoActivo = 0;
  numero.textContent = enPuente ? "" : `— ${i + 1} —`;
  ajustar();
  actualizarPista();
}

carta.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (animando || ardiendo || !historiaIniciada) return;
  try {
    carta.setPointerCapture(e.pointerId);
  } catch (error) {}
  if (dedos.size === 0) medir();
  const p = punto(e);
  dedos.set(e.pointerId, { recorrido: [p], modo: null, trazo: null });
  if (dedos.size === 1 && !enPuente) iniciarPresion(e.pointerId, p);
  else cancelarPresion();
});

carta.addEventListener("pointermove", (e) => {
  const dedo = dedos.get(e.pointerId);
  if (!dedo || animando || ardiendo) return;
  const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  (eventos.length ? eventos : [e]).forEach((ev) => procesar(dedo, punto(ev)));
  if (presion && presion.id === e.pointerId) {
    const p = dedo.recorrido[dedo.recorrido.length - 1];
    if (Math.hypot(p.x - presion.x, p.y - presion.y) > Math.max(14, fuente * 0.6)) cancelarPresion();
  }
  actualizarPista();
});

function soltar(e) {
  if (!dedos.delete(e.pointerId)) return;
  if (presion && presion.id === e.pointerId) cancelarPresion();
  actualizarPista();
}

carta.addEventListener("pointerup", soltar);
carta.addEventListener("pointercancel", soltar);
carta.addEventListener("lostpointercapture", soltar);
carta.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
carta.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("gesturestart", (e) => e.preventDefault());

let pendiente = false;
new ResizeObserver(() => {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    ajustar();
  });
}).observe(escenario);

const escenaSobre = document.getElementById("escena-sobre");
const sobre = document.getElementById("sobre");
const sello = document.getElementById("sello");
const grietas = sello.querySelector(".grietas");
const abrecartas = document.getElementById("abrecartas");
const lienzoCorte = document.getElementById("corte");
const cctx = lienzoCorte.getContext("2d");
const TRAMOS_CORTE = 48;
const tramosCortados = new Array(TRAMOS_CORTE).fill(false);

let integridadSello = 1;
let selloRoto = false;
let toqueSello = null;
let posAbre = { x: 0, y: 0, rot: 0 };
let agarre = null;
let ultimaPunta = null;
let sobreAbierto = false;
let audioPreparado = false;
let esperandoToqueCancion = false;

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function prepararAudio() {
  if (esperandoToqueCancion) {
    if (Number.isFinite(cancion.duration)) cancion.currentTime = Math.min(tiempoReal(), cancion.duration - 1);
    cancion.play().then(() => {
      esperandoToqueCancion = false;
      actualizarPista();
    }).catch(() => {});
    return;
  }
  if (audioPreparado || sobreAbierto) return;
  audioPreparado = true;
  cancion.muted = true;
  cancion.play().then(() => {
    if (!sobreAbierto) {
      cancion.pause();
      cancion.currentTime = 0;
    }
    cancion.muted = false;
  }).catch(() => {
    cancion.muted = false;
    audioPreparado = false;
  });
}

["pointerup", "touchend", "click"].forEach((tipo) => document.addEventListener(tipo, prepararAudio, true));

function empezarCancion() {
  cancion.muted = false;
  cancion.currentTime = 0;
  cancion.play().catch(() => {
    esperandoToqueCancion = true;
    pista.textContent = "Toca la pantalla para escuchar la canción";
  });
}

function soltarMiga(x, y) {
  const miga = document.createElement("span");
  miga.className = "miga";
  miga.style.left = x + "px";
  miga.style.top = y + "px";
  document.body.appendChild(miga);
  miga.animate(
    [
      { transform: "translate(0, 0) rotate(0)", opacity: 1 },
      { transform: `translate(${(Math.random() - 0.5) * 70}px, ${120 + Math.random() * 120}px) rotate(${Math.random() * 360}deg)`, opacity: 0 },
    ],
    { duration: 800, easing: "ease-in" }
  ).finished.then(() => miga.remove());
}

sello.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (selloRoto) return;
  try {
    sello.setPointerCapture(e.pointerId);
  } catch (error) {}
  toqueSello = { id: e.pointerId, x: e.clientX, y: e.clientY };
});

sello.addEventListener("pointermove", (e) => {
  if (!toqueSello || toqueSello.id !== e.pointerId || selloRoto) return;
  const distancia = Math.hypot(e.clientX - toqueSello.x, e.clientY - toqueSello.y);
  toqueSello.x = e.clientX;
  toqueSello.y = e.clientY;
  const caja = sello.getBoundingClientRect();
  const margen = caja.width * 0.4;
  if (e.clientX < caja.left - margen || e.clientX > caja.right + margen || e.clientY < caja.top - margen || e.clientY > caja.bottom + margen) return;

  integridadSello -= distancia / (caja.width * 7);
  grietas.style.opacity = Math.min(1, (1 - integridadSello) * 1.4);
  sello.style.transform = `translate(-50%, -50%) rotate(${(Math.random() - 0.5) * 6}deg)`;
  if (Math.random() < distancia / 30) soltarMiga(e.clientX, e.clientY);
  if (integridadSello <= 0) romperSello();
});

["pointerup", "pointercancel"].forEach((tipo) => sello.addEventListener(tipo, () => (toqueSello = null)));

function romperSello() {
  selloRoto = true;
  toqueSello = null;
  vibrar();
  const caja = sello.getBoundingClientRect();
  const anchoSobre = getComputedStyle(sobre).getPropertyValue("--ancho-sobre");
  const cortes = [
    "polygon(0 0, 52% 0, 46% 30%, 55% 44%, 44% 62%, 52% 80%, 48% 100%, 0 100%)",
    "polygon(52% 0, 100% 0, 100% 100%, 48% 100%, 52% 80%, 44% 62%, 55% 44%, 46% 30%)",
  ];
  cortes.forEach((forma, i) => {
    const pedazo = sello.cloneNode(true);
    pedazo.removeAttribute("id");
    pedazo.classList.add("pedazo");
    Object.assign(pedazo.style, {
      left: caja.left + "px",
      top: caja.top + "px",
      width: caja.width + "px",
      height: caja.height + "px",
      transform: "none",
      clipPath: forma,
    });
    pedazo.style.setProperty("--ancho-sobre", anchoSobre);
    document.body.appendChild(pedazo);
    const lado = i ? 1 : -1;
    pedazo.animate(
      [
        { transform: "translate(0, 0) rotate(0)", opacity: 1 },
        { transform: `translate(${lado * 30}px, -10px) rotate(${lado * 15}deg)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${lado * 80}px, 70vh) rotate(${lado * 140}deg)`, opacity: 0 },
      ],
      { duration: 1300, easing: "ease-in" }
    ).finished.then(() => pedazo.remove());
  });
  for (let i = 0; i < 10; i++) soltarMiga(caja.left + Math.random() * caja.width, caja.top + Math.random() * caja.height);
  sello.style.visibility = "hidden";
  sobre.classList.add("sin-sello");
  pista.textContent = "Toma el abrecartas y pasa la punta por la línea de arriba del sobre";
}

function pintarAbrecartas() {
  abrecartas.style.transform = `translate(${posAbre.x}px, ${posAbre.y - abrecartas.offsetHeight / 2}px) rotate(${posAbre.rot}deg)`;
}

function abrecartasEnReposo(animar) {
  const caja = sobre.getBoundingClientRect();
  posAbre = {
    x: caja.left + (caja.width - abrecartas.offsetWidth) / 2,
    y: Math.min(caja.bottom + Math.max(50, caja.height * 0.35), window.innerHeight - 90),
    rot: -6,
  };
  abrecartas.style.transition = animar ? "transform 0.4s ease-out" : "none";
  pintarAbrecartas();
}

abrecartas.style.transformOrigin = "0 50%";

function cortarEntre(x1, x2, caja) {
  const desde = Math.max(0, Math.min(TRAMOS_CORTE - 1, Math.floor(((Math.min(x1, x2) - caja.left) / caja.width) * TRAMOS_CORTE)));
  const hasta = Math.max(0, Math.min(TRAMOS_CORTE - 1, Math.floor(((Math.max(x1, x2) - caja.left) / caja.width) * TRAMOS_CORTE)));
  if (Math.max(x1, x2) < caja.left || Math.min(x1, x2) > caja.right) return;
  const w = lienzoCorte.width / TRAMOS_CORTE;
  for (let i = desde; i <= hasta; i++) {
    if (tramosCortados[i]) continue;
    tramosCortados[i] = true;
    cctx.fillStyle = "rgba(40, 25, 10, 0.85)";
    cctx.fillRect(i * w, lienzoCorte.height * 0.35 + (Math.random() - 0.5) * 2, w + 1, lienzoCorte.height * 0.35);
    cctx.fillStyle = "rgba(255, 250, 235, 0.7)";
    cctx.fillRect(i * w, lienzoCorte.height * 0.7, w + 1, 1);
  }
  const cortado = tramosCortados.filter(Boolean).length / TRAMOS_CORTE;
  if (cortado >= 0.6) abrirSobre();
}

abrecartas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (sobreAbierto) return;
  try {
    abrecartas.setPointerCapture(e.pointerId);
  } catch (error) {}
  agarre = { id: e.pointerId, distancia: 56 };
  abrecartas.style.transition = "transform 0.15s ease-out";
  setTimeout(() => {
    if (agarre) abrecartas.style.transition = "none";
  }, 150);
  moverAbrecartas(e);
});

function moverAbrecartas(e) {
  posAbre = { x: e.clientX, y: e.clientY - agarre.distancia, rot: 90 };
  pintarAbrecartas();
  const punta = { x: posAbre.x, y: posAbre.y };
  const caja = sobre.getBoundingClientRect();
  const enBorde =
    punta.y > caja.top - 90 && punta.y < caja.top + caja.height * 0.6 &&
    punta.x > caja.left - 60 && punta.x < caja.right + 60;
  sobre.classList.toggle("cortando", enBorde && selloRoto);
  if (enBorde && !selloRoto) pista.textContent = "Primero quita el sello de cera";
  if (enBorde && selloRoto && ultimaPunta && ultimaPunta.enBorde) cortarEntre(ultimaPunta.x, punta.x, caja);
  ultimaPunta = { ...punta, enBorde };
}

abrecartas.addEventListener("pointermove", (e) => {
  if (!agarre || agarre.id !== e.pointerId || sobreAbierto) return;
  moverAbrecartas(e);
});

function soltarAbrecartas() {
  if (!agarre) return;
  agarre = null;
  ultimaPunta = null;
  sobre.classList.remove("cortando");
  if (!sobreAbierto) abrecartasEnReposo(true);
}

abrecartas.addEventListener("pointerup", soltarAbrecartas);
abrecartas.addEventListener("pointercancel", soltarAbrecartas);

function prepararCorte() {
  const dpr = window.devicePixelRatio || 1;
  lienzoCorte.width = Math.round(sobre.offsetWidth * dpr);
  lienzoCorte.height = Math.round(6 * dpr);
}

async function abrirSobre() {
  if (sobreAbierto) return;
  sobreAbierto = true;
  agarre = null;
  vibrar();
  inicioHistoria = performance.now();
  empezarCancion();
  if (!esperandoToqueCancion) pista.textContent = "";
  abrecartas.style.transition = "transform 0.9s ease-in, opacity 0.9s";
  posAbre = { x: posAbre.x + 40, y: window.innerHeight + 200, rot: 160 };
  pintarAbrecartas();
  abrecartas.style.opacity = 0;

  sobre.classList.add("abierto");
  await esperar(800);
  sobre.classList.add("fuera");
  await esperar(1300);
  await escenaSobre.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: "forwards" }).finished;
  escenaSobre.style.display = "none";
  historiaIniciada = true;
  ajustar();
  actualizarPista();
  if (esperandoToqueCancion) pista.textContent = "Toca la pantalla para escuchar la canción";
}

let yendoAlPuente = false;

async function irAlPuente() {
  if (yendoAlPuente || enPuente) return;
  yendoAlPuente = true;
  const cambio = await cambiarPagina("puente");
  yendoAlPuente = false;
  if (cambio) mostrarCerillas();
}

setInterval(() => {
  if (!historiaIniciada) return;
  const t = tiempoHistoria();
  if (!enPuente && !ardiendo && t >= INICIO_PUENTE) irAlPuente();
  if (t >= duracionHistoria() - 0.3) terminar();
  actualizarDesgaste();
}, 500);

cancion.addEventListener("ended", () => {
  if (tiempoReal() >= duracionHistoria() - 20) terminar();
});

const cajetilla = document.getElementById("cajetilla");
const raspador = cajetilla.querySelector(".raspador");
const cerilla = document.getElementById("cerilla");
let fosforo = null;

function pintarCerilla() {
  cerilla.style.transform = `translate(${fosforo.x - 4}px, ${fosforo.y - 5}px) rotate(${fosforo.rot}deg)`;
}

function mostrarCerillas() {
  cajetilla.hidden = false;
  cajetilla.animate([{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }], { duration: 500 });
  nuevaCerilla();
}

function nuevaCerilla() {
  if (ardiendo) return;
  const caja = cajetilla.getBoundingClientRect();
  fosforo = { x: caja.left + caja.width * 0.72, y: caja.top - 34, rot: 14, encendida: false, frote: 0, historial: [], arrastre: null, vuelo: false };
  cerilla.hidden = false;
  cerilla.classList.remove("encendida");
  cerilla.style.opacity = "";
  pintarCerilla();
  cerilla.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
}

function encenderCerilla() {
  fosforo.encendida = true;
  cerilla.classList.add("encendida");
  vibrar();
  pista.textContent = "¡Lánzala al puente!";
}

function sobrePuente(x, y) {
  const dibujo = texto.querySelector(".dibujo-puente");
  if (!dibujo) return false;
  const r = dibujo.getBoundingClientRect();
  return x > r.left - 12 && x < r.right + 12 && y > r.top - 12 && y < r.bottom + 12;
}

cerilla.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (!fosforo || fosforo.vuelo || ardiendo) return;
  try {
    cerilla.setPointerCapture(e.pointerId);
  } catch (error) {}
  fosforo.arrastre = { id: e.pointerId, dx: e.clientX - fosforo.x, dy: e.clientY - fosforo.y };
  fosforo.historial = [{ x: fosforo.x, y: fosforo.y, t: e.timeStamp }];
  fosforo.rot = 0;
  pintarCerilla();
});

cerilla.addEventListener("pointermove", (e) => {
  if (!fosforo || !fosforo.arrastre || fosforo.arrastre.id !== e.pointerId) return;
  const antes = { x: fosforo.x, y: fosforo.y };
  fosforo.x = e.clientX - fosforo.arrastre.dx;
  fosforo.y = e.clientY - fosforo.arrastre.dy;
  fosforo.historial.push({ x: fosforo.x, y: fosforo.y, t: e.timeStamp });
  while (fosforo.historial.length > 1 && e.timeStamp - fosforo.historial[0].t > 120) fosforo.historial.shift();
  fosforo.rot = Math.max(-35, Math.min(35, (fosforo.x - antes.x) * 2));
  pintarCerilla();

  if (!fosforo.encendida) {
    const r = raspador.getBoundingClientRect();
    if (fosforo.x > r.left - 8 && fosforo.x < r.right + 8 && fosforo.y > r.top - 10 && fosforo.y < r.bottom + 10) {
      fosforo.frote += Math.hypot(fosforo.x - antes.x, fosforo.y - antes.y);
      if (fosforo.frote > 50) encenderCerilla();
    }
  }
});

function soltarCerilla(e) {
  if (!fosforo || !fosforo.arrastre || fosforo.arrastre.id !== e.pointerId) return;
  fosforo.arrastre = null;
  const h = fosforo.historial;
  const primero = h[0];
  const ultimo = h[h.length - 1];
  const dt = Math.max(16, ultimo.t - primero.t);
  const quieta = e.timeStamp - ultimo.t > 90;
  const vx = quieta ? 0 : (ultimo.x - primero.x) / dt;
  const vy = quieta ? 0 : (ultimo.y - primero.y) / dt;

  if (!fosforo.encendida) {
    pista.textContent = "Raspa la cabeza de la cerilla en la franja oscura de la caja";
    cerilla.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished.then(nuevaCerilla);
  } else if (Math.hypot(vx, vy) > 0.35) {
    lanzarCerilla(vx, vy);
  } else if (sobrePuente(fosforo.x, fosforo.y)) {
    encenderPuente(fosforo.x, fosforo.y);
  } else {
    apagarCerilla();
  }
}

cerilla.addEventListener("pointerup", soltarCerilla);
cerilla.addEventListener("pointercancel", soltarCerilla);

function lanzarCerilla(vx, vy) {
  const tope = 3;
  const v = Math.hypot(vx, vy);
  if (v > tope) {
    vx = (vx / v) * tope;
    vy = (vy / v) * tope;
  }
  fosforo.vuelo = true;
  let anterior = performance.now();
  const inicio = anterior;
  const giro = vx >= 0 ? 1 : -1;

  function volar(ahora) {
    const dt = Math.min(40, ahora - anterior);
    anterior = ahora;
    vy += 0.0012 * dt;
    fosforo.x += vx * dt;
    fosforo.y += vy * dt;
    fosforo.rot += giro * dt * 0.5;
    pintarCerilla();
    if (sobrePuente(fosforo.x, fosforo.y)) {
      encenderPuente(fosforo.x, fosforo.y);
      return;
    }
    const fuera = fosforo.x < -50 || fosforo.x > window.innerWidth + 50 || fosforo.y < -80 || fosforo.y > window.innerHeight + 50;
    if (fuera || ahora - inicio > 1600) {
      apagarCerilla();
      return;
    }
    requestAnimationFrame(volar);
  }
  requestAnimationFrame(volar);
}

function apagarCerilla() {
  fosforo.vuelo = true;
  cerilla.classList.remove("encendida");
  pista.textContent = "Se apagó. Prueba con otra cerilla";
  cerilla.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }).finished.then(() => {
    cerilla.hidden = true;
    setTimeout(nuevaCerilla, 400);
  });
}

let fuego = null;

function encenderPuente(x, y) {
  if (ardiendo) return;
  ardiendo = true;
  soltarTodos();
  cerilla.hidden = true;
  vibrar();
  pista.textContent = "";
  cajetilla.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 600, fill: "forwards" }).finished.then(() => (cajetilla.hidden = true));
  const base = carta.getBoundingClientRect();
  const ahora = performance.now();
  fuego = {
    x: x - base.left,
    y: y - base.top,
    r: fuente * 0.4,
    ultimo: ahora,
    fases: [Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3],
    particulas: [],
    consumido: false,
  };
  requestAnimationFrame(arder);
}

function radioFuego(a, t) {
  return fuego.r * (1 + 0.2 * Math.sin(3 * a + fuego.fases[0] + t * 0.0008) + 0.1 * Math.sin(5 * a + fuego.fases[1] - t * 0.0013) + 0.06 * Math.sin(11 * a + fuego.fases[2] + t * 0.003));
}

function contornoFuego(t, extra) {
  qctx.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r = radioFuego(a, t) + extra;
    const x = fuego.x + Math.cos(a) * r;
    const y = fuego.y + Math.sin(a) * r;
    if (i) qctx.lineTo(x, y);
    else qctx.moveTo(x, y);
  }
  qctx.closePath();
}

function arder(ahora) {
  const dt = Math.min(100, ahora - fuego.ultimo);
  fuego.ultimo = ahora;
  const diagonal = Math.hypot(Math.max(fuego.x, ancho - fuego.x), Math.max(fuego.y, alto - fuego.y));
  const empuje = fuego.r > diagonal ? 2.5 : 1;
  fuego.r += dt * ancho * (0.00005 + 0.00008 * Math.min(1, (fuego.r / diagonal) * 1.5)) * empuje;
  if (fuego.r * 0.64 > diagonal + fuente * 2) fuego.consumido = true;

  qctx.clearRect(0, 0, ancho, alto);
  if (fuego.consumido) {
    qctx.fillStyle = FONDO;
    qctx.fillRect(0, 0, ancho, alto);
  } else {
    contornoFuego(ahora, fuente * 1.8);
    qctx.fillStyle = "rgba(90, 50, 15, 0.28)";
    qctx.fill();
    contornoFuego(ahora, fuente * 0.8);
    qctx.fillStyle = "rgba(45, 22, 8, 0.85)";
    qctx.fill();
    qctx.save();
    qctx.shadowColor = "rgba(255, 130, 30, 0.95)";
    qctx.shadowBlur = fuente * 0.8;
    contornoFuego(ahora, fuente * 0.22);
    qctx.fillStyle = "#ff8c26";
    qctx.fill();
    qctx.restore();
    contornoFuego(ahora, 0);
    qctx.fillStyle = FONDO;
    qctx.fill();

    for (let k = 0; k < 5; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = radioFuego(a, ahora) + fuente * 0.2;
      const px = fuego.x + Math.cos(a) * r;
      const py = fuego.y + Math.sin(a) * r;
      if (px < 0 || px > ancho || py < 0 || py > alto) continue;
      fuego.particulas.push({
        x: px, y: py,
        vx: (Math.random() - 0.5) * 0.03,
        vy: -(0.04 + Math.random() * 0.08),
        vida: 0,
        max: 500 + Math.random() * 700,
        tam: fuente * (0.25 + Math.random() * 0.45),
        ceniza: Math.random() < 0.15,
      });
    }
  }

  fuego.particulas = fuego.particulas.filter((p) => (p.vida += dt) < p.max);
  fuego.particulas.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const resto = 1 - p.vida / p.max;
    if (p.ceniza) {
      qctx.globalCompositeOperation = "source-over";
      qctx.fillStyle = `rgba(150, 140, 130, ${resto * 0.8})`;
      qctx.fillRect(p.x, p.y, p.tam * 0.25, p.tam * 0.25);
    } else {
      qctx.globalCompositeOperation = "lighter";
      const g = qctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.tam * resto);
      g.addColorStop(0, `rgba(255, 230, 140, ${resto})`);
      g.addColorStop(0.5, `rgba(255, 120, 20, ${resto * 0.7})`);
      g.addColorStop(1, "rgba(255, 60, 0, 0)");
      qctx.fillStyle = g;
      qctx.beginPath();
      qctx.arc(p.x, p.y, p.tam * resto, 0, Math.PI * 2);
      qctx.fill();
    }
  });
  qctx.globalCompositeOperation = "source-over";

  if (fuego.consumido && fuego.particulas.length === 0) {
    finQuemado();
    return;
  }
  requestAnimationFrame(arder);
}

let quemaTerminada = false;

async function finQuemado() {
  quemaTerminada = true;
  await carta.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1500, fill: "forwards" }).finished;
  if (cancion.ended) terminar();
}

const fin = document.getElementById("fin");

function terminar() {
  if (!fin.hidden) return;
  fin.hidden = false;
  pista.textContent = "";
  fin.addEventListener("click", () => location.reload(), { once: true });
}

window.addEventListener("resize", () => {
  prepararCorte();
  if (!agarre && !sobreAbierto) abrecartasEnReposo(false);
  if (fosforo && !fosforo.arrastre && !fosforo.vuelo && !fosforo.encendida) nuevaCerilla();
});

cargarPagina(0);
prepararCorte();
abrecartasEnReposo(false);
if (document.fonts) document.fonts.ready.then(() => {
  ajustar();
  abrecartasEnReposo(false);
});
