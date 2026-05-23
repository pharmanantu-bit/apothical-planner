// ═══════════════════════════════════════════════════════════════════════════
//  Apothical Trade Planner — app.js
//  Pharmacie Apothical Nanterre Université
// ═══════════════════════════════════════════════════════════════════════════

// ─── CONFIGURATION ZONES ────────────────────────────────────────────────────

const TG_1_8 = [
  { id: 'TG1', label: 'TG1' },
  { id: 'TG2', label: 'TG2' },
  { id: 'TG3', label: 'TG3' },
  { id: 'TG4', label: 'TG4' },
  { id: 'TG5', label: 'TG5' },
  { id: 'TG6', label: 'TG6' },
  { id: 'TG7', label: 'TG7' },
  { id: 'TG8', label: 'TG8' },
]

const TG_13_26 = [
  { id: 'TG13',  label: 'TG13',  sub: 'Bébé' },
  { id: 'TG14',  label: 'TG14',  sub: 'Bébé' },
  { id: 'TG15',  label: 'TG15',  sub: 'Photo' },
  { id: 'TG16',  label: 'TG16',  sub: 'Minceur' },
  { id: 'TG17',  label: 'TG17',  sub: 'Diéta' },
  { id: 'TG18',  label: 'TG18',  sub: 'Dentaire' },
  { id: 'TG19',  label: 'TG19',  sub: 'Dentaire' },
  { id: 'TG20',  label: 'TG20',  sub: 'Corps' },
  { id: 'TG21',  label: 'TG21',  sub: 'Visage' },
  { id: 'TG22',  label: 'TG22',  sub: 'Dentaire' },
  { id: 'TG23',  label: 'TG23',  sub: 'OTC' },
  { id: 'TG24',  label: 'TG24',  sub: 'Vitamines' },
  { id: 'TG25',  label: 'TG25',  sub: 'Capillaire' },
  { id: 'TG26',  label: 'TG26',  sub: 'Vitamine' },
]

const BRI_RAYONS = [
  { id: 'BRIR1', label: 'BRI R1', sub: '' },
  { id: 'BRIR2', label: 'BRI R2', sub: '' },
  { id: 'BRIR3', label: 'BRI R3', sub: '' },
  { id: 'BRIR4', label: 'BRI R4', sub: '' },
  { id: 'BRIR5', label: 'BRI R5', sub: '' },
  { id: 'BRIR6', label: 'BRI R6', sub: '' },
  { id: 'BRIR7', label: 'BRI R7', sub: '' },
  { id: 'BRIR8', label: 'BRI R8', sub: '' },
]

const MOIS_FR = ['','Janvier','Février','Mars','Avril','Mai','Juin',
                    'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ─── ÉTAT GLOBAL ────────────────────────────────────────────────────────────

let labos            = []    // tous les labos parsés
let photoColIdx      = -1   // index colonne "photo" dans l'Excel
let placement        = {}    // { zoneId: laboObject } — pour le mois courant
let placementNotes   = {}    // { zoneId: noteText } — notes internes par zone
let draggedId        = null  // id du labo en cours de drag
let currentDetailId  = null  // labo ouvert dans le modal produits
let createTargetZone = null  // zone cible du modal création
let createSourceLabo = null  // labo existant pré-rempli (depuis drag)
let isEditMode       = false // true = modification d'une opération déjà placée
let currentMonth     = ''    // mois sélectionné
let currentFileName  = ''    // nom du fichier importé pour le mois courant

// ─── INIT ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  buildTgZones('tg-1-8',    TG_1_8,    'zone-tg')
  buildTgZones('tg-13-26',  TG_13_26,  'zone-tg')
  buildTgZones('bri-rayons', BRI_RAYONS, 'zone-bri')
  restoreDataFromStorage()
  restorePlanFromStorage()
  restoreStockFromStorage()

  // Listener délégué : clic sur une zone vide → ouvrir le formulaire de création
  document.getElementById('plan-area').addEventListener('click', e => {
    if (draggedId) return
    const zone = e.target.closest('.drop-zone')
    if (!zone || zone.classList.contains('filled')) return
    if (e.target.closest('.chip-remove')) return
    openCreateModal(zone.dataset.zone)
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      [closeModal, closeCreateModal, closePlanModal, closeCommanderModal, closeDepotModal, closeReassortModal]
        .forEach(fn => { try { fn() } catch(_) {} })
    }
  })

  // Zoom molette souris sur le plan
  document.getElementById('plan-modal-body').addEventListener('wheel', e => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.1 : -0.1
    planZoom = Math.min(5, Math.max(0.2, planZoom + delta))
    applyPlanTransform(false)
  }, { passive: false })

  // Pan (glisser) sur le plan
  const planBody = document.getElementById('plan-modal-body')
  planBody.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    isPanning = true
    panStart = { x: e.clientX - planPanX, y: e.clientY - planPanY }
    planBody.style.cursor = 'grabbing'
  })
  window.addEventListener('mousemove', e => {
    if (!isPanning) return
    planPanX = e.clientX - panStart.x
    planPanY = e.clientY - panStart.y
    applyPlanTransform(false)
  })
  window.addEventListener('mouseup', () => {
    isPanning = false
    document.getElementById('plan-modal-body').style.cursor = 'grab'
  })
})

function buildTgZones(containerId, list, cssClass) {
  const container = document.getElementById(containerId)
  list.forEach(({ id, label, sub }) => {
    const div = document.createElement('div')
    div.className = `drop-zone ${cssClass}`
    div.id = `zone-${id}`
    div.dataset.zone = id
    div.dataset.max = '1'
    div.setAttribute('ondragover', 'onDragOver(event,this)')
    div.setAttribute('ondragleave', 'onDragLeave(this)')
    div.setAttribute('ondrop', 'onDrop(event,this)')

    const subHtml = sub
      ? `<small style="color:var(--ink3);font-weight:400;text-transform:none;letter-spacing:0">${sub}</small>`
      : ''

    div.innerHTML = `
      <div class="zone-label">${label} ${subHtml}</div>
      <div class="zone-content" id="content-${id}">
        <div class="zone-placeholder">—</div>
      </div>
    `
    container.appendChild(div)
  })
}

// ─── CHARGEMENT FICHIER ──────────────────────────────────────────────────────

function handleFileDrop(e) {
  e.preventDefault()
  document.getElementById('upload-zone').classList.remove('over')
  const f = e.dataTransfer.files[0]
  if (f) loadFile(f)
}

// Détection dynamique des colonnes depuis les entêtes, avec fallback sur les index fixes
function detectColumns(headers) {
  const find = (...patterns) => {
    for (const p of patterns) {
      const i = headers.findIndex(h => h.includes(p))
      if (i >= 0) return i
    }
    return null
  }
  return {
    nom:      find('LABORATOIRE', 'LABO', 'NOM LAB') ?? 0,
    debut:    find('DEBUT', 'DÉBUT', 'DATE DEB', 'DATE D') ?? 1,
    fin:      find('FIN', 'DATE FIN', 'DATE F') ?? 2,
    gamme:    find('GAMME', 'FAMILLE') ?? 3,
    prodNom:  find('DESIGNATION', 'LIBELLÉ', 'LIBELLE', 'PRODUIT') ?? 4,
    cip:      find('CIP', 'EAN', 'CODE') ?? 5,
    titre:    find('TITRE', 'INTITUL', 'OPÉRATION', 'OPERATION') ?? 7,
    offre:    find('OFFRE', 'CONDITION', 'REMISE', 'AVANTAGE') ?? 8,
    typeZone: find('ZONE', 'EMPLACEMENT') ?? 9,
    bri:      find('BRI', 'BON DE R') ?? 10,
    photo:    find('PHOTO', 'PREUVE', 'JUSTIF') ?? -1,
    email:    find('EMAIL', 'MAIL', 'CONTACT') ?? 17,
    forfait:  find('FORFAIT', 'MONTANT') ?? 18,
  }
}

