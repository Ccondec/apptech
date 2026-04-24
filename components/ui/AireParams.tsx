import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CollapsibleSection } from './TechnicalFormShared'
import { Thermometer, Zap, Wind, CheckSquare, FileText } from 'lucide-react'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>
  onChange: (field: string, value: string) => void
  showOnly?: 'checklist' | 'params'
}

const AC_TYPES    = ['Split', 'Cassette', 'Central', 'VRF / VRV', 'Chiller', 'Fancoil']
const REFRIGERANTS = ['R-22', 'R-410A', 'R-32', 'R-134A', 'R-407C', 'Otro']

const CHECKLIST_GROUPS = [
  {
    title: 'Unidad Interior',
    items: [
      'Limpieza de filtros de aire',
      'Limpieza de serpentín evaporador',
      'Revisión bandeja de condensados',
      'Limpieza línea de drenaje',
      'Revisión del ventilador interior',
      'Revisión de conexiones eléctricas internas',
    ],
  },
  {
    title: 'Unidad Exterior',
    items: [
      'Limpieza de serpentín condensador',
      'Revisión del ventilador exterior',
      'Revisión de conexiones eléctricas externas',
      'Revisión de soportes y anclaje',
      'Revisión de protecciones eléctricas',
    ],
  },
  {
    title: 'Sistema Refrigerante',
    items: [
      'Medición de presiones de operación',
      'Verificación de carga de refrigerante',
      'Revisión de fugas en tuberías',
      'Revisión de aislamiento de tuberías',
      'Verificación de válvulas de servicio',
    ],
  },
  {
    title: 'Documentación',
    items: [
      'Registro fotográfico completado',
      'Parámetros operacionales registrados',
      'Firma del cliente obtenida',
      'Recomendaciones documentadas',
    ],
  },
]

