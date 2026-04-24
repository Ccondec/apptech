import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CollapsibleSection } from './TechnicalFormShared'
import { ClipboardList, Zap, Wrench, AlertTriangle } from 'lucide-react'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>
  onChange: (field: string, value: unknown) => void
  showOnly?: 'checklist' | 'params'
}

interface CheckRow { id: number; text: string; checked: boolean }

const DEFAULT_CHECKLIST: Omit<CheckRow, 'id'>[] = [
  { text: 'Inspección visual de la punta captadora',           checked: false },
  { text: 'Verificación de fijación del pararrayos',           checked: false },
  { text: 'Revisión de continuidad del conductor de bajada',   checked: false },
  { text: 'Inspección de uniones y conectores (apriete)',      checked: false },
  { text: 'Verificación del estado anticorrosión de uniones',  checked: false },
  { text: 'Inspección del borne de inspección / borne de prueba', checked: false },
  { text: 'Medición de resistencia de tierra (ohmmíos)',       checked: false },
  { text: 'Inspección del electrodo de tierra (pozo/malla)',   checked: false },
  { text: 'Revisión de la malla equipotencial (si aplica)',    checked: false },
  { text: 'Verificación de SPD (protectores de sobretensión)', checked: false },
  { text: 'Revisión de señalización y avisos de seguridad',    checked: false },
  { text: 'Registro fotográfico del sistema',                  checked: false },
]

