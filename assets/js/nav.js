/**
 * Rotary Club du François — Bandeau de navigation.
 *
 * Deux comportements selon la largeur, un seul balisage.
 *
 * **Au-dessus de 860 px** — barre horizontale de six rubriques. Deux
 * d'entre elles ouvrent un tiroir : au survol (c'est le CSS qui s'en
 * charge, donc sans attendre le chargement de ce script) et au clavier.
 *
 * **En dessous** — la barre se replie derrière le bouton hamburger et
 * devient une colonne ; les tiroirs s'y insèrent au lieu de flotter.
 *
 * Le survol est volontairement laissé au CSS et non repris ici : un menu
 * qui n'ouvre qu'une fois le JavaScript exécuté paraît cassé pendant la
 * seconde qui précède. Ce script n'ajoute que ce que le CSS ne sait pas
 * faire — le clavier, le clic, et la fermeture.
 */
(function () {
  "use strict";

  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("site-nav");
  if (!nav) return;

  var POINT_DE_RUPTURE = window.matchMedia("(min-width: 861px)");

  function surBureau() {
    return POINT_DE_RUPTURE.matches;
  }

  /* ------------------------------------------------ menu replié (mobile) */

  function ouvrirLeMenu() {
    nav.classList.add("is-open");
    if (!toggle) return;
    toggle.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Fermer le menu");
  }

  function fermerLeMenu() {
    nav.classList.remove("is-open");
    fermerLesTiroirs();
    if (!toggle) return;
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Ouvrir le menu");
  }

  if (toggle) {
    toggle.addEventListener("click", function () {
      if (nav.classList.contains("is-open")) {
        fermerLeMenu();
      } else {
        ouvrirLeMenu();
      }
    });
  }

  /* ------------------------------------------------------------ tiroirs */

  var declencheurs = [].slice.call(nav.querySelectorAll(".nav__declencheur"));

  function tiroirDe(declencheur) {
    var identifiant = declencheur.getAttribute("aria-controls");
    return identifiant ? document.getElementById(identifiant) : null;
  }

  function fermerLesTiroirs(sauf) {
    declencheurs.forEach(function (declencheur) {
      if (declencheur === sauf) return;
      var tiroir = tiroirDe(declencheur);
      if (tiroir) tiroir.classList.remove("is-open");
      declencheur.setAttribute("aria-expanded", "false");
    });
  }

  function basculer(declencheur) {
    var tiroir = tiroirDe(declencheur);
    if (!tiroir) return;
    var ouvert = tiroir.classList.contains("is-open");
    // Un seul tiroir ouvert à la fois : deux panneaux superposés sur un
    // bandeau étroit se recouvriraient l'un l'autre.
    fermerLesTiroirs(declencheur);
    if (ouvert) {
      tiroir.classList.remove("is-open");
      declencheur.setAttribute("aria-expanded", "false");
    } else {
      tiroir.classList.add("is-open");
      declencheur.setAttribute("aria-expanded", "true");
    }
  }

  declencheurs.forEach(function (declencheur) {
    declencheur.addEventListener("click", function (e) {
      e.preventDefault();
      basculer(declencheur);
    });

    // Flèche bas : ouvrir et se poser sur la première entrée. C'est le
    // geste attendu d'un menu, et sans lui le tiroir reste inaccessible à
    // qui n'utilise pas de souris.
    declencheur.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowDown" && e.key !== "Down") return;
      e.preventDefault();
      var tiroir = tiroirDe(declencheur);
      if (!tiroir) return;
      if (!tiroir.classList.contains("is-open")) basculer(declencheur);
      var premier = tiroir.querySelector("a");
      if (premier) premier.focus();
    });
  });

  /* --------------------------------------------------------- fermetures */

  nav.addEventListener("click", function (e) {
    if (e.target.tagName === "A") fermerLeMenu();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" && e.key !== "Esc") return;
    // Rendre le focus au déclencheur : sans cela, fermer au clavier
    // renvoie le curseur en haut de page et l'on perd sa place.
    var ouvert = null;
    declencheurs.forEach(function (d) {
      var tiroir = tiroirDe(d);
      if (tiroir && tiroir.classList.contains("is-open")) ouvert = d;
    });
    fermerLeMenu();
    if (ouvert) ouvert.focus();
  });

  // Clic hors du bandeau : on referme, sinon un tiroir ouvert au clavier
  // resterait affiché en travers de la page.
  document.addEventListener("click", function (e) {
    if (nav.contains(e.target)) return;
    if (toggle && toggle.contains(e.target)) return;
    fermerLesTiroirs();
    if (!surBureau()) fermerLeMenu();
  });

  /* ------------------------------------------- rotation et redimension */

  function surChangementDeTaille(e) {
    // Passage au bureau : le CSS reprend la main, on efface tout état.
    if (e.matches) fermerLeMenu();
  }
  if (typeof POINT_DE_RUPTURE.addEventListener === "function") {
    POINT_DE_RUPTURE.addEventListener("change", surChangementDeTaille);
  } else if (typeof POINT_DE_RUPTURE.addListener === "function") {
    POINT_DE_RUPTURE.addListener(surChangementDeTaille); // Safari ancien
  }

  /* ------------------------------------------------------- page courante */

  // L'état actif est déjà écrit dans le HTML de chaque page. Ce second
  // passage couvre les cas que le fichier statique ne connaît pas : une
  // adresse sans nom de fichier (« /agenda » servi sans extension), ou une
  // page atteinte par un lien avec ancre.
  var fichier = (window.location.pathname.split("/").pop() || "index.html");
  if (fichier.indexOf(".") === -1) fichier += ".html";

  [].slice.call(nav.querySelectorAll("a")).forEach(function (lien) {
    var cible = (lien.getAttribute("href") || "").split("#")[0].split("?")[0];
    if (cible !== fichier) return;
    lien.classList.add("active");
    var rubrique = lien.closest ? lien.closest(".nav__rubrique") : null;
    if (!rubrique) return;
    var declencheur = rubrique.querySelector(".nav__declencheur");
    if (declencheur) declencheur.classList.add("active");
  });
})();
