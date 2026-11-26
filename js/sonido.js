const sonido = (() => {
  let ac = null;
  let maestro = null;
  let ruido = null;
  let paneo = null;
  let musica = null;
  let musicaApagada = false;
  const canales = {};
  const elementoCancion = document.getElementById("cancion");

  function eco() {
    const segundos = 1.6;
    const largo = Math.round(ac.sampleRate * segundos);
    const respuesta = ac.createBuffer(2, largo, ac.sampleRate);
    for (let canal = 0; canal < 2; canal++) {
      const datos = respuesta.getChannelData(canal);
      for (let i = 0; i < largo; i++) {
        const t = i / largo;
        const temprano = i < ac.sampleRate * 0.03 && Math.random() < 0.02 ? 2 : 1;
        datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * temprano;
      }
    }
    const convolver = ac.createConvolver();
    convolver.buffer = respuesta;
    const tono_ = filtro("lowpass", 3800, 0.5);
    const mezcla = ac.createGain();
    mezcla.gain.value = 0.32;
    maestro.connect(convolver).connect(tono_).connect(mezcla).connect(ac.destination);
  }

  function conectarMusica() {
    if (musica || !elementoCancion || !ac || ac.state !== "running") return;
    try {
      const fuente = ac.createMediaElementSource(elementoCancion);
      const filtro_ = filtro("lowpass", 20000, 0.5);
      const volumen = ac.createGain();
      fuente.connect(filtro_).connect(volumen).connect(ac.destination);
      musica = { filtro: filtro_, volumen };
    } catch (error) {
      musica = false;
    }
  }

  function volumenMusica(destino, segundos) {
    if (musica) {
      const t = ac.currentTime;
      sostener(musica.volumen.gain, t);
      musica.volumen.gain.setTargetAtTime(destino, t, segundos / 3);
    } else if (elementoCancion) {
      elementoCancion.volume = Math.max(0, Math.min(1, destino));
    }
  }

  function agacharMusica(nivel = 0.5, vuelta = 1.2) {
    if (musicaApagada || !listo()) return;
    if (musica) {
      const g = musica.volumen.gain;
      const t = ac.currentTime;
      sostener(g, t);
      g.setTargetAtTime(nivel, t, 0.04);
      g.setTargetAtTime(1, t + 0.25, vuelta / 3);
    } else if (elementoCancion) {
      elementoCancion.volume = nivel;
      setTimeout(() => {
        if (!musicaApagada) elementoCancion.volume = 1;
      }, vuelta * 1000);
    }
  }

  function apagarMusica(segundos = 5) {
    if (musicaApagada) return;
    musicaApagada = true;
    if (musica && listo()) {
      const t = ac.currentTime;
      sostener(musica.volumen.gain, t);
      musica.volumen.gain.setValueAtTime(musica.volumen.gain.value, t);
      musica.volumen.gain.linearRampToValueAtTime(0, t + segundos);
      sostener(musica.filtro.frequency, t);
      musica.filtro.frequency.setValueAtTime(musica.filtro.frequency.value, t);
      musica.filtro.frequency.exponentialRampToValueAtTime(350, t + segundos);
    } else if (elementoCancion) {
      const inicio = performance.now();
      const v0 = elementoCancion.volume;
      (function bajar() {
        const f = Math.min(1, (performance.now() - inicio) / (segundos * 1000));
        elementoCancion.volume = v0 * (1 - f);
        if (f < 1) requestAnimationFrame(bajar);
      })();
    }
    setTimeout(() => elementoCancion && elementoCancion.pause(), segundos * 1000 + 200);
  }

  function lado(x) {
    if (!paneo || !paneo.pan) return;
    const p = Math.max(-1, Math.min(1, (x / window.innerWidth) * 2 - 1)) * 0.7;
    paneo.pan.setTargetAtTime(p, ac.currentTime, 0.05);
  }

  function iniciar() {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    if (!ac) {
      try {
        if (navigator.audioSession) navigator.audioSession.type = "playback";
      } catch (error) {}
      ac = new Contexto();
      maestro = ac.createGain();
      maestro.gain.value = 0.55;
      maestro.connect(ac.destination);
      paneo = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
      paneo.connect(maestro);
      eco();
      const largo = ac.sampleRate * 2;
      ruido = ac.createBuffer(1, largo, ac.sampleRate);
      const datos = ruido.getChannelData(0);
      for (let i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
    }
    if (ac.state !== "running") ac.resume().then(conectarMusica).catch(() => {});
    else conectarMusica();
  }

  document.addEventListener("visibilitychange", () => {
    if (!ac) return;
    if (document.hidden) {
      if (musica && elementoCancion && !elementoCancion.paused) {
        elementoCancion.pause();
        elementoCancion.dataset.seguir = "1";
      }
    } else {
      ac.resume().catch(() => {});
      if (elementoCancion && elementoCancion.dataset.seguir && !musicaApagada) {
        delete elementoCancion.dataset.seguir;
        if (musica) {
          musica.volumen.gain.setValueAtTime(0, ac.currentTime);
          volumenMusica(1, 1.5);
        }
        elementoCancion.play().catch(() => {});
      }
    }
  });

  function listo() {
    return ac && ac.state === "running";
  }

  function filtro(tipo, frecuencia, q) {
    const f = ac.createBiquadFilter();
    f.type = tipo;
    f.frequency.value = frecuencia;
    f.Q.value = q;
    return f;
  }

  function canal(nombre, tipo, frecuencia, q) {
    if (!listo()) return null;
    if (!canales[nombre]) {
      const fuente = ac.createBufferSource();
      fuente.buffer = ruido;
      fuente.loop = true;
      const f = filtro(tipo, frecuencia, q);
      const g = ac.createGain();
      g.gain.value = 0;
      fuente.connect(f).connect(g).connect(paneo);
      fuente.start(0, Math.random() * 1.5);
      canales[nombre] = { g, f };
    }
    return canales[nombre];
  }

  function sostener(param, t) {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
    else param.cancelScheduledValues(t);
  }

  function continuo(nombre, nivel, tipo, frecuencia, q, suelta = 0.08) {
    const c = canal(nombre, tipo, frecuencia, q);
    if (!c) return;
    const t = ac.currentTime;
    sostener(c.g.gain, t);
    c.g.gain.setTargetAtTime(nivel, t, 0.015);
    c.g.gain.setTargetAtTime(0, t + suelta, 0.05);
    return c;
  }

  function fijar(nombre, nivel, tipo, frecuencia, q) {
    const c = canal(nombre, tipo, frecuencia, q);
    if (!c) return;
    const t = ac.currentTime;
    sostener(c.g.gain, t);
    c.g.gain.setTargetAtTime(nivel, t, 0.2);
  }

  function rafaga({ dur = 0.2, tipo = "bandpass", f = 2000, f2 = f, q = 1, nivel = 0.3, ataque = 0.005, retraso = 0 }) {
    if (!listo()) return;
    const t = ac.currentTime + retraso;
    const fuente = ac.createBufferSource();
    fuente.buffer = ruido;
    const fl = filtro(tipo, f, q);
    const g = ac.createGain();
    fl.frequency.setValueAtTime(f, t);
    fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(nivel, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    fuente.connect(fl).connect(g).connect(paneo);
    fuente.start(t, Math.random() * 1.5);
    fuente.stop(t + dur + 0.05);
  }

  function tono(f, f2, dur, nivel, retraso = 0) {
    if (!listo()) return;
    const t = ac.currentTime + retraso;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(nivel, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(paneo);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const azar = (a, b) => a + Math.random() * (b - a);

  return {
    iniciar,
    lado,
    agacharMusica,
    apagarMusica,

    pluma(rabia) {
      const c = continuo("pluma", 0.04 + 0.3 * rabia, "bandpass", 3600, 1.3);
      if (!c) return;
      const centro = 4300 - 2000 * rabia;
      c.f.frequency.setTargetAtTime(azar(centro * 0.85, centro * 1.15), ac.currentTime, 0.03);
      c.f.Q.setTargetAtTime(2.2 - 1.6 * rabia, ac.currentTime, 0.05);
      if (rabia > 0.65 && Math.random() < 0.25 * rabia) {
        rafaga({ dur: azar(0.01, 0.03), tipo: "highpass", f: azar(2500, 5000), nivel: 0.1 + 0.2 * rabia });
      }
    },

    goma(rabia) {
      const c = continuo("goma", 0.05 + 0.35 * rabia, "bandpass", 850, 0.8);
      if (c) c.f.frequency.setTargetAtTime(650 + 700 * rabia, ac.currentTime, 0.05);
    },

    cera() {
      continuo("cera", 0.22, "bandpass", 1500, 1.4);
    },

    romperSello() {
      rafaga({ dur: 0.09, tipo: "highpass", f: 2500, nivel: 0.5 });
      tono(150, 55, 0.14, 0.35);
      for (let i = 0; i < 6; i++) rafaga({ dur: 0.02, tipo: "bandpass", f: azar(2500, 5000), q: 3, nivel: azar(0.05, 0.15), retraso: azar(0.15, 0.6) });
    },

    corte() {
      continuo("corte", 0.32, "bandpass", 2300, 0.7, 0.06);
      if (Math.random() < 0.3) rafaga({ dur: 0.02, tipo: "highpass", f: 3500, nivel: 0.1 });
    },

    abrirSobre() {
      rafaga({ dur: 0.5, tipo: "lowpass", f: 400, f2: 1600, q: 0.7, nivel: 0.2, ataque: 0.12 });
    },

    crujido(avance) {
      if (Math.random() > 0.05 + 0.35 * avance) return;
      rafaga({ dur: azar(0.02, 0.07), tipo: "bandpass", f: azar(1500, 5500), q: 2, nivel: 0.06 + 0.22 * avance });
    },

    arrugar(furia = 0.4) {
      agacharMusica(0.45, 1.6);
      const duracion = 0.75 - 0.35 * furia;
      const golpes = Math.round(14 + 26 * furia);
      for (let i = 0; i < golpes; i++) {
        rafaga({ dur: azar(0.02, 0.08), tipo: "bandpass", f: azar(1200, 6000), q: 2, nivel: azar(0.1, 0.25 + 0.3 * furia), retraso: azar(0, duracion) });
      }
      rafaga({ dur: 0.4, tipo: "lowpass", f: 900, f2: 300, nivel: 0.1 + 0.15 * furia, retraso: duracion + 0.05 });
    },

    pagina() {
      rafaga({ dur: 0.4, tipo: "lowpass", f: 500, f2: 2500, q: 0.6, nivel: 0.18, ataque: 0.1 });
    },

    voltear() {
      rafaga({ dur: 0.5, tipo: "lowpass", f: 300, f2: 2200, q: 0.7, nivel: 0.25, ataque: 0.18 });
      rafaga({ dur: 0.05, tipo: "bandpass", f: 1800, q: 1.5, nivel: 0.12, retraso: 0.45 });
    },

    rasgar(furia = 0.3) {
      agacharMusica(0.5, 1.4);
      const dur = 0.8 - 0.4 * furia;
      rafaga({ dur, tipo: "bandpass", f: 700, f2: 3200, q: 1.4 - 0.8 * furia, nivel: 0.2 + 0.35 * furia, ataque: 0.02 });
      const chasquidos = Math.round(6 + 20 * furia);
      for (let i = 0; i < chasquidos; i++) rafaga({ dur: azar(0.01, 0.04), tipo: "highpass", f: azar(2000, 4500), nivel: azar(0.05, 0.1 + 0.25 * furia), retraso: azar(0, dur) });
    },

    encender() {
      agacharMusica(0.55, 2);
      rafaga({ dur: 0.12, tipo: "bandpass", f: 3500, q: 1.5, nivel: 0.45 });
      rafaga({ dur: 0.7, tipo: "lowpass", f: 350, f2: 1800, q: 0.7, nivel: 0.3, ataque: 0.08, retraso: 0.08 });
    },

    soplo() {
      rafaga({ dur: 0.35, tipo: "lowpass", f: 1200, f2: 300, nivel: 0.15, ataque: 0.03 });
    },

    fuego(intensidad, furia = 0.3) {
      fijar("fuego", (0.08 + 0.22 * intensidad) * (0.7 + 0.6 * furia), "lowpass", 450 + 400 * furia, 0.5);
      if (Math.random() < (0.12 + 0.4 * intensidad) * (0.6 + 0.8 * furia)) {
        rafaga({ dur: azar(0.008, 0.035), tipo: "highpass", f: azar(1800, 5000), nivel: azar(0.08, 0.1 + 0.3 * intensidad + 0.15 * furia) });
      }
    },

    gota(fuerte = true) {
      if (fuerte) agacharMusica(0.7, 0.9);
      tono(azar(1100, 1500), azar(380, 520), 0.22, fuerte ? 0.09 : 0.04);
      rafaga({ dur: 0.07, tipo: "highpass", f: 2600, nivel: fuerte ? 0.07 : 0.03, retraso: 0.01 });
    },

    apagarFuego() {
      if (canales.fuego) fijar("fuego", 0, "lowpass", 450, 0.5);
    },
  };
})();
