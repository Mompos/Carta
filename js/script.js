const escenario = document.getElementById("escenario");
const carta = document.getElementById("carta");
const texto = document.getElementById("texto");
const lienzo = document.getElementById("tinta");
const ctx = lienzo.getContext("2d");
const pista = document.getElementById("pista");
const botonReiniciar = document.getElementById("reiniciar");

const PROPORCION = 0.72;
const TINTA = "#1d2340";
const VENTANA_GESTO = 450;
const TIEMPO_GASTADA = 60000;
const PISTA_INICIAL = pista.textContent;

let ancho = 0;
let alto = 0;
let fuente = 20;
let palabras = [];
let trazos = [];
let trazoActual = null;
let tocando = false;
let modo = null;
let recorrido = [];
let tiempoActivo = 0;

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
    el, raya: 0, borrado: 0, tachada: false, x: 0, y: 0, w: 0, h: 0,
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
  const c = carta.getBoundingClientRect();
  palabras.forEach((p) => {
    const r = p.el.getBoundingClientRect();
    p.x = r.left - c.left;
    p.y = r.top - c.top;
    p.w = r.width;
    p.h = r.height;
  });
}

function trazarLinea(puntos, grosor) {
  if (puntos.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = TINTA;
  ctx.globalAlpha = 0.92;
  ctx.lineWidth = grosor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(puntos[0][0], puntos[0][1]);
  for (let i = 1; i < puntos.length; i++) ctx.lineTo(puntos[i][0], puntos[i][1]);
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

function redibujar() {
  ctx.clearRect(0, 0, ancho, alto);
  trazos.forEach((t) => {
    if (t.tipo === "linea") {
      trazarLinea(t.puntos.map(([x, y]) => [x * ancho, y * ancho]), t.grosor * ancho);
    } else {
      borrarEn(t.x * ancho, t.y * ancho, t.r * ancho);
    }
  });
}

function nuevaLinea(grosor) {
  const t = { tipo: "linea", puntos: [], grosor: grosor / ancho };
  trazos.push(t);
  return t;
}

function palabrasEn(x, y, holgura) {
  return palabras.filter(
    (p) =>
      !p.el.classList.contains("borrada") &&
      x > p.x - holgura && x < p.x + p.w + holgura &&
      y > p.y - holgura && y < p.y + p.h + holgura
  );
}

function tachar(p) {
  p.tachada = true;
  p.el.classList.add("tachada");
  const t = nuevaLinea(fuente * 0.13);
  const dientes = Math.max(4, Math.round(p.w / (fuente * 0.18)));
  const arriba = p.y + p.h * 0.25;
  const abajo = p.y + p.h * 0.8;
  for (let pasada = 0; pasada < 2; pasada++) {
    for (let i = 0; i <= dientes; i++) {
      const k = pasada ? dientes - i : i;
      const x = p.x + (p.w * k) / dientes + (Math.random() - 0.5) * fuente * 0.08;
      const y = (i + pasada) % 2 ? arriba : abajo;
      t.puntos.push([x / ancho, (y + (Math.random() - 0.5) * fuente * 0.1) / ancho]);
    }
  }
  trazarLinea(t.puntos.map(([x, y]) => [x * ancho, y * ancho]), t.grosor * ancho);
}

function rayar(a, b) {
  if (!trazoActual) {
    trazoActual = nuevaLinea(fuente * 0.09);
    trazoActual.puntos.push([a.x / ancho, a.y / ancho]);
  }
  const jx = (Math.random() - 0.5) * fuente * 0.05;
  const jy = (Math.random() - 0.5) * fuente * 0.05;
  trazoActual.puntos.push([(b.x + jx) / ancho, (b.y + jy) / ancho]);
  trazarLinea([[a.x, a.y], [b.x + jx, b.y + jy]], trazoActual.grosor * ancho);

  const distancia = Math.hypot(b.x - a.x, b.y - a.y);
  palabrasEn(b.x, b.y, fuente * 0.15).forEach((p) => {
    if (p.tachada) return;
    p.raya += distancia / (Math.max(p.w, fuente) * 4);
    if (p.raya >= 1) tachar(p);
  });
}

function borrar(a, b) {
  const r = fuente * 0.9;
  const distancia = Math.hypot(b.x - a.x, b.y - a.y);
  const pasos = Math.max(1, Math.ceil(distancia / (r * 0.35)));
  for (let i = 1; i <= pasos; i++) {
    const x = a.x + ((b.x - a.x) * i) / pasos;
    const y = a.y + ((b.y - a.y) * i) / pasos;
    trazos.push({ tipo: "goma", x: x / ancho, y: y / ancho, r: r / ancho });
    borrarEn(x, y, r);
  }

  palabrasEn(b.x, b.y, r * 0.6).forEach((p) => {
    p.borrado = Math.min(1, p.borrado + distancia / (p.h * 14));
    p.el.style.opacity = 1 - p.borrado;
    p.el.style.filter = `blur(${p.borrado * 2}px)`;
    if (p.borrado >= 1) p.el.classList.add("borrada");
  });
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

function clasificar() {
  let sx = 0;
  let sy = 0;
  for (let i = 1; i < recorrido.length; i++) {
    sx += Math.abs(recorrido[i].x - recorrido[i - 1].x);
    sy += Math.abs(recorrido[i].y - recorrido[i - 1].y);
  }
  const minimo = fuente * 0.3;
  const gx = giros(recorrido.map((p) => p.x), minimo);
  const gy = giros(recorrido.map((p) => p.y), minimo);
  const umbral = fuente * 2;

  if (gx >= 2 && sx > umbral && sx > sy * 1.5) return "rayar";
  if (gy >= 2 && sy > umbral && sy > sx * 1.5) return "borrar";
  if (modo === "rayar" && gx === 0 && sx + sy > fuente * 4) return null;
  if (modo === "borrar" && gy === 0 && sx + sy > fuente * 4) return null;
  return modo;
}

function aplicar(a, b) {
  tiempoActivo += Math.min(100, b.t - a.t);
  if (modo === "rayar") rayar(a, b);
  else if (modo === "borrar") borrar(a, b);
}

function actualizarPista() {
  const desgaste = Math.min(1, tiempoActivo / TIEMPO_GASTADA);
  carta.style.setProperty("--desgaste", desgaste.toFixed(3));
  if (modo === "rayar") pista.textContent = "Rayando…";
  else if (modo === "borrar") pista.textContent = "Borrando…";
  else if (desgaste >= 1) pista.textContent = "La carta ya está gastada.";
  else pista.textContent = PISTA_INICIAL;
}

function punto(e) {
  const c = carta.getBoundingClientRect();
  return { x: e.clientX - c.left, y: e.clientY - c.top, t: e.timeStamp || performance.now() };
}

function procesar(p) {
  const anterior = recorrido[recorrido.length - 1];
  recorrido.push(p);
  while (recorrido.length > 2 && p.t - recorrido[0].t > VENTANA_GESTO) recorrido.shift();

  const nuevo = clasificar();
  if (nuevo !== modo) {
    modo = nuevo;
    trazoActual = null;
    if (modo) {
      for (let i = 1; i < recorrido.length; i++) aplicar(recorrido[i - 1], recorrido[i]);
    }
  } else if (modo && anterior) {
    aplicar(anterior, p);
  }
}

carta.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  carta.setPointerCapture(e.pointerId);
  medir();
  tocando = true;
  modo = null;
  trazoActual = null;
  recorrido = [punto(e)];
});

carta.addEventListener("pointermove", (e) => {
  if (!tocando) return;
  const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  (eventos.length ? eventos : [e]).forEach((ev) => procesar(punto(ev)));
  actualizarPista();
});

function soltar() {
  tocando = false;
  modo = null;
  trazoActual = null;
  recorrido = [];
  actualizarPista();
}

carta.addEventListener("pointerup", soltar);
carta.addEventListener("pointercancel", soltar);

botonReiniciar.addEventListener("click", () => {
  trazos = [];
  tiempoActivo = 0;
  palabras.forEach((p) => {
    p.raya = 0;
    p.borrado = 0;
    p.tachada = false;
    p.el.classList.remove("tachada", "borrada");
    p.el.style.opacity = "";
    p.el.style.filter = "";
  });
  redibujar();
  actualizarPista();
});

document.addEventListener("gesturestart", (e) => e.preventDefault());

let pendiente = false;
function alCambiarTamano() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    ajustar();
  });
}

new ResizeObserver(alCambiarTamano).observe(escenario);

envolverPalabras();
ajustar();
if (document.fonts) document.fonts.ready.then(ajustar);