function loadFile(file) {
  if (!file) return
  if (!file.name.match(/\.(xlsx|xls)$/i)) {
    showToast('⚠️  Fichier .xlsx requis')
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })

      // Lire toutes les feuilles et les concaténer (sauf feuilles vides)
      let rows = []
      let headersRow = null
      wb.SheetNames.forEach((sheetName, si) => {
        const ws = wb.Sheets[sheetName]
        const sheetRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (!sheetRows.length) return
        if (si === 0) {
          headersRow = sheetRows[0]
          rows = sheetRows
        } else {
          // Feuilles suivantes : ignorer leur 1ère ligne si c'est un entête identique
          const firstRow = sheetRows[0]
          const isHeader = firstRow.some(c => String(c).toUpperCase().includes('LABORATOIRE'))
          rows = rows.concat(isHeader ? sheetRows.slice(1) : sheetRows)
        }
      })
      if (!headersRow) throw new Error('Fichier vide')

      // Ligne 0 = entêtes — détection dynamique des colonnes
      const headers = (rows[0] || []).map(h => String(h).toUpperCase().trim())
      const cols    = detectColumns(headers)
      photoColIdx   = cols.photo

      // Parsing avec gestion des lignes de continuation (nom vide = produit supplémentaire)
      const map     = {}   // key → labo
      const order   = []   // clés dans l'ordre d'apparition
      let lastKey   = ''
      let skipped   = 0
      let processed = 0

      rows.slice(1).forEach((r, rowIdx) => {
        // Ligne entièrement vide → ignorer
        const rowStr = r.join('').trim()
        if (!rowStr) { skipped++; return }

        let nom = String(r[cols.nom] || '').trim()

        // Ignorer entêtes répétés
        const nomUp = nom.toUpperCase()
        if (nomUp === 'NOM DU LABORATOIRE' || nomUp === 'LABORATOIRE' || nomUp === 'NOM LAB') {
          skipped++; return
        }
        if (nom === 'NAN') nom = ''

        // Ligne de continuation : nom vide mais on a un produit ou CIP
        if (!nom) {
          const hasProd = String(r[cols.cip] || '').trim() || String(r[cols.prodNom] || '').trim()
          if (hasProd && lastKey && map[lastKey]) {
            nom = map[lastKey].labo
          } else {
            skipped++; return
          }
        }

        const debut    = String(r[cols.debut]    || '').trim()
        const fin      = String(r[cols.fin]      || '').trim()
        const typeZone = String(r[cols.typeZone]  || '').trim()
        const gamme    = String(r[cols.gamme]     || '').trim()
        const titre    = String(r[cols.titre]     || '').trim()

        // Clé unique : labo + période + zone + gamme + titre pour ne pas fusionner des ops différentes
        const key = [nom, debut, fin, typeZone, gamme || titre].join('|||')

        if (!map[key]) {
          map[key] = buildLabo(nom, r, cols, key)
          map[key].products = []
          order.push(key)
        }
        lastKey = key
        processed++

        // Collecter les produits de cette ligne
        const cip  = String(r[cols.cip]    || '').trim()
        const prod = String(r[cols.prodNom] || '').trim() || gamme
        if (cip || prod) {
          const dup = map[key].products.some(p => p.cip === cip && p.nom === prod)
          if (!dup) {
            const briVal    = String(r[cols.bri] || '').trim()
            const hasBriRow = briVal && briVal !== '-' && briVal !== '0' && parseFloat(briVal) > 0
            const offre     = hasBriRow
              ? `-${briVal}€ BRI`
              : String(r[cols.offre] || '').trim() || ''
            map[key].products.push({ nom: prod, cip, offre })
          }
        }
      })

      // Détecter les labos avec plusieurs opérations → label distinctif sur la carte
      const nomCount = {}
      order.forEach(k => { const n = map[k].labo; nomCount[n] = (nomCount[n] || 0) + 1 })
      const nomSeen  = {}
      order.forEach(k => {
        const l = map[k]
        if (nomCount[l.labo] > 1) {
          nomSeen[l.labo] = (nomSeen[l.labo] || 0) + 1
          l._opLabel = `op ${nomSeen[l.labo]}/${nomCount[l.labo]}`
        }
      })

      labos = order.map(k => map[k])

      const totalProducts = labos.reduce((s, l) => s + l.products.length, 0)

      // Nouveau fichier pour ce mois → vider le placement précédent
      currentFileName = file.name
      clearZonesUI()
      placement      = {}
      placementNotes = {}

      // UI upload
      const uploadZone = document.getElementById('upload-zone')
      uploadZone.classList.add('loaded')
      document.getElementById('upload-icon').textContent = '✅'
      document.getElementById('upload-text').innerHTML =
        `<strong>${file.name}</strong><br>${labos.length} opérations · ${totalProducts} produits`
      document.getElementById('header-hint').textContent =
        'Glisse les labos dans les zones à droite'

      renderLaboList(labos)
      updateFooter()
      document.getElementById('btn-export').disabled = false
      saveDataToStorage()
      saveExcelToStorage(e.target.result, file.name)

      const nbSheets = wb.SheetNames.length
      const sheetsInfo = nbSheets > 1 ? ` · ${nbSheets} feuilles` : ''
      const skippedInfo = skipped > 0 ? ` · ${skipped} lignes ignorées` : ''
      showToast(`✅  ${labos.length} opérations · ${totalProducts} produits${sheetsInfo}${skippedInfo}`)
      if (skipped > 5) {
        setTimeout(() => showToast(`ℹ️  ${skipped} lignes vides/entêtes ignorées — vérifie si tout est présent`), 3000)
      }
    } catch (err) {
      showToast('❌  Erreur lecture fichier')
      console.error(err)
    }
  }
  reader.readAsArrayBuffer(file)
}

function saveExcelToStorage(arrayBuffer, fileName) {
  try {
    const bytes = new Uint8Array(arrayBuffer)
    const chunks = []
    for (let i = 0; i < bytes.byteLength; i += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
    }
    const b64 = btoa(chunks.join(''))
    localStorage.setItem(EXCEL_STORAGE_KEY, JSON.stringify({ data: b64, name: fileName }))
  } catch (e) {}
}

function deleteCurrentFile() {
  labos          = []
  placement      = {}
  placementNotes = {}
  photoColIdx    = -1
  currentFileName = ''

  clearZonesUI()
  resetUploadUI()
  saveDataToStorage()
  showToast('🗑  Fichier et opérations supprimés')
}

function buildLabo(nom, r, cols, key) {
  const get = (idx) => String(r[idx] !== undefined ? r[idx] : '').trim()

  const bri     = get(cols.bri)
  const hasBri  = bri && bri !== '-' && bri !== '0' && parseFloat(bri) > 0
  const titre   = get(cols.titre)
  const gamme   = get(cols.gamme)
  const cond    = get(cols.offre)

  const isApothical = titre.toUpperCase().includes('APOTHICAL')
  const isSolaire   = checkKeywords(gamme + ' ' + titre, [
    'ANTHELIOS','BARIESUN','CAPITAL SOLEIL','SUN SECURE','SOLAIRE',
    'SOLAIRES','SUN PROTECTION','SUNSCREEN'
  ])
  const isBebe = checkKeywords(nom + ' ' + gamme, [
    'MUSTELA','BIOLANE','KLORANE BEBE','BEBE','LOVE & GREEN'
  ])

  let needsPhoto = false
  if (photoColIdx >= 0) {
    const val = get(photoColIdx).toUpperCase()
    needsPhoto = val !== '' && val !== 'NON' && val !== 'N' && val !== '0' && val !== 'FALSE'
  }
  if (!needsPhoto) {
    needsPhoto = checkKeywords(cond + ' ' + titre, ['PHOTO', 'PREUVE', 'JUSTIFICATIF'])
  }

  return {
    id:         (key || nom).replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(),
    labo:       nom,
    gamme:      gamme || titre.substring(0, 40),
    titre:      titre.substring(0, 60),
    type_zone:  get(cols.typeZone),
    bri:        hasBri ? bri : null,
    hasBri,
    isApothical,
    isSolaire,
    isBebe,
    needsPhoto,
    photoURL:   null,
    debut:      get(cols.debut),
    fin:        get(cols.fin),
    ean:        get(cols.cip),
    conditions: cond.substring(0, 150),
    email:      get(cols.email),
    forfait:    get(cols.forfait),
  }
}

function checkKeywords(str, keywords) {
  const s = str.toUpperCase()
  return keywords.some(k => s.includes(k.toUpperCase()))
}

// ─── RENDU LISTE LABOS ───────────────────────────────────────────────────────

let currentSort = 'az'

function onSortChange(val) {
  currentSort = val
  applyFilters()
}

function sortList(list) {
  switch (currentSort) {
    case 'az':      return [...list].sort((a, b) => a.labo.localeCompare(b.labo, 'fr'))
    case 'za':      return [...list].sort((a, b) => b.labo.localeCompare(a.labo, 'fr'))
    case 'bri':     return [...list].sort((a, b) => (b.hasBri ? 1 : 0) - (a.hasBri ? 1 : 0))
    case 'placed':  return [...list].sort((a, b) => (isPlaced(b.id) ? 1 : 0) - (isPlaced(a.id) ? 1 : 0))
    case 'unplaced':return [...list].sort((a, b) => (isPlaced(a.id) ? 1 : 0) - (isPlaced(b.id) ? 1 : 0))
    default:        return list
  }
}

function renderLaboList(list) {
  const container = document.getElementById('labo-list')
  const count     = document.getElementById('labo-count')

  if (!list.length) {
    container.innerHTML = '<div class="empty-hint"><p>Aucun résultat</p></div>'
    count.textContent = ''
    return
  }

  const placed = list.filter(l => isPlaced(l.id)).length
  count.textContent = `${list.length} labos · ${placed} placés · ${list.length - placed} restants`

  const sorted = sortList(list)

  // Grouper par nom de labo avec un header par groupe
  let html = ''
  let lastLabo = null
  sorted.forEach(l => {
    if (l.labo !== lastLabo) {
      const opCount = sorted.filter(x => x.labo === l.labo).length
      const countBadge = opCount > 1 ? `<span class="group-count">${opCount}</span>` : ''
      html += `<div class="labo-group-header">${l.labo}${countBadge}</div>`
      lastLabo = l.labo
    }
    html += buildLaboCardHTML(l)
  })
  container.innerHTML = html
}

function buildLaboCardHTML(l) {
  const placed     = isPlaced(l.id)
  const badges     = []
  const products   = l.products || []
  const depotCount = products.filter(p => p.depot).length
  const commanded  = !!l.commanded

  if (l.isApothical) badges.push(`<span class="badge b-av">A&amp;V</span>`)
  if (l.hasBri)      badges.push(`<span class="badge b-bri">BRI ${l.bri}€</span>`)
  else               badges.push(`<span class="badge b-tg">TG</span>`)
  if (l.isSolaire)   badges.push(`<span class="badge b-solaire">☀ Solaire</span>`)
  if (l.isBebe)      badges.push(`<span class="badge b-bebe">👶 Bébé</span>`)
  if (l._opLabel)    badges.push(`<span class="badge b-op">${l._opLabel}</span>`)

  return `
    <div
      class="labo-card ${placed ? 'placed' : ''}"
      id="card-${l.id}"
      draggable="${placed ? 'false' : 'true'}"
      ondragstart="onDragStart(event,'${l.id}')"
      ondragend="onDragEnd(event)"
      onclick="showDetail('${l.id}')"
      title="${l.conditions}">
      <button class="card-delete" onclick="event.stopPropagation(); deleteLabo('${l.id}')" title="Supprimer ce labo">✕</button>
      <div class="labo-card-name">${l.labo}</div>
      <div class="labo-card-gamme">${l.gamme}</div>
      <div class="labo-card-badges">${badges.join('')}</div>
    </div>
  `
}

function toggleCommander(laboId) {
  const l = labos.find(x => x.id === laboId)
  if (!l) return
  l.commanded = !l.commanded
  const badge = document.getElementById('badge-cmd-' + l.id)
  if (badge) {
    badge.classList.toggle('active', l.commanded)
    badge.innerHTML = `🛒 ${l.commanded ? 'Commandé ✓' : 'Commander'}`
    badge.title = l.commanded ? 'Annuler la commande' : 'Marquer comme commandé'
  }
  saveDataToStorage()
  showToast(l.commanded ? '🛒  Marqué comme commandé' : '↩  Commande annulée')
}

