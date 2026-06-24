/* ════════════════════════════════════════════════════════════════════════════
   APOTHICAL PLANNER — Couche cloud (Supabase)
   - Lecture libre pour toute l'équipe / écriture réservée au propriétaire connecté
   - localStorage reste le cache local + le mode hors-ligne ; le cloud est la source
     de vérité quand on est en ligne.
   - Tolérant hors-ligne : si non configuré ou sans réseau, l'app fonctionne comme avant.
   ════════════════════════════════════════════════════════════════════════════ */

/* ─── 1) CONFIG — À REMPLIR APRÈS CRÉATION DU PROJET SUPABASE ──────────────────
   Project Settings → API :
     • Project URL          → CLOUD_CONFIG.url
     • Project API keys → anon public → CLOUD_CONFIG.anonKey
*/
const CLOUD_CONFIG = {
  url:        'https://qolvysomdrelcdvvtnud.supabase.co',
  anonKey:    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbHZ5c29tZHJlbGNkdnZ0bnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyODc5NjMsImV4cCI6MjA5Nzg2Mzk2M30.-8kn969ZBbiPulNOq8_DNGBGt6sMrX-bR78SefurxPM',
  ownerEmail: 'pharmanantu@gmail.com',  // seul compte autorisé à écrire
}

/* ─── 2) Clés localStorage (doivent matcher app.js) ───────────────────────────── */
const CLOUD_KEYS = {
  data:  'apothical_data_v1',
  plan:  'apothical_plan_v1',
  rot:   'apothical_plan_rotation_v1',
  stock: 'apothical_stock_v1',
  dirty: 'apothical_cloud_dirty',   // mois modifiés localement et pas encore poussés
}
const GLOBAL_ROW = '__global__'      // ligne unique : plan pharmacie + stock partagés

let sb        = null   // client supabase
let cloudUser = null   // session propriétaire (ou null)

/* ════════════════════════════ UTILITAIRES ════════════════════════════════════ */

function cloudConfigured() {
  return !!(CLOUD_CONFIG.url && CLOUD_CONFIG.anonKey && window.supabase)
}
function cloudIsOwner() { return !!(cloudUser && cloudUser.email === CLOUD_CONFIG.ownerEmail) }

function readLS(key)  { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null } }
function rawLS(key)   { try { return localStorage.getItem(key) } catch { return null } }
function writeLS(k,v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)) } catch (e) {} }

/* — suivi des mois modifiés hors-ligne (pour ne jamais écraser un brouillon local) — */
function getDirty()      { return readLS(CLOUD_KEYS.dirty) || [] }
function markDirty(key)  { const d = getDirty(); if (!d.includes(key)) { d.push(key); writeLS(CLOUD_KEYS.dirty, d) } }
function clearDirty(key) { writeLS(CLOUD_KEYS.dirty, getDirty().filter(k => k !== key)) }

/* ════════════════════════════ INITIALISATION ═════════════════════════════════ */

