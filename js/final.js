const TIEMPO_REINICIO = 2000;
const DURACION_FIN = 7000;
const DURACION_QUEMA_FIN = 3200;
const LIMPIEZA_NECESARIA = 0.85;
const CELDA = 12;

const despedida = document.getElementById("despedida");
const lluvia = document.getElementById("lluvia");
const papel = document.getElementById("papel");
const ceniza = document.getElementById("ceniza");
const cenizaCtx = ceniza.getContext("2d");
const FRAGMENTOS = [...document.querySelectorAll("#paginas .lagrimas p")].map((p) => p.textContent.trim()).filter(Boolean);

let lagrimaActual = null;
let frote = null;
let reinicio = null;

function azar(a, b) {
  return a + Math.random() * (b - a);
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
  prepararCeniza();
  estadoFinal = "lagrimas";
  soltarLagrima(0);
}

function zonaLluvia() {
  const arriba = document.querySelector("header").getBoundingClientRect().bottom + 10;
  const abajo = document.querySelector("footer").getBoundingClientRect().top - 6;
  return { izq: 14, der: window.innerWidth - 14, arriba, abajo };
}

function escalaGotas() {
  return Math.min(1.35, Math.max(0.8, Math.min(window.innerWidth, window.innerHeight * 0.62) / 375));
}

// ---------- Lágrimas ----------

function partirEnLineas(c, texto, maximo) {
  const lineas = [];
  let linea = "";
  texto.split(" ").forEach((palabra) => {
    const prueba = linea ? linea + " " + palabra : palabra;
    if (linea && c.measureText(prueba).width > maximo) {
      lineas.push(linea);
      linea = palabra;
    } else linea = prueba;
  });
  if (linea) lineas.push(linea);
  return lineas;
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
  const camino = new Path2D();
  const medio = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const inicio = medio(pts[n - 1], pts[0]);
  camino.moveTo(inicio[0], inicio[1]);
  for (let i = 0; i < n; i++) {
    const m = medio(pts[i], pts[(i + 1) % n]);
    camino.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  camino.closePath();
  return camino;
}

function dibujarMancha(c, radio) {
  const puntas = Array.from({ length: Math.round(azar(6, 11)) }, () => ({ a: Math.random() * Math.PI * 2, largo: radio * azar(0.2, 0.85) }));
  const agua = "rgba(160, 190, 230, 0.34)";
  const borde = "rgba(210, 228, 250, 0.55)";

  puntas.forEach(({ a, largo }) => {
    const ancho_ = radio * azar(0.05, 0.12);
    const x1 = Math.cos(a) * radio * 0.98;
    const y1 = Math.sin(a) * radio * 0.98;
    const px = -Math.sin(a) * ancho_;
    const py = Math.cos(a) * ancho_;
    c.fillStyle = agua;
    c.beginPath();
    c.moveTo(x1 + px, y1 + py);
    c.lineTo(Math.cos(a) * (radio + largo), Math.sin(a) * (radio + largo));
    c.lineTo(x1 - px, y1 - py);
    c.fill();
  });

  const degradado = c.createRadialGradient(-radio * 0.2, -radio * 0.25, 0, 0, 0, radio * 1.08);
  degradado.addColorStop(0, "rgba(80, 110, 150, 0.12)");
  degradado.addColorStop(0.78, "rgba(95, 128, 170, 0.2)");
  degradado.addColorStop(0.93, "rgba(165, 195, 232, 0.4)");
  degradado.addColorStop(1, "rgba(210, 228, 250, 0.5)");
  const mancha = contornoIrregular(radio, puntas);
  c.fillStyle = degradado;
  c.fill(mancha);
  c.strokeStyle = borde;
  c.lineWidth = 1.2;
  c.stroke(mancha);

  c.save();
  c.rotate(-0.5);
  c.fillStyle = "rgba(255, 255, 255, 0.2)";
  c.beginPath();
  c.ellipse(-radio * 0.4, -radio * 0.2, radio * 0.28, radio * 0.16, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  return puntas;
}

function crearLagrima(texto, radio) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const tamano = Math.min(30, Math.max(22, window.innerWidth * 0.062));
  const medidor = document.createElement("canvas").getContext("2d");
  medidor.font = `${tamano}px Caveat, "Segoe Script", "Bradley Hand", cursive`;
  const lineas = partirEnLineas(medidor, texto, Math.min(window.innerWidth * 0.72, 400));
  const anchoTexto = Math.max(...lineas.map((l) => medidor.measureText(l).width));
  const altoLinea = tamano * 1.15;
  const altoTexto = lineas.length * altoLinea;
  const alcance = radio * 2.5;
  const ancho_ = Math.ceil(Math.max(alcance * 2, anchoTexto + 30));
  const alto_ = Math.ceil(Math.max(alcance * 2, altoTexto + 30));

  const lienzo_ = document.createElement("canvas");
  lienzo_.className = "lienzo-lagrima";
  lienzo_.width = ancho_ * dpr;
  lienzo_.height = alto_ * dpr;
  lienzo_.style.width = ancho_ + "px";
  lienzo_.style.height = alto_ + "px";
  const c = lienzo_.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, ancho_ / 2 * dpr, alto_ / 2 * dpr);
  const puntas = dibujarMancha(c, radio);

  c.font = medidor.font;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = "#efe6d3";
  c.shadowColor = "rgba(20, 30, 45, 0.95)";
  c.shadowBlur = 10;
  lineas.forEach((l, i) => {
    const y = (i - (lineas.length - 1) / 2) * altoLinea;
    c.fillText(l, 0, y);
    c.fillText(l, 0, y);
  });

  const columnas = Math.ceil(ancho_ / CELDA);
  const filas = Math.ceil(alto_ / CELDA);
  const celdas = new Uint8Array(columnas * filas);
  let tinta = 0;
  for (let f = 0; f < filas; f++) {
    for (let k = 0; k < columnas; k++) {
      const x = (k + 0.5) * CELDA - ancho_ / 2;
      const y = (f + 0.5) * CELDA - alto_ / 2;
      const enMancha = Math.hypot(x, y) < radio * 1.05;
      const enTexto = Math.abs(x) < anchoTexto / 2 + 4 && Math.abs(y) < altoTexto / 2 + 2;
      if (enMancha || enTexto) {
        celdas[f * columnas + k] = 1;
        tinta++;
      }
    }
  }
  return { lienzo: lienzo_, c, puntas, ancho: ancho_, alto: alto_, celdas, columnas, filas, tinta, borradas: 0, caja: { w: anchoTexto + 16, h: altoTexto + 10 } };
}