function applyFilters() {
  const q    = document.getElementById('search-input').value.toLowerCase().trim()
  const type = document.getElementById('type-filter')?.value || 'all'

  let filtered = labos

  // Filtre par type
  const typeMap = {
    bri:     l => l.hasBri,
    tg:      l => !l.hasBri,
    av:      l => l.isApothical,
    solaire: l => l.isSolaire,
    bebe:    l => l.isBebe,
    placed:  l => isPlaced(l.id),
    unplaced:l => !isPlaced(l.id),
    depot:   l => (l.products || []).some(p => p.depot),
  }
  if (typeMap[type]) filtered = filtered.filter(typeMap[type])

  // Filtre texte
  if (q) {
    filtered = filtered.filter(l =>
      l.labo.toLowerCase().includes(q) ||
      l.gamme.toLowerCase().includes(q) ||
      l.titre.toLowerCase().includes(q)
    )
  }

  renderLaboList(filtered)
}

function filterLabos(q) { applyFilters() }

function isPlaced(laboId) {
  return Object.values(placement).some(l => l.id === laboId)
}

// ─── DRAG & DROP ─────────────────────────────────────────────────────────────

function onDragStart(e, laboId) {
  const l = labos.find(x => x.id === laboId)
  if (!l || isPlaced(l.id)) {
    e.preventDefault()
    return
  }
  draggedId = laboId
  e.dataTransfer.effectAllowed = 'move'
  setTimeout(() => {
    document.getElementById('card-' + laboId)?.classList.add('dragging')
  }, 0)
}

function onDragEnd(e) {
  if (draggedId) {
    document.getElementById('card-' + draggedId)?.classList.remove('dragging')
  }
}

function onDragOver(e, zone) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  zone.classList.add('highlight')
}

function onDragLeave(zone) {
  zone.classList.remove('highlight')
}

function onDrop(e, zone) {
  e.preventDefault()
  zone.classList.remove('highlight')

  if (!draggedId) return

  const labo   = labos.find(l => l.id === draggedId)
  const zoneId = zone.dataset.zone

  // Retirer la classe dragging avant de nullifier draggedId
  document.getElementById('card-' + draggedId)?.classList.remove('dragging')
  draggedId = null

  if (!labo) return

  // Zone déjà occupée
  if (placement[zoneId]) {
    showToast('⚠️  Zone occupée — retire d\'abord le labo présent')
    setCardPlaced(labo.id, false)
    return
  }

  // Retirer de l'éventuelle ancienne zone
  for (const [z, l] of Object.entries(placement)) {
    if (l.id === labo.id) {
      delete placement[z]
      clearZone(z)
      setCardPlaced(labo.id, false)
    }
  }

  // Ouvrir le modal pré-rempli pour confirmer/compléter l'opération
  openCreateModalForDrop(zoneId, labo)
}

// ─── RENDU ZONES ─────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function renderChip(zoneId, labo) {
  const content = document.getElementById('content-' + zoneId)
  const zone    = document.getElementById('zone-' + zoneId)
  if (!content) return

  const offer = labo.hasBri
    ? `-${labo.bri}€ BRI`
    : labo.isApothical
      ? '✦ Apothical & Vous'
      : ''

  const note = placementNotes[zoneId]

  content.innerHTML = `
    <div class="placed-chip" onclick="editZone('${zoneId}')" title="Cliquer pour modifier">
      <div class="chip-body">
        <div class="chip-name">${labo.labo}</div>
        <div class="chip-gamme">${labo.gamme}</div>
        ${offer ? `<div class="chip-offer">${offer}</div>` : ''}
        ${note ? `<div class="chip-note">📝 ${escHtml(note)}</div>` : ''}
      </div>
      <button class="chip-remove" onclick="event.stopPropagation(); removeFromZone('${zoneId}')" title="Retirer">✕</button>
    </div>
  `
  zone?.classList.add('filled')
}

function clearZone(zoneId) {
  const content = document.getElementById('content-' + zoneId)
  const zone    = document.getElementById('zone-' + zoneId)
  if (content) content.innerHTML = '<div class="zone-placeholder">—</div>'
  zone?.classList.remove('filled')
}

function autoPlaceBri() {
  // Labs BRI non encore placés
  const unplaced = labos.filter(l => l.hasBri && !isPlaced(l.id))
  if (!unplaced.length) { showToast('✅  Tous les labs BRI sont déjà placés'); return }

  // Slots BRI libres existants
  const freeSlots = BRI_RAYONS.map(z => z.id).filter(id => !placement[id])

  // Si pas assez de slots, en créer de nouveaux
  let needed = unplaced.length - freeSlots.length
  while (needed > 0) {
    const n = BRI_RAYONS.length + 1
    const newZone = { id: `BRIR${n}`, label: `BRI R${n}`, sub: '' }
    BRI_RAYONS.push(newZone)
    // Créer le DOM de la zone
    const container = document.getElementById('bri-rayons')
    const div = document.createElement('div')
    div.className = 'drop-zone zone-bri'
    div.id = `zone-${newZone.id}`
    div.dataset.zone = newZone.id
    div.dataset.max = '1'
    div.setAttribute('ondragover', 'onDragOver(event,this)')
    div.setAttribute('ondragleave', 'onDragLeave(this)')
    div.setAttribute('ondrop', 'onDrop(event,this)')
    div.innerHTML = `
      <div class="zone-label">${newZone.label}</div>
      <div class="zone-content" id="content-${newZone.id}">
        <div class="zone-placeholder">—</div>
      </div>`
    container.appendChild(div)
    freeSlots.push(newZone.id)
    needed--
  }

  // Placer chaque lab BRI dans un slot libre
  unplaced.forEach((labo, i) => {
    const zoneId = freeSlots[i]
    placement[zoneId] = labo
    renderChip(zoneId, labo)
    setCardPlaced(labo.id, true)
  })

  updateFooter()
  saveDataToStorage()
  showToast(`⚡ ${unplaced.length} lab${unplaced.length > 1 ? 's' : ''} BRI placé${unplaced.length > 1 ? 's' : ''} automatiquement`)
}

function removeFromZone(zoneId) {
  const labo = placement[zoneId]
  if (!labo) return
  delete placement[zoneId]
  delete placementNotes[zoneId]
  clearZone(zoneId)
  setCardPlaced(labo.id, false)
  updateFooter()
  saveDataToStorage()
  showToast(`↩  ${labo.labo} retiré de ${zoneId}`)
}

function setCardPlaced(laboId, placed) {
  const card = document.getElementById('card-' + laboId)
  if (!card) return
  if (placed) {
    card.classList.add('placed')
    card.setAttribute('draggable', 'false')
  } else {
    card.classList.remove('placed')
    card.setAttribute('draggable', 'true')
  }
  applyFilters()
}

// ─── STATS FOOTER ────────────────────────────────────────────────────────────

function updateFooter() {
  const total  = labos.length
  const placed = Object.keys(placement).length
  const el     = document.getElementById('footer-stats')
  if (!total) {
    el.innerHTML = 'Aucun fichier chargé'
    return
  }
  el.innerHTML = `
    <strong>${placed}</strong> zones remplies &nbsp;·&nbsp;
    <strong>${total - Object.values(placement).map(l=>l.id)
      .filter((v,i,a)=>a.indexOf(v)===i).length}</strong> labos restants
    sur <strong>${total}</strong>
  `
}

// ─── SUPPRIMER UN LABO DE LA LISTE ───────────────────────────────────────────

function deleteLabo(laboId) {
  const l = labos.find(x => x.id === laboId)
  if (!l) return

  // Retirer du placement si présent
  for (const [z, placed] of Object.entries(placement)) {
    if (placed.id === laboId) {
      delete placement[z]
      clearZone(z)
    }
  }

  labos = labos.filter(x => x.id !== laboId)
  const q = document.getElementById('search-input').value
  filterLabos(q)
  updateFooter()
  saveDataToStorage()
  showToast(`🗑  ${l.labo} supprimé`)
}

// ─── CLEAR ALL ───────────────────────────────────────────────────────────────

function clearAll() {
  if (Object.keys(placement).length === 0) return
  if (!confirm('Réinitialiser tout le placement ?')) return

  placement = {}
  placementNotes = {}

  document.querySelectorAll('.zone-content').forEach(c => {
    c.innerHTML = '<div class="zone-placeholder">—</div>'
  })
  document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('filled'))
  document.querySelectorAll('.labo-card').forEach(c => {
    c.classList.remove('placed')
    c.setAttribute('draggable', 'true')
  })

  updateFooter()
  saveDataToStorage()
  showToast('Plan réinitialisé')
}

// ─── EXPORT EXCEL ────────────────────────────────────────────────────────────

