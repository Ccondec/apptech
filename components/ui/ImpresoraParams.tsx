import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CollapsibleSection } from './TechnicalFormShared'
import { Printer, ClipboardList, Wrench, Zap } from 'lucide-react'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>
  onChange: (field: string, value: unknown) => void
}

interface CheckRow { id: number; text: string; checked: boolean }

const DEFAULT_CHECKLIST: Omit<CheckRow, 'id'>[] = [
  { text: 'Limpieza exterior del equipo',              checked: false },
  { text: 'Limpieza interior (polvo y residuos)',      checked: false },
  { text: 'Limpieza de rodillos de arrastre',          checked: false },
  { text: 'Limpieza de cabezal de impresión',          checked: false },
  { text: 'Limpieza de sensor de papel',               checked: false },
  { text: 'Verificación de bandeja de papel',          checked: false },
  { text: 'Verificación de nivel de tóner / tinta',   checked: false },
  { text: 'Verificación del fusor (impresoras láser)', checked: false },
  { text: 'Prueba de impresión de página de prueba',  checked: false },
  { text: 'Verificación de conectividad (USB/Red)',    checked: false },
  { text: 'Verificación de actualizaciones de firmware', checked: false },
  { text: 'Verificación de cola de impresión',        checked: false },
]

export default function ImpresoraParams({ formData, onChange }: Props) {
  // Inicializar checklist con valores por defecto si está vacío
  const checks: CheckRow[] = React.useMemo(() => {
    const stored = formData.impresoraChecklist
    if (stored && stored.length > 0) return stored
    return DEFAULT_CHECKLIST.map((c, i) => ({ ...c, id: i + 1 }))
  }, [])

  // Sincronizar checklist inicial al montar
  React.useEffect(() => {
    if (!formData.impresoraChecklist || formData.impresoraChecklist.length === 0) {
      onChange('impresoraChecklist', DEFAULT_CHECKLIST.map((c, i) => ({ ...c, id: i + 1 })))
    }
  }, [])

  const updateCheck = (id: number, field: 'checked', val: boolean) =>
    onChange('impresoraChecklist', checks.map((c: CheckRow) =>
      c.id === id ? { ...c, [field]: val } : c
    ))

  const done  = checks.filter((c: CheckRow) => c.checked).length
  const total = checks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <>
      {/* Lista de Actividades */}
      <CollapsibleSection title="Lista de Actividades" icon={ClipboardList} initiallyOpen>
        <div className="space-y-3">
          {total > 0 && (
            <div className="space-y-1 mb-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>{done} de {total} actividades completadas</span>
                <span className="font-medium text-green-600">{pct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          {checks.map((c: CheckRow) => (
            <label key={c.id} className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={c.checked}
                onChange={e => updateCheck(c.id, 'checked', e.target.checked)}
                className="h-4 w-4 text-green-600 rounded border-gray-300 flex-shrink-0"
              />
              <span className={`text-sm ${c.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {c.text}
              </span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* Especificaciones */}
      <CollapsibleSection title="Especificaciones del Equipo" icon={Printer} initiallyOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Tipo de impresora</Label>
            <select
              value={String(formData.impresoraTipo ?? '')}
              onChange={e => onChange('impresoraTipo', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              <option value="Láser Monocromática">Láser Monocromática</option>
              <option value="Láser Color">Láser Color</option>
              <option value="Inyección de Tinta">Inyección de Tinta</option>
              <option value="Matricial">Matricial</option>
              <option value="Térmica">Térmica</option>
              <option value="Multifuncional Láser">Multifuncional Láser</option>
              <option value="Multifuncional Tinta">Multifuncional Tinta</option>
              <option value="Gran Formato">Gran Formato</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Formato de papel</Label>
            <select
              value={String(formData.impresoraFormato ?? '')}
              onChange={e => onChange('impresoraFormato', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              <option value="Carta (Letter)">Carta (Letter)</option>
              <option value="Oficio (Legal)">Oficio (Legal)</option>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="Doble Carta">Doble Carta</option>
              <option value="Continuo">Continuo</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Conectividad</Label>
            <select
              value={String(formData.impresoraConectividad ?? '')}
              onChange={e => onChange('impresoraConectividad', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              <option value="USB">USB</option>
              <option value="Red (Ethernet)">Red (Ethernet)</option>
              <option value="WiFi">WiFi</option>
              <option value="USB + Red">USB + Red</option>
              <option value="USB + WiFi">USB + WiFi</option>
              <option value="Red + WiFi">Red + WiFi</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Contador de páginas</Label>
            <Input
              type="number"
              placeholder="Ej: 45230"
              value={String(formData.impresoraContador ?? '')}
              onChange={e => onChange('impresoraContador', e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Consumibles */}
      <CollapsibleSection title="Estado de Consumibles" icon={Zap}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Nivel de tóner / tinta</Label>
            <select
              value={String(formData.impresoraNivelToner ?? '')}
              onChange={e => onChange('impresoraNivelToner', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              <option value="Óptimo (75-100%)">Óptimo (75-100%)</option>
              <option value="Bueno (50-75%)">Bueno (50-75%)</option>
              <option value="Regular (25-50%)">Regular (25-50%)</option>
              <option value="Bajo (menos de 25%)">Bajo (menos de 25%)</option>
              <option value="Agotado">Agotado</option>
              <option value="Reemplazado">Reemplazado</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Tóner / cartucho reemplazado</Label>
            <select
              value={String(formData.impresoraTonerReemplazado ?? '')}
              onChange={e => onChange('impresoraTonerReemplazado', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              <option value="No">No</option>
              <option value="Sí — Negro">Sí — Negro</option>
              <option value="Sí — Color completo">Sí — Color completo</option>
              <option value="Sí — Cian">Sí — Cian</option>
              <option value="Sí — Magenta">Sí — Magenta</option>
              <option value="Sí — Amarillo">Sí — Amarillo</option>
              <option value="Sí — Todos los colores">Sí — Todos los colores</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Estado del fusor / rodillo</Label>
            <select
              value={String(formData.impresoraFusor ?? '')}
              onChange={e => onChange('impresoraFusor', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              <option value="Bueno">Bueno</option>
              <option value="Desgaste normal">Desgaste normal</option>
              <option value="Requiere reemplazo pronto">Requiere reemplazo pronto</option>
              <option value="Reemplazado">Reemplazado</option>
              <option value="N/A">N/A</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Kit de mantenimiento aplicado</Label>
            <select
              value={String(formData.impresoraKitMant ?? '')}
              onChange={e => onChange('impresoraKitMant', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              <option value="No aplica">No aplica</option>
              <option value="Sí">Sí</option>
              <option value="No — pendiente">No — pendiente</option>
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Prueba de impresión */}
      <CollapsibleSection title="Resultado de Prueba" icon={Wrench}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Página de prueba</Label>
            <select
              value={String(formData.impresoraPrueba ?? '')}
              onChange={e => onChange('impresoraPrueba', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              <option value="Exitosa">Exitosa</option>
              <option value="Con observaciones">Con observaciones</option>
              <option value="Fallida">Fallida</option>
              <option value="No realizada">No realizada</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Calidad de impresión</Label>
            <select
              value={String(formData.impresoraCalidad ?? '')}
              onChange={e => onChange('impresoraCalidad', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              <option value="Óptima">Óptima</option>
              <option value="Buena">Buena</option>
              <option value="Regular">Regular</option>
              <option value="Deficiente">Deficiente</option>
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Fallas encontradas</Label>
            <select
              value={String(formData.impresoraFallas ?? '')}
              onChange={e => onChange('impresoraFallas', e.target.value)}
              className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
            >
              <option value="">Ninguna</option>
              <option value="Atasco de papel frecuente">Atasco de papel frecuente</option>
              <option value="Impresión borrosa">Impresión borrosa</option>
              <option value="Líneas en la impresión">Líneas en la impresión</option>
              <option value="No imprime en color">No imprime en color</option>
              <option value="Error de conectividad">Error de conectividad</option>
              <option value="Ruidos anormales">Ruidos anormales</option>
              <option value="No enciende">No enciende</option>
              <option value="Manchas en papel">Manchas en papel</option>
              <option value="Múltiples fallas">Múltiples fallas</option>
            </select>
          </div>
        </div>
      </CollapsibleSection>
    </>
  )
}
