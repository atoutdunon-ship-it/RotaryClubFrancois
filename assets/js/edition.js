/**
 * EDITO en ligne — modification du site depuis le site lui-même.
 *
 * L'Administrateur ouvre une séance depuis l'espace membre (Administration →
 * Textes, photos et liens → « Ouvrir le site en mode édition »). Le site
 * public s'ouvre alors avec un jeton dans le fragment de l'URL. Un bandeau
 * apparaît, chaque zone modifiable se signale, et le clic ouvre l'éditeur
 * EDITO sur place.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Ce fichier ne coûte rien aux visiteurs
 * ─────────────────────────────────────────────────────────────────────────
 * Sans jeton en mémoire de session, le script s'arrête à sa première ligne :
 * aucune requête réseau, aucun style chargé, aucun élément ajouté. La barre
 * d'outils et sa feuille de style ne sont téléchargées qu'une fois la séance
 * ouverte et validée par le serveur.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Sécurité
 * ─────────────────────────────────────────────────────────────────────────
 * Le jeton est conservé en `sessionStorage` : il disparaît à la fermeture de
 * l'onglet, et n'est pas partagé avec les autres onglets. Il n'est jamais
 * inscrit dans l'URL visible — le fragment est effacé dès sa lecture. Rien
 * ici ne fait autorité : le serveur revérifie signature, expiration, statut
 * du compte et rôle à chaque écriture, et repasse tout texte reçu par sa
 * liste blanche.
 */