function exportExcel() {
  if (!labos.length) { showToast('⚠️  Aucun fichier chargé'); return }

  const wb         = XLSX.utils.book_new()
  const monthLabel = document.getElementById('month-select').value || 'Plan'
  const currentMois = monthLabel.split(' ')[0]

  const aoa  = rows => XLSX.utils.aoa_to_sheet(rows)
  const add  = (ws, name, cols) => {
    if (cols) ws['!cols'] = cols.map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, ws, name)
  }

  // Séparer par type de zone
  const entries = Object.entries(placement)
  const tgZones = entries.filter(([z]) => z.startsWith('TG')).sort(sortZone)
  const icZones = entries.filter(([z]) => z.startsWith('IC')).sort(sortZone)
  const faZones = entries.filter(([z]) => z.startsWith('FA')).sort(sortZone)
  const podium  = placement['PODIUM']

  // ── 1. PLAN (vide)
  add(aoa([['PLAN TRADE — ' + monthLabel], ['Synthèse à compléter manuellement']]), 'PLAN')

  // ── 2. TG
  const tgRows = [['Commande à passer', 'TG', 'LABORATOIRE ET OPERATIONS PRODUITS', 'CIP', 'OFFRE PREVUE', 'NOTES']]
  tgZones.forEach(([zone, l]) => {
    const ecran = ['TG9','TG10','TG11','TG12'].includes(zone)
    const label = ecran ? zone + ' (ECRAN)' : zone
    tgRows.push(['ras', label, l.labo + (l.gamme ? ' — ' + l.gamme : ''), l.ean || '', offreLabel(l), placementNotes[zone] || ''])
  })
  add(aoa(tgRows), 'TG', [18, 16, 55, 16, 20, 35])

  // ── 3. INTERCOMPTOIR
  const icRows = [['INTERCOMPTOIR', 'LABORATOIRE ET OPERATIONS PRODUITS', 'CIP', 'OFFRE', 'TRADE', 'NOTES']]
  icZones.forEach(([zone, l]) => {
    icRows.push([zone, l.labo + (l.gamme ? ' — ' + l.gamme : ''), l.ean || '', offreLabel(l), 'Trade', placementNotes[zone] || ''])
  })
  add(aoa(icRows), 'INTERCOMPTOIR', [14, 55, 16, 20, 10, 35])

  // ── 4. FOND AVANCEE
  const faRows = [['', 'LABORATOIRE', 'PRODUIT', 'CIP', 'OFFRE', 'TRADE', 'NOTES']]
  faZones.forEach(([zone, l]) => {
    faRows.push([zone, l.labo, l.gamme || l.titre, l.ean || '', offreLabel(l), 'Trade', placementNotes[zone] || ''])
  })
  add(aoa(faRows), 'FOND AVANCEE', [6, 28, 50, 16, 24, 10, 35])

  // ── 5. BRI RAYON (depuis les zones BRIR dédiées)
  const briRZones = entries.filter(([z]) => z.startsWith('BRIR')).sort(sortZone)
  const briRows = [['Zone', 'Laboratoire', 'Produit / Gamme', 'Offre BRI', 'Notes']]
  briRZones.forEach(([zone, l]) => {
    briRows.push([zone, l.labo, l.gamme || l.titre, l.hasBri ? `-${l.bri}€` : 'RAS', placementNotes[zone] || ''])
  })
  add(aoa(briRows), 'BRI RAYON', [10, 28, 50, 12, 35])

  // ── 6. ENTREE - OFFRES SAISON (solaires automatiquement)
  const entreeRows = [['', 'NOM DES PRODUITS', 'Offres']]
  const solaires = Object.values(placement).filter(l => l.isSolaire)
  const refs = ['G01-01','G01-02','G01-03','G01-04','G02-01','G02-02','G02-03','G02-04']
  solaires.slice(0, 8).forEach((l, i) => {
    entreeRows.push([refs[i] || '', l.labo, l.hasBri ? `-${l.bri}€` : '-2€'])
  })
  add(aoa(entreeRows), 'ENTREE - OFFRES SAISON', [10, 45, 12])

  // ── 7. PODIUM (planning annuel complet)
  const podiumRows = [['Mois', 'Labo', 'Produits', 'Offre']]
  MOIS_FR.slice(1).forEach(m => {
    if (m === currentMois && podium) {
      podiumRows.push([m, podium.labo, podium.gamme || podium.titre, offreLabel(podium)])
    } else {
      podiumRows.push([m, '', '', ''])
    }
  })
  add(aoa(podiumRows), 'PODIUM', [14, 28, 55, 25])

  // ── 8. TG 15 PHOTO
  const tg15 = placement['TG15']
  add(aoa(tg15 ? [[tg15.labo], [tg15.gamme]] : [['Zone libre — à photographier']]), 'TG 15 PHOTO', [50])

  // ── 9. BACS SOLDEURS
  const bacsHeader = [''].concat(Array.from({length:20}, (_,i) => `BAC ${i+1}`))
  add(aoa([bacsHeader]), 'BACS SOLDEURS')

  // Écrire le fichier
  const filename = `Plan_trade_${monthLabel.replace(' ', '_')}.xlsx`
  XLSX.writeFile(wb, filename)
  showToast(`✅  ${filename} téléchargé`)
}

function offreLabel(l) {
  if (l.hasBri) return `-${l.bri}€`
  if (l.isApothical) return 'Apothical & Vous'
  return 'RAS'
}

function sortZone([a], [b]) {
  const na = parseInt(a.replace(/\D/g,'')) || 0
  const nb = parseInt(b.replace(/\D/g,'')) || 0
  return na - nb
}

// ─── MODAL COMMANDER ─────────────────────────────────────────────────────────

const SECTIONS_ORDER = [
  { key: 'PODIUM', label: '🏆 Podium' },
  { key: 'FA',     label: '⭐ Fonds avancés' },
  { key: 'TG',     label: '📦 Gondoles TG' },
  { key: 'IC',     label: '🛒 Intercomptoirs' },
  { key: 'BRIR',   label: '🏷 BRI Rayons' },
]

function openCommanderModal() {
  const month = document.getElementById('month-select').value || '—'
  document.getElementById('commander-month').textContent = month

  const body = document.getElementById('commander-body')
  const entries = Object.entries(placement)

  let html = ''

  // Section produits commandés (p.commanded = true) — toujours en premier
  const commandedGroups = []
  labos.forEach(l => {
    const cp = (l.products || []).filter(p => p.commanded)
    if (cp.length) commandedGroups.push({ labo: l, products: cp })
  })

  if (commandedGroups.length) {
    const total = commandedGroups.reduce((s, g) => s + g.products.length, 0)
    html += `<div class="cmd-section cmd-section-commanded">
      <div class="cmd-section-title" onclick="toggleCmdSection(this.parentElement)">🛒 Produits commandés <span style="font-weight:400;color:var(--ink4)">${total} produit${total > 1 ? 's' : ''}</span></div>
      <div class="cmd-row row-commanded cmd-header">
        <div class="cmd-cell">Désignation produit</div>
        <div class="cmd-cell">Laboratoire</div>
        <div class="cmd-cell cip-cell">Code CIP</div>
        <div class="cmd-cell offre-cell">Offre</div>
        <div class="cmd-cell action-cell"></div>
      </div>
      <div class="cmd-section-body">`
    commandedGroups.forEach(({ labo: l, products: cp }) => {
      cp.forEach(p => {
        const globalIdx = (l.products || []).indexOf(p)
        html += `
      <div class="cmd-row row-commanded">
        <div class="cmd-cell">${p.nom || '—'}</div>
        <div class="cmd-cell labo-cell"><span>${l.labo}</span></div>
        <div class="cmd-cell cip-cell">${p.cip || '—'}</div>
        <div class="cmd-cell offre-cell">${p.offre || '—'}</div>
        <div class="cmd-cell action-cell">
          <button class="row-btn del" onclick="removeCommanded('${l.id}',${globalIdx})" title="Retirer">✕</button>
        </div>
      </div>`
      })
    })
    html += `</div></div>`
  }

  // Section opérations placées dans le plan
  SECTIONS_ORDER.forEach(({ key, label }) => {
    const rows = entries.filter(([z]) => z === key || z.startsWith(key))
                        .sort(sortZone)
    if (!rows.length) return

    html += `<div class="cmd-section">
      <div class="cmd-section-title" onclick="toggleCmdSection(this.parentElement)">${label} <span style="font-weight:400;color:var(--ink4)">${rows.length} opération${rows.length > 1 ? 's' : ''}</span></div>
      <div class="cmd-row row-plan cmd-header">
        <div class="cmd-cell zone-cell">Zone</div>
        <div class="cmd-cell">Laboratoire · Gamme</div>
        <div class="cmd-cell">Offre</div>
        <div class="cmd-cell">Période</div>
        <div class="cmd-cell">Statut</div>
      </div>
      <div class="cmd-section-body">`

    rows.forEach(([zone, l]) => {
      const offre = l.hasBri ? `-${l.bri}€ BRI` : l.isApothical ? 'A&V' : l.conditions || '—'
      const dates = l.debut && l.fin ? `${l.debut} → ${l.fin}` : l.debut || '—'
      const placed = !!placement[zone]
      html += `
      <div class="cmd-row row-plan">
        <div class="cmd-cell zone-cell">${zone}</div>
        <div class="cmd-cell labo-cell">
          <span>${l.labo}</span>
          <span style="font-size:11px;color:var(--ink3);font-weight:400">${l.gamme || ''}</span>
        </div>
        <div class="cmd-cell offre-cell">${offre}</div>
        <div class="cmd-cell dates-cell">${dates}</div>
        <div class="cmd-cell status-cell">
          <span class="cmd-status ${placed ? 'ok' : 'wait'}">${placed ? '✓ Placé' : '⏳ En attente'}</span>
        </div>
      </div>`
    })

    html += `</div></div>`
  })

  body.innerHTML = html || `<div class="cmd-empty">Aucune opération placée et aucun produit commandé.</div>`
  document.getElementById('commander-overlay').classList.add('open')
}

function closeCommanderModal() {
  document.getElementById('commander-overlay').classList.remove('open')
}

function toggleCmdSection(section) {
  section.classList.toggle('collapsed')
}

function removeCommanded(laboId, idx) {
  const l = labos.find(x => x.id === laboId)
  if (!l || !l.products[idx]) return
  l.products[idx].commanded = false
  saveDataToStorage()
  openCommanderModal()
}

// ─── MODAL DÉPÔT ──────────────────────────────────────────────────────────────

function openDepotModal() {
  const body = document.getElementById('depot-body')

  // Collecter tous les produits marqués dépôt, groupés par labo
  const groups = []
  labos.forEach(l => {
    const depotProducts = (l.products || []).filter(p => p.depot)
    if (depotProducts.length) groups.push({ labo: l, products: depotProducts })
  })

  const totalProduits = groups.reduce((s, g) => s + g.products.length, 0)
  document.getElementById('depot-count-label').textContent =
    groups.length ? `${groups.length} labo${groups.length > 1 ? 's' : ''} · ${totalProduits} produit${totalProduits > 1 ? 's' : ''}` : ''

  if (!groups.length) {
    body.innerHTML = `<div class="cmd-empty">Aucun produit marqué au dépôt.<br><small>Ouvrez un laboratoire dans la sidebar et cliquez sur 📦 Dépôt pour chaque produit disponible.</small></div>`
    document.getElementById('depot-overlay').classList.add('open')
    return
  }

  let html = ''
  groups.forEach(({ labo: l, products }) => {
    const zone = Object.entries(placement).find(([, pl]) => pl.id === l.id)?.[0] || '—'
    html += `
    <div class="cmd-section">
      <div class="cmd-section-title" onclick="toggleCmdSection(this.parentElement)">
        ${l.labo}
        <span style="font-weight:400;color:var(--ink4)">${l.gamme || ''}</span>
        ${zone !== '—' ? `<span class="cmd-status ok" style="margin-left:8px">✓ ${zone}</span>` : ''}
      </div>
      <div class="cmd-row row-depot-item cmd-header">
        <div class="cmd-cell">Désignation produit</div>
        <div class="cmd-cell cip-cell">Code CIP 13</div>
        <div class="cmd-cell offre-cell">Offre</div>
      </div>
      <div class="cmd-section-body">`

    products.forEach(p => {
      html += `
      <div class="cmd-row row-depot-item">
        <div class="cmd-cell">${p.nom || '—'}</div>
        <div class="cmd-cell cip-cell">${p.cip || '—'}</div>
        <div class="cmd-cell offre-cell">${p.offre || '—'}</div>
      </div>`
    })

    html += `</div></div>`
  })

  body.innerHTML = html
  document.getElementById('depot-overlay').classList.add('open')
}