const NumField = ({
  id, label, unit, value, onChange,
}: { id: string; label: string; unit: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1">
    <Label htmlFor={id} className="text-xs">{label} ({unit})</Label>
    <Input
      id={id} type="number" inputMode="decimal" placeholder="0.0"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-right text-sm"
    />
  </div>
)

export default function AireParams({ formData, onChange, showOnly }: Props) {
  const checkedItems: string[] = formData.checkedItems || []

  const toggleItem = (item: string) => {
    const next = checkedItems.includes(item)
      ? checkedItems.filter(i => i !== item)
      : [...checkedItems, item]
    onChange('checkedItems', next as unknown as string)
  }

  const totalItems = CHECKLIST_GROUPS.reduce((s, g) => s + g.items.length, 0)
  const pct = totalItems > 0 ? Math.round((checkedItems.length / totalItems) * 100) : 0

  return (
    <>
      {/* Checklist AC */}
      {showOnly !== 'params' && <CollapsibleSection title="Lista de Actividades" icon={CheckSquare}>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{checkedItems.length} de {totalItems} actividades completadas</span>
              <span className="font-medium text-green-600">{pct}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CHECKLIST_GROUPS.map(group => {
              const done = group.items.filter(i => checkedItems.includes(i)).length
              return (
                <div key={group.title} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                    <span className="text-xs font-medium text-gray-700">{group.title}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">{done}/{group.items.length}</span>
                  </div>
                  <div className="divide-y">
                    {group.items.map(item => (
                      <label key={item} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={checkedItems.includes(item)} onChange={() => toggleItem(item)}
                          className="h-4 w-4 text-green-600 rounded border-gray-300" />
                        <span className={`text-xs ${checkedItems.includes(item) ? 'line-through text-gray-400' : 'text-gray-700'}`}>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CollapsibleSection>}

      {/* Especificaciones AC */}
      {showOnly !== 'checklist' && <>
      <CollapsibleSection title="Especificaciones del Sistema AC" icon={Wind}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Tipo de unidad</Label>
            <select
              value={String(formData.acType ?? '')}
              onChange={e => onChange('acType', e.target.value)}
              className="w-full h-9 px-2 border rounded-md bg-white text-sm"
            >
              <option value="">Seleccionar</option>
              {AC_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Capacidad (BTU/h)</Label>
            <Input placeholder="Ej: 12000" value={String(formData.acCapacityBTU ?? '')}
              onChange={e => onChange('acCapacityBTU', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label>Refrigerante</Label>
            <select
              value={String(formData.acRefrigerant ?? '')}
              onChange={e => onChange('acRefrigerant', e.target.value)}
              className="w-full h-9 px-2 border rounded-md bg-white text-sm"
            >
              <option value="">Seleccionar</option>
              {REFRIGERANTS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Parámetros de presión y temperatura */}
      <CollapsibleSection title="Presiones y Temperaturas" icon={Thermometer}>
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-600">Sistema Refrigerante</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="acPressureSuction"   label="Presión Succión"  unit="psi" value={String(formData.acPressureSuction  ?? '')} onChange={v => onChange('acPressureSuction',  v)} />
            <NumField id="acPressureDischarge" label="Presión Descarga" unit="psi" value={String(formData.acPressureDischarge ?? '')} onChange={v => onChange('acPressureDischarge', v)} />
            <NumField id="acTempSuction"       label="Temp. Succión"   unit="°C"  value={String(formData.acTempSuction       ?? '')} onChange={v => onChange('acTempSuction',       v)} />
            <NumField id="acTempDischarge"     label="Temp. Descarga"  unit="°C"  value={String(formData.acTempDischarge     ?? '')} onChange={v => onChange('acTempDischarge',     v)} />
          </div>
          <h4 className="text-sm font-medium text-gray-600">Temperaturas de Aire</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="acTempSupply"  label="Suministro" unit="°C" value={String(formData.acTempSupply  ?? '')} onChange={v => onChange('acTempSupply',  v)} />
            <NumField id="acTempReturn"  label="Retorno"    unit="°C" value={String(formData.acTempReturn  ?? '')} onChange={v => onChange('acTempReturn',  v)} />
            <NumField id="acTempAmbient" label="Ambiente"   unit="°C" value={String(formData.acTempAmbient ?? '')} onChange={v => onChange('acTempAmbient', v)} />
            <NumField id="acRefrigerantCharge" label="Carga Refrig." unit="lbs" value={String(formData.acRefrigerantCharge ?? '')} onChange={v => onChange('acRefrigerantCharge', v)} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Parámetros eléctricos AC */}
      <CollapsibleSection title="Parámetros Eléctricos (AC)" icon={Zap}>
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-600">Compresor</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="acVoltageComp"  label="Voltaje"   unit="V" value={String(formData.acVoltageComp  ?? '')} onChange={v => onChange('acVoltageComp',  v)} />
            <NumField id="acCurrentComp"  label="Corriente" unit="A" value={String(formData.acCurrentComp  ?? '')} onChange={v => onChange('acCurrentComp',  v)} />
            <NumField id="acPowerComp"    label="Potencia"  unit="W" value={String(formData.acPowerComp    ?? '')} onChange={v => onChange('acPowerComp',    v)} />
            <NumField id="acFrequency"    label="Frecuencia" unit="Hz" value={String(formData.acFrequency   ?? '')} onChange={v => onChange('acFrequency',    v)} />
          </div>
          <h4 className="text-sm font-medium text-gray-600">Ventiladores</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="acVoltFanInt"   label="V. Ventil. Interior"  unit="V" value={String(formData.acVoltFanInt  ?? '')} onChange={v => onChange('acVoltFanInt',  v)} />
            <NumField id="acAmpFanInt"    label="A. Ventil. Interior"  unit="A" value={String(formData.acAmpFanInt   ?? '')} onChange={v => onChange('acAmpFanInt',   v)} />
            <NumField id="acVoltFanExt"   label="V. Ventil. Exterior"  unit="V" value={String(formData.acVoltFanExt  ?? '')} onChange={v => onChange('acVoltFanExt',  v)} />
            <NumField id="acAmpFanExt"    label="A. Ventil. Exterior"  unit="A" value={String(formData.acAmpFanExt   ?? '')} onChange={v => onChange('acAmpFanExt',   v)} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Estado AC */}
      <CollapsibleSection title="Estado del Equipo (AC)" icon={FileText}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { id: 'acStatusCompressor', label: 'Compresor' },
            { id: 'acStatusEvaporator', label: 'Evaporador' },
            { id: 'acStatusCondenser',  label: 'Condensador' },
            { id: 'acStatusExpansion',  label: 'Válvula Expansión' },
            { id: 'acStatusDrain',      label: 'Sistema Drenaje' },
            { id: 'acStatusElectrical', label: 'Sistema Eléctrico' },
          ].map(({ id, label }) => (
            <div key={id} className="space-y-1">
              <Label className="text-sm">{label}</Label>
              <select value={String(formData[id] ?? '')} onChange={e => onChange(id, e.target.value)}
                className="w-full p-2 border rounded-md bg-white text-sm">
                <option value="">Seleccionar</option>
                <option value="bueno">Bueno</option>
                <option value="regular">Regular</option>
                <option value="falla">Falla</option>
              </select>
            </div>
          ))}
        </div>
      </CollapsibleSection>
      </>}
    </>
  )
}
