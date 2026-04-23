import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CollapsibleSection } from './TechnicalFormShared'
import { Sun, Zap, Battery, CheckSquare, FileText } from 'lucide-react'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: Record<string, any>
  onChange: (field: string, value: string) => void
}

const SYSTEM_TYPES  = ['On-Grid (Red)', 'Off-Grid (Aislado)', 'Híbrido', 'FNCER']
const INVERTER_TYPES = ['String', 'Microinversor', 'Central', 'Híbrido']

const CHECKLIST_GROUPS = [
  {
    title: 'Paneles Solares',
    items: [
      'Limpieza de módulos fotovoltaicos',
      'Inspección visual de daños / microfisuras',
      'Revisión de sombras sobre paneles',
      'Verificación de conexiones en caja de combinación',
      'Revisión de estructura y anclajes',
      'Medición de Voc e Isc por string',
    ],
  },
  {
    title: 'Inversor y Protecciones',
    items: [
      'Revisión del inversor (errores / alarmas)',
      'Verificación de parámetros de operación',
      'Revisión de protecciones DC (fusibles / DPS)',
      'Revisión de protecciones AC (interruptores)',
      'Verificación de puesta a tierra',
      'Revisión de ventilación del inversor',
    ],
  },
  {
    title: 'Baterías (si aplica)',
    items: [
      'Medición de voltaje de banco',
      'Verificación de estado de carga (SOC)',
      'Revisión de bornes y conexiones',
      'Verificación de temperatura de baterías',
      'Revisión del controlador de carga',
    ],
  },
  {
    title: 'Documentación',
    items: [
      'Registro fotográfico completado',
      'Parámetros de generación registrados',
      'Firma del cliente obtenida',
      'Recomendaciones documentadas',
    ],
  },
]

const NumField = ({ id, label, unit, value, onChange }: {
  id: string; label: string; unit: string; value: string; onChange: (v: string) => void
}) => (
  <div className="space-y-1">
    <Label htmlFor={id} className="text-xs">{label} ({unit})</Label>
    <Input id={id} type="number" inputMode="decimal" placeholder="0.0"
      value={value} onChange={e => onChange(e.target.value)} className="text-right text-sm" />
  </div>
)

