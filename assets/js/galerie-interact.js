/**
 * Rotary Club du François — Galerie du club Interact La Yole.
 *
 * Le club filleul a sa propre galerie, sur sa propre page. Techniquement
 * c'est la même table qu'au Rotary, filtrée sur `origine=interact` : une
 * seule administration à tenir, deux affichages séparés.
 *
 * Ce script est délibérément indépendant de `gallery.js`, qui sert la page
 * Galerie du Rotary avec sa visionneuse, ses filtres par exercice et ses
 * albums. Ici, une grille et un agrandissement au clic suffisent. Réutiliser
 * l'autre aurait imposé de charger sa feuille de style et ses réglages sur
 * une page qui n'en a pas besoin.
 *
 * Si le serveur ne répond pas, le texte déjà écrit dans la page reste en
 * place : aucune section vide, aucun message d'erreur au visiteur.
 */
(function () {
  "use strict";

  var socle = document.querySelector("[data-galerie-interact]");
  if (!socle || !window.RC || !window.RC.api) return;

  var vide = document.getElementById("galerie-interact-vide");
  var chemin = socle.getAttribute("data-source") || "/api/public/galerie?origine=interact";

  function echapper(valeur) {
    return String(valeur == null ? "" : valeur)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /** Légende d'une photo : le titre, à défaut l'événement, à défaut rien. */
  function legende(photo) {
    return (photo.titre || photo.evenement || "").trim();
  }

  function dessiner(photos) {
    var grille = document.createElement("div");
    grille.className = "gi-grille";

    photos.forEach(function (photo, rang) {
      var texte = legende(photo);
      var vignette = document.createElement("button");
      vignette.type = "button";
      vignette.className = "gi-vignette";
      vignette.setAttribute("data-rang", String(rang));
      // Le texte alternatif décrit la photo pour qui ne la voit pas ; sans
      // légende, on dit au moins de quoi il s'agit plutôt que rien.
      vignette.innerHTML =
        '<img src="' + echapper(photo.image_url) + '" loading="lazy" decoding="async"' +
        ' alt="' + echapper(texte || "Action du club Interact La Yole") + '">' +
        (texte ? '<span class="gi-legende">' + echapper(texte) + "</span>" : "");
      grille.appendChild(vignette);
    });

    socle.innerHTML = "";
    socle.appendChild(grille);
    brancherAgrandissement(photos);
  }

  /* ---------------------------------------------------- agrandissement */

  function brancherAgrandissement(photos) {
    var voile = null;

    function fermer() {
      if (!voile) return;
      voile.remove();
      voile = null;
      document.body.style.overflow = "";
      document.removeEventListener("keydown", auClavier);
    }

    function auClavier(e) {
      if (e.key === "Escape" || e.key === "Esc") fermer();
    }

    function ouvrir(rang) {
      var photo = photos[rang];
      if (!photo) return;
      fermer();

      voile = document.createElement("div");
      voile.className = "gi-voile";
      voile.setAttribute("role", "dialog");
      voile.setAttribute("aria-modal", "true");
      voile.setAttribute("aria-label", legende(photo) || "Photo agrandie");
      voile.innerHTML =
        '<button type="button" class="gi-fermer" aria-label="Fermer">Fermer</button>' +
        '<figure class="gi-cadre">' +
        '<img src="' + echapper(photo.image_url) + '" alt="' +
        echapper(legende(photo) || "Action du club Interact La Yole") + '">' +
        (legende(photo)
          ? "<figcaption>" + echapper(legende(photo)) + "</figcaption>" : "") +
        "</figure>";

      document.body.appendChild(voile);
      // Le fond ne défile plus derrière la photo : sur téléphone, c'est ce
      // qui distingue une visionneuse d'un empilement confus.
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", auClavier);

      voile.addEventListener("click", function (e) {
        if (e.target === voile || e.target.classList.contains("gi-fermer")) fermer();
      });
      var bouton = voile.querySelector(".gi-fermer");
      if (bouton) bouton.focus();
    }

    socle.addEventListener("click", function (e) {
      var vignette = e.target.closest ? e.target.closest(".gi-vignette") : null;
      if (!vignette) return;
      ouvrir(parseInt(vignette.getAttribute("data-rang"), 10));
    });
  }

  /* --------------------------------------------------------- chargement */

  window.RC.api(chemin).then(function (photos) {
    // Serveur injoignable ou aucune photo : le texte de la page reste.
    if (!Array.isArray(photos) || !photos.length) return;
    if (vide) vide.remove();
    dessiner(photos);
  });
})();
