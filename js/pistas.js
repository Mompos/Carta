const ESPERA_PRIMERA_PISTA = 3500;
const ESPERA_ENTRE_PISTAS = 7000;
const VECES_POR_PISTA = 2;

const aprendidos = new Set();
const vecesMostrada = {};
let ultimaActividad = performance.now();
let pistaVisible = null;

function aprender(nombre) {
  aprendidos.add(nombre);
  if (pistaVisible && pistaVisible.nombre === nombre) esconderPista();
}

function centro(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, r };
}

function zigzag(cx, cy, amplitud, eje, idas = 3) {
  const puntos = [];
  for (let i = 0; i <= idas * 2; i++) {
    const lado = i === 0 ? 0 : i % 2 ? 1 : -1;
    puntos.push(eje === "x" ? [cx + lado * amplitud, cy] : [cx, cy + lado * amplitud]);
  }
  puntos.push([cx, cy]);
  return puntos;
}

function palabraLibre() {
  medir();
  const base = carta.getBoundingClientRect();
  const libres = palabras.filter((p) => !p.tachada && !p.borrada && p.w > fuente * 1.6);
  const p = libres[Math.min(libres.length - 1, 3)] || palabras[0];
  return p ? { x: base.left + p.x + p.w / 2, y: base.top + p.y + p.h / 2, w: p.w } : null;
}

function catalogoPistas() {
  const sobreVisible = escenaSobre.style.display !== "none";
  const lista = [];

  if (sobreVisible && !selloRoto) {
    const s = centro(sello);
    lista.push({ nombre: "sello", texto: "Rasca el sello de cera", puntos: zigzag(s.x, s.y, s.w * 0.4, "x", 4) });
  } else if (sobreVisible && selloRoto && !sobreAbierto && !agarre) {
    const a = abrecartas.getBoundingClientRect();
    const caja = sobre.getBoundingClientRect();
    const y = caja.top + Math.min(70, caja.height * 0.25);
    lista.push({
      nombre: "abrecartas",
      texto: "Toma el abrecartas y córtalo por arriba",
      puntos: [[a.left + a.width * 0.75, a.top + a.height / 2], [caja.left + caja.width * 0.15, y], [caja.right - caja.width * 0.15, y]],
    });
  }

  if (historiaIniciada && !estadoFinal && !animando && !ardiendo) {
    const c = centro(carta);
    if (volteada || enPuente) {
      if (volteada && !fotoCerca) {
        const f = centro(reverso.querySelector(".foto-2") || reverso);
        lista.push({ nombre: "foto", texto: "Toca una foto para verla de cerca", puntos: [[f.x, f.y]], quieto: true });
      }
      if (fosforo && !fosforo.arrastre && !fosforo.vuelo) {
        const r = raspador.getBoundingClientRect();
        const objetivo = centro(volteada ? reverso : texto.querySelector(".dibujo-puente") || carta);
        const yr = r.top + r.height / 2;
        lista.push({
          nombre: "cerilla",
          texto: volteada ? "Raspa una cerilla y lánzala a las fotos" : "Raspa una cerilla y lánzala al puente",
          puntos: [[fosforo.x, fosforo.y], [r.left + 10, yr], [r.right - 10, yr], [r.left + 10, yr], [r.right - 10, yr], [objetivo.x, objetivo.y]],
        });
      }
      if (volteada) lista.push({ nombre: "volver", texto: "Desliza hacia arriba para volver a la carta", puntos: [[c.x, c.r.bottom - c.h * 0.15], [c.x, c.r.top + c.h * 0.2]], rapido: true });
    } else {
      if (nivelDesgaste() >= 1 && !fotosQuemadas) lista.push({ nombre: "voltear", texto: "La carta está gastada: desliza hacia arriba", puntos: [[c.x, c.r.bottom - c.h * 0.15], [c.x, c.r.top + c.h * 0.2]], rapido: true });
      const p = palabraLibre();
      if (p) {
        lista.push({ nombre: "tachar", texto: "Frota de lado a lado para tachar", puntos: zigzag(p.x, p.y, Math.max(p.w * 0.6, 28), "x") });
        lista.push({ nombre: "borrar", texto: "Frota arriba y abajo para borrar", puntos: zigzag(p.x, p.y, fuente * 0.7, "y") });
      }
      const ultima = actual === paginas.length - 1;
      lista.push({ nombre: "pasar", texto: ultima ? "Desliza a la izquierda para ver las fotos" : "Desliza a la izquierda para pasar la página", puntos: [[c.r.right - c.w * 0.12, c.y], [c.r.left + c.w * 0.12, c.y]], rapido: true });
      lista.push({ nombre: "cortar", texto: "Desliza hacia abajo para cortarla", puntos: [[c.x, c.r.top + c.h * 0.1], [c.x + c.w * 0.04, c.r.bottom - c.h * 0.1]], rapido: true });
      lista.push({ nombre: "arrugar", texto: "Deja el dedo quieto para arrugarla", puntos: [[c.x, c.y]], quieto: true });
    }
  }

  if (estadoFinal === "lagrimas" && lagrimaActual && !lagrimaActual.saliendo) {
    lista.push({ nombre: "lagrima", texto: "Frota la lágrima para borrarla", puntos: zigzag(lagrimaActual.cx, lagrimaActual.cy, lagrimaActual.radio * 0.9, "x", 3) });
  }
  return lista;
}

