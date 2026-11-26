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
    if (Math.random() < 0.75) {
      const rr = radio * azar(0.05, 0.11);
      const d = radio + largo + rr * 1.4;
      c.beginPath();
      c.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = borde;
      c.lineWidth = 0.8;
      c.stroke();
    }
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

  for (let i = 0, n = Math.round(azar(4, 9)); i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = radio * azar(1.5, 2.3);
    c.beginPath();
    c.arc(Math.cos(a) * d, Math.sin(a) * d, radio * azar(0.04, 0.1), 0, Math.PI * 2);
    c.fillStyle = "rgba(170, 200, 238, 0.5)";
    c.fill();
  }
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
  dibujarMancha(c, radio);

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
  return { lienzo: lienzo_, c, ancho: ancho_, alto: alto_, celdas, columnas, filas, tinta, borradas: 0, caja: { w: anchoTexto + 16, h: altoTexto + 10 } };
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

  const gota = document.createElement("i");
  gota.className = "lagrima";
  const lado = Math.max(14, radio * 0.55);
  gota.style.width = gota.style.height = lado + "px";
  lluvia.appendChild(gota);
  const desde = `translate(${cx - lado / 2 + (cx - window.innerWidth / 2) * 0.45}px, ${cy - lado / 2 + (cy - window.innerHeight / 2) * 0.45}px) scale(4)`;
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
      if (estadoFinal !== "lagrimas") return;
      salpicar(l);
    })
    .catch(() => gota.remove());
}

function salpicar(l) {
  sonido.gota(true);
  vibrar();
  lluvia.appendChild(l.lienzo);
  l.lienzo.animate(
    [
      { transform: "scale(0.3)", opacity: 0 },
      { transform: "scale(1.06)", opacity: 1, offset: 0.6 },
      { transform: "scale(1)", opacity: 1 },
    ],
    { duration: 420, easing: "ease-out" }
  );
  const onda = document.createElement("i");
  onda.className = "onda-lagrima";
  const lado = l.radio * 2;
  Object.assign(onda.style, { width: lado + "px", height: lado + "px", left: l.cx - l.radio + "px", top: l.cy - l.radio + "px" });
  lluvia.appendChild(onda);
  onda.animate([{ transform: "scale(0.6)", opacity: 0.9 }, { transform: "scale(2.5)", opacity: 0 }], { duration: 1100, easing: "ease-out", fill: "forwards" }).finished.then(() => onda.remove());

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