async function cloudInit() {
  if (!cloudConfigured()) { updateCloudBadge('off'); return }
  try {
    sb = supabase.createClient(CLOUD_CONFIG.url, CLOUD_CONFIG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
    const { data } = await sb.auth.getSession()
    cloudUser = data && data.session ? data.session.user : null
    updateCloudBadge(cloudIsOwner() ? 'owner' : 'read')
    await cloudBootSync()
  } catch (e) {
    console.warn('[cloud] init échouée — mode local', e)
    updateCloudBadge('offline')
  }
}

/* Synchro au démarrage :
   1. (propriétaire) pousser les modifs locales en attente
   2. tirer le global (plan + stock) puis les mois depuis le cloud
   3. re-rendre l'écran                                                          */
async function cloudBootSync() {
  if (!sb) return
  try {
    if (cloudIsOwner()) await cloudFlushDirty()
    await cloudPullGlobal()
    await cloudPullAllMonths()       // remplit le cache local de tous les mois
    rerenderAfterSync()
    updateCloudBadge(cloudIsOwner() ? 'owner' : 'read')
  } catch (e) {
    console.warn('[cloud] boot sync partielle', e)
    updateCloudBadge('offline')
  }
}

function rerenderAfterSync() {
  const keep = typeof currentMonth !== 'undefined' ? currentMonth : ''
  try {
    if (keep && typeof loadMonthData === 'function') loadMonthData(keep)
    else if (typeof restoreDataFromStorage === 'function') restoreDataFromStorage()
    if (typeof restorePlanFromStorage  === 'function') restorePlanFromStorage()
    if (typeof restoreStockFromStorage === 'function') restoreStockFromStorage()
  } catch (e) { console.warn('[cloud] rerender', e) }
}

/* ════════════════════════════ PUSH (propriétaire) ════════════════════════════ */

/* Pousse un mois précis. Si offline / non-owner → marque dirty et sort. */
async function cloudPushMonth(mois) {
  if (!mois) return
  if (!sb || !cloudIsOwner()) { markDirty(mois); return }
  const store = readLS(CLOUD_KEYS.data) || { months: {} }
  const monthData = (store.months || {})[mois]
  if (!monthData) return
  try {
    const { error } = await sb.from('plans')
      .upsert({ mois, data: monthData, updated_by: cloudUser.email }, { onConflict: 'mois' })
    if (error) throw error
    clearDirty(mois)
    updateCloudBadge('owner', '✓ synchronisé')
  } catch (e) {
    console.warn('[cloud] push mois échoué', e); markDirty(mois)
    updateCloudBadge('offline')
  }
}

/* Pousse le global : plan pharmacie + stock partagés. */
async function cloudPushGlobal() {
  if (!sb || !cloudIsOwner()) { markDirty(GLOBAL_ROW); return }
  const plan  = readLS(CLOUD_KEYS.plan)   // { dataURL, fileName }
  const stock = readLS(CLOUD_KEYS.stock)  // { stock, meta }
  const rot   = parseInt(rawLS(CLOUD_KEYS.rot) || '0', 10)
  try {
    const { error } = await sb.from('plans').upsert({
      mois: GLOBAL_ROW,
      data: { rotation: rot, planMeta: plan ? { fileName: plan.fileName } : null },
      plan_b64: plan ? plan.dataURL : null,
      stock: stock || null,
      updated_by: cloudUser.email,
    }, { onConflict: 'mois' })
    if (error) throw error
    clearDirty(GLOBAL_ROW)
  } catch (e) { console.warn('[cloud] push global échoué', e); markDirty(GLOBAL_ROW) }
}

/* Rejoue toutes les modifs locales en attente. */
async function cloudFlushDirty() {
  for (const key of getDirty().slice()) {
    if (key === GLOBAL_ROW) await cloudPushGlobal()
    else                    await cloudPushMonth(key)
  }
}

/* ════════════════════════════ PULL (tout le monde) ═══════════════════════════ */

/* Tire le global (plan + stock) et l'écrit en local — sauf si modif locale en attente. */
async function cloudPullGlobal() {
  if (!sb) return
  const { data: row, error } = await sb.from('plans').select('*').eq('mois', GLOBAL_ROW).maybeSingle()
  if (error || !row) return
  if (getDirty().includes(GLOBAL_ROW)) return            // brouillon local prioritaire
  if (row.plan_b64) writeLS(CLOUD_KEYS.plan, { dataURL: row.plan_b64, fileName: (row.data && row.data.planMeta && row.data.planMeta.fileName) || 'Plan pharmacie' })
  if (row.data && typeof row.data.rotation === 'number') writeLS(CLOUD_KEYS.rot, String(row.data.rotation))
  if (row.stock) writeLS(CLOUD_KEYS.stock, row.stock)
}

/* Tire tous les mois et fusionne dans le cache local (cloud-wins, sauf dirty). */
async function cloudPullAllMonths() {
  if (!sb) return
  const { data: rows, error } = await sb.from('plans').select('mois,data,updated_at').neq('mois', GLOBAL_ROW)
  if (error || !rows) return
  const store = readLS(CLOUD_KEYS.data) || { months: {}, currentMonth: '' }
  if (!store.months) store.months = {}
  const dirty = getDirty()
  for (const row of rows) {
    if (dirty.includes(row.mois)) continue               // ne pas écraser un brouillon local
    if (row.data) store.months[row.mois] = row.data
  }
  writeLS(CLOUD_KEYS.data, store)
}

/* Renvoie tous les mois du cloud (pour l'écran Stats). Fallback : cache local. */
async function cloudFetchMonths() {
  if (sb) {
    try {
      const { data: rows } = await sb.from('plans').select('mois,data,updated_at,updated_by').neq('mois', GLOBAL_ROW)
      if (rows && rows.length) return rows.map(r => ({ mois: r.mois, ...r.data, _updatedAt: r.updated_at, _by: r.updated_by }))
    } catch (e) { /* fallback local */ }
  }
  const store = readLS(CLOUD_KEYS.data) || { months: {} }
  return Object.entries(store.months || {}).map(([mois, d]) => ({ mois, ...d }))
}

/* ════════════════════════════ AUTH PROPRIÉTAIRE ══════════════════════════════ */

async function cloudLogin(email, password) {
  if (!sb) { showToast('⚠️  Cloud non configuré'); return false }
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) { showToast('❌  Connexion refusée'); return false }
  cloudUser = data.user
  updateCloudBadge(cloudIsOwner() ? 'owner' : 'read')
  showToast('🔓  Connecté — écriture activée')
  closeCloudModal()
  await cloudFlushDirty()
  return true
}

