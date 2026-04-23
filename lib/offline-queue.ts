// ── Offline Queue ─────────────────────────────────────────────
// Stores informes that couldn't be saved due to no connectivity.
// Syncs them automatically when the connection is restored.

const DB_NAME = 'apptech_offline'
const DB_VERSION = 1
const STORE = 'pending_informes'

export interface PendingInforme {
  id: string           // local UUID
  createdAt: number    // Date.now()
  informe: {
    qr_code?: string
    fecha: string
    cliente: string
    serial: string
    marca: string
    modelo: string
    capacidad: string
    ubicacion: string
    tecnico: string
    equipo_id?: string
    tipo_reporte?: string
    observaciones?: string
    recomendaciones?: string
  }
  empresa_id: string
  // foto as base64 blob (optional — may be undefined if no photos)
  fotoBase64?: string
}

// ── DB helpers ────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueInforme(pending: PendingInforme): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(pending)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingInformes(): Promise<PendingInforme[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function removePendingInforme(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function countPendingInformes(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Sync ──────────────────────────────────────────────────────

import { guardarInforme, siguienteNumeroInforme, formatearNumeroInforme } from './supabase'

export async function syncPendingInformes(): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingInformes()
  if (pending.length === 0) return { synced: 0, failed: 0 }

  let synced = 0
  let failed = 0

  for (const item of pending) {
    try {
      const tipo = item.informe.tipo_reporte ?? 'ups'
      // Consecutivo global — mismo contador para todos los tipos
      const nextNum = await siguienteNumeroInforme(item.empresa_id)
      const numero_informe = formatearNumeroInforme(nextNum, tipo)

      const result = await guardarInforme({
        ...item.informe,
        numero_informe,
        empresa_id: item.empresa_id,
      })

      if (result.ok) {
        await removePendingInforme(item.id)
        synced++
      } else {
        failed++
      }
    } catch {
      failed++
    }
  }

  return { synced, failed }
}