export default function FotovoltaicoParams({ formData, onChange }: Props) {
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
      {/* Checklist FV — primero, igual que UPS */}
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
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{done}/{group.items.length}</span>
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

      {/* Especificaciones sistema fotovoltaico */}
      <CollapsibleSection title="Especificaciones del Sistema Fotovoltaico" icon={Sun}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Tipo de sistema</Label>
            <select value={String(formData.pvSystemType ?? '')} onChange={e => onChange('pvSystemType', e.target.value)}
              className="w-full h-9 px-2 border rounded-md bg-white text-sm">
              <option value="">Seleccionar</option>
              {SYSTEM_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Potencia pico (kWp)</Label>
            <Input placeholder="Ej: 10.5" value={String(formData.pvPeakPower ?? '')}
              onChange={e => onChange('pvPeakPower', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label>N° de paneles</Label>
            <Input placeholder="Ej: 24" value={String(formData.pvPanelCount ?? '')}
              onChange={e => onChange('pvPanelCount', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label>Marca / modelo panel</Label>
            <Input placeholder="Ej: Longi 440W" value={String(formData.pvPanelModel ?? '')}
              onChange={e => onChange('pvPanelModel', e.target.value)} className="text-sm" />
          </div>
          <div className="space-y-1">
            <Label>Tipo de inversor</Label>
            <select value={String(formData.pvInverterType ?? '')} onChange={e => onChange('pvInverterType', e.target.value)}
              className="w-full h-9 px-2 border rounded-md bg-white text-sm">
              <option value="">Seleccionar</option>
              {INVERTER_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Marca / modelo inversor</Label>
            <Input placeholder="Ej: Huawei SUN2000" value={String(formData.pvInverterModel ?? '')}
              onChange={e => onChange('pvInverterModel', e.target.value)} className="text-sm" />
          </div>
        </div>
      </CollapsibleSection>

      {/* Parámetros DC — Paneles */}
      <CollapsibleSection title="Parámetros DC — Paneles" icon={Sun}>
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-600">Por String / Combinador</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="pvVoc"         label="Voc (circuito abierto)"  unit="V"   value={String(formData.pvVoc         ?? '')} onChange={v => onChange('pvVoc',         v)} />
            <NumField id="pvIsc"         label="Isc (cortocircuito)"     unit="A"   value={String(formData.pvIsc         ?? '')} onChange={v => onChange('pvIsc',         v)} />
            <NumField id="pvVmp"         label="Vmp (máx. potencia)"     unit="V"   value={String(formData.pvVmp         ?? '')} onChange={v => onChange('pvVmp',         v)} />
            <NumField id="pvImp"         label="Imp (máx. potencia)"     unit="A"   value={String(formData.pvImp         ?? '')} onChange={v => onChange('pvImp',         v)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="pvDcPower"     label="Potencia DC generada"    unit="W"   value={String(formData.pvDcPower     ?? '')} onChange={v => onChange('pvDcPower',     v)} />
            <NumField id="pvIrradiance"  label="Irradiancia"             unit="W/m²"value={String(formData.pvIrradiance  ?? '')} onChange={v => onChange('pvIrradiance',  v)} />
            <NumField id="pvPanelTemp"   label="Temperatura panel"       unit="°C"  value={String(formData.pvPanelTemp   ?? '')} onChange={v => onChange('pvPanelTemp',   v)} />
            <NumField id="pvAmbientTemp" label="Temperatura ambiente"    unit="°C"  value={String(formData.pvAmbientTemp ?? '')} onChange={v => onChange('pvAmbientTemp', v)} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Parámetros AC — Inversor */}
      <CollapsibleSection title="Parámetros AC — Inversor" icon={Zap}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="pvAcVoltL1"    label="Voltaje L1"              unit="V"   value={String(formData.pvAcVoltL1    ?? '')} onChange={v => onChange('pvAcVoltL1',    v)} />
            <NumField id="pvAcVoltL2"    label="Voltaje L2"              unit="V"   value={String(formData.pvAcVoltL2    ?? '')} onChange={v => onChange('pvAcVoltL2',    v)} />
            <NumField id="pvAcVoltL3"    label="Voltaje L3"              unit="V"   value={String(formData.pvAcVoltL3    ?? '')} onChange={v => onChange('pvAcVoltL3',    v)} />
            <NumField id="pvFrequency"   label="Frecuencia"              unit="Hz"  value={String(formData.pvFrequency   ?? '')} onChange={v => onChange('pvFrequency',   v)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="pvAcCurrentL1" label="Corriente L1"            unit="A"   value={String(formData.pvAcCurrentL1 ?? '')} onChange={v => onChange('pvAcCurrentL1', v)} />
            <NumField id="pvAcCurrentL2" label="Corriente L2"            unit="A"   value={String(formData.pvAcCurrentL2 ?? '')} onChange={v => onChange('pvAcCurrentL2', v)} />
            <NumField id="pvAcCurrentL3" label="Corriente L3"            unit="A"   value={String(formData.pvAcCurrentL3 ?? '')} onChange={v => onChange('pvAcCurrentL3', v)} />
            <NumField id="pvAcPower"     label="Potencia activa"         unit="kW"  value={String(formData.pvAcPower     ?? '')} onChange={v => onChange('pvAcPower',     v)} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <NumField id="pvEfficiency"  label="Eficiencia inversor"     unit="%"   value={String(formData.pvEfficiency  ?? '')} onChange={v => onChange('pvEfficiency',  v)} />
            <NumField id="pvEnergyDay"   label="Energía generada (día)"  unit="kWh" value={String(formData.pvEnergyDay   ?? '')} onChange={v => onChange('pvEnergyDay',   v)} />
            <NumField id="pvEnergyTotal" label="Energía total acumulada" unit="kWh" value={String(formData.pvEnergyTotal ?? '')} onChange={v => onChange('pvEnergyTotal', v)} />
            <NumField id="pvCO2Saved"    label="CO₂ evitado"            unit="kg"  value={String(formData.pvCO2Saved    ?? '')} onChange={v => onChange('pvCO2Saved',    v)} />
          </div>
        </div>
      </CollapsibleSection>

      {/* Baterías fotovoltaicas */}
      <CollapsibleSection title="Sistema de Baterías (si aplica)" icon={Battery}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <NumField id="pvBattVoltage"  label="Voltaje banco"    unit="V"  value={String(formData.pvBattVoltage  ?? '')} onChange={v => onChange('pvBattVoltage',  v)} />
          <NumField id="pvBattSOC"      label="Estado de carga"  unit="%"  value={String(formData.pvBattSOC      ?? '')} onChange={v => onChange('pvBattSOC',      v)} />
          <NumField id="pvBattCurrent"  label="Corriente carga"  unit="A"  value={String(formData.pvBattCurrent  ?? '')} onChange={v => onChange('pvBattCurrent',  v)} />
          <NumField id="pvBattTemp"     label="Temperatura"      unit="°C" value={String(formData.pvBattTemp     ?? '')} onChange={v => onChange('pvBattTemp',     v)} />
        </div>
      </CollapsibleSection>

      {/* Estado sistema FV */}
      <CollapsibleSection title="Estado del Sistema Fotovoltaico" icon={FileText}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { id: 'pvStatusPanels',     label: 'Módulos Fotovoltaicos' },
            { id: 'pvStatusInverter',   label: 'Inversor' },
            { id: 'pvStatusStructure',  label: 'Estructura / Montaje' },
            { id: 'pvStatusProtDC',     label: 'Protecciones DC' },
            { id: 'pvStatusProtAC',     label: 'Protecciones AC' },
            { id: 'pvStatusBattery',    label: 'Baterías (si aplica)' },
          ].map(({ id, label }) => (
            <div key={id} className="space-y-1">
              <Label className="text-sm">{label}</Label>
              <select value={String(formData[id] ?? '')} onChange={e => onChange(id, e.target.value)}
                className="w-full p-2 border rounded-md bg-white text-sm">
                <option value="">Seleccionar</option>
                <option value="bueno">Bueno</option>
                <option value="regular">Regular</option>
                <option value="falla">Falla</option>
                <option value="na">N/A</option>
              </select>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </>
  )
}
