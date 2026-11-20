# Psalmodia — sauvegarde et remise en ligne

Ce document explique ce que contient la sauvegarde, et comment remettre l'appli en ligne
à partir de zéro (si GitHub disparaît, si le compte est perdu, ou pour confier l'appli à quelqu'un).

## 1. Comment est faite l'appli

L'appli est un site web (une « PWA » qu'on installe sur l'iPhone), en deux parties :

| Partie | Dépôt GitHub | Contenu | Adresse en ligne |
|---|---|---|---|
| L'appli elle-même | `psalmodia` | `index.html` (tout le code, tous les textes copte/arabe/français, les traductions, les titres, les minutages mot par mot), `sw.js` (fonctionnement hors connexion), `manifest.webmanifest` (icône et nom sur l'écran d'accueil), `icons/`, `chantres/` (photos des chantres), `evangiles/` (images) | https://d-water-law78.github.io/psalmodia/ |
| Les audios | `psalmodia-audio` | environ 420 fichiers `.m4a` (≈ 5 Go), `liste.json` (liste des audios et leur taille) | https://d-water-law78.github.io/psalmodia-audio/ |

Les deux sont publiés gratuitement par **GitHub Pages** (Réglages du dépôt → Pages → « Deploy from a branch » → `main` / dossier racine).

## 2. Ce que contient la sauvegarde (Google Drive → « Sauvegarde Psalmodia »)

| Dossier / fichier | Contenu | Mis à jour |
|---|---|---|
| `Textes (versions)/` | une copie complète de l'appli (`.zip`) à chaque mise à jour, les 100 dernières | automatiquement, toutes les 15 min si changement |
| `Autres branches/` | les travaux pas encore publiés (branches GitHub autres que `main`) | automatiquement |
| `Audios/` | tous les fichiers du dépôt des audios, à l'identique | automatiquement |
| `psalmodia-historique-complet-AAAA-MM-JJ.bundle` | tout l'historique des modifications, toutes branches, depuis la première version (23/10/2026) | à refaire de temps en temps (demander à Claude) |
| `derniere-sauvegarde.txt` | où en est la sauvegarde | à chaque vérification |
| `etat-sauvegarde.json` | mémoire du script (ne pas toucher) | — |
| `Code de la sauvegarde automatique` | le script qui fait tout ça (à coller dans script.google.com) | — |

## 3. Remettre l'appli en ligne

### Méthode simple (sans rien installer)
1. Créer un compte GitHub (ou utiliser celui de la personne qui reprend l'appli).
2. Créer un dépôt **public** `psalmodia`. Bouton « uploading an existing file » : y déposer le contenu
   du `.zip` le plus récent de `Textes (versions)` (décompressé : `index.html`, `sw.js`, `manifest.webmanifest`,
   `.nojekyll`, et les dossiers `icons`, `chantres`, `evangiles`).
3. Créer un dépôt **public** `psalmodia-audio` et y déposer tout le contenu du dossier `Audios`.
   ⚠️ Par le site web, GitHub n'accepte que 100 fichiers à la fois et 25 Mo par fichier. Les quelques gros
   fichiers (messes entières, jusqu'à 52 Mo) doivent passer par GitHub Desktop ou la ligne de commande
   (limite 100 Mo par fichier).
4. Dans chaque dépôt : Settings → Pages → Source « Deploy from a branch » → `main` → `/ (root)` → Save.
5. **Si le nom du compte GitHub n'est plus `D-Water-Law78`** : dans `index.html`, remplacer partout
   `https://d-water-law78.github.io/psalmodia-audio` par la nouvelle adresse des audios
   (`https://<nouveau-compte>.github.io/psalmodia-audio`). Sinon l'appli s'affiche mais les audios ne se lisent pas.

### Méthode complète (avec tout l'historique)
Sur un ordinateur avec `git` :
```
git clone psalmodia-historique-complet-AAAA-MM-JJ.bundle psalmodia
cd psalmodia
git remote set-url origin https://github.com/<compte>/psalmodia.git
git push origin --all
```
Puis activer GitHub Pages comme ci-dessus.

N'importe quel autre hébergeur de site statique fonctionne aussi (Netlify, Cloudflare Pages…),
à condition de mettre à jour l'adresse des audios (étape 5).

## 4. Ce qui n'est PAS dans la sauvegarde

- **Données personnelles de chaque iPhone** : favoris, playlists, réglages, thème, minutages faits sur le
  téléphone et pas encore envoyés, audios importés à la main. Ils restent dans le téléphone.
- **Les scripts de calage des Hazaat** (`tools/hazaat_caler.py`, `hazaat_export.py`, `hazaat_injecter.py`) :
  ils n'ont jamais été enregistrés sur GitHub. Leur résultat est bien dans `index.html`, mais les scripts
  eux-mêmes n'existent plus.
- **Les statistiques de visites** (compte GoatCounter `psalmodia.goatcounter.com`) : elles sont chez GoatCounter.
- **Les conversations avec Claude** (textes collés, explications) : elles restent dans claude.ai.
  Pour en garder une copie : claude.ai → Paramètres → Confidentialité → Exporter les données.
- **Les polices d'écriture** (Marcellus, Noto Naskh Arabic) sont chargées depuis Google Fonts sur Internet.