function closeDepotModal() {
  document.getElementById('depot-overlay').classList.remove('open')
}

function exportDepotExcel() {
  const groups = []
  labos.forEach(l => {
    const depotProducts = (l.products || []).filter(p => p.depot)
    if (depotProducts.length) groups.push({ labo: l, products: depotProducts })
  })

  if (!groups.length) { showToast('⚠️  Aucun produit au dépôt'); return }

  const rows = [['Laboratoire', 'Gamme', 'Désignation produit', 'Code CIP 13', 'Offre', 'Zone placée', 'Qté en stock']]
  groups.forEach(({ labo: l, products }) => {
    const zone = Object.entries(placement).find(([, pl]) => pl.id === l.id)?.[0] || ''
    products.forEach(p => {
      rows.push([l.labo, l.gamme || '', p.nom || '', p.cip || '', p.offre || '', zone, ''])
    })
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 40 }, { wch: 16 }, { wch: 22 }, { wch: 10 }, { wch: 14 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dépôt')
  const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')
  XLSX.writeFile(wb, `Depot_${currentMonth.replace(' ', '_') || date}.xlsx`)
  showToast('✅  Export dépôt généré')
}

function exportCommandeExcel() {
  if (!Object.keys(placement).length) { showToast('⚠️ Aucune opération placée'); return }

  const month = document.getElementById('month-select').value || 'Plan'
  const wb    = XLSX.utils.book_new()

  const rows = [['Zone', 'Laboratoire', 'Gamme / Produit', 'Offre', 'Période', 'Email', 'Forfait', 'Notes']]

  SECTIONS_ORDER.forEach(({ key }) => {
    Object.entries(placement)
      .filter(([z]) => z === key || z.startsWith(key))
      .sort(sortZone)
      .forEach(([zone, l]) => {
        const offre  = l.hasBri ? `-${l.bri}€ BRI` : l.isApothical ? 'Apothical & Vous' : l.conditions || ''
        const dates  = l.debut && l.fin ? `${l.debut} → ${l.fin}` : l.debut || ''
        rows.push([zone, l.labo, l.gamme || l.titre, offre, dates, l.email || '', l.forfait || '', placementNotes[zone] || ''])
      })
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 40 }, { wch: 20 }, { wch: 22 }, { wch: 30 }, { wch: 14 }, { wch: 35 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Commande')
  XLSX.writeFile(wb, `Commande_${month.replace(' ', '_')}.xlsx`)
  showToast('✅ Commande exportée')
}

// ─── STOCK & RÉASSORT ─────────────────────────────────────────────────────────

const STOCK_STORAGE_KEY = 'apothical_stock_v1'
let stock     = {}     // { cipNormalisé: quantité }
let stockMeta = null   // { name, date, count }

// Normalise un CIP : ne garde que les chiffres
function normalizeCip(v) {
  return String(v == null ? '' : v).replace(/\D/g, '')
}

// Parse une quantité (gère "12", "12,0", " 3 ", etc.)
function parseQty(v) {
  if (v == null || v === '') return 0
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

// Détecte les colonnes CIP et quantité dans l'export de stock
function detectStockColumns(headers) {
  const find = (...pats) => {
    for (const p of pats) { const i = headers.findIndex(h => h.includes(p)); if (i >= 0) return i }
    return null
  }
  return {
    cip: find('CIP13', 'CIP 13', 'CIP', 'EAN', 'CODE'),
    qty: find('QTE PHYSIQUE', 'QTÉ PHYSIQUE', 'QUANTITE', 'QUANTITÉ', 'QTE', 'QTÉ', 'STOCK', 'DISPO', 'DÉTENU', 'DETENU', 'PHYSIQUE'),
  }
}

// Quantité en stock pour un CIP donné — null si introuvable
function getStockQty(cip) {
  if (!stock) return null
  const key = normalizeCip(cip)
  if (!key) return null
  if (Object.prototype.hasOwnProperty.call(stock, key)) return stock[key]
  // fallback : ignorer les zéros de tête (CIP parfois préfixé par 0)
  const stripped = key.replace(/^0+/, '')
  for (const k in stock) { if (k.replace(/^0+/, '') === stripped) return stock[k] }
  return null
}

function loadStockFile(file) {
  if (!file) return
  if (!file.name.match(/\.(xlsx|xls|csv)$/i)) { showToast('⚠️  Fichier .xlsx ou .csv requis'); return }

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
      let rows = []
      wb.SheetNames.forEach(name => {
        rows = rows.concat(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }))
      })
      if (!rows.length) throw new Error('vide')

      // Trouver la ligne d'entête (celle qui contient un mot CIP)
      let headerIdx = rows.findIndex(r => r.some(c => /CIP|EAN|CODE/i.test(String(c))))
      if (headerIdx < 0) headerIdx = 0
      const headers = rows[headerIdx].map(h => String(h).toUpperCase().trim())
      const sc = detectStockColumns(headers)
      if (sc.cip == null) throw new Error('cip')

      const map = {}
      let lines = 0
      rows.slice(headerIdx + 1).forEach(r => {
        const cip = normalizeCip(r[sc.cip])
        if (!cip || cip.length < 6) return   // ignore lignes sans vrai CIP
        const qty = sc.qty != null ? parseQty(r[sc.qty]) : 0
        map[cip] = (map[cip] || 0) + qty
        lines++
      })
      if (!lines) throw new Error('cip')

      stock = map
      stockMeta = { name: file.name, date: new Date().toISOString(), count: Object.keys(map).length }
      saveStockToStorage()
      updateStockUI()
      showToast(`✅  Stock chargé : ${stockMeta.count} références`)
    } catch (err) {
      if (err.message === 'cip') showToast('❌  Colonne CIP introuvable dans le fichier')
      else showToast('❌  Erreur lecture du fichier stock')
      console.error(err)
    }
  }
  reader.readAsArrayBuffer(file)
}

function saveStockToStorage() {
  try { localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify({ stock, meta: stockMeta })) } catch (e) {}
}

function restoreStockFromStorage() {
  try {
    const raw = localStorage.getItem(STOCK_STORAGE_KEY)
    if (!raw) return
    const o = JSON.parse(raw)
    stock     = o.stock || {}
    stockMeta = o.meta  || null
    updateStockUI()
  } catch (e) {}
}

function updateStockUI() {
  const btn = document.getElementById('btn-stock')
  if (!btn) return
  if (stockMeta && stockMeta.count) {
    btn.classList.add('has-stock')
    btn.innerHTML = `📥 Stock · ${stockMeta.count}`
    btn.title = `Stock chargé : ${stockMeta.count} références (${stockMeta.name}). Cliquez pour remplacer.`
  } else {
    btn.classList.remove('has-stock')
    btn.innerHTML = '📥 Stock'
    btn.title = "Importer l'export de stock de votre logiciel (CIP + quantité)"
  }
}

// Croise les produits des opérations avec le stock → dépôt vs commander
function computeReassort() {
  const depot = [], commander = []
  labos.forEach(l => {
    const zone = Object.entries(placement).find(([, pl]) => pl.id === l.id)?.[0] || ''
    ;(l.products || []).forEach(p => {
      const qty  = getStockQty(p.cip)
      const item = { labo: l.labo, gamme: l.gamme || '', nom: p.nom || '', cip: p.cip || '', offre: p.offre || '', qty, zone }
      if (qty != null && qty >= 1) depot.push(item)
      else commander.push(item)
    })
  })
  return { depot, commander }
}

function renderReassortSection(title, statusClass, items) {
  if (!items.length) {
    return `<div class="cmd-section"><div class="cmd-section-title">${title} <span class="cmd-status ${statusClass}" style="margin-left:8px">0</span></div></div>`
  }
  let html = `
    <div class="cmd-section">
      <div class="cmd-section-title" onclick="toggleCmdSection(this.parentElement)">
        ${title} <span class="cmd-status ${statusClass}" style="margin-left:8px">${items.length}</span>
      </div>
      <div class="cmd-row cmd-header row-reassort">
        <div class="cmd-cell">Laboratoire</div>
        <div class="cmd-cell">Désignation produit</div>
        <div class="cmd-cell cip-cell">Code CIP</div>
        <div class="cmd-cell offre-cell">Offre</div>
        <div class="cmd-cell">Qté stock</div>
      </div>
      <div class="cmd-section-body">`
  items.forEach(it => {
    const qtyTxt = it.qty == null ? '—' : it.qty
    html += `
      <div class="cmd-row row-reassort">
        <div class="cmd-cell labo-cell">${escHtml(it.labo)}</div>
        <div class="cmd-cell">${escHtml(it.nom) || '—'}</div>
        <div class="cmd-cell cip-cell">${it.cip || '—'}</div>
        <div class="cmd-cell offre-cell">${escHtml(it.offre) || '—'}</div>
        <div class="cmd-cell">${qtyTxt}</div>
      </div>`
  })
  html += `</div></div>`
  return html
}

function openReassortModal() {
  const body  = document.getElementById('reassort-body')
  const label = document.getElementById('reassort-count-label')
  const open  = () => document.getElementById('reassort-overlay').classList.add('open')

  if (!labos.length) {
    label.textContent = ''
    body.innerHTML = `<div class="cmd-empty">Aucune opération chargée.<br><small>Importez d'abord un fichier OPEAZ dans la sidebar.</small></div>`
    return open()
  }
  if (!stockMeta) {
    label.textContent = ''
    body.innerHTML = `<div class="cmd-empty">Aucun stock chargé.<br><small>Cliquez sur 📥 Stock et importez l'export CIP + quantité de votre logiciel.</small></div>`
    return open()
  }

  const { depot, commander } = computeReassort()
  label.textContent = `📦 ${depot.length} au dépôt  ·  🛒 ${commander.length} à commander  ·  stock : ${stockMeta.count} réf.`
  body.innerHTML =
    renderReassortSection('📦 À aller chercher au dépôt', 'ok', depot) +
    renderReassortSection('🛒 À commander', 'wait', commander)
  open()
}