async function cloudLogout() {
  if (sb) await sb.auth.signOut()
  cloudUser = null
  updateCloudBadge('read')
  showToast('🔒  Déconnecté — lecture seule')
}

/* ════════════════════════════ UI : badge + modal login ═══════════════════════ */

function updateCloudBadge(state, note) {
  const el = document.getElementById('cloud-badge')
  if (!el) return
  const map = {
    off:     { t: '☁︎ Local',        c: '#9aa0a6', title: 'Cloud non configuré — données en local uniquement' },
    offline: { t: '☁︎ Hors-ligne',   c: '#e0894a', title: 'Cloud injoignable — synchro en attente' },
    read:    { t: '☁︎ Lecture',      c: '#3a7bd5', title: 'Connecté en lecture — clique pour te connecter (écriture)' },
    owner:   { t: '☁︎ Synchronisé',  c: '#2e9e6b', title: 'Connecté propriétaire — écriture cloud active' },
  }
  const s = map[state] || map.off
  el.textContent = note ? `${s.t} · ${note}` : s.t
  el.style.color = s.c
  el.title = s.title
}

function openCloudModal() {
  if (!cloudConfigured()) { showToast('⚠️  Configure d’abord cloud.js (URL + clé)'); return }
  if (cloudIsOwner()) { if (confirm('Déconnecter le compte propriétaire ?')) cloudLogout(); return }
  document.getElementById('cloud-overlay').classList.add('open')
  setTimeout(() => { const f = document.getElementById('cloud-email'); if (f) f.focus() }, 50)
}
function closeCloudModal() { const o = document.getElementById('cloud-overlay'); if (o) o.classList.remove('open') }

function submitCloudLogin(ev) {
  ev.preventDefault()
  const email = document.getElementById('cloud-email').value.trim()
  const pass  = document.getElementById('cloud-pass').value
  cloudLogin(email, pass)
}

/* ════════════════════════════ HOOK PUBLIC ════════════════════════════════════
   Appelé par app.js après chaque sauvegarde locale. Debounce pour limiter les écritures. */
let _pushTimer = null
function cloudOnLocalSave(mois) {
  if (!cloudConfigured() || !mois) return
  markDirty(mois)            // toujours marquer : garantit le rattrapage même si push échoue
  clearTimeout(_pushTimer)
  _pushTimer = setTimeout(() => { cloudPushMonth(mois); cloudPushGlobal() }, 1200)
}

/* Appelé après une sauvegarde du plan pharmacie ou du stock (données globales). */
let _pushGlobalTimer = null
function cloudOnGlobalSave() {
  if (!cloudConfigured()) return
  markDirty(GLOBAL_ROW)
  clearTimeout(_pushGlobalTimer)
  _pushGlobalTimer = setTimeout(() => cloudPushGlobal(), 1200)
}

/* Démarrage cloud après le boot de l'app */
document.addEventListener('DOMContentLoaded', () => { cloudInit() })