function mostrarPista(p) {
  vecesMostrada[p.nombre] = (vecesMostrada[p.nombre] || 0) + 1;
  const capa = document.createElement("div");
  capa.className = "pista-gesto";
  const dedo = document.createElement("i");
  dedo.className = "dedo-fantasma";
  const rotulo = document.createElement("span");
  rotulo.className = "rotulo-gesto";
  rotulo.textContent = p.texto;
  capa.append(dedo, rotulo);
  document.body.appendChild(capa);

  const [x0, y0] = p.puntos[0];
  const ancho = rotulo.offsetWidth;
  const arriba = Math.max(...p.puntos.map((q) => q[1])) + 34;
  const debajo = arriba + rotulo.offsetHeight < window.innerHeight - 20;
  const ry = debajo ? arriba : Math.min(...p.puntos.map((q) => q[1])) - 34 - rotulo.offsetHeight;
  const rx = Math.min(window.innerWidth - ancho - 12, Math.max(12, x0 - ancho / 2));
  rotulo.style.transform = `translate(${rx}px, ${ry}px)`;

  const paso = p.rapido ? 520 : p.quieto ? 2600 : 260;
  const recorrido = p.quieto ? 2600 : Math.max(700, paso * (p.puntos.length - 1));
  const cuadros = p.quieto
    ? [
        { transform: `translate(${x0}px, ${y0}px) scale(1.3)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(${x0}px, ${y0}px) scale(0.85)`, opacity: 1, offset: 0.88 },
        { transform: `translate(${x0}px, ${y0}px) scale(0.85)`, opacity: 0 },
      ]
    : [
        { transform: `translate(${x0}px, ${y0}px) scale(1.3)`, opacity: 0, offset: 0 },
        { transform: `translate(${x0}px, ${y0}px) scale(1)`, opacity: 1, offset: 0.08 },
        ...p.puntos.slice(1).map(([x, y], i) => ({ transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1, offset: 0.08 + (0.84 * (i + 1)) / (p.puntos.length - 1) })),
        { transform: `translate(${p.puntos[p.puntos.length - 1][0]}px, ${p.puntos[p.puntos.length - 1][1]}px) scale(1.2)`, opacity: 0, offset: 1 },
      ];
  const animacion = dedo.animate(cuadros, { duration: recorrido + 500, iterations: 2, easing: "ease-in-out" });
  if (p.quieto) capa.classList.add("quieto");
  rotulo.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: (recorrido + 500) * 2, fill: "forwards" });
  pistaVisible = { nombre: p.nombre, capa };
  animacion.finished.then(() => {
    if (pistaVisible && pistaVisible.capa === capa) esconderPista();
  }).catch(() => {});
}

function esconderPista() {
  if (!pistaVisible) return;
  const capa = pistaVisible.capa;
  pistaVisible = null;
  capa.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: "forwards" }).finished.then(() => capa.remove());
  ultimaActividad = performance.now();
}

function actividad() {
  ultimaActividad = performance.now();
  esconderPista();
}

["pointerdown", "keydown"].forEach((tipo) => document.addEventListener(tipo, actividad, true));
document.addEventListener("pointermove", (e) => {
  if (e.buttons || e.pointerType === "touch") ultimaActividad = performance.now();
}, true);

let pistasMostradas = 0;
setInterval(() => {
  if (pistaVisible || document.hidden) return;
  const espera = pistasMostradas ? ESPERA_ENTRE_PISTAS : ESPERA_PRIMERA_PISTA;
  if (performance.now() - ultimaActividad < espera) return;
  const p = catalogoPistas().find((q) => !aprendidos.has(q.nombre) && (vecesMostrada[q.nombre] || 0) < VECES_POR_PISTA);
  if (!p) return;
  pistasMostradas++;
  mostrarPista(p);
}, 500);
