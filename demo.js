// Démonstration du Motion Blur en haut de la page.
// La boule va et vient toute seule ; on peut l'attraper à la souris ou au doigt et la lancer.
// Le flou est un vrai flou de mouvement : chaque image superpose la boule à plusieurs instants
// du passé récent (comme un obturateur d'appareil photo resté ouvert), donc la traînée est
// toujours DERRIÈRE la boule et s'allonge avec la vitesse. Le curseur règle la durée de cet obturateur.
(function () {
  var demo = document.querySelector(".demo");
  if (!demo) return;
  var track = demo.querySelector(".demo-track");
  var canvas = demo.querySelector(".demo-canvas");
  var hint = demo.querySelector(".demo-hint");
  var toggle = demo.querySelector(".demo-toggle");
  var slider = demo.querySelector(".demo-intensity");
  var output = demo.querySelector(".demo-value");
  var ctx = canvas.getContext("2d");
  // Le flou est d'abord dessiné en blanc pur sur une toile cachée, puis recoloré :
  // superposer 32 boules presque transparentes d'une couleur non grise donnait une teinte jaune (arrondis).
  var buffer = document.createElement("canvas");
  var bctx = buffer.getContext("2d");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var R = 36;                 // rayon de la boule
  var TRIP = 1.7;             // durée d'un aller (secondes)
  var MAX_SHUTTER = 0.14;     // obturateur à 100 % (secondes)
  var SAMPLES = 32;           // nombre de boules superposées pour dessiner le flou

  var w = 0, h = 0, dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    w = track.clientWidth; h = track.clientHeight;
    canvas.width = buffer.width = w * dpr; canvas.height = buffer.height = h * dpr;
  }
  window.addEventListener("resize", resize);
  resize();

  var color = "#f1f4ee";
  function readColor() { color = getComputedStyle(document.documentElement).getPropertyValue("--on-racing").trim() || color; }
  readColor();
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", readColor);

  // ---------- Réglages ----------
  function updateSlider() {
    slider.style.setProperty("--fill", slider.value + "%");
    output.textContent = slider.value + " %";
    slider.disabled = !toggle.checked;
  }
  slider.addEventListener("input", updateSlider);
  toggle.addEventListener("change", updateSlider);
  updateSlider();

  // ---------- Mouvement ----------
  // Modes : "auto" (va-et-vient), "drag" (tenue par l'utilisateur), "free" (lancée, rebondit puis ralentit)
  var mode = "auto";
  var u = 0, dir = 1;                       // avancement de l'aller-retour (0 à 1) et sens
  var x = R + 16, y = 0, vx = 0, vy = 0;
  var history = [];                         // positions passées {t, x, y} pour dessiner le flou
  var grab = null;

  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function left() { return R + 16; }
  function right() { return w - R - 16; }

  // Reprendre le va-et-vient à partir de la position actuelle (on retrouve l'avancement u correspondant)
  function resumeAuto() {
    var target = (x - left()) / Math.max(1, right() - left());
    target = Math.max(0, Math.min(1, target));
    var lo = 0, hi = 1;
    for (var i = 0; i < 20; i++) { var mid = (lo + hi) / 2; if (ease(mid) < target) lo = mid; else hi = mid; }
    u = lo;
    dir = vx < 0 || (vx === 0 && target > .5) ? -1 : 1;
    mode = "auto";
  }

  function step(now, dt) {
    if (mode === "auto") {
      if (!reduced) u += dir * dt / TRIP;
      if (u >= 1) { u = 1; dir = -1; }
      if (u <= 0) { u = 0; dir = 1; }
      var nx = left() + (right() - left()) * ease(u);
      vx = (nx - x) / Math.max(dt, 1e-3);
      x = nx;
      y += (h / 2 - y) * Math.min(1, dt * 4);   // revient doucement au milieu
    } else if (mode === "free") {
      x += vx * dt; y += vy * dt;
      if (x < R) { x = R; vx = Math.abs(vx) * .8; }
      if (x > w - R) { x = w - R; vx = -Math.abs(vx) * .8; }
      if (y < R) { y = R; vy = Math.abs(vy) * .8; }
      if (y > h - R) { y = h - R; vy = -Math.abs(vy) * .8; }
      var f = Math.pow(.25, dt);                 // frottement : la boule ralentit
      vx *= f; vy *= f;
      if (Math.hypot(vx, vy) < 140) resumeAuto();
    }
    history.push({ t: now, x: x, y: y });
    while (history.length > 2 && now - history[1].t > MAX_SHUTTER + .05) history.shift();
  }

  // Position de la boule à un instant passé (entre deux positions enregistrées)
  function at(t) {
    for (var i = history.length - 1; i > 0; i--) {
      var a = history[i - 1], b = history[i];
      if (a.t <= t) {
        var k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return history[0];
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    var shutter = toggle.checked ? MAX_SHUTTER * slider.value / 100 : 0;
    if (shutter < .002) {
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      return;
    }
    // Superposition additive : là où toutes les boules se recouvrent, la boule est opaque ;
    // là où elle n'est passée qu'un court instant, elle est transparente.
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, w, h);
    bctx.globalCompositeOperation = "lighter";
    bctx.globalAlpha = 1 / SAMPLES;
    bctx.fillStyle = "#ffffff";
    for (var i = 0; i < SAMPLES; i++) {
      var p = at(now - shutter * i / (SAMPLES - 1));
      bctx.beginPath(); bctx.arc(p.x, p.y, R, 0, Math.PI * 2); bctx.fill();
    }
    // On recopie seulement la transparence obtenue, avec la couleur exacte de la boule
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buffer, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
  }

  // ---------- Attraper et lancer la boule ----------
  function local(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  canvas.addEventListener("pointerdown", function (e) {
    var p = local(e);
    if (Math.hypot(p.x - x, p.y - y) > R + 24) return;
    grab = { dx: x - p.x, dy: y - p.y, moves: [] };
    mode = "drag";
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("grabbing");
    hint.classList.add("hidden");
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!grab) return;
    var p = local(e);
    x = Math.max(R, Math.min(w - R, p.x + grab.dx));
    y = Math.max(R, Math.min(h - R, p.y + grab.dy));
    grab.moves.push({ t: performance.now() / 1000, x: x, y: y });
    if (grab.moves.length > 6) grab.moves.shift();
  });
  function release() {
    if (!grab) return;
    // Vitesse de lancer = déplacement des derniers instants
    var m = grab.moves, a = m[0], b = m[m.length - 1];
    vx = vy = 0;
    if (a && b && b.t > a.t && performance.now() / 1000 - b.t < .1) {
      vx = (b.x - a.x) / (b.t - a.t); vy = (b.y - a.y) / (b.t - a.t);
    }
    var sp = Math.hypot(vx, vy);
    if (sp > 2600) { vx *= 2600 / sp; vy *= 2600 / sp; }
    grab = null;
    mode = "free";
    canvas.classList.remove("grabbing");
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // ---------- Boucle d'animation ----------
  // La boucle s'arrête quand la démonstration n'est pas visible (plus bas dans la page) : moins de calcul
  var last = performance.now() / 1000, onScreen = true, looping = false;
  y = h / 2;
  function frame(ms) {
    if (!onScreen) { looping = false; return; }
    var now = ms / 1000;
    var dt = Math.min(.05, now - last);
    last = now;
    step(now, dt);
    draw(now);
    requestAnimationFrame(frame);
  }
  function start() { if (!looping) { looping = true; last = performance.now() / 1000; history = []; requestAnimationFrame(frame); } }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen) start();
    }).observe(track);
  }
  start();
})();