export default function ApantallamientoParams({ formData, onChange, showOnly }: Props) {
  const checks: CheckRow[] = React.useMemo(() => {
    const stored = formData.apanChecklist
    if (stored && stored.length > 0) return stored
    return DEFAULT_CHECKLIST.map((c, i) => ({ ...c, id: i + 1 }))
  }, [])

  React.useEffect(() => {
    if (!formData.apanChecklist || formData.apanChecklist.length === 0) {
      onChange('apanChecklist', DEFAULT_CHECKLIST.map((c, i) => ({ ...c, id: i + 1 })))
    }
  }, [])

  const updateCheck = (id: number, val: boolean) =>
    onChange('apanChecklist', checks.map((c: CheckRow) =>
      c.id === id ? { ...c, checked: val } : c
    ))

  const done  = checks.filter((c: CheckRow) => c.checked).length
  const total = checks.length
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <>
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
              <label key={c.id} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={c.checked}
                  onChange={e => updateCheck(c.id, e.target.checked)}
                  className="h-4 w-4 text-green-600 rounded border-gray-300 flex-shrink-0"
                />
                <span className={`text-sm ${c.checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {c.text}
                </span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {showOnly !== 'checklist' && <>
        {/* Datos del sistema */}
        <CollapsibleSection title="Datos del Sistema" icon={Zap} initiallyOpen>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Tipo de sistema</Label>
              <select
                value={String(formData.apanTipo ?? '')}
                onChange={e => onChange('apanTipo', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="Franklin (Punta simple)">Franklin (Punta simple)</option>
                <option value="Jaula de Faraday (Malla)">Jaula de Faraday (Malla)</option>
                <option value="ESE (Punta Ionizante)">ESE (Punta Ionizante)</option>
                <option value="Malla + Bajantes">Malla + Bajantes</option>
                <option value="Sistema combinado">Sistema combinado</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Nivel de protección</Label>
              <select
                value={String(formData.apanNivel ?? '')}
                onChange={e => onChange('apanNivel', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="NP I">NP I</option>
                <option value="NP II">NP II</option>
                <option value="NP III">NP III</option>
                <option value="NP IV">NP IV</option>
                <option value="No definido">No definido</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Altura de la punta captadora (m)</Label>
              <Input
                type="number"
                placeholder="Ej: 6.5"
                value={String(formData.apanAltura ?? '')}
                onChange={e => onChange('apanAltura', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Año de instalación</Label>
              <Input
                type="number"
                placeholder="Ej: 2019"
                value={String(formData.apanAnoInstalacion ?? '')}
                onChange={e => onChange('apanAnoInstalacion', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Medición de tierra */}
        <CollapsibleSection title="Medición de Tierra" icon={Wrench}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Resistencia de tierra medida (Ω)</Label>
              <Input
                type="number"
                placeholder="Ej: 3.2"
                value={String(formData.apanResistencia ?? '')}
                onChange={e => onChange('apanResistencia', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Valor máximo permitido (Ω)</Label>
              <select
                value={String(formData.apanResistenciaMax ?? '')}
                onChange={e => onChange('apanResistenciaMax', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="5 Ω (NP I)">5 Ω (NP I)</option>
                <option value="10 Ω (NP II)">10 Ω (NP II)</option>
                <option value="10 Ω (general)">10 Ω (general)</option>
                <option value="25 Ω">25 Ω</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Método de medición</Label>
              <select
                value={String(formData.apanMetodo ?? '')}
                onChange={e => onChange('apanMetodo', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="Caída de potencial (3 puntos)">Caída de potencial (3 puntos)</option>
                <option value="Método Wenner (4 puntos)">Método Wenner (4 puntos)</option>
                <option value="Clamp (pinza amperimétrica)">Clamp (pinza amperimétrica)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Instrumento de medición</Label>
              <Input
                placeholder="Ej: Fluke 1625"
                value={String(formData.apanInstrumento ?? '')}
                onChange={e => onChange('apanInstrumento', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Temperatura ambiente (°C)</Label>
              <Input
                type="number"
                placeholder="Ej: 28"
                value={String(formData.apanTemperatura ?? '')}
                onChange={e => onChange('apanTemperatura', e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label>Humedad relativa (%)</Label>
              <Input
                type="number"
                placeholder="Ej: 70"
                value={String(formData.apanHumedad ?? '')}
                onChange={e => onChange('apanHumedad', e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Resultado */}
        <CollapsibleSection title="Resultado de la Inspección" icon={AlertTriangle}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Estado del conductor de bajada</Label>
              <select
                value={String(formData.apanBajante ?? '')}
                onChange={e => onChange('apanBajante', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="Bueno">Bueno</option>
                <option value="Con corrosión leve">Con corrosión leve</option>
                <option value="Con corrosión severa">Con corrosión severa</option>
                <option value="Roto / Discontinuo">Roto / Discontinuo</option>
                <option value="Reemplazado">Reemplazado</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Estado de la punta captadora</Label>
              <select
                value={String(formData.apanPunta ?? '')}
                onChange={e => onChange('apanPunta', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="Buena">Buena</option>
                <option value="Con desgaste">Con desgaste</option>
                <option value="Con corrosión">Con corrosión</option>
                <option value="Dañada">Dañada</option>
                <option value="Reemplazada">Reemplazada</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Estado de las uniones y conectores</Label>
              <select
                value={String(formData.apanUniones ?? '')}
                onChange={e => onChange('apanUniones', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="Bueno">Bueno</option>
                <option value="Con oxidación leve">Con oxidación leve</option>
                <option value="Con oxidación severa">Con oxidación severa</option>
                <option value="Sueltos / Requieren apriete">Sueltos / Requieren apriete</option>
                <option value="Reemplazados">Reemplazados</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Resultado general</Label>
              <select
                value={String(formData.apanResultado ?? '')}
                onChange={e => onChange('apanResultado', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Aprobado con observaciones">Aprobado con observaciones</option>
                <option value="Reprobado — requiere correctivo">Reprobado — requiere correctivo</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Normativa aplicada</Label>
              <select
                value={String(formData.apanNorma ?? '')}
                onChange={e => onChange('apanNorma', e.target.value)}
                className="w-full h-10 border border-gray-200 rounded-md px-3 text-sm bg-white"
              >
                <option value="">Seleccionar…</option>
                <option value="NTC 4552 / IEC 62305">NTC 4552 / IEC 62305</option>
                <option value="RETIE">RETIE</option>
                <option value="NTC 4552 + RETIE">NTC 4552 + RETIE</option>
                <option value="IEC 62305">IEC 62305</option>
                <option value="NFPA 780">NFPA 780</option>
              </select>
            </div>
          </div>
        </CollapsibleSection>
      </>}
    </>
  )
}
