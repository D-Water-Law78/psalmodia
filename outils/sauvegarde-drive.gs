/**
 * SAUVEGARDE AUTOMATIQUE DE PSALMODIA DANS GOOGLE DRIVE
 * -----------------------------------------------------
 * Toutes les 15 minutes, ce script regarde si l'appli a été mise à jour sur GitHub.
 *  - Textes (dépôt « psalmodia ») : à chaque mise à jour, une nouvelle copie complète
 *    (.zip) est ajoutée dans « Sauvegarde Psalmodia / Textes (versions) ».
 *    Les anciennes versions sont gardées (les 100 dernières).
 *    Les autres branches (travaux pas encore en ligne) vont dans « Autres branches ».
 *  - Audios (dépôt « psalmodia-audio ») : tous les fichiers sont copiés dans
 *    « Sauvegarde Psalmodia / Audios ». Seuls les fichiers nouveaux ou modifiés
 *    sont recopiés. Un fichier supprimé sur GitHub n'est JAMAIS supprimé du Drive.
 *    Les autres branches du dépôt audio : seuls les fichiers différents de main sont copiés.
 *    (Les dépôts psalmodia-audio2 à 8 sont des copies exactes de psalmodia-audio.)
 *  - Le fichier « derniere-sauvegarde.txt » indique où en est la sauvegarde.
 *
 * Mise en route : choisir la fonction « installer » en haut, cliquer sur « Exécuter »,
 * puis autoriser l'accès. C'est tout : ensuite tout se fait tout seul.
 */

const CONFIG = {
  proprietaire: 'D-Water-Law78',
  depotTextes: 'psalmodia',
  depotAudio: 'psalmodia-audio',
  branche: 'main',
  dossier: 'Sauvegarde Psalmodia',
  versionsAGarder: 100,
  minutesMax: 4.5,               // Google coupe un script après 6 minutes
  morceau: 16 * 1024 * 1024,     // téléchargement par morceaux de 16 Mo
  fuseau: 'Europe/Paris'
};

/* ============ À lancer une seule fois ============ */
function installer() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'sauvegarder') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sauvegarder').timeBased().everyMinutes(15).create();
  sauvegarder();
}

/* ============ Lancé automatiquement ============ */
function sauvegarder() {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(1000)) return;           // une sauvegarde est déjà en cours
  const debut = Date.now();
  const racine = dossier_(DriveApp.getRootFolder(), CONFIG.dossier);
  const etat = lireEtat_(racine);
  const notes = [];
  try {
    sauverTextes_(racine, etat, notes);
    ecrireEtat_(racine, etat);
    sauverAudio_(racine, etat, debut, notes);
  } catch (e) {
    notes.push('⚠️ Problème (nouvel essai dans 15 min) : ' + e.message);
  } finally {
    ecrireEtat_(racine, etat);
    ecrireRapport_(racine, etat, notes);
    verrou.releaseLock();
  }
}

/* ============ Textes ============ */
/* Toutes les branches sont sauvegardées : « main » (l'appli en ligne) dans « Textes (versions) »,
   les autres (travaux pas encore publiés) dans « Autres branches / <nom> ». */
