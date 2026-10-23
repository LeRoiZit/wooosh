// Curseur Wooosh : un point qui suit la souris en laissant une traînée floue (Motion Blur),
// et un anneau qui le rattrape en douceur et grossit sur les liens et boutons.
// Seulement avec une vraie souris, et sans traînée si « réduire les animations » est activé dans Windows.
(function () {
  var fine = window.matchMedia("(pointer: fine)").matches;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Barre de progression de lecture (fine ligne verte tout en haut)
  var progress = document.querySelector(".progress");
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
    document.body.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- Langue (français / anglais) ----------
  // Le français est dans la page ; on le garde en mémoire pour pouvoir y revenir.
  // Le choix est retenu dans le navigateur (jamais envoyé), voir confidentialite.html.
  var dict = window.WOOOSH_I18N || {};
  var originals = new Map();
  var translatable = document.querySelectorAll("[data-i18n], [data-i18n-alt], [data-i18n-aria]");
  translatable.forEach(function (el) {
    originals.set(el, { html: el.innerHTML, alt: el.getAttribute("alt"), aria: el.getAttribute("aria-label") });
  });

  function setLang(lang) {
    if (lang !== "fr" && !dict[lang]) lang = "fr";
    var d = dict[lang] || {};
    translatable.forEach(function (el) {
      var o = originals.get(el);
      var k = el.getAttribute("data-i18n"), ka = el.getAttribute("data-i18n-alt"), kr = el.getAttribute("data-i18n-aria");
      if (k) el.innerHTML = lang === "fr" || d[k] == null ? o.html : d[k];
      if (ka) el.setAttribute("alt", lang === "fr" || d[ka] == null ? o.alt : d[ka]);
      if (kr) el.setAttribute("aria-label", lang === "fr" || d[kr] == null ? o.aria : d[kr]);
    });
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-set-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-set-lang") === lang ? "true" : "false");
    });
    try { localStorage.setItem("wooosh-lang", lang); } catch (e) { /* navigation privée : on ne retient pas */ }
    // les textes calculés (paiement, abonnement) se réécrivent dans la nouvelle langue
    document.dispatchEvent(new CustomEvent("wooosh-lang", { detail: lang }));
  }

  var saved = null;
  try { saved = localStorage.getItem("wooosh-lang"); } catch (e) { }
  setLang(saved || ((navigator.language || "fr").slice(0, 2) === "fr" ? "fr" : "en"));
  document.querySelectorAll("[data-set-lang]").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.getAttribute("data-set-lang")); });
  });

  // ---------- Comparaison avant / après ----------
  // Un curseur de formulaire invisible couvre l'image : il marche à la souris, au doigt et au clavier.
  document.querySelectorAll(".compare").forEach(function (box) {
    var range = box.querySelector(".compare-range");
    function update() { box.style.setProperty("--pos", range.value + "%"); }
    range.addEventListener("input", update);
    update();
  });

  // ---------- Carrousel des écrans, piloté par le défilement de la page ----------
  // La section est haute et son contenu reste collé à l'écran : en descendant (molette, pavé tactile, doigt),
  // la piste avance de gauche à droite ; après le dernier écran, la page continue normalement.
  document.querySelectorAll(".gallery").forEach(function (gallery) {
    var track = gallery.querySelector(".gallery-track");
    var viewport = gallery.querySelector(".gallery-viewport");
    var slides = Array.prototype.slice.call(gallery.querySelectorAll(".slide"));
    var tabs = gallery.querySelectorAll(".gallery-tab");
    var prev = gallery.querySelector('.arrow[data-dir="-1"]'), next = gallery.querySelector('.arrow[data-dir="1"]');
    var n = slides.length, current = -1, pos = 0, ticking = false, lastPos = -1;
    // Mesures de la page, relues seulement au chargement et quand la fenêtre change de taille :
    // pendant le défilement, on ne lit que window.scrollY (lire les tailles à chaque image ralentit beaucoup).
    var m = { top: 0, range: 1, step: 0, slideW: 0, viewW: 0 };
    function measure() {
      track.style.transform = "none";
      m.top = gallery.getBoundingClientRect().top + window.scrollY;
      m.range = Math.max(1, gallery.offsetHeight - window.innerHeight);
      m.step = slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : 0;
      m.slideW = slides[0].offsetWidth;
      m.viewW = viewport.clientWidth;
      lastPos = -1;
    }

    // Position de défilement de la page qui met l'écran i au centre
    function scrollFor(i) {
      return m.top + m.range * (i / (n - 1));
    }
    function goTo(i) {
      i = Math.max(0, Math.min(n - 1, i));
      window.scrollTo({ top: scrollFor(i), behavior: reduced ? "auto" : "smooth" });
    }

    function render() {
      ticking = false;
      var y = window.scrollY;
      // section loin de l'écran : rien à faire
      if (y < m.top - window.innerHeight || y > m.top + m.range + window.innerHeight) return;
      var p = Math.max(0, Math.min(1, (y - m.top) / m.range));
      pos = p * (n - 1);
      if (Math.abs(pos - lastPos) < 0.0005) return;
      lastPos = pos;
      // Décalage pour que l'écran « pos » soit au centre de la fenêtre du navigateur
      var x = m.viewW / 2 - m.slideW / 2 - pos * m.step;
      track.style.transform = "translate3d(" + x.toFixed(1) + "px,0,0)";
      // Effet 3D : les écrans sur les côtés pivotent vers le centre et reculent un peu
      slides.forEach(function (s, i) {
        var d = Math.max(-1.5, Math.min(1.5, i - pos));
        // perspective() propre à chaque écran : le point de vue est toujours en face de lui
        s.style.transform = "perspective(1600px) translateZ(" + (-Math.abs(d) * 160).toFixed(1) + "px) rotateY(" + (-d * 28).toFixed(2) + "deg)";
        s.style.opacity = (1 - Math.min(1, Math.abs(d)) * .55).toFixed(3);
      });
      var best = Math.round(pos);
      if (best === current) return;
      current = best;
      slides.forEach(function (s, i) { s.classList.toggle("is-active", i === best); });
      tabs.forEach(function (t, i) { t.setAttribute("aria-current", i === best ? "true" : "false"); });
      prev.disabled = best === 0;
      next.disabled = best === n - 1;
    }
    function request() { if (!ticking) { ticking = true; requestAnimationFrame(render); } }

    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", function () { measure(); request(); });
    // les images et les polices changent les tailles une fois chargées
    window.addEventListener("load", function () { measure(); request(); });
    tabs.forEach(function (t) { t.addEventListener("click", function () { goTo(+t.getAttribute("data-slide")); }); });
    prev.addEventListener("click", function () { goTo(current - 1); });
    next.addEventListener("click", function () { goTo(current + 1); });
    // Un clic sur un écran voisin l'amène au centre
    slides.forEach(function (s, i) { s.addEventListener("click", function () { if (i !== current && !moved) goTo(i); }); });
    gallery.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { goTo(current + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { goTo(current - 1); e.preventDefault(); }
    });
    measure();
    render();

    // ---------- Fenêtres en 3D : on les fait tourner en les faisant glisser à la souris ----------
    // (au doigt, le glissement sert à faire défiler le carrousel)
    var moved = false;
    slides.forEach(function (s) {
      var win = s.querySelector(".win");
      var start = null;
      win.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "touch" || e.button !== 0) return;
        var cs = getComputedStyle(win);
        start = { x: e.clientX, y: e.clientY, rx: parseFloat(cs.getPropertyValue("--rx")), ry: parseFloat(cs.getPropertyValue("--ry")) };
        moved = false;
        win.setPointerCapture(e.pointerId);
        win.classList.add("dragging");
        e.preventDefault();
      });
      win.addEventListener("pointermove", function (e) {
        if (!start) return;
        var dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        // 0,35° par pixel ; on limite l'angle pour que la fenêtre reste lisible
        var ry = Math.max(-60, Math.min(60, start.ry + dx * 0.35));
        var rx = Math.max(-30, Math.min(30, start.rx - dy * 0.35));
        win.style.setProperty("--ry", ry + "deg");
        win.style.setProperty("--rx", rx + "deg");
      });
      function end() {
        if (!start) return;
        start = null;
        win.classList.remove("dragging");
        setTimeout(function () { moved = false; }, 0);
      }
      win.addEventListener("pointerup", end);
      win.addEventListener("pointercancel", end);
      // Double-clic : la fenêtre revient à sa position de départ
      win.addEventListener("dblclick", function () { win.style.removeProperty("--rx"); win.style.removeProperty("--ry"); });
    });
  });

  if (!fine) return;

  // Le point suit la souris directement (déplacé par la carte graphique, sans attendre l'animation) ;
  // la traînée est dessinée seulement autour du curseur, et rien ne tourne quand la souris est immobile.
  var canvas = document.createElement("canvas");
  canvas.className = "cursor-trail";
  var dot = document.createElement("div");
  dot.className = "cursor-dot";
  var ring = document.createElement("div");
  ring.className = "cursor-ring";
  document.body.append(canvas, ring, dot);
  document.documentElement.classList.add("custom-cursor");

  var ctx = canvas.getContext("2d");
  var dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    dirty = null;
  }
  var dirty = null;                   // zone dessinée à l'image précédente (seule zone à effacer)
  window.addEventListener("resize", resize);
  resize();

  var TRAIL_MS = reduced ? 0 : 110;   // durée de la traînée
  var points = [];                    // positions récentes {x, y, t}
  var mouse = { x: -100, y: -100 }, ringPos = { x: -100, y: -100 };
  var visible = false, hovering = false, running = false, last = 0;

  function wake() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }

  window.addEventListener("mousemove", function (e) {
    mouse.x = e.clientX; mouse.y = e.clientY;
    dot.style.transform = "translate3d(" + mouse.x + "px," + mouse.y + "px,0)";
    if (!visible) { ringPos.x = mouse.x; ringPos.y = mouse.y; points = []; visible = true; document.body.classList.add("cursor-on"); }
    wake();
  }, { passive: true });
  document.addEventListener("mouseleave", function () { visible = false; points = []; document.body.classList.remove("cursor-on"); wake(); });
  document.addEventListener("mouseover", function (e) {
    hovering = !!e.target.closest("a, button, summary, .btn, .compare-range");
    ring.classList.toggle("hover", hovering);
  });
  window.addEventListener("mousedown", function () { ring.classList.add("down"); });
  window.addEventListener("mouseup", function () { ring.classList.remove("down"); });

  function ink() {
    return getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#eceef0";
  }
  var color = ink();
  window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () { color = ink(); });

  function frame(now) {
    var dt = Math.min(.05, (now - last) / 1000);
    last = now;
    // La traînée : les positions des dernières ~110 ms, reliées par un trait de plus en plus fin
    // et transparent vers l'arrière.
    if (visible) points.push({ x: mouse.x, y: mouse.y, t: now });
    while (points.length && now - points[0].t > TRAIL_MS) points.shift();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (dirty) ctx.clearRect(dirty.x, dirty.y, dirty.w, dirty.h);
    dirty = null;
    if (visible && points.length > 1) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      for (var i = 1; i < points.length; i++) {
        var k = i / points.length;    // 0 = le plus ancien, 1 = la position actuelle
        var a = points[i - 1], b = points[i];
        ctx.globalAlpha = k * k * 0.5;
        ctx.lineWidth = 1.5 + 5 * k;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        minX = Math.min(minX, a.x, b.x); maxX = Math.max(maxX, a.x, b.x);
        minY = Math.min(minY, a.y, b.y); maxY = Math.max(maxY, a.y, b.y);
      }
      ctx.globalAlpha = 1;
      dirty = { x: minX - 8, y: minY - 8, w: maxX - minX + 16, h: maxY - minY + 16 };
    }

    // L'anneau rattrape la souris (même vitesse quel que soit le nombre d'images par seconde)
    // et s'étire dans le sens du mouvement
    var dx = mouse.x - ringPos.x, dy = mouse.y - ringPos.y;
    var f = 1 - Math.pow(0.8, dt * 60);
    ringPos.x += dx * f; ringPos.y += dy * f;
    var speed = reduced || hovering ? 0 : Math.min(Math.hypot(dx, dy) / 60, 0.6);
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;
    ring.style.transform = "translate3d(" + ringPos.x + "px," + ringPos.y + "px,0) rotate(" + angle + "deg) scale(" + (1 + speed) + "," + (1 - speed * 0.5) + ")";

    // On s'arrête quand tout est immobile ; le prochain mouvement de souris relance la boucle
    var settled = Math.abs(dx) < .3 && Math.abs(dy) < .3 && points.length < 2 && !dirty;
    if (settled) { running = false; points = []; return; }
    requestAnimationFrame(frame);
  }
})();
