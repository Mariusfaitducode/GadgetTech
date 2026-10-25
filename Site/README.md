# Site – proposition de refonte

Une page produit pour Métronome, proposée par [Sur Le Radar](https://surleradar.com).
Démo en ligne : https://metronome-surleradar.vercel.app

Ce dossier n'est qu'une proposition, à reprendre, modifier ou ignorer librement.
Il ne touche à rien d'autre dans le dépôt.

## Ce qu'il contient

- Une séquence d'ouverture où l'objet, reconstruit en 3D aux cotes des STL
  (130 × 100 × 35 mm), se tourne vers le visiteur jusqu'à ce que l'écran
  remplisse la page. L'écran affiche l'heure en direct et fait le flash de
  rafraîchissement d'un vrai e-ink à chaque minute.
- Un calculateur du temps perdu sur le quai (réglé sur le calcul de la vidéo).
- Un simulateur : station, temps de marche, l'écran fait le calcul.
- Une vue éclatée des six pièces, pilotée au défilement.
- Le guide de montage, aligné sur le README du dépôt : QR codes d'onboarding,
  `HAVE_SNI` dans wolfSSL, partition « Minimal SPIFFS ».
- Un schéma de câblage interactif.
- Une liste d'attente « Je le veux tout fait », pour mesurer la demande.
  **Formulaire de démonstration : il n'envoie rien.** Il faut le brancher
  (Formspree, Tally, Supabase, un webhook…) avant de le mettre en ligne.

Les liens affiliés Amazon du site actuel sont conservés tels quels.

## Lancer en local

Pas de build, pas de dépendance : HTML, CSS et JavaScript, three.js chargé depuis
jsDelivr.

```sh
cd Site
python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000.

## Organisation

```
index.html        la page
styles.css        styles
js/screen.js      horaires simulés + dessin de l'écran 400 × 300 (partagé)
js/scene.js       objet 3D (three.js), scène d'ouverture, vue éclatée
js/app.js         interactions : défilement, simulateur, câblage, formulaire
assets/           photos des composants, STL, image de partage
```

## À savoir

- Les horaires affichés sur la page sont simulés : pas d'appel à PRIM depuis le
  navigateur (il faudrait exposer une clé).
- `og:image` pointe vers le domaine de la démo : à changer pour
  `metronome.aywen.fr` en cas de reprise.
- Le pied de page indique « refonte non officielle, Sur Le Radar » : à retirer
  ou adapter si vous reprenez le site.
