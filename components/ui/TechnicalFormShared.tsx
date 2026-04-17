import React, { useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'

export const CollapsibleSection = ({
  title,
  icon: IconComponent,
  children,
  initiallyOpen = false,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  initiallyOpen?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen)
  const toggle = useCallback(() => setIsOpen(p => !p), [])

  return (
    <div className="border rounded-lg">
      <button
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
        onClick={toggle}
        type="button"
      >
        <h3 className="font-semibold flex items-center gap-2">
          {IconComponent && <IconComponent className="w-5 h-5" />}
          {title}
        </h3>
        <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="p-4 border-t">{children}</div>}
    </div>
  )
}
