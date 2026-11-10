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
const PISTA_INICIAL = pista.textContent;
const paginas = [...document.querySelectorAll("#paginas .pagina")].map((s) => s.innerHTML);

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

  if (palabras.length && palabras.every((p) => p.borrada)) siguientePagina();
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

function actualizarPista() {
  if (animando) return;
  const desgaste = Math.min(1, tiempoActivo / TIEMPO_GASTADA);
  carta.style.setProperty("--desgaste", desgaste.toFixed(3));
  const modos = [...dedos.values()].map((d) => d.modo);
  if (presion && presion.avance > 0) {
    const quedan = Math.ceil((TIEMPO_ARRUGAR - (performance.now() - presion.inicio)) / 1000);
    pista.textContent = `Arrugando la hoja… ${quedan}`;
  } else if (modos.includes("rayar")) pista.textContent = "Rayando…";
  else if (modos.includes("borrar")) pista.textContent = "Borrando…";
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

async function siguientePagina() {
  if (animando) return;
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
  cargarPagina((actual + 1) % paginas.length);
  pista.textContent = `Página ${actual + 1}`;
  carta.style.opacity = "";
  await entrar([{ opacity: 0, transform: "translateX(40px) rotate(3deg)" }, { opacity: 1, transform: "none" }]);
}

async function entrar(cuadros) {
  await carta.animate(cuadros, { duration: 550, easing: "ease-out" }).finished;
  animando = false;
  actualizarPista();
}

function cargarPagina(i) {
  actual = i;
  texto.innerHTML = paginas[i];
  envolverPalabras();
  trazos = [];
  tiempoActivo = 0;
  numero.textContent = `— ${i + 1} —`;
  ajustar();
  actualizarPista();
}

carta.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (animando) return;
  try {
    carta.setPointerCapture(e.pointerId);
  } catch (error) {}
  if (dedos.size === 0) medir();
  const p = punto(e);
  dedos.set(e.pointerId, { recorrido: [p], modo: null, trazo: null });
  if (dedos.size === 1) iniciarPresion(e.pointerId, p);
  else cancelarPresion();
});

carta.addEventListener("pointermove", (e) => {
  const dedo = dedos.get(e.pointerId);
  if (!dedo || animando) return;
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

cargarPagina(0);
if (document.fonts) document.fonts.ready.then(ajustar);
