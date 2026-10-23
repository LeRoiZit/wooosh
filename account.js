// Page « Mon abonnement » (DÉMONSTRATION) : lit une clé d'accès et affiche la formule, le temps restant
// et un bouton Résilier. La résiliation est gardée dans ce navigateur : comme dans la vraie vie, la clé
// reste valable jusqu'à la fin de la période payée, elle ne sera simplement pas renouvelée.
(function () {
  var form = document.querySelector(".account-form");
  if (!form) return;
  var T = window.WoooshT, D = window.WoooshDate, Orders = window.WoooshOrders;
  var input = form.querySelector(".account-key");
  var error = document.querySelector(".account-error");
  var card = document.querySelector(".sub-card");
  var list = document.querySelector(".order-list");
  var current = null; // { key, plan, expires, daysLeft }

  function canceled(key) {
    return Orders.load().some(function (o) { return o.key === key && o.canceled; });
  }

  function renderCard() {
    if (!current) { card.hidden = true; return; }
    var period = current.plan === "yearly" ? 365 : 30;
    var start = new Date(current.expires); start.setDate(start.getDate() - period + 1);
    var off = canceled(current.key), expired = current.daysLeft === 0;
    card.hidden = false;
    card.querySelector(".sub-plan").textContent = current.plan === "yearly"
      ? T("Annuel · 39,99 € / an", "Yearly · €39.99 / year") : T("Mensuel · 4,99 € / mois", "Monthly · €4.99 / month");
    card.querySelector(".sub-days").innerHTML = current.daysLeft + "<span> " +
      (current.daysLeft > 1 ? T("jours restants", "days left") : T("jour restant", "day left")) + "</span>";
    var badge = card.querySelector(".sub-badge");
    badge.textContent = expired ? T("Expiré", "Expired") : off ? T("Résilié", "Canceled") : T("Actif", "Active");
    badge.className = "sub-badge" + (expired || off ? "" : " is-live");
    card.querySelector(".sub-bar span").style.width = Math.max(2, current.daysLeft / period * 100) + "%";
    card.querySelector(".sub-start").textContent = T("Début : ", "Start: ") + D(start);
    card.querySelector(".sub-end").textContent = T("Fin : ", "End: ") + D(current.expires);
    card.querySelector(".sub-key").textContent = T("Clé : ", "Key: ") + current.key;
    card.querySelector(".sub-message").textContent = expired
      ? T("Cet abonnement est terminé. Choisissez une formule pour obtenir une nouvelle clé.", "This subscription has ended. Pick a plan to get a new key.")
      : off
        ? T("Abonnement résilié : Wooosh reste utilisable jusqu'au " + D(current.expires) + ", puis il ne sera pas renouvelé.",
            "Subscription canceled: Wooosh stays usable until " + D(current.expires) + ", then it won't renew.")
        : T("Renouvellement automatique le " + D(new Date(current.expires.getTime() + 86400000)) + ".",
            "Renews automatically on " + D(new Date(current.expires.getTime() + 86400000)) + ".");
    var btn = card.querySelector(".sub-cancel");
    btn.hidden = expired;
    btn.textContent = off ? T("Réactiver l'abonnement", "Resume subscription") : T("Résilier l'abonnement", "Cancel subscription");
  }

  function renderOrders() {
    var orders = Orders.load();
    list.innerHTML = "";
    if (!orders.length) {
      var li = document.createElement("li");
      li.className = "order-empty";
      li.textContent = T("Aucune commande sur ce navigateur pour l'instant.", "No order in this browser yet.");
      list.appendChild(li);
      return;
    }
    orders.forEach(function (o) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "order";
      var name = document.createElement("strong");
      name.textContent = o.plan === "yearly" ? T("Annuel", "Yearly") : T("Mensuel", "Monthly");
      var meta = document.createElement("span");
      meta.textContent = D(new Date(o.date)) + " · " + o.email;
      var key = document.createElement("code");
      key.textContent = o.key;
      b.append(name, meta, key);
      b.addEventListener("click", function () { input.value = o.key; show(); });
      li.appendChild(b);
      list.appendChild(li);
    });
  }

  function show() {
    window.WoooshLicense.parse(input.value).then(function (info) {
      current = info;
      error.hidden = !!info;
      if (!info) error.textContent = T("Cette clé n'est pas valide. Vérifiez-la ou copiez-la à nouveau.", "This key isn't valid. Check it or copy it again.");
      renderCard();
    });
  }

  form.addEventListener("submit", function (e) { e.preventDefault(); show(); });

  card.querySelector(".sub-cancel").addEventListener("click", function () {
    if (!current) return;
    var orders = Orders.load(), found = false;
    orders.forEach(function (o) { if (o.key === current.key) { o.canceled = !o.canceled; found = true; } });
    if (!found) orders.unshift({ key: current.key, plan: current.plan, email: "—", date: new Date().toISOString(), canceled: true });
    Orders.save(orders);
    renderCard();
    renderOrders();
  });

  document.addEventListener("wooosh-lang", function () { renderCard(); renderOrders(); });
  renderOrders();
})();