function closeReassortModal() {
  document.getElementById('reassort-overlay').classList.remove('open')
}

function exportReassort() {
  if (!labos.length)  { showToast('⚠️  Aucune opération chargée'); return }
  if (!stockMeta)     { showToast('⚠️  Importez d\'abord votre stock (📥 Stock)'); return }

  const { depot, commander } = computeReassort()
  const wb = XLSX.utils.book_new()
  const mkSheet = (items) => {
    const rows = [['Laboratoire', 'Gamme', 'Désignation produit', 'Code CIP 13', 'Offre', 'Qté en stock', 'Zone placée']]
    items.forEach(it => rows.push([it.labo, it.gamme, it.nom, it.cip, it.offre, it.qty == null ? 'non trouvé' : it.qty, it.zone]))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 26 }, { wch: 20 }, { wch: 40 }, { wch: 16 }, { wch: 20 }, { wch: 12 }, { wch: 10 }]
    return ws
  }
  XLSX.utils.book_append_sheet(wb, mkSheet(depot),     'Au dépôt')
  XLSX.utils.book_append_sheet(wb, mkSheet(commander), 'À commander')
  const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')
  XLSX.writeFile(wb, `Reassort_${(currentMonth || 'plan').replace(/ /g, '_') || date}.xlsx`)
  showToast(`✅  Réassort exporté : ${depot.length} dépôt · ${commander.length} commande`)
}

// ─── SÉLECTION DU MOIS ───────────────────────────────────────────────────────

function onMonthChange() {
  const newMonth = document.getElementById('month-select').value

  // Sauvegarder l'état complet du mois courant avant de changer
  if (currentMonth) saveDataToStorage()

  // Vider tout
  clearZonesUI()
  placement       = {}
  placementNotes  = {}
  labos           = []
  photoColIdx     = -1
  currentFileName = ''
  currentMonth    = newMonth

  // Charger les données du nouveau mois (ou afficher état vide)
  if (newMonth) loadMonthData(newMonth)
  else          resetUploadUI()

  // Persister le mois sélectionné (saveDataToStorage précédent a sauvegardé l'ANCIEN mois)
  try {
    const raw   = localStorage.getItem(DATA_STORAGE_KEY)
    const store = raw ? JSON.parse(raw) : { months: {}, currentMonth: '' }
    store.currentMonth = newMonth
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(store))
  } catch (e) {}

  if (newMonth) showToast(`📅  ${newMonth}`)
}

function clearZonesUI() {
  document.querySelectorAll('.zone-content').forEach(c => {
    c.innerHTML = '<div class="zone-placeholder">—</div>'
  })
  document.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('filled'))
}

function loadMonthData(month) {
  try {
    const raw = localStorage.getItem(DATA_STORAGE_KEY)
    if (!raw) { resetUploadUI(); return }
    const monthData = (JSON.parse(raw).months || {})[month]
    if (!monthData || !monthData.labos || !monthData.labos.length) {
      resetUploadUI()
      return
    }
    labos          = monthData.labos
    photoColIdx    = typeof monthData.photoColIdx === 'number' ? monthData.photoColIdx : -1
    currentFileName = monthData.fileName || month
    placementNotes = monthData.placementNotes || {}

    const ids = monthData.placementIds || {}
    for (const [zone, laboId] of Object.entries(ids)) {
      const labo = labos.find(l => l.id === laboId)
      if (labo) { placement[zone] = labo; renderChip(zone, labo) }
    }

    document.getElementById('upload-zone').classList.add('loaded')
    document.getElementById('upload-icon').textContent = '✅'
    document.getElementById('upload-text').innerHTML =
      `<strong>${monthData.fileName || month}</strong><br>${labos.length} laboratoires chargés`
    document.getElementById('header-hint').textContent = 'Glisse les labos dans les zones à droite'
    renderLaboList(labos)
    updateFooter()
    document.getElementById('btn-export').disabled = false
    showToast(`♻️  ${labos.length} laboratoires restaurés — ${month}`)
  } catch (e) { resetUploadUI() }
}

function resetUploadUI() {
  document.getElementById('upload-zone').classList.remove('loaded')
  document.getElementById('upload-icon').textContent = '📂'
  document.getElementById('upload-text').innerHTML =
    `Importe le fichier Excel du mois<br><small style="color:var(--ink4)">Format .xlsx requis</small>`
  document.getElementById('header-hint').textContent = 'Importe un fichier Excel pour commencer'
  document.getElementById('labo-list').innerHTML =
    '<div class="empty-hint"><p>Aucun fichier pour ce mois</p></div>'
  document.getElementById('labo-count').textContent = ''
  document.getElementById('btn-export').disabled = true
  updateFooter()
}

// ─── PLAN PHARMACIE ──────────────────────────────────────────────────────────

let planObjectURL = null
let planRotation  = 0
const PLAN_STORAGE_KEY     = 'apothical_plan_v1'
const ROTATION_STORAGE_KEY = 'apothical_plan_rotation_v1'
const EXCEL_STORAGE_KEY    = 'apothical_excel_v1'
const DATA_STORAGE_KEY = 'apothical_data_v1'
let planZoom      = 1
let planPanX      = 0
let planPanY      = 0
let isPanning     = false
let panStart      = { x: 0, y: 0 }

function applyPlanTransform(animate = true) {
  const viewer = document.getElementById('plan-viewer')
  viewer.style.transition = animate ? 'transform .25s cubic-bezier(.16,1,.3,1)' : 'none'
  viewer.style.transform  =
    `rotate(${planRotation}deg) scale(${planZoom}) translate(${planPanX}px, ${planPanY}px)`
  document.getElementById('zoom-label').textContent = Math.round(planZoom * 100) + '%'
}

function zoomPlan(delta) {
  planZoom = Math.min(5, Math.max(0.2, planZoom + delta))
  applyPlanTransform()
}

function resetZoom() {
  planZoom = 1; planPanX = 0; planPanY = 0
  applyPlanTransform()
  document.getElementById('zoom-label').textContent = '100%'
}

function rotatePlan() {
  planRotation = (planRotation + 90) % 360
  applyPlanTransform()
  saveRotationToStorage()
}

function saveRotationToStorage() {
  try {
    localStorage.setItem(ROTATION_STORAGE_KEY, String(planRotation))
  } catch (e) {}
}

function savePlanRotation() {
  saveRotationToStorage()
  const btn = document.getElementById('btn-save-rotation')
  btn.textContent = '✓ Sauvegardé'
  btn.style.color = '#2a7a4b'
  setTimeout(() => {
    btn.textContent = '💾 Sauvegarder'
    btn.style.color = ''
  }, 2000)
}

function loadPlanFile(file) {
  if (!file) return

  // Lire en base64 pour affichage ET sauvegarde
  const reader = new FileReader()
  reader.onload = (e) => {
    const dataURL = e.target.result
    displayPlan(dataURL, file.name)
    savePlanToStorage(dataURL, file.name)
  }
  reader.readAsDataURL(file)
}

function displayPlan(dataURL, fileName) {
  if (planObjectURL) URL.revokeObjectURL(planObjectURL)

  // Convertir dataURL → objectURL pour l'iframe/img
  planObjectURL = dataURL

  // Réinitialiser rotation, zoom et pan
  planRotation = 0; planZoom = 1; planPanX = 0; planPanY = 0
  applyPlanTransform(false)
  document.getElementById('zoom-label').textContent = '100%'

  const isPDF  = fileName.match(/\.pdf$/i) || dataURL.startsWith('data:application/pdf')
  const iframe = document.getElementById('plan-iframe')
  const img    = document.getElementById('plan-img')
  const empty  = document.getElementById('plan-empty')

  empty.style.display  = 'none'
  iframe.style.display = 'none'
  img.style.display    = 'none'

  if (isPDF) {
    iframe.src = dataURL
    iframe.style.display = 'block'
  } else {
    img.src = dataURL
    img.style.display = 'block'
  }

  document.getElementById('plan-file-name').textContent = fileName
  document.getElementById('btn-plan').classList.add('has-plan')
  document.getElementById('plan-modal').classList.add('open')
}

function savePlanToStorage(dataURL, fileName) {
  try {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ dataURL, fileName }))
    showToast(`📐  ${fileName} chargé et sauvegardé`)
  } catch (e) {
    showToast(`📐  ${fileName} chargé (fichier trop lourd pour être sauvegardé)`)
  }
}

function restorePlanFromStorage() {
  try {
    const saved = localStorage.getItem(PLAN_STORAGE_KEY)
    if (!saved) {
      if (window.DEFAULT_PLAN) {
        displayPlan(window.DEFAULT_PLAN.dataURL, window.DEFAULT_PLAN.fileName)
        savePlanToStorage(window.DEFAULT_PLAN.dataURL, window.DEFAULT_PLAN.fileName)
        const savedRotation = parseInt(localStorage.getItem(ROTATION_STORAGE_KEY) || '0', 10)
        if (savedRotation) { planRotation = savedRotation; applyPlanTransform(false) }
      }
      return
    }
    const { dataURL, fileName } = JSON.parse(saved)
    if (!dataURL || !fileName) return
    displayPlan(dataURL, fileName)
    const savedRotation = parseInt(localStorage.getItem(ROTATION_STORAGE_KEY) || '0', 10)
    if (savedRotation) { planRotation = savedRotation; applyPlanTransform(false) }
    // Ne pas rouvrir le modal automatiquement — juste activer le bouton
    document.getElementById('plan-modal').classList.remove('open')
    document.getElementById('btn-plan').classList.add('has-plan')
    document.getElementById('plan-file-name').textContent = fileName
  } catch (e) {}
}

function openPlanModal() {
  document.getElementById('plan-modal').classList.add('open')
}

function closePlanModal() {
  document.getElementById('plan-modal').classList.remove('open')
}

// ─── CRÉATION MANUELLE D'OPÉRATION ───────────────────────────────────────────

