# Apothical — Trade Planner
### Pharmacie Apothical Nanterre Université

Interface locale pour créer le plan trade mensuel.
Glisse `operations.xlsx` → positionne les labos → exporte le plan Excel.

---

## Installation (une seule fois)

### Prérequis
- **Node.js** installé sur le PC → https://nodejs.org (prendre la version LTS)

### Étapes

```bash
# 1. Ouvre un terminal dans ce dossier
# 2. Installe les dépendances
npm install

# 3. Lance le serveur
npm start
```

**Ouvre ensuite** → http://localhost:3000 dans Chrome

---

## Lancement quotidien

```bash
npm start
```

Puis ouvre http://localhost:3000

---

## Comment utiliser

### 1. Charger le fichier
Glisse le fichier **operations.xlsx** du mois dans la zone à gauche.
Les laboratoires apparaissent automatiquement dans la liste.

### 2. Positionner les labos
Glisse chaque labo depuis la liste vers la bonne zone :
- **Podium** → labo exclusif du mois (Animation LED 4 faces)
- **FA1 / FA2 / FA3** → fonds avancés (produits stars)
- **TG9–TG12 ÉCRAN** → gondoles avec écran digital (priorité aux BRI)
- **TG1–TG26** → gondoles selon la catégorie produit
- **IC1–IC6** → intercomptoirs caisses (impulsion OTC)

### 3. Exporter
Clique sur **"Exporter Plan_trade.xlsx"** en bas à droite.
Le fichier est téléchargé avec les 9 feuilles dans ton format exact.

---

## Badges dans la liste

| Badge | Signification |
|-------|--------------|
| `A&V` rouge | Opération Apothical & Vous (PLV C-Media) |
| `BRI X€` vert | Bon de réduction immédiat consommateur |
| `TG` bleu | Mise en avant gondole simple |
| `☀ Solaire` | Produit solaire → ajouté auto en Entrée à l'export |
| `👶 Bébé` | Produit bébé |

---

## Structure du projet

```
apothical-planner/
├── server.js          ← Serveur Express (lance l'interface)
├── package.json
└── public/
    ├── index.html     ← Interface principale
    ├── style.css      ← Styles
    └── app.js         ← Logique (drag & drop, export Excel)
```

---

## Pour modifier l'outil (avec Claude Code)

```bash
# Dans ce dossier :
claude
```

Exemples :
- "Ajoute un bouton pour sauvegarder le plan en cours"
- "Ajoute un champ notes sur chaque zone"
- "Colorie les zones TG BRI en vert dans l'export"