function soltarLagrima(n) {
  if (estadoFinal !== "lagrimas") return;
  if (n >= FRAGMENTOS.length) {
    setTimeout(mostrarPapel, 900);
    return;
  }
  const radio = azar(40, 62) * escalaGotas();
  const l = crearLagrima(FRAGMENTOS[n], radio);
  const zona = zonaLluvia();
  const medioAncho = Math.max(radio * 2.2, l.caja.w / 2);
  const medioAlto = Math.max(radio * 2.2, l.caja.h / 2);
  const cx = azar(zona.izq + medioAncho, Math.max(zona.izq + medioAncho, zona.der - medioAncho));
  const cy = azar(zona.arriba + medioAlto, Math.max(zona.arriba + medioAlto, zona.abajo - medioAlto));
  Object.assign(l, { n, cx, cy, radio, izq: cx - l.ancho / 2, arriba: cy - l.alto / 2 });
  l.lienzo.style.left = l.izq + "px";
  l.lienzo.style.top = l.arriba + "px";

  caerGota(l);
}

// ---------- Caída y salpicadura ----------

const efectos = document.createElement("canvas");
efectos.className = "efectos-gota";
const efx = efectos.getContext("2d");
const animaciones = [];
let pintando = false;

function prepararEfectos() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (efectos.width !== Math.round(w * dpr) || efectos.height !== Math.round(h * dpr)) {
    efectos.width = Math.round(w * dpr);
    efectos.height = Math.round(h * dpr);
    efectos.style.width = w + "px";
    efectos.style.height = h + "px";
  }
  efx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!efectos.isConnected) lluvia.appendChild(efectos);
}