function sauverTextes_(racine, etat, notes) {
  if (typeof etat.textes === 'string') etat.textes = { [CONFIG.branche]: etat.textes };
  etat.textes = etat.textes || {};
  const branches = branches_(CONFIG.depotTextes);
  for (const nom in branches) {
    const sha = branches[nom];
    if (etat.textes[nom] === sha) continue;
    const principale = nom === CONFIG.branche;
    const dossier = principale ? dossier_(racine, 'Textes (versions)')
      : dossier_(dossier_(racine, 'Autres branches'), nom.replace(/\//g, '_'));
    const zip = telecharger_(`https://codeload.github.com/${CONFIG.proprietaire}/${CONFIG.depotTextes}/zip/${sha}`).getBlob();
    zip.setName(`psalmodia-textes_${maintenant_('yyyy-MM-dd_HH\'h\'mm')}${principale ? '' : '_' + nom.replace(/\//g, '_')}_${sha.slice(0, 7)}.zip`);
    dossier.createFile(zip);
    etat.textes[nom] = sha;
    notes.push('Nouvelle version sauvegardée : ' + zip.getName());

    // On garde les N versions les plus récentes
    const fichiers = [];
    const it = dossier.getFiles();
    while (it.hasNext()) fichiers.push(it.next());
    fichiers.sort((a, b) => b.getDateCreated() - a.getDateCreated());
    fichiers.slice(principale ? CONFIG.versionsAGarder : 20).forEach(f => f.setTrashed(true));
  }
}

/* ============ Audios ============ */
function sauverAudio_(racine, etat, debut, notes) {
  const a = etat.audio;
  const toutes = branches_(CONFIG.depotAudio);
  const sha = toutes[CONFIG.branche];
  sauverBranchesAudio_(racine, etat, toutes, debut, notes);
  if (a.cible !== sha) {
    const r = UrlFetchApp.fetch(
      `https://api.github.com/repos/${CONFIG.proprietaire}/${CONFIG.depotAudio}/git/trees/${sha}?recursive=1`,
      { headers: entetesGithub_(), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) {
      notes.push('GitHub a demandé de patienter (liste des audios), nouvel essai dans 15 min.');
      return;
    }
    const arbre = JSON.parse(r.getContentText());
    if (arbre.truncated) throw new Error('liste des fichiers audio incomplète');
    a.liste = arbre.tree.filter(x => x.type === 'blob').map(x => ({ p: x.path, s: x.sha, t: x.size }));
    a.cible = sha;
  }

  const racineAudio = dossier_(racine, 'Audios');
  const restants = a.liste.filter(x => a.fait[x.p] !== x.s);
  let copies = 0;
  for (const f of restants) {
    if (Date.now() - debut > CONFIG.minutesMax * 60000) break;
    const morceaux = f.p.split('/');
    const nom = morceaux.pop();
    const dossier = morceaux.reduce((d, n) => dossier_(d, n), racineAudio);
    const url = `https://raw.githubusercontent.com/${CONFIG.proprietaire}/${CONFIG.depotAudio}/${a.cible}/` +
      f.p.split('/').map(encodeURIComponent).join('/');
    envoyer_(url, f.t, nom, dossier);
    a.fait[f.p] = f.s;
    copies++;
    if (copies % 5 === 0) ecrireEtat_(racine, etat);
  }
  if (copies) notes.push(`${copies} fichier(s) audio copié(s).`);
}

/* Branches du dépôt audio autres que « main » : on copie seulement les fichiers qui diffèrent de main,
   dans « Autres branches / audio_<nom> ». */
function sauverBranchesAudio_(racine, etat, toutes, debut, notes) {
  etat.branchesAudio = etat.branchesAudio || {};
  const principal = toutes[CONFIG.branche];
  for (const b in toutes) {
    if (b === CONFIG.branche || etat.branchesAudio[b] === toutes[b]) continue;
    if (Date.now() - debut > CONFIG.minutesMax * 60000) return;
    const r = UrlFetchApp.fetch(
      `https://api.github.com/repos/${CONFIG.proprietaire}/${CONFIG.depotAudio}/compare/${principal}...${toutes[b]}`,
      { headers: entetesGithub_(), muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) { notes.push('GitHub a demandé de patienter (branche audio ' + b + ').'); return; }
    const fichiers = (JSON.parse(r.getContentText()).files || []).filter(f => f.status !== 'removed');
    const base = dossier_(dossier_(racine, 'Autres branches'), 'audio_' + b.replace(/\//g, '_'));
    for (const f of fichiers) {
      const morceaux = f.filename.split('/');
      const nom = morceaux.pop();
      const dossier = morceaux.reduce((d, n) => dossier_(d, n), base);
      const url = `https://raw.githubusercontent.com/${CONFIG.proprietaire}/${CONFIG.depotAudio}/${toutes[b]}/` +
        f.filename.split('/').map(encodeURIComponent).join('/');
      envoyer_(url, taille_(url), nom, dossier);
    }
    etat.branchesAudio[b] = toutes[b];
    notes.push(`Branche audio « ${b} » sauvegardée (${fichiers.length} fichier(s) différent(s) de main).`);
  }
}

function taille_(url) {
  const r = UrlFetchApp.fetch(url, { headers: { Range: 'bytes=0-0' }, muteHttpExceptions: true });
  const m = entete_(r, 'content-range').match(/\/(\d+)$/);
  if (r.getResponseCode() === 206 && m) return Number(m[1]);
  if (r.getResponseCode() === 200) return r.getBlob().getBytes().length;   // fichier vide ou d'un octet
  throw new Error('fichier introuvable : ' + url);
}

/* Copie un fichier de GitHub vers Drive, par morceaux (les gros fichiers dépassent 50 Mo). */
function envoyer_(url, taille, nom, dossier) {
  const existants = dossier.getFilesByName(nom);
  const existant = existants.hasNext() ? existants.next() : null;
  if (taille === 0) {
    if (existant) existant.setContent(''); else dossier.createFile(nom, '');
    return;
  }
  const init = UrlFetchApp.fetch(
    existant
      ? `https://www.googleapis.com/upload/drive/v3/files/${existant.getId()}?uploadType=resumable`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: existant ? 'patch' : 'post',
      contentType: 'application/json; charset=UTF-8',
      payload: JSON.stringify(existant ? {} : { name: nom, parents: [dossier.getId()] }),
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'X-Upload-Content-Length': String(taille),
        'X-Upload-Content-Type': typeMime_(nom)
      },
      muteHttpExceptions: true
    });
  if (init.getResponseCode() !== 200) throw new Error(`Drive refuse ${nom} (${init.getResponseCode()})`);
  const session = entete_(init, 'location');

  for (let de = 0; de < taille; de += CONFIG.morceau) {
    const a = Math.min(de + CONFIG.morceau, taille) - 1;
    const r = UrlFetchApp.fetch(url, { headers: { Range: `bytes=${de}-${a}` }, muteHttpExceptions: true });
    const code = r.getResponseCode();
    const plage = entete_(r, 'content-range');
    const complet = code === 200 && de === 0 && a === taille - 1;
    if (!complet && !(code === 206 && plage.indexOf(`bytes ${de}-${a}/${taille}`) === 0)) {
      throw new Error(`téléchargement de ${nom} interrompu (${code})`);
    }
    const u = UrlFetchApp.fetch(session, {
      method: 'put',
      payload: r.getBlob(),
      headers: { 'Content-Range': `bytes ${de}-${a}/${taille}` },
      muteHttpExceptions: true,
      followRedirects: false
    });
    const c = u.getResponseCode();
    if (a < taille - 1 ? c !== 308 : (c !== 200 && c !== 201)) {
      throw new Error(`envoi de ${nom} vers Drive interrompu (${c})`);
    }
  }
}

/* ============ Outils ============ */
function branches_(depot) {
  const txt = telecharger_(`https://github.com/${CONFIG.proprietaire}/${depot}.git/info/refs?service=git-upload-pack`).getContentText();
  const res = {};
  const re = /([0-9a-f]{40}) refs\/heads\/([^\s\u0000]+)/g;
  let m;
  while ((m = re.exec(txt))) res[m[2]] = m[1];
  if (!res[CONFIG.branche]) throw new Error('version introuvable pour ' + depot);
  return res;
}

function dernierCommit_(depot) {
  return branches_(depot)[CONFIG.branche];
}

function telecharger_(url) {
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error(`GitHub ne répond pas (${r.getResponseCode()})`);
  return r;
}

function entetesGithub_() {
  const h = { Accept: 'application/vnd.github+json' };
  const jeton = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (jeton) h.Authorization = 'Bearer ' + jeton;
  return h;
}

function entete_(reponse, nom) {
  const h = reponse.getAllHeaders();
  for (const k in h) if (k.toLowerCase() === nom) return String(h[k]);
  return '';
}

function typeMime_(nom) {
  const ext = (nom.split('.').pop() || '').toLowerCase();
  return ({ m4a: 'audio/mp4', mp3: 'audio/mpeg', json: 'application/json', html: 'text/html',
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', js: 'text/javascript' })[ext]
    || 'application/octet-stream';
}

function dossier_(parent, nom) {
  const it = parent.getFoldersByName(nom);
  return it.hasNext() ? it.next() : parent.createFolder(nom);
}

const FICHIER_ETAT = 'etat-sauvegarde.json';

function lireEtat_(racine) {
  const it = racine.getFilesByName(FICHIER_ETAT);
  let e = {};
  if (it.hasNext()) { try { e = JSON.parse(it.next().getBlob().getDataAsString()); } catch (x) { e = {}; } }
  e.audio = e.audio || {};
  e.audio.fait = e.audio.fait || {};
  e.audio.liste = e.audio.liste || [];
  return e;
}

function ecrireEtat_(racine, etat) {
  ecrireTexte_(racine, FICHIER_ETAT, JSON.stringify(etat));
}

function ecrireRapport_(racine, etat, notes) {
  const a = etat.audio;
  const total = a.liste.length;
  const faits = a.liste.filter(x => a.fait[x.p] === x.s).length;
  const lignes = [
    'Dernière vérification : ' + maintenant_('dd/MM/yyyy à HH:mm'),
    '',
    'Textes : ' + (etat.textes && etat.textes[CONFIG.branche]
      ? 'à jour (version ' + etat.textes[CONFIG.branche].slice(0, 7) + ', ' + Object.keys(etat.textes).length + ' branche(s) sauvegardée(s))'
      : 'pas encore sauvegardés'),
    'Audios : ' + faits + ' / ' + total + ' fichiers à jour' + (total && faits === total ? ' ✅' : ' (copie en cours…)'),
    ''
  ].concat(notes);
  ecrireTexte_(racine, 'derniere-sauvegarde.txt', lignes.join('\n'));
}

function ecrireTexte_(dossier, nom, contenu) {
  const it = dossier.getFilesByName(nom);
  if (it.hasNext()) it.next().setContent(contenu); else dossier.createFile(nom, contenu, MimeType.PLAIN_TEXT);
}

function maintenant_(format) {
  return Utilities.formatDate(new Date(), CONFIG.fuseau, format);
}
