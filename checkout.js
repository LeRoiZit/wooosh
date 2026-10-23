// Paiement de DÉMONSTRATION : aucun paiement réel, aucune donnée envoyée.
// « Choisir Mensuel / Annuel » ouvre la fenêtre de commande ; après le faux paiement, une vraie clé d'accès
// Wooosh est créée (license.js) et la commande est gardée dans ce navigateur pour la page « Mon abonnement ».
// Pour la vraie vente, cette fenêtre sera remplacée par celle de la plateforme de paiement.
window.WoooshOrders = {
  // Commandes gardées dans ce navigateur : [{ key, plan, email, date, canceled }]
  load: function () {
    try { return JSON.parse(localStorage.getItem("wooosh-orders") || "[]"); } catch (e) { return []; }
  },
  save: function (list) {
    try { localStorage.setItem("wooosh-orders", JSON.stringify(list)); } catch (e) { /* navigation privée */ }
  }
};

// Petit texte français / anglais selon la langue de la page
window.WoooshT = function (fr, en) { return document.documentElement.lang === "en" ? en : fr; };

window.WoooshDate = function (d) {
  return d.toLocaleDateString(document.documentElement.lang === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" });
};

(function () {
  var dialog = document.querySelector(".checkout");
  if (!dialog) return;
  var T = window.WoooshT;
  var PLANS = {
    monthly: { fr: "Wooosh · Mensuel", en: "Wooosh · Monthly", priceFr: "4,99 € / mois", priceEn: "€4.99 / month", payFr: "Payer 4,99 € (démo)", payEn: "Pay €4.99 (demo)" },
    yearly: { fr: "Wooosh · Annuel", en: "Wooosh · Yearly", priceFr: "39,99 € / an", priceEn: "€39.99 / year", payFr: "Payer 39,99 € (démo)", payEn: "Pay €39.99 (demo)" }
  };
  var plan = "yearly", order = null;
  var form = dialog.querySelector(".checkout-form");
  var email = dialog.querySelector(".checkout-email");
  var emailError = dialog.querySelector(".field-error");

  function step(name) {
    dialog.querySelectorAll(".checkout-step").forEach(function (s) { s.hidden = s.getAttribute("data-step") !== name; });
  }

  function render() {
    var p = PLANS[plan];
    dialog.querySelector(".checkout-plan").textContent = T(p.fr, p.en);
    dialog.querySelector(".checkout-price").textContent = T(p.priceFr, p.priceEn);
    dialog.querySelector(".checkout-pay").textContent = T(p.payFr, p.payEn);
    if (order) {
      dialog.querySelector(".key-value").textContent = order.key;
      dialog.querySelector(".checkout-sent").textContent = T(
        "Elle serait aussi envoyée par e-mail à " + order.email + " (démonstration : aucun e-mail n'est envoyé).",
        "It would also be emailed to " + order.email + " (demo: no email is sent).");
      dialog.querySelector(".key-exp").textContent = T(
        "Valable jusqu'au " + window.WoooshDate(order.expires) + " inclus.",
        "Valid until " + window.WoooshDate(order.expires) + " inclusive.");
    }
  }
  document.addEventListener("wooosh-lang", render);

  document.querySelectorAll("[data-buy]").forEach(function (b) {
    b.addEventListener("click", function () {
      plan = b.getAttribute("data-buy");
      order = null;
      emailError.hidden = true;
      step("pay");
      render();
      dialog.showModal();
      // la fenêtre passe au-dessus de tout, y compris du curseur Wooosh : on remet le curseur normal
      hadCursor = document.documentElement.classList.contains("custom-cursor");
      document.documentElement.classList.remove("custom-cursor");
      email.focus();
    });
  });

  var hadCursor = false;
  dialog.addEventListener("close", function () { if (hadCursor) document.documentElement.classList.add("custom-cursor"); });
  dialog.querySelector("[data-close]").addEventListener("click", function () { dialog.close(); });
  // un clic à côté de la fenêtre la ferme
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var value = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { emailError.hidden = false; email.focus(); return; }
    emailError.hidden = true;
    step("wait");
    // petite attente pour imiter la banque, puis création de la clé
    setTimeout(function () {
      window.WoooshLicense.create(plan).then(function (key) { return window.WoooshLicense.parse(key); }).then(function (info) {
        order = { key: info.key, plan: plan, email: value, expires: info.expires };
        var list = window.WoooshOrders.load();
        list.unshift({ key: info.key, plan: plan, email: value, date: new Date().toISOString(), canceled: false });
        window.WoooshOrders.save(list.slice(0, 20));
        render();
        step("done");
      });
    }, 1400);
  });

  var copy = dialog.querySelector(".key-copy");
  copy.addEventListener("click", function () {
    var text = dialog.querySelector(".key-value").textContent;
    var done = function () {
      copy.textContent = T("Copiée ✓", "Copied ✓");
      setTimeout(function () { copy.textContent = T("Copier", "Copy"); }, 1600);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { });
  });
})();