function animarEfecto(paso) {
  animaciones.push({ paso, inicio: performance.now() });
  if (pintando) return;
  pintando = true;
  requestAnimationFrame(function cuadro(ahora) {
    efx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = animaciones.length - 1; i >= 0; i--) {
      const a = animaciones[i];
      if (estadoFinal !== "lagrimas" || a.paso(ahora - a.inicio) === false) animaciones.splice(i, 1);
    }
    if (animaciones.length) requestAnimationFrame(cuadro);
    else {
      efx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pintando = false;
    }
  });
}

function esferaAgua(x, y, rx, ry, giro, alfa) {
  efx.save();
  efx.translate(x, y);
  efx.rotate(giro);
  efx.globalAlpha = alfa;
  const cuerpo = efx.createRadialGradient(-rx * 0.3, -ry * 0.35, 0, 0, 0, Math.max(rx, ry));
  cuerpo.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  cuerpo.addColorStop(0.18, "rgba(220, 235, 250, 0.7)");
  cuerpo.addColorStop(0.6, "rgba(140, 175, 215, 0.38)");
  cuerpo.addColorStop(0.88, "rgba(70, 100, 140, 0.45)");
  cuerpo.addColorStop(1, "rgba(200, 225, 250, 0.6)");
  efx.fillStyle = cuerpo;
  efx.beginPath();
  efx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  efx.fill();
  efx.fillStyle = "rgba(255, 255, 255, 0.5)";
  efx.beginPath();
  efx.ellipse(rx * 0.35, ry * 0.42, rx * 0.22, ry * 0.12, -0.6, 0, Math.PI * 2);
  efx.fill();
  efx.restore();
}

function sombraGota(x, y, r, alfa) {
  const s = efx.createRadialGradient(x, y, 0, x, y, r);
  s.addColorStop(0, `rgba(8, 5, 3, ${alfa})`);
  s.addColorStop(1, "rgba(8, 5, 3, 0)");
  efx.fillStyle = s;
  efx.beginPath();
  efx.arc(x, y, r, 0, Math.PI * 2);
  efx.fill();
}

function caerGota(l) {
  prepararEfectos();
  const { cx, cy, radio } = l;
  const lado = Math.max(8, radio * 0.3);
  const x0 = cx + (cx - window.innerWidth / 2) * 0.35 + azar(-20, 20);
  const y0 = cy + (cy - window.innerHeight / 2) * 0.35 + azar(-20, 20);
  const duracion = azar(700, 900);
  const fase = Math.random() * 6;
  animarEfecto((t) => {
    const f = Math.min(1, t / duracion);
    const e = f * f;
    const altura = 1 - e;
    const x = x0 + (cx - x0) * e;
    const y = y0 + (cy - y0) * e;
    sombraGota(cx + altura * radio * 0.9, cy + altura * radio * 1.1, lado * (1.1 + altura * 2.4), 0.08 + 0.32 * (1 - altura));
    const r = lado * (1 + altura * 3);
    const temblor = Math.sin(t * 0.045 + fase) * 0.1 * (0.4 + altura);
    esferaAgua(x, y, r * (1 + temblor), r * (1 - temblor), fase, Math.min(1, 0.25 + f * 1.6) * (0.55 + 0.45 * (1 - altura)));
    if (f >= 1) {
      salpicar(l);
      return false;
    }
  });
}