function copyCip(btn) {
  const cip = btn.dataset.cip
  navigator.clipboard.writeText(cip).then(() => showToast('⎘ CIP copié'))
}

function renderOpProductsTable(labo) {
  const section = document.getElementById('op-products-section')
  const tbody   = document.getElementById('op-products-tbody')
  const products = (labo?.products || []).filter(p => p.nom || p.cip)
  if (!products.length) { section.style.display = 'none'; return }

  tbody.innerHTML = products.map(p => `
    <tr>
      <td>${labo.gamme || '—'}</td>
      <td>${p.nom  || '—'}</td>
      <td class="mono">
        <span class="cip-td">
          <span>${p.cip || '—'}</span>
          ${p.cip ? `<button class="btn-copy-cip" data-cip="${escHtml(p.cip)}" onclick="copyCip(this)" title="Copier le CIP">⎘</button>` : ''}
        </span>
      </td>
      <td>${p.offre || '—'}</td>
    </tr>`).join('')
  section.style.display = 'block'
}

function editZone(zoneId) {
  const labo = placement[zoneId]
  if (!labo) return

  isEditMode       = true
  createTargetZone = zoneId
  createSourceLabo = labo

  document.getElementById('create-modal-title').textContent  = 'Modifier l\'opération'
  document.getElementById('create-zone-label').textContent    = `Zone : ${zoneId}`
  document.getElementById('btn-submit-create').textContent    = 'Enregistrer'

  document.getElementById('cf-labo').value    = labo.labo
  document.getElementById('cf-labo').readOnly = false
  document.getElementById('cf-gamme').value   = labo.gamme     || ''
  document.getElementById('cf-offre').value   = labo.conditions || ''
  document.getElementById('cf-debut').value   = labo.debut     || ''
  document.getElementById('cf-fin').value     = labo.fin       || ''
  document.getElementById('cf-notes').value   = placementNotes[zoneId] || ''

  const typeSelect = document.getElementById('cf-type')
  if (labo.hasBri) {
    typeSelect.value = 'bri'
    document.getElementById('cf-bri').value = labo.bri || ''
    document.getElementById('cf-bri-wrap').style.display = 'block'
  } else if (labo.isApothical) {
    typeSelect.value = 'av'
    document.getElementById('cf-bri-wrap').style.display = 'none'
  } else {
    typeSelect.value = 'tg'
    document.getElementById('cf-bri-wrap').style.display = 'none'
  }

  renderOpProductsTable(labo)
  document.getElementById('create-overlay').classList.add('open')
  setTimeout(() => document.getElementById('cf-gamme').focus(), 80)
}

function openCreateModal(zoneId) {
  createTargetZone = zoneId
  createSourceLabo = null
  document.getElementById('create-modal-title').textContent = 'Nouvelle opération'
  document.getElementById('create-zone-label').textContent = `Zone : ${zoneId}`
  document.getElementById('create-form').reset()
  document.getElementById('cf-labo').readOnly = false
  document.getElementById('cf-bri-wrap').style.display = 'none'
  document.getElementById('cf-notes').value = ''
  document.getElementById('btn-submit-create').textContent = 'Créer & Placer'
  document.getElementById('op-products-section').style.display = 'none'
  document.getElementById('create-overlay').classList.add('open')
  setTimeout(() => document.getElementById('cf-labo').focus(), 80)
}

function openCreateModalForDrop(zoneId, labo) {
  createTargetZone = zoneId
  createSourceLabo = labo

  document.getElementById('create-modal-title').textContent = 'Confirmer l\'opération'
  document.getElementById('create-zone-label').textContent = `Zone : ${zoneId}`

  // Pré-remplir avec les données du labo
  document.getElementById('cf-labo').value  = labo.labo
  document.getElementById('cf-labo').readOnly = true
  document.getElementById('cf-gamme').value = labo.gamme || ''
  document.getElementById('cf-offre').value = labo.conditions || ''
  document.getElementById('cf-debut').value = labo.debut || ''
  document.getElementById('cf-fin').value   = labo.fin   || ''
  document.getElementById('cf-notes').value = ''

  const typeSelect = document.getElementById('cf-type')
  if (labo.hasBri) {
    typeSelect.value = 'bri'
    document.getElementById('cf-bri').value = labo.bri || ''
    document.getElementById('cf-bri-wrap').style.display = 'block'
  } else if (labo.isApothical) {
    typeSelect.value = 'av'
    document.getElementById('cf-bri-wrap').style.display = 'none'
  } else {
    typeSelect.value = 'tg'
    document.getElementById('cf-bri-wrap').style.display = 'none'
  }

  document.getElementById('btn-submit-create').textContent = 'Confirmer & Placer'
  renderOpProductsTable(labo)
  document.getElementById('create-overlay').classList.add('open')
  setTimeout(() => document.getElementById('cf-offre').focus(), 80)
}

function toggleExpandCreate() {
  const panel    = document.querySelector('.create-panel')
  const btn      = document.getElementById('btn-expand-create')
  const inner    = document.querySelector('.create-form-inner')
  const fields   = document.querySelector('.form-fields')
  const prodSec  = document.getElementById('op-products-section')
  const tableWrap = document.querySelector('.op-products-table-wrap')
  const expanded = panel.classList.toggle('expanded')

  if (expanded) {
    panel.style.width    = 'min(1100px, 96vw)'
    panel.style.maxHeight = '90vh'
    inner.style.cssText  = 'display:flex;flex-direction:row;gap:20px;align-items:flex-start;'
    fields.style.cssText = 'flex:0 0 320px;min-width:0;'
    if (prodSec) {
      prodSec.style.cssText   = 'flex:1;min-width:0;display:block;margin-top:0;'
      if (tableWrap) tableWrap.style.maxHeight = 'calc(90vh - 180px)'
    }
    btn.textContent = '⤡'
    btn.title       = 'Réduire'
  } else {
    panel.style.width    = '640px'
    panel.style.maxHeight = ''
    inner.style.cssText  = ''
    fields.style.cssText = ''
    if (prodSec && prodSec.children.length > 1) {
      prodSec.style.cssText = 'display:block;'
      if (tableWrap) tableWrap.style.maxHeight = '200px'
    }
    btn.textContent = '⤢'
    btn.title       = 'Agrandir'
  }
}

function closeCreateModal() {
  const panel = document.querySelector('.create-panel')
  panel.classList.remove('expanded')
  panel.style.width = ''
  panel.style.maxHeight = ''
  const inner  = document.querySelector('.create-form-inner')
  const fields = document.querySelector('.form-fields')
  if (inner)  inner.style.cssText  = ''
  if (fields) fields.style.cssText = ''
  document.getElementById('btn-expand-create').textContent = '⤢'
  document.getElementById('create-overlay').classList.remove('open')
  document.getElementById('labo-suggestions').style.display = 'none'

  // Si on annule un drop (pas une édition), remettre la carte disponible dans la sidebar
  if (createSourceLabo && !isEditMode) {
    setCardPlaced(createSourceLabo.id, false)
  }

  createTargetZone = null
  createSourceLabo = null
  isEditMode       = false
}

// ─── AUTOCOMPLETE LABO ───────────────────────────────────────────────────────

let laboSuggestionsData = []

function laboAutocomplete(q) {
  const box     = document.getElementById('labo-suggestions')
  const trimmed = q.trim().toLowerCase()

  if (!trimmed || !labos.length) { box.style.display = 'none'; return }

  laboSuggestionsData = labos.filter(l =>
    (l.labo || '').toLowerCase().includes(trimmed) ||
    (l.gamme || '').toLowerCase().includes(trimmed)
  ).slice(0, 20)

  if (!laboSuggestionsData.length) { box.style.display = 'none'; return }

  box.innerHTML = laboSuggestionsData.map((l, i) => {
    const offre  = l.bri ? `BRI −${l.bri}€` : (l.conditions || '')
    const dates  = (l.debut || l.fin) ? `${l.debut}${l.fin ? ' → ' + l.fin : ''}` : ''
    const badge  = l.hasBri ? '<span class="sug-badge bri">BRI</span>'
                 : l.isApothical ? '<span class="sug-badge av">A&V</span>'
                 : l.isSolaire   ? '<span class="sug-badge sol">☀</span>' : ''
    return `
    <div class="labo-suggestion-item" data-idx="${i}">
      <div class="suggestion-row-top">
        <span class="suggestion-name">${l.labo}</span>
        ${badge}
      </div>
      ${l.gamme ? `<div class="suggestion-gamme">${l.gamme}</div>` : ''}
      <div class="suggestion-meta">
        ${offre ? `<span>${offre}</span>` : ''}
        ${dates ? `<span class="suggestion-dates">${dates}</span>` : ''}
      </div>
    </div>`
  }).join('')

  box.querySelectorAll('.labo-suggestion-item').forEach(el => {
    el.addEventListener('mousedown', e => {
      e.preventDefault()
      const m = laboSuggestionsData[+el.dataset.idx]
      selectLaboSuggestion(m.labo, m.gamme, m.conditions)
    })
  })

  box.style.display = 'block'
}

function selectLaboSuggestion(nom, gamme, offre) {
  document.getElementById('cf-labo').value  = nom
  if (gamme) document.getElementById('cf-gamme').value  = gamme
  if (offre) document.getElementById('cf-offre').value  = offre
  document.getElementById('labo-suggestions').style.display = 'none'
}

function toggleBriField() {
  const isBri = document.getElementById('cf-type').value === 'bri'
  document.getElementById('cf-bri-wrap').style.display = isBri ? 'block' : 'none'
}

