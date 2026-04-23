'use client'
import { useEffect, useState, useCallback } from 'react'
import { WifiOff, Wifi, RefreshCw, CheckCircle } from 'lucide-react'
import { countPendingInformes, syncPendingInformes } from '@/lib/offline-queue'

export default function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null)

  const refreshCount = useCallback(async () => {
    try {
      const count = await countPendingInformes()
      setPendingCount(count)
    } catch {
      // IndexedDB not available (SSR) — ignore
    }
  }, [])

  useEffect(() => {
    // Initial state
    setIsOnline(navigator.onLine)
    refreshCount()

    const handleOnline = async () => {
      setIsOnline(true)
      await refreshCount()
    }
    const handleOffline = () => {
      setIsOnline(false)
      refreshCount()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Poll pending count every 30 s to catch new items
    const interval = setInterval(refreshCount, 30_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [refreshCount])

  const handleSync = async () => {
    if (syncing || !isOnline) return
    setSyncing(true)
    try {
      const result = await syncPendingInformes()
      await refreshCount()
      if (result.synced > 0) {
        setSyncResult({ synced: result.synced })
        setTimeout(() => setSyncResult(null), 4000)
      }
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync when we come back online and there are pending items
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      handleSync()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  // Nothing to show when online and no pending items
  if (isOnline && pendingCount === 0 && !syncResult) return null

  // Success flash
  if (syncResult) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2">
        <CheckCircle className="w-4 h-4" />
        {syncResult.synced} informe{syncResult.synced > 1 ? 's' : ''} sincronizado{syncResult.synced > 1 ? 's' : ''}
      </div>
    )
  }

  // Offline banner
  if (!isOnline) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-800 text-white text-sm px-4 py-2.5 flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4 text-gray-400" />
        <span className="text-gray-200">Sin conexión</span>
        {pendingCount > 0 && (
          <span className="ml-1 bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    )
  }

  // Online but has pending items to sync
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-full shadow-lg">
      <Wifi className="w-4 h-4 text-green-500" />
      <span>{pendingCount} informe{pendingCount > 1 ? 's' : ''} por sincronizar</span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="ml-1 text-green-600 hover:text-green-700 disabled:opacity-50"
        title="Sincronizar ahora"
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}
