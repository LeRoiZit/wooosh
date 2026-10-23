// Clés d'accès Wooosh (DÉMONSTRATION) : WOOO-XXXXX-XXXXX-XXXXX-XXXXX
// Même format et même secret que l'application (src/App/License.cs) : une clé créée ici est acceptée par Wooosh.
// Pour la vraie vente, c'est la plateforme de paiement qui fournira les clés ; ce fichier disparaîtra.
//
// 12 octets : [0] version + formule (1 = mensuel, 2 = annuel), [1-2] date de fin (jours depuis le 01/01/2026),
// [3-6] numéro aléatoire, [7-11] signature HMAC-SHA256 tronquée ; écrits en base 32 (Crockford).
window.WoooshLicense = (function () {
  var ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  var SECRET = "wooosh-demo-licence-2026";
  var EPOCH = Date.UTC(2026, 0, 1);
  var DAY = 86400000;

  function sign(bytes) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      .then(function (k) { return crypto.subtle.sign("HMAC", k, bytes.slice(0, 7)); })
      .then(function (s) { return new Uint8Array(s); });
  }

  function format(s) {
    return "WOOO-" + s.slice(0, 5) + "-" + s.slice(5, 10) + "-" + s.slice(10, 15) + "-" + s.slice(15, 20);
  }

  // Date du jour (fuseau de l'ordinateur) en jours depuis le 01/01/2026
  function todayDays() {
    var d = new Date();
    return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / DAY);
  }

  // plan : "monthly" (30 jours) ou "yearly" (365 jours)
  function create(plan) {
    var bytes = new Uint8Array(12);
    var days = todayDays() + (plan === "yearly" ? 365 : 30) - 1; // aujourd'hui compris
    bytes[0] = (1 << 4) | (plan === "yearly" ? 2 : 1);
    bytes[1] = days >> 8; bytes[2] = days & 255;
    crypto.getRandomValues(bytes.subarray(3, 7));
    return sign(bytes).then(function (sig) {
      bytes.set(sig.subarray(0, 5), 7);
      var out = "", bit = 0;
      for (var c = 0; c < 20; c++) {
        var v = 0;
        for (var b = 0; b < 5; b++, bit++) {
          var k = bit - 4;
          v = (v << 1) | (k >= 0 && (bytes[k >> 3] & (0x80 >> (k & 7))) ? 1 : 0);
        }
        out += ALPHABET[v];
      }
      return format(out);
    });
  }

  // Lit une clé : renvoie une promesse de { key, plan, expires (Date), daysLeft } ou null si invalide
  function parse(text) {
    var s = String(text || "").toUpperCase().replace(/[\s-]/g, "");
    if (s.indexOf("WOOO") === 0) s = s.slice(4);
    s = s.replace(/O/g, "0").replace(/[IL]/g, "1");
    if (s.length !== 20) return Promise.resolve(null);
    var bytes = new Uint8Array(12), bit = 0;
    for (var i = 0; i < 20; i++) {
      var v = ALPHABET.indexOf(s[i]);
      if (v < 0) return Promise.resolve(null);
      for (var b = 4; b >= 0; b--, bit++) {
        if (!((v >> b) & 1)) continue;
        if (bit < 4) return Promise.resolve(null);
        var k = bit - 4;
        bytes[k >> 3] |= 0x80 >> (k & 7);
      }
    }
    return sign(bytes).then(function (sig) {
      for (var i = 0; i < 5; i++) if (bytes[7 + i] !== sig[i]) return null;
      var plan = bytes[0] & 15;
      if (bytes[0] >> 4 !== 1 || (plan !== 1 && plan !== 2)) return null;
      var days = (bytes[1] << 8) | bytes[2];
      var e = new Date(EPOCH + days * DAY);
      return {
        key: format(s),
        plan: plan === 2 ? "yearly" : "monthly",
        expires: new Date(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()),
        daysLeft: Math.max(0, days - todayDays() + 1)
      };
    });
  }

  return { create: create, parse: parse };
})();