function manchita(l, x, y, r, a, largo) {
  const c = l.c;
  const ancho_ = r + largo * 0.25;
  c.save();
  c.globalCompositeOperation = "destination-over";
  c.translate(x, y);
  c.rotate(a);
  c.fillStyle = "rgba(160, 190, 230, 0.4)";
  c.beginPath();
  c.ellipse(-largo * 0.3, 0, ancho_, r * azar(0.75, 0.95), 0, 0, Math.PI * 2);
  c.fill();
  if (largo > r * 0.8) {
    c.beginPath();
    c.ellipse(-largo, 0, r * 0.45, r * 0.3, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = "source-over";
  c.strokeStyle = "rgba(210, 228, 250, 0.5)";
  c.lineWidth = 0.8;
  c.beginPath();
  c.ellipse(-largo * 0.3, 0, ancho_, r * 0.85, 0, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = "rgba(255, 255, 255, 0.3)";
  c.beginPath();
  c.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function lanzarGotitas(l) {
  const { cx, cy, radio } = l;
  const limite = Math.min(l.ancho, l.alto) / 2 - radio * 0.15;
  const gotitas = [];
  l.puntas.forEach(({ a, largo }) => {
    if (Math.random() < 0.85) gotitas.push({ a: a + azar(-0.05, 0.05), d: radio + largo + radio * azar(0.08, 0.2), r: radio * azar(0.05, 0.11), dur: azar(240, 380) });
  });
  for (let i = 0, n = Math.round(azar(7, 13)); i < n; i++) {
    gotitas.push({ a: Math.random() * Math.PI * 2, d: radio * azar(1.35, 2.4), r: radio * azar(0.025, 0.08), dur: azar(320, 560) });
  }
  gotitas.forEach((g) => {
    g.d = Math.min(g.d, limite - g.r * 2);
    g.alto = azar(0.5, 1.1);
    g.retraso = azar(0, 60);
  });
  let posadas = 0;
  animarEfecto((t) => {
    let vivas = 0;
    gotitas.forEach((g) => {
      const f = (t - g.retraso) / g.dur;
      if (f < 0) {
        vivas++;
        return;
      }
      const cos = Math.cos(g.a);
      const sin = Math.sin(g.a);
      if (f < 1) {
        vivas++;
        const avance = 1 - Math.pow(1 - f, 2.2);
        const d = radio * 0.55 + (g.d - radio * 0.55) * avance;
        const h = Math.sin(Math.PI * f) * g.alto;
        const x = cx + cos * d;
        const y = cy + sin * d;
        sombraGota(x + h * g.r * 3, y + h * g.r * 3.6, g.r * (1.4 + h), 0.25 * (1 - h * 0.6));
        const estirada = 1 + (1 - f) * 0.9;
        esferaAgua(x, y, g.r * (1 + h * 0.8) * estirada, (g.r * (1 + h * 0.8)) / Math.sqrt(estirada), g.a, 0.9);
      } else if (!g.posada) {
        g.posada = true;
        posadas++;
        manchita(l, cx - l.izq - l.ancho / 2 + cos * g.d, cy - l.arriba - l.alto / 2 + sin * g.d, g.r, g.a, g.r * azar(0.6, 1.8));
        g.onda = t;
      }
      if (g.posada && t - g.onda < 260) {
        vivas++;
        const o = (t - g.onda) / 260;
        efx.strokeStyle = `rgba(215, 232, 252, ${0.6 * (1 - o)})`;
        efx.lineWidth = 0.8;
        efx.beginPath();
        efx.arc(cx + cos * g.d, cy + sin * g.d, g.r * (1 + o * 2.2), 0, Math.PI * 2);
        efx.stroke();
      }
    });
    if (posadas >= 3 && !lanzarGotitas.sono) {
      lanzarGotitas.sono = true;
      sonido.gota(false);
    }
    if (vivas === 0) lanzarGotitas.sono = false;
    return vivas > 0;
  });
}

function coronaYRebote(l) {
  const { cx, cy, radio } = l;
  const dientes = Array.from({ length: 22 }, (_, i) => ({ a: (i / 22) * Math.PI * 2 + azar(-0.1, 0.1), largo: azar(0.6, 1.4) }));
  animarEfecto((t) => {
    if (t < 280) {
      const f = t / 280;
      const r = radio * (0.45 + 0.8 * (1 - Math.pow(1 - f, 2)));
      efx.save();
      efx.globalAlpha = 1 - f;
      efx.strokeStyle = "rgba(230, 242, 255, 0.8)";
      efx.lineWidth = radio * 0.08 * (1 - f) + 0.6;
      efx.beginPath();
      efx.arc(cx, cy, r, 0, Math.PI * 2);
      efx.stroke();
      efx.fillStyle = "rgba(235, 245, 255, 0.85)";
      dientes.forEach(({ a, largo }) => {
        const sube = Math.sin(Math.PI * f) * radio * 0.18 * largo;
        efx.beginPath();
        efx.arc(cx + Math.cos(a) * (r + sube), cy + Math.sin(a) * (r + sube), radio * 0.035 * largo * (1 - f * 0.5) + 0.5, 0, Math.PI * 2);
        efx.fill();
      });
      efx.restore();
    }
    if (t > 90 && t < 640) {
      const f = (t - 90) / 550;
      const h = Math.sin(Math.PI * f);
      const r = radio * 0.09 * (1 + h * 1.3);
      sombraGota(cx + h * radio * 0.35, cy + h * radio * 0.42, r * 1.6, 0.2);
      esferaAgua(cx, cy, r, r, 0, 0.85);
    }
    [0, 200].forEach((retraso) => {
      const o = (t - retraso) / 1100;
      if (o < 0 || o > 1) return;
      efx.strokeStyle = `rgba(210, 228, 250, ${0.7 * (1 - o)})`;
      efx.lineWidth = 1.4 * (1 - o) + 0.4;
      efx.beginPath();
      efx.arc(cx, cy, radio * (0.6 + 1.9 * (1 - Math.pow(1 - o, 2))), 0, Math.PI * 2);
      efx.stroke();
    });
    return t < 1300;
  });
}

function salpicar(l) {
  sonido.lado(l.cx);
  sonido.gota(true);
  vibrar();
  lluvia.insertBefore(l.lienzo, efectos);
  l.lienzo.animate(
    [
      { transform: "scale(0.25)", opacity: 0.4 },
      { transform: "scale(1.07)", opacity: 1, offset: 0.55 },
      { transform: "scale(0.98)", offset: 0.8 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 460, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)" }
  );
  coronaYRebote(l);
  lanzarGotitas(l);
  lagrimaActual = l;
}

function borrarLagrima(x, y) {
  const l = lagrimaActual;
  const pincel = Math.max(22, l.radio * 0.5);
  const lx = x - l.izq;
  const ly = y - l.arriba;
  if (lx < -pincel || ly < -pincel || lx > l.ancho + pincel || ly > l.alto + pincel) return false;
  const c = l.c;
  c.save();
  c.globalCompositeOperation = "destination-out";
  const goma = c.createRadialGradient(lx - l.ancho / 2, ly - l.alto / 2, 0, lx - l.ancho / 2, ly - l.alto / 2, pincel);
  goma.addColorStop(0, "rgba(0,0,0,0.6)");
  goma.addColorStop(0.6, "rgba(0,0,0,0.35)");
  goma.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = goma;
  c.beginPath();
  c.arc(lx - l.ancho / 2, ly - l.alto / 2, pincel, 0, Math.PI * 2);
  c.fill();
  c.restore();

  const alcance = pincel * 0.75;
  const k0 = Math.max(0, Math.floor((lx - alcance) / CELDA));
  const k1 = Math.min(l.columnas - 1, Math.floor((lx + alcance) / CELDA));
  const f0 = Math.max(0, Math.floor((ly - alcance) / CELDA));
  const f1 = Math.min(l.filas - 1, Math.floor((ly + alcance) / CELDA));
  for (let f = f0; f <= f1; f++) {
    for (let k = k0; k <= k1; k++) {
      const i = f * l.columnas + k;
      if (!l.celdas[i] || l.celdas[i] >= 3) continue;
      if (Math.hypot((k + 0.5) * CELDA - lx, (f + 0.5) * CELDA - ly) > alcance) continue;
      l.celdas[i]++;
      if (l.celdas[i] === 3) l.borradas++;
    }
  }
  return true;
}

function frotarLagrima(e) {
  if (!frote || frote.id !== e.pointerId || !lagrimaActual || lagrimaActual.saliendo) return;
  const l = lagrimaActual;
  const pincel = Math.max(22, l.radio * 0.5);
  const dx = e.clientX - frote.x;
  const dy = e.clientY - frote.y;
  const distancia = Math.hypot(dx, dy);
  const pasos = Math.max(1, Math.ceil(distancia / (pincel * 0.35)));
  let toco = false;
  for (let i = 1; i <= pasos; i++) toco = borrarLagrima(frote.x + (dx * i) / pasos, frote.y + (dy * i) / pasos) || toco;
  frote.x = e.clientX;
  frote.y = e.clientY;
  if (!toco) return;
  sonido.goma(Math.min(1, 0.2 + distancia / 30));
  if (l.borradas / l.tinta >= LIMPIEZA_NECESARIA) terminarLimpieza();
}

function terminarLimpieza() {
  const l = lagrimaActual;
  l.saliendo = true;
  lagrimaActual = null;
  aprender("lagrima");
  pista.textContent = "";
  vibrar();
  l.lienzo.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: "forwards" }).finished.then(() => l.lienzo.remove());
  setTimeout(() => soltarLagrima(l.n + 1), 800);
}

despedida.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (estadoFinal === "lagrimas") {
    frote = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try {
      despedida.setPointerCapture(e.pointerId);
    } catch (error) {}
    frotarLagrima(e);
  } else if (estadoFinal === "ceniza" && !reinicio) {
    reinicio = { id: e.pointerId, x: e.clientX, y: e.clientY, reloj: setTimeout(() => location.reload(), TIEMPO_REINICIO) };
    pista.textContent = "…";
  }
});
despedida.addEventListener("pointermove", (e) => {
  frotarLagrima(e);
  if (reinicio && reinicio.id === e.pointerId && Math.hypot(e.clientX - reinicio.x, e.clientY - reinicio.y) > 30) soltarReinicio();
});
["pointerup", "pointercancel"].forEach((tipo) =>
  despedida.addEventListener(tipo, (e) => {
    if (frote && frote.id === e.pointerId) frote = null;
    soltarReinicio();
  })
);
despedida.addEventListener("touchstart", (e) => {
  if (estadoFinal) e.preventDefault();
}, { passive: false });
despedida.addEventListener("contextmenu", (e) => e.preventDefault());

function soltarReinicio() {
  if (!reinicio) return;
  clearTimeout(reinicio.reloj);
  reinicio = null;
  if (estadoFinal === "ceniza") pista.textContent = "Mantén el dedo para volver a empezar";
}

// ---------- La carta que dice Fin ----------

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

function escribirEn(el, frase) {
  el.textContent = "";
  el.setAttribute("aria-label", frase);
  return [...frase].map((c) => {
    const l = document.createElement("span");
    l.className = "letra";
    l.textContent = c;
    el.appendChild(l);
    return l;
  });
}

function ajustarPapel() {
  if (papel.hidden) return;
  papel.style.setProperty("--fuente-papel", Math.min(27, Math.max(20, window.innerWidth * 0.066)) + "px");
}

async function mostrarPapel() {
  estadoFinal = "papel";
  pista.textContent = "";
  lluvia.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1500, fill: "forwards" });

  const quemado_ = registro.quemada;
  papel.classList.toggle("quemado", quemado_);
  papel.querySelector(".papel-borde").style.clipPath = bordeRoto(quemado_ ? 3.5 : 0.6);
  papel.querySelector(".papel-hoja").style.clipPath = bordeRoto(quemado_ ? 4 : 0.6);
  const letras = escribirEn(papel.querySelector(".final-frase"), "Fin");

  papel.hidden = false;
  ajustarPapel();
  sonido.pagina();
  const aparece = performance.now();
  papel.animate([{ opacity: 0, transform: "translateY(26px) rotate(-2deg)" }, { opacity: 1, transform: "none" }], { duration: 1600, easing: "ease-out", fill: "both" });
  await esperar(1400);
  letras.forEach((l, i) => l.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: 700, delay: i * 380, fill: "both" }));
  await esperar(Math.max(0, DURACION_FIN - (performance.now() - aparece)));
  quemarPapel();
}