(function () {
  "use strict";

  var CLE_STOCKAGE = "edito_jeton";

  /* Lecture du jeton : fragment d'URL en priorité, puis mémoire de session. */
  function lireJeton() {
    var trouve = (window.location.hash || "").match(/[#&]edito=([^&]+)/);
    if (trouve) {
      var jeton = decodeURIComponent(trouve[1]);
      try { sessionStorage.setItem(CLE_STOCKAGE, jeton); } catch (e) { /* mode privé */ }
      // On efface le fragment sans recharger la page ni laisser d'entrée
      // dans l'historique de navigation.
      history.replaceState(null, "", window.location.pathname + window.location.search);
      return jeton;
    }
    try { return sessionStorage.getItem(CLE_STOCKAGE); } catch (e) { return null; }
  }

  var jeton = lireJeton();
  if (!jeton) return;   // visiteur ordinaire : le script s'arrête ici

  var RC = window.RC;
  if (!RC || RC.baseApi() === null) return;
  var BASE = RC.baseApi();

  function oublierJeton() {
    try { sessionStorage.removeItem(CLE_STOCKAGE); } catch (e) { /* rien */ }
  }

  function appeler(chemin, options) {
    var parametres = options || {};
    parametres.headers = parametres.headers || {};
    parametres.headers.Authorization = "Bearer " + jeton;
    parametres.credentials = "omit";   // aucune autorité ambiante
    return fetch(BASE + chemin, parametres).then(function (r) {
      return r.json().catch(function () { return null; });
    });
  }

  /* --------------------------------------------------------------------- */
  /* Chargement à la demande de la barre d'outils EDITO                     */
  /* --------------------------------------------------------------------- */

  function charger(balise, attributs) {
    return new Promise(function (resoudre, rejeter) {
      var el = document.createElement(balise);
      Object.keys(attributs).forEach(function (k) { el.setAttribute(k, attributs[k]); });
      el.onload = resoudre;
      el.onerror = rejeter;
      document.head.appendChild(el);
    });
  }

  function chargerEdito(palette) {
    window.RC_EDITEUR = palette;
    return Promise.all([
      charger("link", { rel: "stylesheet", href: "assets/css/editeur.css" }),
      charger("script", { src: "assets/js/editeur.js" })
    ]);
  }

  /* --------------------------------------------------------------------- */
  /* Démarrage                                                              */
  /* --------------------------------------------------------------------- */

  appeler("/api/edition/session").then(function (etat) {
    if (!etat || !etat.peut_editer) {
      oublierJeton();
      return;
    }
    chargerEdito(etat.palette)
      .then(function () { activer(etat); })
      .catch(function () {
        alert("Le mode édition n'a pas pu se charger. Rechargez la page.");
      });
  });

  /* --------------------------------------------------------------------- */
  /* Mode édition                                                           */
  /* --------------------------------------------------------------------- */

  var CHAMPS_COURTS = { eyebrow: "Sur-titre", title: "Titre" };
  var page = document.body.getAttribute("data-page") || "";
  var actif = false;

  function activer(etat) {
    charger("link", { rel: "stylesheet", href: "assets/css/edition.css" });
    construireBandeau(etat.nom);
    basculer(true);
  }

  function construireBandeau(nom) {
    var bandeau = document.createElement("div");
    bandeau.className = "edito-bandeau";
    bandeau.innerHTML =
      '<span class="edito-bandeau__etat">Mode édition</span>' +
      '<span class="edito-bandeau__nom"></span>' +
      '<span class="edito-bandeau__aide">Cliquez sur un texte ou une photo pour le modifier.</span>' +
      '<span class="edito-bandeau__actions">' +
      '<button type="button" class="edito-btn" data-edito="pause">Suspendre</button>' +
      '<button type="button" class="edito-btn edito-btn--sortie" data-edito="quitter">Quitter</button>' +
      "</span>";
    bandeau.querySelector(".edito-bandeau__nom").textContent = nom || "";
    document.body.appendChild(bandeau);
    document.body.classList.add("edito-decale");

    bandeau.querySelector('[data-edito="pause"]').addEventListener("click", function () {
      basculer(!actif);
      this.textContent = actif ? "Suspendre" : "Reprendre";
    });

    bandeau.querySelector('[data-edito="quitter"]').addEventListener("click", function () {
      oublierJeton();
      window.location.reload();
    });
  }

  function basculer(nouvelEtat) {
    actif = nouvelEtat;
    document.body.classList.toggle("edito-actif", actif);
    if (actif) marquerLesZones();
  }

  /* Le site est trilingue. Le contenu géré depuis l'administration est la
     version française ; l'anglais et l'espagnol viennent de i18n.js, par
     dessus. Modifier une zone traduite alors que la page est affichée en
     anglais reviendrait donc à écrire de l'anglais dans le champ français,
     sans que rien ne le signale. On refuse plutôt que de laisser faire. */
  function langueFrancaise() {
    return (document.documentElement.lang || "fr").slice(0, 2) === "fr";
  }

  function estTraduite(el) {
    return el.hasAttribute("data-i18n");
  }

  /* Chaque élément porteur d'un data-block devient cliquable. */
  function marquerLesZones() {
    document.querySelectorAll("[data-block]").forEach(function (el) {
      if (el.dataset.editoPret) return;

      var parties = (el.getAttribute("data-block") || "").split(":");
      var cle = parties[0];
      var champ = parties[1];
      if (!cle || !champ) return;

      el.dataset.editoPret = "1";
      el.dataset.editoCle = cle;
      el.dataset.editoChamp = champ;

      var verrouillee = estTraduite(el) && !langueFrancaise();
      el.classList.add(verrouillee ? "edito-zone--verrouillee" : "edito-zone");
      el.setAttribute(
        "title",
        verrouillee
          ? "Repassez le site en français pour modifier ce texte"
          : "Modifier — " + (CHAMPS_COURTS[champ] || champ)
      );

      if (verrouillee) {
        el.addEventListener("click", function (e) {
          if (!actif) return;
          e.preventDefault();
          signaler(
            "Ce texte existe en trois langues. Repassez le site en français pour le modifier.",
            true
          );
        });
      } else if (champ === "image") {
        preparerImage(el);
      } else {
        el.addEventListener("click", function (e) {
          if (!actif) return;
          e.preventDefault();
          e.stopPropagation();
          ouvrirEditeur(el, cle, champ);
        });
      }
    });
  }

  /* --------------------------------------------------------------------- */
  /* Édition d'un texte                                                     */
  /* --------------------------------------------------------------------- */

  function ouvrirEditeur(el, cle, champ) {
    if (document.querySelector(".edito-panneau")) return;   // un seul à la fois

    var estLien = champ === "link1" || champ === "link2";
    var estRiche = champ === "body";

    var panneau = document.createElement("div");
    panneau.className = "edito-panneau";

    var titre = document.createElement("div");
    titre.className = "edito-panneau__titre";
    titre.textContent = etiquette(cle, champ);
    panneau.appendChild(titre);

    var saisie, saisieUrl;

    if (estRiche) {
      saisie = document.createElement("textarea");
      saisie.setAttribute("data-editeur", "");
      saisie.rows = 6;
      saisie.value = el.innerHTML.trim();
      panneau.appendChild(saisie);
    } else if (estLien) {
      saisie = champSimple(panneau, "Texte du bouton", el.textContent.trim());
      saisieUrl = champSimple(panneau, "Adresse", el.getAttribute("href") || "");
    } else {
      saisie = champSimple(panneau, CHAMPS_COURTS[champ] || champ, el.textContent.trim());
    }

    var actions = document.createElement("div");
    actions.className = "edito-panneau__actions";
    var enregistrer = bouton(actions, "Enregistrer", "edito-btn edito-btn--valider");
    var annuler = bouton(actions, "Annuler", "edito-btn");
    var retour = document.createElement("span");
    retour.className = "edito-panneau__retour";
    retour.setAttribute("role", "status");
    actions.appendChild(retour);
    panneau.appendChild(actions);

    el.classList.add("edito-zone--en-cours");
    el.parentNode.insertBefore(panneau, el.nextSibling);

    if (estRiche && window.rcEditeur) window.rcEditeur.demarrer();
    (panneau.querySelector(".editeur__zone") || saisie).focus();

    function fermer() {
      el.classList.remove("edito-zone--en-cours");
      panneau.remove();
    }

    annuler.addEventListener("click", fermer);

    document.addEventListener("keydown", function echap(e) {
      if (e.key === "Escape" && document.body.contains(panneau)) {
        document.removeEventListener("keydown", echap);
        fermer();
      }
    });

    enregistrer.addEventListener("click", function () {
      enregistrer.disabled = true;
      retour.textContent = "Enregistrement…";
      retour.className = "edito-panneau__retour";

      var travaux = [];
      if (estLien) {
        travaux.push(ecrire(cle, champ === "link1" ? "link_label" : "link2_label", saisie.value));
        travaux.push(ecrire(cle, champ === "link1" ? "link_url" : "link2_url", saisieUrl.value));
      } else {
        travaux.push(ecrire(cle, estRiche ? "body" : champ, saisie.value));
      }

      Promise.all(travaux)
        .then(function (reponses) {
          var echec = reponses.find(function (r) { return !r || !r.ok; });
          if (echec) {
            retour.textContent = (echec && echec.erreur) || "Enregistrement refusé.";
            retour.className = "edito-panneau__retour edito-panneau__retour--erreur";
            enregistrer.disabled = false;
            return;
          }
          appliquer(el, champ, estRiche, reponses, saisie, saisieUrl);
          fermer();
          signaler("Modification enregistrée.");
        })
        .catch(function () {
          retour.textContent = "Serveur injoignable. Rien n'a été modifié.";
          retour.className = "edito-panneau__retour edito-panneau__retour--erreur";
          enregistrer.disabled = false;
        });
    });
  }

  /* Applique le résultat dans la page, sans rechargement : le rédacteur voit
     immédiatement ce que verra le visiteur. */
  function appliquer(el, champ, estRiche, reponses, saisie, saisieUrl) {
    if (champ === "link1" || champ === "link2") {
      el.textContent = saisie.value;
      el.setAttribute("href", saisieUrl.value);
    } else if (estRiche) {
      el.innerHTML = reponses[0].rendu;
      el.classList.add("texte-riche");
    } else {
      el.textContent = reponses[0].rendu;
    }
  }

  function ecrire(cle, champ, valeur) {
    return appeler("/api/edition/bloc", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page: page, cle: cle, champ: champ, valeur: valeur })
    });
  }

  /* --------------------------------------------------------------------- */
  /* Remplacement d'une photo                                               */
  /* --------------------------------------------------------------------- */

  function preparerImage(el) {
    var cle = el.dataset.editoCle;
    el.classList.add("edito-zone--image");
    el.setAttribute("title", "Cliquez ou déposez une image pour la remplacer");

    var choix = document.createElement("input");
    choix.type = "file";
    choix.accept = "image/png,image/jpeg,image/webp,image/gif";
    choix.className = "edito-fichier";
    el.parentNode.insertBefore(choix, el.nextSibling);

    el.addEventListener("click", function (e) {
      if (!actif) return;
      e.preventDefault();
      choix.click();
    });

    choix.addEventListener("change", function () {
      if (choix.files && choix.files[0]) envoyerImage(el, cle, choix.files[0]);
      choix.value = "";
    });

    ["dragenter", "dragover"].forEach(function (nom) {
      el.addEventListener(nom, function (e) {
        if (!actif) return;
        e.preventDefault();
        el.classList.add("edito-zone--survol");
      });
    });
    ["dragleave", "drop"].forEach(function (nom) {
      el.addEventListener(nom, function () { el.classList.remove("edito-zone--survol"); });
    });
    el.addEventListener("drop", function (e) {
      if (!actif) return;
      e.preventDefault();
      var fichier = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (fichier) envoyerImage(el, cle, fichier);
    });
  }

  function envoyerImage(el, cle, fichier) {
    if (fichier.size > 8 * 1024 * 1024) {
      signaler("Image trop lourde (8 Mo maximum).", true);
      return;
    }
    el.classList.add("edito-zone--envoi");

    var donnees = new FormData();
    donnees.append("page", page);
    donnees.append("cle", cle);
    donnees.append("image", fichier);

    appeler("/api/edition/bloc/image", { method: "POST", body: donnees })
      .then(function (r) {
        if (!r || !r.ok) {
          signaler((r && r.erreur) || "Envoi refusé.", true);
          return;
        }
        el.src = r.url;
        el.style.display = "";
        signaler("Photo remplacée.");
      })
      .catch(function () { signaler("Serveur injoignable.", true); })
      .finally(function () { el.classList.remove("edito-zone--envoi"); });
  }

  /* --------------------------------------------------------------------- */
  /* Utilitaires d'interface                                                */
  /* --------------------------------------------------------------------- */

  function champSimple(parent, libelle, valeur) {
    var lot = document.createElement("label");
    lot.className = "edito-champ";
    var texte = document.createElement("span");
    texte.textContent = libelle;
    var entree = document.createElement("input");
    entree.type = "text";
    entree.value = valeur || "";
    lot.appendChild(texte);
    lot.appendChild(entree);
    parent.appendChild(lot);
    return entree;
  }

  function bouton(parent, libelle, classe) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = classe;
    b.textContent = libelle;
    parent.appendChild(b);
    return b;
  }

  function etiquette(cle, champ) {
    var noms = {
      eyebrow: "Sur-titre", title: "Titre", body: "Texte",
      link1: "Bouton principal", link2: "Bouton secondaire"
    };
    return (noms[champ] || champ) + " — zone « " + cle + " »";
  }

  var minuteur;
  function signaler(message, erreur) {
    var zone = document.querySelector(".edito-message");
    if (!zone) {
      zone = document.createElement("div");
      zone.className = "edito-message";
      zone.setAttribute("role", "status");
      document.body.appendChild(zone);
    }
    zone.textContent = message;
    zone.classList.toggle("edito-message--erreur", !!erreur);
    zone.classList.add("edito-message--visible");
    clearTimeout(minuteur);
    minuteur = setTimeout(function () {
      zone.classList.remove("edito-message--visible");
    }, 3200);
  }
})();
