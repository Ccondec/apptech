import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CollapsibleSection } from './TechnicalFormShared'
import { ClipboardList, Settings, Plus, Trash2, CheckCircle, RotateCcw } from 'lucide-react'
import { Button } from './button'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>
  onChange: (field: string, value: unknown) => void
  showOnly?: 'checklist' | 'params'
}

interface ParamRow { id: number; label: string; value: string; unit: string }
interface CheckRow { id: number; text: string; checked: boolean }

type Categoria =
  | 'tablero'
  | 'redes'
  | 'computo'
  | 'instalacion'
  | 'otro'
  | ''

const CATEGORIAS: { id: Categoria; label: string }[] = [
  { id: 'tablero',     label: 'Tablero Eléctrico' },
  { id: 'redes',       label: 'Redes / Cableado Estructurado' },
  { id: 'computo',     label: 'Mantenimiento de Cómputo' },
  { id: 'instalacion', label: 'Instalación Eléctrica' },
  { id: 'otro',        label: 'Otro servicio' },
]

const CHECKLISTS: Record<string, string[]> = {
  tablero: [
    'Limpieza interior del tablero eléctrico',
    'Verificación y apriete de bornes y conexiones',
    'Revisión de breakers / disyuntores',
    'Medición de voltajes por fase (L1, L2, L3)',
    'Verificación de protecciones (fusibles, interruptores)',
    'Revisión del estado del cableado (aislamiento)',
    'Verificación de puesta a tierra del tablero',
    'Inspección de puntos calientes (termografía)',
    'Verificación del etiquetado de circuitos',
    'Prueba de funcionamiento general',
  ],
  redes: [
    'Verificación de puntos de red activos',
    'Prueba de continuidad de cableado',
    'Certificación / prueba de velocidad de puertos',
    'Revisión y organización de patch panel',
    'Limpieza del cuarto de comunicaciones',
    'Verificación de switch / router / AP',
    'Revisión de etiquetado de puertos',
    'Verificación de UPS de red (si aplica)',
    'Revisión de canaletas y ducterías',
    'Documentación del diagrama de red',
  ],
  computo: [
    'Limpieza exterior del equipo',
    'Limpieza interior (polvo, ventiladores)',
    'Aplicación de pasta térmica al procesador',
    'Verificación y limpieza de memorias RAM',
    'Verificación de disco duro / SSD',
    'Actualización de controladores / drivers',
    'Verificación y actualización de antivirus',
    'Prueba de temperatura bajo carga',
    'Verificación de fuente de poder',
    'Prueba de funcionamiento general',
  ],
  instalacion: [
    'Verificación de acometida eléctrica',
    'Revisión de tomacorrientes y placas',
    'Verificación de interruptores y dimmer',
    'Revisión del sistema de iluminación',
    'Medición de voltajes en puntos de consumo',
    'Verificación de puesta a tierra',
    'Revisión de ducterías y canaletas',
    'Verificación de capacidad de circuitos',
    'Inspección de empalmes y cajas de paso',
    'Verificación de cumplimiento RETIE',
  ],
  otro: [],
}

function buildChecklist(cat: string): CheckRow[] {
  const items = CHECKLISTS[cat] ?? []
  return items.map((text, i) => ({ id: i + 1, text, checked: false }))
}

export default function OtrosParams({ formData, onChange, showOnly }: Props) {
  const categoria: Categoria = formData.otrosCategoria ?? ''
  const checks: CheckRow[]   = formData.otrosChecklist ?? []
  const params: ParamRow[]   = formData.otrosParams    ?? []

  // Auto-poblar checklist cuando cambia la categoría
  const handleCategoria = (cat: Categoria) => {
    onChange('otrosCategoria', cat)
    if (cat && cat !== 'otro') {
      onChange('otrosChecklist', buildChecklist(cat))
    }
  }

  const resetChecklist = () => {
    if (categoria && categoria !== 'otro') {
      onChange('otrosChecklist', buildChecklist(categoria))
    }
  }

  // Checklist
  const addCheck = () =>
    onChange('otrosChecklist', [...checks, { id: Date.now(), text: '', checked: false }])
  const removeCheck = (id: number) =>
    onChange('otrosChecklist', checks.filter((c: CheckRow) => c.id !== id))
  const updateCheck = (id: number, field: 'text' | 'checked', val: string | boolean) =>
    onChange('otrosChecklist', checks.map((c: CheckRow) => c.id === id ? { ...c, [field]: val } : c))

  const done  = checks.filter((c: CheckRow) => c.checked).length
  const total = checks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  // Parámetros libres
  const addParam = () =>
    onChange('otrosParams', [...params, { id: Date.now(), label: '', value: '', unit: '' }])
  const removeParam = (id: number) =>
    onChange('otrosParams', params.filter((p: ParamRow) => p.id !== id))
  const updateParam = (id: number, field: keyof ParamRow, val: string) =>
    onChange('otrosParams', params.map((p: ParamRow) => p.id === id ? { ...p, [field]: val } : p))

  return (
    <>
      {/* ── Categoría del servicio (siempre visible) ── */}
      {showOnly !== 'params' && (
        <CollapsibleSection title="Categoría del Servicio" icon={Settings} initiallyOpen>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1 sm:col-span-2">
              <Label>Tipo de servicio</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CATEGORIAS.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoria(cat.id)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium text-left transition-colors ${
                      categoria === cat.id
                        ? 'bg-green-600 text-white border-green-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {categoria === 'otro' && (
              <div className="space-y-1 sm:col-span-2">
                <Label>Descripción del servicio</Label>
                <Input
                  placeholder="Ej: Revisión de tablero de transferencia automática"
                  value={String(formData.otrosDescripcion ?? '')}
                  onChange={e => onChange('otrosDescripcion', e.target.value)}
                  className="text-sm"
                />
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Lista de actividades ── */}
      {showOnly !== 'params' && (
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

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={addCheck}
                className="flex-1 border-dashed text-gray-500 hover:text-gray-700">
                <Plus className="w-4 h-4 mr-2" /> Agregar actividad
              </Button>
              {categoria && categoria !== 'otro' && (
                <Button type="button" variant="outline" onClick={resetChecklist}
                  className="border-dashed text-gray-400 hover:text-gray-600 px-3"
                  title="Restaurar actividades predefinidas">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* ── Parámetros medidos + Resultado ── */}
      {showOnly !== 'checklist' && <>
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

        <CollapsibleSection title="Resultado de la Inspección" icon={CheckCircle}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Estado general del sistema</Label>
              <select
                value={String(formData.otrosEstado ?? '')}
                onChange={e => onChange('otrosEstado', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="Óptimo">Óptimo</option>
                <option value="Bueno">Bueno</option>
                <option value="Regular — requiere atención">Regular — requiere atención</option>
                <option value="Deficiente — requiere correctivo urgente">Deficiente — requiere correctivo urgente</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Resultado general</Label>
              <select
                value={String(formData.otrosResultado ?? '')}
                onChange={e => onChange('otrosResultado', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Aprobado con observaciones">Aprobado con observaciones</option>
                <option value="Reprobado — requiere correctivo">Reprobado — requiere correctivo</option>
              </select>
            </div>
          </div>
        </CollapsibleSection>
      </>}
    </>
  )
}
