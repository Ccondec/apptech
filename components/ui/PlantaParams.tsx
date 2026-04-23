import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CollapsibleSection } from './TechnicalFormShared'
import { Gauge, Zap, CheckSquare, FileText, Fuel } from 'lucide-react'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>
  onChange: (field: string, value: string) => void
}

const FUEL_TYPES = ['Diésel', 'Gas Natural', 'GLP', 'Gasolina', 'Bifuel']

const CHECKLIST_GROUPS = [
  {
    title: 'Motor y Combustible',
    items: [
      'Revisión nivel de combustible',
      'Revisión nivel de aceite motor',
      'Revisión nivel de refrigerante',
      'Inspección de fugas de combustible',
      'Inspección de fugas de aceite',
      'Revisión del sistema de escape',
    ],
  },
  {
    title: 'Sistema Eléctrico',
    items: [
      'Revisión batería de arranque',
      'Medición voltaje de batería',
      'Revisión de conexiones eléctricas',
      'Revisión del alternador',
      'Prueba de transferencia automática (ATS)',
      'Verificación de protecciones eléctricas',
    ],
  },
  {
    title: 'Prueba de Carga',
    items: [
      'Arranque sin carga',
      'Prueba con carga al 25%',
      'Prueba con carga al 50%',
      'Prueba con carga al 75%',
      'Verificación de frecuencia y voltaje',
      'Registro de parámetros en operación',
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

export default function PlantaParams({ formData, onChange }: Props) {
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
      {/* Checklist Planta — primero, igual que UPS */}
      <CollapsibleSection title="Lista de Actividades" icon={CheckSquare}>
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
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">{done}/{group.items.length}</span>
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
      </CollapsibleSection>

      {/* Especificaciones Planta */}
      <CollapsibleSection title="Especificaciones del Generador" icon={Fuel}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Tipo de combustible</Label>
            <select value={String(formData.genFuelType ?? '')} onChange={e => onChange('genFuelType', e.target.value)}
              className="w-full h-9 px-2 border rounded-md bg-white text-sm">
              <option value="">Seleccionar</option>
              {FUEL_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Potencia (kVA)</Label>
            <Input placeholder="Ej: 100" value={String(formData.genPowerKVA ?? '')}
              onChange={e => onChange('genPowerKVA', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label>Horas de operación</Label>
            <Input placeholder="Ej: 1250" value={String(formData.genHours ?? '')}
              onChange={e => onChange('genHours', e.target.value)} className="text-sm" />
          </div>
        </div>
      </CollapsibleSection>

      {/* Niveles y temperaturas */}
      <CollapsibleSection title="Niveles y Temperaturas" icon={Gauge}>
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-600">Niveles</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="genFuelLevel"    label="Combustible" unit="%"   value={String(formData.genFuelLevel    ?? '')} onChange={v => onChange('genFuelLevel',    v)} />
            <NumField id="genOilLevel"     label="Aceite"      unit="mm"  value={String(formData.genOilLevel     ?? '')} onChange={v => onChange('genOilLevel',     v)} />
            <NumField id="genCoolantLevel" label="Refrigerante" unit="%"  value={String(formData.genCoolantLevel ?? '')} onChange={v => onChange('genCoolantLevel', v)} />
            <NumField id="genOilPressure"  label="Pres. Aceite" unit="psi" value={String(formData.genOilPressure  ?? '')} onChange={v => onChange('genOilPressure',  v)} />
          </div>
          <h4 className="text-sm font-medium text-gray-600">Temperaturas y Operación</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="genEngineTemp"  label="Temp. Motor"  unit="°C"  value={String(formData.genEngineTemp  ?? '')} onChange={v => onChange('genEngineTemp',  v)} />
            <NumField id="genRPM"         label="RPM"          unit="rpm" value={String(formData.genRPM         ?? '')} onChange={v => onChange('genRPM',         v)} />
            <NumField id="genFrequency"   label="Frecuencia"   unit="Hz"  value={String(formData.genFrequency   ?? '')} onChange={v => onChange('genFrequency',   v)} />
            <NumField id="genRunTime"     label="Tiempo prueba" unit="min" value={String(formData.genRunTime     ?? '')} onChange={v => onChange('genRunTime',     v)} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Parámetros eléctricos Planta */}
      <CollapsibleSection title="Parámetros Eléctricos (Planta)" icon={Zap}>
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-600">Voltaje de Salida</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="genVoltL1"  label="L1"  unit="V" value={String(formData.genVoltL1  ?? '')} onChange={v => onChange('genVoltL1',  v)} />
            <NumField id="genVoltL2"  label="L2"  unit="V" value={String(formData.genVoltL2  ?? '')} onChange={v => onChange('genVoltL2',  v)} />
            <NumField id="genVoltL3"  label="L3"  unit="V" value={String(formData.genVoltL3  ?? '')} onChange={v => onChange('genVoltL3',  v)} />
            <NumField id="genVoltFF"  label="FF"  unit="V" value={String(formData.genVoltFF  ?? '')} onChange={v => onChange('genVoltFF',  v)} />
          </div>
          <h4 className="text-sm font-medium text-gray-600">Corriente de Salida</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="genAmpL1"   label="L1"  unit="A" value={String(formData.genAmpL1   ?? '')} onChange={v => onChange('genAmpL1',   v)} />
            <NumField id="genAmpL2"   label="L2"  unit="A" value={String(formData.genAmpL2   ?? '')} onChange={v => onChange('genAmpL2',   v)} />
            <NumField id="genAmpL3"   label="L3"  unit="A" value={String(formData.genAmpL3   ?? '')} onChange={v => onChange('genAmpL3',   v)} />
            <NumField id="genBattVolt" label="Bat. Arranque" unit="V" value={String(formData.genBattVolt ?? '')} onChange={v => onChange('genBattVolt', v)} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Estado Planta */}
      <CollapsibleSection title="Estado del Equipo (Planta)" icon={FileText}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { id: 'genStatusEngine',      label: 'Motor' },
            { id: 'genStatusAlternator',  label: 'Alternador' },
            { id: 'genStatusStartBatt',   label: 'Batería Arranque' },
            { id: 'genStatusATS',         label: 'Transferencia (ATS)' },
            { id: 'genStatusFuelSystem',  label: 'Sistema Combustible' },
            { id: 'genStatusCooling',     label: 'Sistema Enfriamiento' },
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
    </>
  )
}
