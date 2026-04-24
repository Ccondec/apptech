import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CollapsibleSection } from './TechnicalFormShared'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { Button } from './button'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>
  onChange: (field: string, value: unknown) => void
  showOnly?: 'checklist' | 'params'
}

interface ParamRow { id: number; label: string; value: string; unit: string }
interface CheckRow { id: number; text: string; checked: boolean }

export default function OtrosParams({ formData, onChange, showOnly }: Props) {
  const params: ParamRow[]  = formData.otrosParams   || []
  const checks: CheckRow[]  = formData.otrosChecklist || []

  // ── Parámetros libres ──────────────────────────────────────────────────────
  const addParam = () =>
    onChange('otrosParams', [...params, { id: Date.now(), label: '', value: '', unit: '' }])

  const removeParam = (id: number) =>
    onChange('otrosParams', params.filter((p: ParamRow) => p.id !== id))

  const updateParam = (id: number, field: keyof ParamRow, val: string) =>
    onChange('otrosParams', params.map((p: ParamRow) => p.id === id ? { ...p, [field]: val } : p))

  // ── Checklist libre ────────────────────────────────────────────────────────
  const addCheck = () =>
    onChange('otrosChecklist', [...checks, { id: Date.now(), text: '', checked: false }])

  const removeCheck = (id: number) =>
    onChange('otrosChecklist', checks.filter((c: CheckRow) => c.id !== id))

  const updateCheck = (id: number, field: 'text' | 'checked', val: string | boolean) =>
    onChange('otrosChecklist', checks.map((c: CheckRow) => c.id === id ? { ...c, [field]: val } : c))

  const done  = checks.filter((c: CheckRow) => c.checked).length
  const total = checks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <>
      {/* Título del informe + Parámetros libres */}
      {showOnly !== 'checklist' && <>
      <CollapsibleSection title="Información del Informe" icon={ClipboardList} initiallyOpen>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Título del informe</Label>
            <Input
              placeholder="Ej: Revisión tablero eléctrico"
              value={String(formData.otrosTitulo ?? '')}
              onChange={e => onChange('otrosTitulo', e.target.value)}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label>Tipo de equipo / sistema</Label>
            <Input
              placeholder="Ej: Tablero de distribución"
              value={String(formData.otrosTipoEquipo ?? '')}
              onChange={e => onChange('otrosTipoEquipo', e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Parámetros libres */}
      <CollapsibleSection title="Parámetros Medidos" icon={ClipboardList}>
        <div className="space-y-3">
          {params.length > 0 && (
            <div className="grid grid-cols-12 gap-2 px-1">
              <span className="col-span-5 text-xs font-medium text-gray-500">Parámetro</span>
              <span className="col-span-4 text-xs font-medium text-gray-500">Valor</span>
              <span className="col-span-2 text-xs font-medium text-gray-500">Unidad</span>
              <span className="col-span-1" />
            </div>
          )}
          {params.map((p: ParamRow) => (
            <div key={p.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5">
                <Input value={p.label} onChange={e => updateParam(p.id, 'label', e.target.value)}
                  placeholder="Nombre del parámetro" className="text-sm" />
              </div>
              <div className="col-span-4">
                <Input value={p.value} onChange={e => updateParam(p.id, 'value', e.target.value)}
                  placeholder="0.0" className="text-sm text-right" />
              </div>
              <div className="col-span-2">
                <Input value={p.unit} onChange={e => updateParam(p.id, 'unit', e.target.value)}
                  placeholder="V / A" className="text-sm" />
              </div>
              <div className="col-span-1 flex justify-center">
                <button type="button" onClick={() => removeParam(p.id)}
                  className="p-1 text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addParam}
            className="w-full border-dashed text-gray-500 hover:text-gray-700">
            <Plus className="w-4 h-4 mr-2" /> Agregar parámetro
          </Button>
        </div>
      </CollapsibleSection>
      </>}

      {/* Checklist libre */}
      {showOnly !== 'params' && <CollapsibleSection title="Lista de Actividades" icon={ClipboardList}>
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
            <div key={c.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={c.checked}
                onChange={e => updateCheck(c.id, 'checked', e.target.checked)}
                className="h-4 w-4 text-green-600 rounded border-gray-300 flex-shrink-0"
              />
              <Input
                value={c.text}
                onChange={e => updateCheck(c.id, 'text', e.target.value)}
                placeholder="Descripción de la actividad"
                className={`text-sm flex-1 ${c.checked ? 'line-through text-gray-400' : ''}`}
              />
              <button type="button" onClick={() => removeCheck(c.id)}
                className="p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={addCheck}
            className="w-full border-dashed text-gray-500 hover:text-gray-700">
            <Plus className="w-4 h-4 mr-2" /> Agregar actividad
          </Button>
        </div>
      </CollapsibleSection>}
    </>
  )
}