function submitCreateOp(event) {
  event.preventDefault()

  const nom    = document.getElementById('cf-labo').value.trim()
  const gamme  = document.getElementById('cf-gamme').value.trim()
  const type   = document.getElementById('cf-type').value
  const briVal = document.getElementById('cf-bri').value.trim()
  const offre  = document.getElementById('cf-offre').value.trim()
  const debut  = document.getElementById('cf-debut').value.trim()
  const fin    = document.getElementById('cf-fin').value.trim()
  const note   = document.getElementById('cf-notes').value.trim()

  if (!nom) return

  const hasBri      = type === 'bri' && briVal && parseFloat(briVal) > 0
  const isApothical = type === 'av'

  let labo
  if (createSourceLabo) {
    // Mise à jour du labo existant
    labo             = createSourceLabo
    labo.labo        = nom
    labo.gamme       = gamme
    labo.titre       = offre || gamme
    labo.conditions  = offre
    labo.debut       = debut
    labo.fin         = fin
    labo.hasBri      = hasBri
    labo.bri         = hasBri ? briVal : null
    labo.isApothical = isApothical

    if (isEditMode) {
      // Re-rendre le chip en place sans changer le placement
      placement[createTargetZone] = labo
      if (note) placementNotes[createTargetZone] = note
      else delete placementNotes[createTargetZone]
      renderChip(createTargetZone, labo)
      applyFilters()
      updateFooter()
      saveDataToStorage()
      closeCreateModal()
      showToast(`✅  ${labo.labo} modifié`)
      return
    }
  } else {
    // Création d'un nouveau labo
    const id = nom.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '_' + Date.now()
    labo = {
      id, labo: nom, gamme, titre: offre || gamme,
      type_zone: '', bri: hasBri ? briVal : null,
      hasBri, isApothical, isSolaire: false, isBebe: false,
      debut, fin, ean: '', conditions: offre, email: '', forfait: '',
      products: [],
    }
    labos.push(labo)
  }

  if (createTargetZone && !placement[createTargetZone]) {
    placement[createTargetZone] = labo
    if (note) placementNotes[createTargetZone] = note
    else delete placementNotes[createTargetZone]
    renderChip(createTargetZone, labo)
    setCardPlaced(labo.id, true)
  }

  applyFilters()
  updateFooter()
  saveDataToStorage()
  closeCreateModal()
  showToast(`✅  ${labo.labo} placé en ${createTargetZone}`)
}

// ─── MODAL DÉTAIL LABO ───────────────────────────────────────────────────────

function showDetail(laboId) {
  const l = labos.find(x => x.id === laboId)
  if (!l) return

  currentDetailId = laboId

  document.getElementById('modal-labo-name').textContent = l.labo
  document.getElementById('modal-dates').textContent =
    l.debut && l.fin ? `${l.debut}  →  ${l.fin}` : ''

  const badges = []
  if (l.isApothical) badges.push(`<span class="badge b-av">A&amp;V</span>`)
  if (l.hasBri)      badges.push(`<span class="badge b-bri">BRI ${l.bri}€</span>`)
  else               badges.push(`<span class="badge b-tg">TG</span>`)
  if (l.isSolaire)   badges.push(`<span class="badge b-solaire">☀ Solaire</span>`)
  if (l.isBebe)      badges.push(`<span class="badge b-bebe">👶 Bébé</span>`)
  document.getElementById('modal-badges').innerHTML = badges.join('')

  renderProductsTable(l)
  document.getElementById('modal-overlay').classList.add('open')
}

function renderProductsTable(l) {
  const products = l.products || []
  const depotCount = products.filter(p => p.depot).length
  const countParts = []
  if (products.length) countParts.push(`${products.length} produit${products.length > 1 ? 's' : ''}`)
  if (depotCount)      countParts.push(`📦 ${depotCount} en dépôt`)
  document.getElementById('modal-count').textContent = countParts.join('  ·  ')

  const tbody = document.getElementById('products-tbody')
  if (!products.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Aucun produit trouvé</td></tr>`
    return
  }
  tbody.innerHTML = products.map((p, i) => `
    <tr class="${p.depot ? 'row-depot' : ''}">
      <td>${p.nom || '<em style="color:var(--ink4)">—</em>'}</td>
      <td class="cip-cell">
        <span class="cip-value">${p.cip || '—'}</span>
        ${p.cip ? `<button class="row-btn copy cip-copy-btn" onclick="copyProductRow(${i})" title="Copier le CIP">⎘</button>` : ''}
      </td>
      <td class="offre-cell">${p.offre || '<em style="color:var(--ink4)">—</em>'}</td>
      <td class="depot-cell">
        <button class="btn-depot ${p.depot ? 'active' : ''}" onclick="toggleDepot(${i})" title="${p.depot ? 'Retirer du dépôt' : 'Marquer comme disponible au dépôt'}">
          📦 ${p.depot ? 'En dépôt' : 'Dépôt'}
        </button>
      </td>
      <td class="commander-cell">
        <button class="btn-commander ${p.commanded ? 'active' : ''}" onclick="toggleProductCommander(${i})" title="${p.commanded ? 'Annuler la commande' : 'Marquer comme commandé'}">
          🛒 ${p.commanded ? 'Commandé' : 'Commander'}
        </button>
      </td>
      <td class="row-actions">
        <button class="row-btn del" onclick="deleteProductRow(${i})" title="Supprimer">✕</button>
      </td>
    </tr>`).join('')
}

function toggleDepot(idx) {
  const l = labos.find(x => x.id === currentDetailId)
  if (!l || !l.products[idx]) return
  l.products[idx].depot = !l.products[idx].depot
  renderProductsTable(l)
  // Mettre à jour le badge dépôt sur la carte sidebar
  const hasDepot = l.products.some(p => p.depot)
  const card = document.getElementById('card-' + l.id)
  if (card) {
    const existing = card.querySelector('.b-depot')
    if (hasDepot && !existing) {
      card.querySelector('.labo-card-badges')?.insertAdjacentHTML('beforeend', '<span class="badge b-depot">📦 Dépôt</span>')
    } else if (!hasDepot && existing) {
      existing.remove()
    }
  }
  saveDataToStorage()
  showToast(l.products[idx].depot ? '📦  Produit marqué au dépôt' : '↩  Retiré du dépôt')
}

function toggleProductCommander(idx) {
  const l = labos.find(x => x.id === currentDetailId)
  if (!l || !l.products[idx]) return
  l.products[idx].commanded = !l.products[idx].commanded
  renderProductsTable(l)
  saveDataToStorage()
  if (l.products[idx].commanded) {
    closeModal()
    openCommanderModal()
  } else {
    showToast('↩  Commande annulée')
  }
}

function exportLaboCIP() {
  const l = labos.find(x => x.id === currentDetailId)
  if (!l) return
  const products = (l.products || []).filter(p => p.cip || p.nom)
  if (!products.length) { showToast('⚠️  Aucun produit à exporter'); return }

  const rows = [
    ['Laboratoire', l.labo, '', ''],
    ['Période', `${l.debut || ''} → ${l.fin || ''}`, '', ''],
    ['Gamme', l.gamme || '', '', ''],
    [],
    ['Désignation produit', 'Code CIP 13', 'Offre', 'DÉPÔT', 'Qté en stock'],
    ...products.map(p => [p.nom || '', p.cip || '', p.offre || '', p.depot ? '📦 OUI' : '', ''])
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 42 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Produits CIP')

  const safeName = l.labo.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)
  const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')
  XLSX.writeFile(wb, `CIP_${safeName}_${date}.xlsx`)
  showToast(`⬇  ${products.length} produit(s) exportés`)
}

function copyProductRow(idx) {
  const l = labos.find(x => x.id === currentDetailId)
  if (!l) return
  const p = l.products[idx]
  if (!p) return
  const text = p.cip || ''
  navigator.clipboard.writeText(text)
    .then(() => showToast(`⎘  CIP copié : ${text}`))
    .catch(() => showToast('❌  Copie impossible'))
}

function deleteProductRow(idx) {
  const l = labos.find(x => x.id === currentDetailId)
  if (!l) return
  const removed = l.products.splice(idx, 1)[0]
  renderProductsTable(l)
  if (removed) showToast(`🗑  ${removed.nom || removed.cip || 'Produit'} supprimé`)
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open')
}

// ─── TOAST ───────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.classList.remove('show'), 2600)
}

// ─── SAUVEGARDE / RESTAURATION DONNÉES ───────────────────────────────────────

function saveDataToStorage() {
  if (!currentMonth) return
  try {
    const raw   = localStorage.getItem(DATA_STORAGE_KEY)
    const store = raw ? JSON.parse(raw) : { months: {}, currentMonth: '' }
    if (!store.months) store.months = {}

    const ids = {}
    for (const [zone, labo] of Object.entries(placement)) ids[zone] = labo.id

    store.months[currentMonth] = {
      labos,
      photoColIdx,
      placementIds: ids,
      placementNotes: { ...placementNotes },
      fileName: currentFileName || currentMonth,
    }
    store.currentMonth = currentMonth
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(store))
  } catch (e) {}
}

function restoreDataFromStorage() {
  try {
    const raw = localStorage.getItem(DATA_STORAGE_KEY)
    if (!raw) return
    const store = JSON.parse(raw)
    const month = store.currentMonth || ''
    if (!month) return

    currentMonth = month
    const sel   = document.getElementById('month-select')
    const match = Array.from(sel.options).find(o => o.value === month)
    if (match) sel.value = month

    loadMonthData(month)
  } catch (e) {}
}

// ─── SAUVEGARDE / RESTAURATION COMPLÈTE ─────────────────────────────────────

function exportBackup() {
  const data  = localStorage.getItem(DATA_STORAGE_KEY)
  const plan  = localStorage.getItem(PLAN_STORAGE_KEY)
  const excel = localStorage.getItem(EXCEL_STORAGE_KEY)
  const stockData = localStorage.getItem(STOCK_STORAGE_KEY)
  if (!data && !plan) { showToast('⚠️  Aucune donnée à sauvegarder'); return }
  const backup = JSON.stringify({ data, plan, excel, stock: stockData, version: 3, date: new Date().toISOString() })
  const blob = new Blob([backup], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `apothical_backup_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  showToast('💾  Sauvegarde exportée')
}

function importBackup(file) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    try {
      const backup = JSON.parse(e.target.result)
      if (!backup.data && !backup.plan) throw new Error('invalid')
      if (backup.data)  localStorage.setItem(DATA_STORAGE_KEY,  backup.data)
      if (backup.plan)  localStorage.setItem(PLAN_STORAGE_KEY,  backup.plan)
      if (backup.excel) localStorage.setItem(EXCEL_STORAGE_KEY, backup.excel)
      if (backup.stock) localStorage.setItem(STOCK_STORAGE_KEY, backup.stock)
      showToast('✅  Sauvegarde restaurée — rechargement…')
      setTimeout(() => location.reload(), 1400)
    } catch {
      showToast('❌  Fichier de sauvegarde invalide')
    }
  }
  reader.readAsText(file)
}