// ---------- El papel se quema y deja ceniza ----------

function prepararCeniza() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  ceniza.width = Math.round(window.innerWidth * dpr);
  ceniza.height = Math.round(window.innerHeight * dpr);
  cenizaCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function quemarPapel() {
  estadoFinal = "quemandoFin";
  const caja = papel.getBoundingClientRect();
  const ox = azar(caja.width * 0.2, caja.width * 0.8);
  const oy = caja.height * azar(0.85, 1);
  const maximo = Math.hypot(Math.max(ox, caja.width - ox), Math.max(oy, caja.height - oy)) + 30;
  const chispas = [];
  const fase = Math.random() * 6.3;
  const inicio = performance.now();
  let anterior = inicio;
  vibrar();
  sonido.encender();
  sonido.apagarMusica(DURACION_QUEMA_FIN / 1000 + 3);

  function cuadro(ahora) {
    const dt = Math.min(50, ahora - anterior);
    anterior = ahora;
    const t = Math.min(1, (ahora - inicio) / DURACION_QUEMA_FIN);
    const r = maximo * (t * t * 0.55 + t * 0.45);
    const mascara = `radial-gradient(circle at ${ox}px ${oy}px, transparent ${r + 6}px, #000 ${r + 20}px)`;
    papel.style.webkitMaskImage = mascara;
    papel.style.maskImage = mascara;
    sonido.fuego(1 - t * 0.5, 0.4);

    cenizaCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    cenizaCtx.save();
    cenizaCtx.beginPath();
    cenizaCtx.rect(caja.left, caja.top, caja.width, caja.height);
    cenizaCtx.clip();
    const borde = (desfase) => {
      cenizaCtx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const rr = r + desfase + Math.sin(a * 5 + fase) * 7 + Math.sin(a * 11 - ahora * 0.004) * 4 + Math.sin(a * 23 + ahora * 0.009) * 2;
        const x = caja.left + ox + Math.cos(a) * rr;
        const y = caja.top + oy + Math.sin(a) * rr;
        if (i) cenizaCtx.lineTo(x, y);
        else cenizaCtx.moveTo(x, y);
      }
    };
    borde(20);
    cenizaCtx.strokeStyle = "rgba(35, 16, 6, 0.85)";
    cenizaCtx.lineWidth = 26;
    cenizaCtx.stroke();
    cenizaCtx.globalCompositeOperation = "lighter";
    [[11, 14, "rgba(255, 110, 30, 0.5)"], [11, 3, "rgba(255, 220, 140, 0.95)"]].forEach(([desfase, grosor, color]) => {
      borde(desfase);
      cenizaCtx.strokeStyle = color;
      cenizaCtx.lineWidth = grosor;
      cenizaCtx.stroke();
    });
    cenizaCtx.restore();

    if (t < 1) {
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const x = caja.left + ox + Math.cos(a) * (r + 10);
        const y = caja.top + oy + Math.sin(a) * (r + 10);
        if (x > caja.left && x < caja.right && y > caja.top && y < caja.bottom) chispas.push({ x, y, vy: -azar(0.03, 0.09), vx: azar(-0.02, 0.02), vida: 0, max: azar(500, 1100) });
      }
    }
    cenizaCtx.globalCompositeOperation = "lighter";
    for (let i = chispas.length - 1; i >= 0; i--) {
      const p = chispas[i];
      p.vida += dt;
      if (p.vida > p.max) {
        chispas.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      cenizaCtx.fillStyle = `rgba(255, ${Math.round(150 + 80 * (1 - p.vida / p.max))}, 60, ${(1 - p.vida / p.max).toFixed(2)})`;
      cenizaCtx.fillRect(p.x, p.y, 2, 2);
    }
    cenizaCtx.globalCompositeOperation = "source-over";

    if (t < 1 || chispas.length) requestAnimationFrame(cuadro);
    else dejarCeniza(caja);
  }
  requestAnimationFrame(cuadro);
}

