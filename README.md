# OUIDROP — Base de données codes erreur
## Guide de déploiement complet

---

## 📁 Structure des fichiers

```
ouidrop-app/
├── login.html           → Page de connexion
├── index.html           → Tableau de bord principal
├── search.html          → Recherche pleine page
├── error.html           → Détail d'un code erreur
├── table-automate.html  → Table complète Automate
├── table-lexium.html    → Table complète Lexium
├── notes.html           → Gestion des notes de ticket
├── stats.html           → Statistiques d'utilisation
├── style.css            → Design system partagé
├── core.js              → Auth, cache, utilitaires
└── gas-script.gs        → Google Apps Script (à déployer séparément)
```

---

## 🔑 Étape 1 — Changer le mot de passe

Le mot de passe par défaut est `ouidrop2025`. **Changez-le avant de déployer.**

1. Ouvrez la **console du navigateur** sur n'importe quelle page (F12)
2. Copiez-collez cette commande en remplaçant `VotreMDP` par votre mot de passe :
```javascript
crypto.subtle.digest('SHA-256', new TextEncoder().encode('VotreMDP'))
  .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
```
3. Copiez le hash affiché
4. Dans `login.html`, remplacez la valeur de `PASSWORD_HASH` par votre hash
5. Supprimez la ligne `|| pwd === 'ouidrop2025'` dans la fonction `doLogin()` (ligne de démo)

---

## 📊 Étape 2 — Configurer Google Apps Script

### 2.1 Préparer le Google Sheet

Dans votre Google Sheet, la feuille `Raw_Data` doit avoir cette structure :

| A (Code) | B (Emplacement) | C (Description) | D (Causes) | E (Mesures) | F (vide) | G (Code DEC) | H (Code HEX) | I (Classe) | J (Description) | K (Cause) | L (Mesures) | ... | N (Titre lien) | O (URL) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| *Codes Automate* | | | | | | *Codes Lexium* | | | | | | | *Liens rapides* | |
| 30301 | Drive Stepper | Perte comm... | ... | ... | | 4352 | 1100 | 0 | Paramètres... | ... | ... | | Documentation | https://... |

> ⚠️ Ajustez les indices de colonnes dans `gas-script.gs` si votre structure diffère.

### 2.2 Déployer le script

1. Ouvrez votre Google Sheet → **Extensions > Apps Script**
2. Collez le contenu de `gas-script.gs` dans `Code.gs`
3. Modifiez `SPREADSHEET_ID` avec l'ID de votre Sheet (visible dans l'URL)
4. **Tester** : cliquez sur `testGetData()` puis Exécuter — vérifiez les logs
5. **Déployer** : Déployer > Nouveau déploiement
   - Type : **Application Web**
   - Exécuter en tant que : **Moi**
   - Accès : **Tout le monde** (nécessaire pour la page GitHub)
6. Copiez l'URL de déploiement (format `https://script.google.com/macros/s/.../exec`)

### 2.3 Connecter l'URL au site

Dans `core.js`, remplacez :
```javascript
GAS_URL: 'https://script.google.com/macros/s/VOTRE_SCRIPT_ID/exec',
```
Par votre URL de déploiement.

---

## 🐙 Étape 3 — Déployer sur GitHub Pages

1. Créez un repository GitHub (public)
2. Uploadez tous les fichiers `.html`, `.css`, `.js` à la racine
3. **Ne pas uploader** `gas-script.gs` et `README.md` si vous souhaitez garder la config secrète (mais le hash du mdp est déjà dans le code)
4. Allez dans **Settings > Pages**
   - Source : `Deploy from a branch`
   - Branch : `main` / `root`
5. Votre site sera accessible à `https://VOTRE_USERNAME.github.io/REPO_NAME/login.html`

> 💡 Conseil : définissez `login.html` comme page par défaut en ajoutant un fichier `_config.yml` :
> ```yaml
> # Pas nécessaire, GitHub Pages redirige vers index.html par défaut
> ```
> Ou renommez `login.html` en `index.html` et `index.html` en `dashboard.html` (et adaptez les liens).

---

## ⚙️ Personnalisation

### Changer les couleurs
Dans `style.css`, modifiez les variables CSS dans `:root` :
```css
--accent:  #e8c547;   /* Couleur principale (jaune) */
--accent2: #f07b3f;   /* Couleur secondaire (orange) */
```

### Durée de la session
Dans `core.js` :
```javascript
SESSION_LONG:  1000 * 60 * 60 * 24 * 30,  // 30 jours (avec "Rester connecté")
SESSION_SHORT: 1000 * 60 * 60 * 8,         // 8 heures (sans)
```

### Durée du cache BDD
```javascript
CACHE_TTL: 1000 * 60 * 60 * 24,  // 24 heures
```

---

## 🔒 Sécurité

- L'authentification est côté client (SHA-256 du mot de passe). Elle protège l'accès aux pages mais le hash est visible dans le code source public.
- Les données sont publiquement accessibles via l'URL du Google Apps Script si quelqu'un la connaît.
- Pour un usage interne non-critique, c'est suffisant. Pour des données sensibles, envisagez un hébergement privé.

---

## 🐛 Dépannage

| Problème | Solution |
|---|---|
| `Mode démo` s'affiche | Configurez `GAS_URL` dans `core.js` |
| Erreur CORS sur le GAS | Vérifiez que l'accès est "Tout le monde" dans le déploiement |
| Données vides | Vérifiez les indices de colonnes dans `gas-script.gs` |
| Mot de passe refusé | Vérifiez que le hash dans `login.html` correspond bien |
| Cache pas mis à jour | Cliquez sur "Actualiser la BDD" ou videz le localStorage |

---

*OUIDROP — Outil interne de support technique*
