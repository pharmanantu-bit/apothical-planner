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

  // Listener délégué : clic sur une zone vide → ouvrir le formulaire de création
  document.getElementById('plan-area').addEventListener('click', e => {
    if (draggedId) return
    const zone = e.target.closest('.drop-zone')
    if (!zone || zone.classList.contains('filled')) return
    if (e.target.closest('.chip-remove')) return
    openCreateModal(zone.dataset.zone)
  })

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeCreateModal(); closePlanModal(); closeCommanderModal() }
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
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

      // Ligne 0 = entêtes — détection dynamique des colonnes
      const headers = (rows[0] || []).map(h => String(h).toUpperCase().trim())
      const cols    = detectColumns(headers)
      photoColIdx   = cols.photo

      // Parsing avec gestion des lignes de continuation (nom vide = produit supplémentaire)
      const map   = {}   // key → labo
      const order = []   // clés dans l'ordre d'apparition
      let lastKey = ''

      rows.slice(1).forEach(r => {
        let nom = String(r[cols.nom] || '').trim()

        // Ignorer entêtes répétés et lignes entièrement vides
        if (!nom || nom === 'NAN' ||
            nom.toUpperCase() === 'NOM DU LABORATOIRE' ||
            nom.toUpperCase() === 'LABORATOIRE') {
          // Ligne de continuation si on a un contexte
          if (!nom && lastKey && map[lastKey]) {
            nom = map[lastKey].labo
          } else {
            return
          }
        }

        const debut    = String(r[cols.debut]    || '').trim()
        const fin      = String(r[cols.fin]      || '').trim()
        const typeZone = String(r[cols.typeZone]  || '').trim()

        // Clé unique par opération : même labo + même période + même zone = même op
        const key = nom + '|||' + debut + '|||' + fin + '|||' + typeZone

        if (!map[key]) {
          map[key] = buildLabo(nom, r, cols, key)
          map[key].products = []
          order.push(key)
        }
        lastKey = key

        // Collecter les produits de cette ligne
        const cip  = String(r[cols.cip]    || '').trim()
        const prod = String(r[cols.prodNom] || '').trim() || String(r[cols.gamme] || '').trim()
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
      showToast(`✅  ${labos.length} opérations · ${totalProducts} produits chargés`)
    } catch (err) {
      showToast('❌  Erreur lecture fichier')
      console.error(err)
    }
  }
  reader.readAsArrayBuffer(file)
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

  container.innerHTML = list.map(l => buildLaboCardHTML(l)).join('')
}

function buildLaboCardHTML(l) {
  const placed  = isPlaced(l.id)
  const badges  = []

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
  draggedId    = null

  if (!labo) return

  // Zone déjà occupée
  if (placement[zoneId]) {
    showToast('⚠️  Zone occupée — retire d\'abord le labo présent')
    return
  }

  // Retirer de l'éventuelle ancienne zone
  for (const [z, l] of Object.entries(placement)) {
    if (l.id === labo.id) {
      delete placement[z]
      clearZone(z)
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

  if (!entries.length) {
    body.innerHTML = `<div class="cmd-empty">Aucune opération placée pour le moment.</div>`
    document.getElementById('commander-overlay').classList.add('open')
    return
  }

  let html = ''
  SECTIONS_ORDER.forEach(({ key, label }) => {
    const rows = entries.filter(([z]) => z === key || z.startsWith(key))
                        .sort(sortZone)
    if (!rows.length) return

    html += `<div class="cmd-section">
      <div class="cmd-section-title">${label} <span style="font-weight:400;color:var(--ink4)">${rows.length} opération${rows.length > 1 ? 's' : ''}</span></div>
      <div class="cmd-row cmd-header">
        <div class="cmd-cell zone-cell">Zone</div>
        <div class="cmd-cell">Laboratoire · Gamme</div>
        <div class="cmd-cell">Offre</div>
        <div class="cmd-cell">Période</div>
        <div class="cmd-cell">Statut</div>
      </div>`

    rows.forEach(([zone, l]) => {
      const offre = l.hasBri ? `-${l.bri}€ BRI` : l.isApothical ? 'A&V' : l.conditions || '—'
      const dates = l.debut && l.fin ? `${l.debut} → ${l.fin}` : l.debut || '—'
      const placed = !!placement[zone]
      html += `
      <div class="cmd-row">
        <div class="cmd-cell zone-cell">${zone}</div>
        <div class="cmd-cell labo-cell">
          <div>
            <div>${l.labo}</div>
            <div style="font-size:11px;color:var(--ink3);font-weight:400">${l.gamme || ''}</div>
          </div>
        </div>
        <div class="cmd-cell offre-cell">${offre}</div>
        <div class="cmd-cell dates-cell">${dates}</div>
        <div class="cmd-cell status-cell">
          <span class="cmd-status ${placed ? 'ok' : 'wait'}">${placed ? '✓ Placé' : '⏳ En attente'}</span>
        </div>
      </div>`
    })

    html += `</div>`
  })

  body.innerHTML = html
  document.getElementById('commander-overlay').classList.add('open')
}

function closeCommanderModal() {
  document.getElementById('commander-overlay').classList.remove('open')
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
const PLAN_STORAGE_KEY = 'apothical_plan_v1'
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
    if (!saved) return
    const { dataURL, fileName } = JSON.parse(saved)
    if (!dataURL || !fileName) return
    displayPlan(dataURL, fileName)
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
  document.getElementById('create-overlay').classList.add('open')
  setTimeout(() => document.getElementById('cf-offre').focus(), 80)
}

function closeCreateModal() {
  document.getElementById('create-overlay').classList.remove('open')
  createTargetZone = null
  createSourceLabo = null
  isEditMode       = false
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
  document.getElementById('modal-count').textContent =
    products.length ? `${products.length} produit${products.length > 1 ? 's' : ''}` : ''

  const tbody = document.getElementById('products-tbody')
  if (!products.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">Aucun produit trouvé</td></tr>`
    return
  }
  tbody.innerHTML = products.map((p, i) => `
    <tr>
      <td>${p.nom || '<em style="color:var(--ink4)">—</em>'}</td>
      <td class="cip-cell">
        <span class="cip-value">${p.cip || '—'}</span>
        ${p.cip ? `<button class="row-btn copy cip-copy-btn" onclick="copyProductRow(${i})" title="Copier le CIP">⎘</button>` : ''}
      </td>
      <td class="offre-cell">${p.offre || '<em style="color:var(--ink4)">—</em>'}</td>
      <td class="row-actions">
        <button class="row-btn del" onclick="deleteProductRow(${i})" title="Supprimer">✕</button>
      </td>
    </tr>`).join('')
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
