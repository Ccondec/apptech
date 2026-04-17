'use client'
import { useRef } from 'react'
import { X } from 'lucide-react'

interface DraggableLogoProps {
  src: string
  posX: number
  posY: number
  zoom: number
  onPositionChange: (x: number, y: number) => void
  onZoomChange: (z: number) => void
  onRemove: () => void
  className?: string
}

export default function DraggableLogo({
  src, posX, posY, zoom, onPositionChange, onZoomChange, onRemove, className = ''
}: DraggableLogoProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastPos  = useRef({ x: 0, y: 0 })
  const pinchStartDist = useRef<number | null>(null)
  const pinchStartZoom = useRef(zoom)

  const startDrag = (clientX: number, clientY: number) => {
    dragging.current = true
    lastPos.current  = { x: clientX, y: clientY }
  }
  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const dx = ((lastPos.current.x - clientX) / rect.width)  * 100
    const dy = ((lastPos.current.y - clientY) / rect.height) * 100
    lastPos.current = { x: clientX, y: clientY }
    onPositionChange(Math.min(100, Math.max(0, posX + dx)), Math.min(100, Math.max(0, posY + dy)))
  }
  const endDrag = () => { dragging.current = false }

  const getDist = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden rounded-xl cursor-grab active:cursor-grabbing select-none relative ${className}`}
      onMouseDown={e => { e.preventDefault(); startDrag(e.clientX, e.clientY) }}
      onMouseMove={e => moveDrag(e.clientX, e.clientY)}
      onMouseUp={endDrag} onMouseLeave={endDrag}
      onWheel={e => { e.preventDefault(); onZoomChange(Math.min(4, Math.max(1, zoom + (e.deltaY > 0 ? -0.1 : 0.1)))) }}
      onTouchStart={e => {
        if (e.touches.length === 2) {
          pinchStartDist.current = getDist(e.touches)
          pinchStartZoom.current = zoom
          dragging.current = false
        } else { startDrag(e.touches[0].clientX, e.touches[0].clientY) }
      }}
      onTouchMove={e => {
        e.preventDefault()
        if (e.touches.length === 2 && pinchStartDist.current !== null) {
          onZoomChange(Math.min(4, Math.max(1, pinchStartZoom.current * (getDist(e.touches) / pinchStartDist.current))))
        } else if (e.touches.length === 1) {
          moveDrag(e.touches[0].clientX, e.touches[0].clientY)
        }
      }}
      onTouchEnd={() => { endDrag(); pinchStartDist.current = null }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Company Logo"
        draggable={false}
        className="w-full h-full object-cover pointer-events-none"
        style={{
          objectPosition: `${posX}% ${posY}%`,
          transform: `scale(${zoom})`,
          transformOrigin: `${posX}% ${posY}%`,
        }}
      />
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove() }}
        className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-red-500 transition-colors z-10"
      >
        <X className="w-3 h-3" />
      </button>
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] bg-black/40 text-white px-2 py-0.5 rounded-full pointer-events-none whitespace-nowrap">
        ✋ Arrastra · 🔍 Zoom
      </span>
    </div>
  )
}
