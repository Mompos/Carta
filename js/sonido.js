const sonido = (() => {
  let ac = null;
  let maestro = null;
  let ruido = null;
  const canales = {};

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
      const largo = ac.sampleRate * 2;
      ruido = ac.createBuffer(1, largo, ac.sampleRate);
      const datos = ruido.getChannelData(0);
      for (let i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
    }
    if (ac.state !== "running") ac.resume().catch(() => {});
  }

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
      fuente.connect(f).connect(g).connect(maestro);
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
    fuente.connect(fl).connect(g).connect(maestro);
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
    o.connect(g).connect(maestro);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const azar = (a, b) => a + Math.random() * (b - a);

  return {
    iniciar,

    pluma(fuerza) {
      const c = continuo("pluma", Math.min(0.32, 0.07 * fuerza), "bandpass", 3600, 1.3);
      if (c) c.f.frequency.setTargetAtTime(azar(2800, 4600), ac.currentTime, 0.03);
    },

    goma(fuerza) {
      continuo("goma", Math.min(0.4, 0.09 * fuerza), "bandpass", 850, 0.8);
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

    arrugar() {
      for (let i = 0; i < 22; i++) rafaga({ dur: azar(0.02, 0.08), tipo: "bandpass", f: azar(1200, 6000), q: 2, nivel: azar(0.15, 0.4), retraso: azar(0, 0.65) });
      rafaga({ dur: 0.4, tipo: "lowpass", f: 900, f2: 300, nivel: 0.15, retraso: 0.7 });
    },

    pagina() {
      rafaga({ dur: 0.4, tipo: "lowpass", f: 500, f2: 2500, q: 0.6, nivel: 0.18, ataque: 0.1 });
    },

    voltear() {
      rafaga({ dur: 0.5, tipo: "lowpass", f: 300, f2: 2200, q: 0.7, nivel: 0.25, ataque: 0.18 });
      rafaga({ dur: 0.05, tipo: "bandpass", f: 1800, q: 1.5, nivel: 0.12, retraso: 0.45 });
    },

    rasgar() {
      rafaga({ dur: 0.55, tipo: "bandpass", f: 700, f2: 3200, q: 0.9, nivel: 0.4, ataque: 0.02 });
      for (let i = 0; i < 14; i++) rafaga({ dur: azar(0.01, 0.04), tipo: "highpass", f: azar(2000, 4500), nivel: azar(0.08, 0.25), retraso: azar(0, 0.5) });
    },

    encender() {
      rafaga({ dur: 0.12, tipo: "bandpass", f: 3500, q: 1.5, nivel: 0.45 });
      rafaga({ dur: 0.7, tipo: "lowpass", f: 350, f2: 1800, q: 0.7, nivel: 0.3, ataque: 0.08, retraso: 0.08 });
    },

    soplo() {
      rafaga({ dur: 0.35, tipo: "lowpass", f: 1200, f2: 300, nivel: 0.15, ataque: 0.03 });
    },

    fuego(intensidad) {
      fijar("fuego", 0.08 + 0.22 * intensidad, "lowpass", 450, 0.5);
      if (Math.random() < 0.12 + 0.4 * intensidad) {
        rafaga({ dur: azar(0.008, 0.035), tipo: "highpass", f: azar(1800, 5000), nivel: azar(0.08, 0.1 + 0.3 * intensidad) });
      }
    },

    apagarFuego() {
      if (canales.fuego) fijar("fuego", 0, "lowpass", 450, 0.5);
    },
  };
})();