function dejarCeniza(caja) {
  papel.hidden = true;
  sonido.apagarFuego();
  cenizaCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const zona = zonaLluvia();
  const base = caja.top + caja.height * 0.8;
  const forma = (n) => Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2 + azar(-0.4, 0.4);
    return [Math.cos(a) * azar(0.45, 1), Math.sin(a) * azar(0.45, 1)];
  });
  const copos = [];
  const agregar = (cantidad, destino, tamano, color) => {
    for (let i = 0; i < cantidad; i++) {
      const [tx, ty] = destino();
      copos.push({
        x0: caja.left + caja.width * azar(0.15, 0.85),
        y0: caja.top + caja.height * azar(0.3, 0.9),
        tx,
        ty,
        lado: tamano(),
        giro: azar(-3, 3),
        color: color(),
        retraso: azar(0, 0.35),
        aplastado: azar(0.45, 0.75),
        forma: forma(6),
        brasa: Math.random() < 0.06,
      });
    }
  };
  const gris = () => {
    const g = Math.round(azar(70, 165));
    return `rgba(${g}, ${g - 6}, ${g - 12}, ${azar(0.4, 0.9).toFixed(2)})`;
  };
  agregar(10, () => [caja.left + caja.width * azar(0.2, 0.8), base + azar(-0.1, 0.05) * caja.height], () => azar(9, 20), () => "rgba(28, 20, 15, 0.9)");
  agregar(160, () => [caja.left + caja.width * (0.5 + (Math.random() + Math.random() - 1) * 0.36), base - Math.abs(Math.random() + Math.random() - 1) * caja.height * 0.14 + azar(0, 8)], () => azar(1.5, 5), gris);
  const grisClaro = () => {
    const g = Math.round(azar(125, 205));
    return `rgba(${g}, ${g - 5}, ${g - 10}, ${azar(0.55, 0.95).toFixed(2)})`;
  };
  agregar(460, () => {
    const cerca = Math.random() < 0.55;
    const x = cerca ? caja.left + caja.width / 2 + (Math.random() + Math.random() - 1) * window.innerWidth * 0.5 : azar(zona.izq, zona.der);
    const y = cerca ? base + (Math.random() + Math.random() - 1) * (zona.abajo - zona.arriba) * 0.35 : azar(zona.arriba, zona.abajo);
    return [Math.min(zona.der, Math.max(zona.izq, x)), Math.min(zona.abajo, Math.max(zona.arriba, y))];
  }, () => azar(1.6, 4.6), grisClaro);

  const dibujarCopo = (c, x, y, angulo, apagado) => {
    cenizaCtx.save();
    cenizaCtx.translate(x, y);
    cenizaCtx.rotate(angulo);
    cenizaCtx.fillStyle = c.color;
    cenizaCtx.beginPath();
    c.forma.forEach(([fx, fy], k) => (k ? cenizaCtx.lineTo(fx * c.lado, fy * c.lado * c.aplastado) : cenizaCtx.moveTo(fx * c.lado, fy * c.lado * c.aplastado)));
    cenizaCtx.closePath();
    cenizaCtx.fill();
    if (c.brasa && apagado < 1) {
      cenizaCtx.fillStyle = `rgba(255, 120, 40, ${((1 - apagado) * azar(0.5, 0.95)).toFixed(2)})`;
      cenizaCtx.fillRect(-1, -1, 2, 2);
    }
    cenizaCtx.restore();
  };

  const inicio = performance.now();
  const VUELO = 2600;
  (function soplar(ahora) {
    const t = (ahora - inicio) / VUELO;
    cenizaCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    copos.forEach((c) => {
      const f = Math.min(1, Math.max(0, (t - c.retraso) / (1 - c.retraso)));
      const e = 1 - Math.pow(1 - f, 3);
      const x = c.x0 + (c.tx - c.x0) * e + Math.sin(f * Math.PI) * 18 * Math.sin(c.giro * 3);
      const y = c.y0 + (c.ty - c.y0) * e - Math.sin(f * Math.PI) * 40;
      dibujarCopo(c, x, y, c.giro * e, Math.min(1, (ahora - inicio) / 6000));
    });
    if (ahora - inicio < 6000) requestAnimationFrame(soplar);
  })(inicio);
  estadoFinal = "ceniza";
  clearInterval(reloj);
  setTimeout(() => {
    if (estadoFinal === "ceniza" && !reinicio) pista.textContent = "Mantén el dedo para volver a empezar";
  }, 2500);
}

window.addEventListener("resize", ajustarPapel);
