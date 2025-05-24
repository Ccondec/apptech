import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Wrench, User, FileText, Camera, X, Pen, Download, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  isSaved?: boolean;
  id:string;
}

type DrawEvent = React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>;

// Componente de firma con mejoras para dispositivos táctiles
const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onClear, isSaved = false,id }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 150 });
  const [signatureSaved, setSignatureSaved] = useState(isSaved);

  // Función para ajustar el tamaño del canvas según el dispositivo
  const adjustCanvasSize = () => {
    const container = canvasRef.current?.parentElement;
    if (container) {
      const width = container.clientWidth - 20; // Resta el padding
      setCanvasSize({
        width: width,
        height: width / 2 // Mantener proporción 2:1
      });
    }
  };

  useEffect(() => {
    // Ajustar tamaño al montar
    adjustCanvasSize();
    
    // Ajustar tamaño cuando cambia el tamaño de la ventana
    window.addEventListener('resize', adjustCanvasSize);
    
    return () => {
      window.removeEventListener('resize', adjustCanvasSize);
    };
  }, []);
  
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        setContext(ctx);
      }
    }
  }, [canvasSize]);

  useEffect(() => {
    // Actualizar el estado local cuando cambia la prop externa
    console.log(`SignaturePad ${id} - isSaved updated to:`, isSaved);
    setSignatureSaved(isSaved);
  }, [isSaved, id]);

  const startDrawing = (e: DrawEvent) => {
    e.preventDefault(); // Prevenir comportamiento por defecto para evitar scroll en móviles
    if (!context) return;
    const { offsetX, offsetY } = getCoordinates(e);
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    // Si el usuario comienza a dibujar, la firma ya no está guardada
    setSignatureSaved(false);
  };

  const draw = (e: DrawEvent) => {
    e.preventDefault(); // Prevenir comportamiento por defecto para evitar scroll en móviles
    if (!isDrawing || !context) return;
    const { offsetX, offsetY } = getCoordinates(e);
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing && context) {  // Verificar que context no sea null
      context.closePath();
      setIsDrawing(false);
    } else if (isDrawing) {
      // Si isDrawing es true pero context es null, al menos actualiza el estado
      setIsDrawing(false);
    }
  };

  const getCoordinates = (e: DrawEvent) => {
    if (!canvasRef.current) {
      return { offsetX: 0, offsetY: 0 }; // Valor predeterminado si el canvas no existe
    }
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Detectar si es un evento táctil o de ratón
    if ('touches' in e) {
      // Evento táctil
      const touch = e.touches[0];
      return {
        offsetX: (touch.clientX - rect.left) * scaleX,
        offsetY: (touch.clientY - rect.top) * scaleY
      };
    } else {
      // Evento de mouse
      return {
        offsetX: (e.clientX - rect.left) * scaleX,
        offsetY: (e.clientY - rect.top) * scaleY
      };
    }
  }; 

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return; // Verificar que canvas no sea null
    const ctx = canvas.getContext('2d');
    if (!ctx) return; // Verificar que ctx no sea null
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
    setSignatureSaved(false); // Resetear el estado guardado
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return; // Verificar que canvas no sea null
    
    console.log(`SignaturePad ${id} - Saving signature`);
    onSave(canvas.toDataURL());
    setSignatureSaved(true); // Actualizar estado a guardado
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-2 bg-white">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full border border-gray-200 rounded touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ touchAction: 'none' }} // Importante para prevenir el zoom en dispositivos táctiles
        />
      </div>
      <div className="flex gap-2">
        <Button 
          type="button" 
          onClick={clear}
          variant="outline"
          className="flex-1"
        >
          Borrar
        </Button>
        <Button 
          type="button" 
          onClick={save}
          className={`flex-1 ${signatureSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
        >
          {signatureSaved ? 'Guardado ✓' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
};

// Define una interface para cada campo eléctrico
interface ElectricalField {
  id: string;
  label: string;
  unit: string;
}

// Define una interface para las propiedades del componente
interface ElectricalInputGroupProps {
  title: string;
  fields: ElectricalField[];
  values: Record<string, string | number>;
  onChange: (id: string, value: string) => void;
}

// Aplica la interface al componente
const ElectricalInputGroup: React.FC<ElectricalInputGroupProps> = ({ title, fields, values, onChange }) => (
  <div className="space-y-4">
    <h4 className="font-medium pt-2">{title}</h4>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {fields.map(({ id, label, unit }) => (
        <div key={id} className="space-y-2">
          <Label htmlFor={id} className="text-sm">{label} ({unit})</Label>
          <Input
            id={id}
            type="number"
            value={values[id] || ''}
            onChange={(e) => onChange(id, e.target.value)}
            className="text-right text-sm"
            placeholder="0.0"
          />
        </div>
      ))}
    </div>
  </div>
);

interface CollapsibleSectionProps {
  title: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; // Para iconos SVG como los de lucide-react
  children: React.ReactNode;
  initiallyOpen?: boolean; // Opcional con valor predeterminado
}

// Componente colapsable para secciones en dispositivos móviles
const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon, children, initiallyOpen = false }) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const IconComponent = icon;
  
  return (
    <div className="border rounded-lg">
      <button 
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="font-semibold flex items-center gap-2">
          {IconComponent && <IconComponent className="w-5 h-5" />}
          {title}
        </h3>
        <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="p-4 border-t">
          {children}
        </div>
      )}
    </div>
  );
};

// Define la interfaz para los valores del formulario de cliente
interface ClientFormValues {
  clientCompany?: string;
  clientAddress?: string;
  clientCity?: string;
  clientContact?: string;
  clientEmail?: string;
  clientPhone?: string;
  // Añade aquí cualquier otro campo que pueda existir en values
}

// Define la interfaz para las propiedades del componente ClientSection
interface ClientSectionProps {
  values: ClientFormValues;
  onChange: (field: string, value: string) => void;
  isMobile: boolean;
}

// Aplica la interfaz al componente
const ClientSection: React.FC<ClientSectionProps> = ({ values, onChange, isMobile }) => {
  const content = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {/* Columna Izquierda */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="clientCompany">Empresa</Label>
          <Input
            id="clientCompany"
            value={values.clientCompany || ''}
            onChange={(e) => onChange('clientCompany', e.target.value)}
            placeholder="Nombre de la empresa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientAddress">Dirección</Label>
          <Input
            id="clientAddress"
            value={values.clientAddress || ''}
            onChange={(e) => onChange('clientAddress', e.target.value)}
            placeholder="Dirección de la empresa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientCity">Ciudad</Label>
          <Input
            id="clientCity"
            value={values.clientCity || ''}
            onChange={(e) => onChange('clientCity', e.target.value)}
            placeholder="Ciudad"
          />
        </div>
      </div>
      
      {/* Columna Derecha */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="clientContact">Contacto</Label>
          <Input
            id="clientContact"
            value={values.clientContact || ''}
            onChange={(e) => onChange('clientContact', e.target.value)}
            placeholder="Nombre del contacto"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientEmail">Correo Electrónico</Label>
          <Input
            id="clientEmail"
            type="email"
            value={values.clientEmail || ''}
            onChange={(e) => onChange('clientEmail', e.target.value)}
            placeholder="correo@empresa.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientPhone">Teléfono</Label>
          <Input
            id="clientPhone"
            value={values.clientPhone || ''}
            onChange={(e) => onChange('clientPhone', e.target.value)}
            placeholder="Número de contacto"
          />
        </div>
      </div>
    </div>
  );
  
  if (isMobile) {
    return (
      <CollapsibleSection title="Información del Cliente" icon={User} initiallyOpen={true}>
        {content}
      </CollapsibleSection>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <User className="w-5 h-5" />
        Información del Cliente
      </h3>
      {content}
    </div>
  );
};

// Define una interfaz para el componente de Tipo de Servicio
interface ServiceTypeProps {
  value: string;
  onChange: (value: string) => void;
  isMobile: boolean;
}

// Crear un componente específico para el Tipo de Servicio
const ServiceTypeSection: React.FC<ServiceTypeProps> = ({ value, onChange, isMobile }) => {
  const content = (
    <div className="space-y-4">
      <div className="flex items-center">
        <label htmlFor="serviceType" className="text-lg font-medium flex-1">Tipo de Servicio:</label>
        <div className="flex-1">
          <select
            id="serviceType"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-2 border rounded-md bg-white"
          >
            <option value="">Seleccione un servicio</option>
            {[
              'Mantenimiento Preventivo',
              'Cambio Baterías',
              'Revision y Diagnóstico',
              'Mantenimiento Correctivo',
              'Instalación y Arranque',
              'Garantía'
            ].map(service => (
              <option key={service} value={service.toLowerCase()}>{service}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <CollapsibleSection title="Tipo de Servicio" icon={Wrench} initiallyOpen={true}>
        {content}
      </CollapsibleSection>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="font-bold flex items-center gap-2 mb-4">
        <Wrench className="w-5 h-5" />
        Detalles del Servicio
      </h3>
      {content}
    </div>
  );
    
};

// Define la interfaz para los valores del formulario de servicio
interface ServiceFormValues {
  serviceType?: string;
  equipmentBrand?: string;
  equipmentModel?: string;
  equipmentSerial?: string;
  equipmentUbicacion?: string;
  // Añade aquí cualquier otro campo que pueda existir en values
}

// Define la interfaz para las propiedades del componente ServiceSection
interface ServiceSectionProps {
  values: ServiceFormValues;
  onChange: (field: string, value: string) => void;
  isMobile: boolean;
}

// Aplica la interfaz al componente
const ServiceSection: React.FC<ServiceSectionProps> = ({ values, onChange, isMobile }) => {
  const content = (
    <>
      
      {/* Resto de campos en grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="equipmentBrand">Marca Equipo</Label>
          <Input
            id="equipmentBrand"
            value={values.equipmentBrand || ''}
            onChange={(e) => onChange('equipmentBrand', e.target.value)}
            placeholder="Marca del equipo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipmentModel">Modelo Equipo</Label>
          <Input
            id="equipmentModel"
            value={values.equipmentModel || ''}
            onChange={(e) => onChange('equipmentModel', e.target.value)}
            placeholder="Modelo del equipo"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipmentSerial">Serial Equipo</Label>
          <Input
            id="equipmentSerial"
            value={values.equipmentSerial || ''}
            onChange={(e) => onChange('equipmentSerial', e.target.value)}
            placeholder="Número de serie"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipmentUbicacion">Ubicacion Equipo</Label>
          <Input
            id="equipmentUbicacion"
            value={values.equipmentUbicacion || ''}
            onChange={(e) => onChange('equipmentUbicacion', e.target.value)}
            placeholder="Ubicacion Equipo"
          />
        </div>
      </div>
    </>
  );
  
  if (isMobile) {
    return (
      <CollapsibleSection title="Detalles del Servicio" icon={Wrench}>
        {content}
      </CollapsibleSection>
    );
  }
  
  return (
    <div className="space-y-4">
      {content}
    </div>
  );
};

// Reutilizamos la interfaz ElectricalField que definimos anteriormente
interface ElectricalField {
  id: string;
  label: string;
  unit: string;
}

// Define la estructura específica de los parámetros eléctricos
interface ElectricalParameters {
  inputVoltage: ElectricalField[];
  inputCurrent: ElectricalField[];
  outputVoltage: ElectricalField[];
  outputCurrent: ElectricalField[];
}

// Define la interfaz para las propiedades del componente ElectricalSection
interface ElectricalSectionProps {
  electricalParameters: ElectricalParameters;
  formData: Record<string, string | number>;
  handleFieldChange: (field: string, value: string) => void;
  isMobile: boolean;
}

// Aplica la interfaz al componente
const ElectricalSection: React.FC<ElectricalSectionProps> = ({ 
  electricalParameters, 
  formData, 
  handleFieldChange, 
  isMobile 
}) => {
  const content = (
    <div className="space-y-6">
      <ElectricalInputGroup
        title="Voltaje de Entrada"
        fields={electricalParameters.inputVoltage}
        values={formData}
        onChange={handleFieldChange}
      />
      <ElectricalInputGroup
        title="Corriente de Entrada"
        fields={electricalParameters.inputCurrent}
        values={formData}
        onChange={handleFieldChange}
      />
      <ElectricalInputGroup
        title="Voltaje de Salida"
        fields={electricalParameters.outputVoltage}
        values={formData}
        onChange={handleFieldChange}
      />
      <ElectricalInputGroup
        title="Corriente de Salida"
        fields={electricalParameters.outputCurrent}
        values={formData}
        onChange={handleFieldChange}
      />
    </div>
  );
  
  if (isMobile) {
    return (
      <CollapsibleSection title="Parámetros Eléctricos" icon={FileText}>
        {content}
      </CollapsibleSection>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Parámetros Eléctricos
      </h3>
      {content}
    </div>
  );
};

// Define una interfaz para los valores específicos del formulario de baterías
interface BatteryFormData {
  // Parámetros de batería - Grupo 1
  batteryVoltageTotal?: string | number;
  batteryVoltageTest?: string | number;
  batteryCurrentDischarge?: string | number;
  batteryCurrentTest?: string | number;
  
  // Parámetros de batería - Grupo 2
  batteryQuantity?: string | number;
  batteryReference?: string | number;
  batteryAutonomy?: string | number;
  batteryFecha?: string | number;
  
  // Otros campos que puedas tener
  [key: string]: string | number | undefined;
}

// Define la interfaz para las propiedades del componente BatterySection
interface BatterySectionProps {
  formData: BatteryFormData;
  handleFieldChange: (field: string, value: string) => void;
  isMobile: boolean;
}

// Componente para la sección de baterías (sin los estados)
const BatterySection: React.FC<BatterySectionProps> = ({ formData, handleFieldChange, isMobile }) => {
  const content = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { id: 'batteryVoltageTotal', label: 'Voltaje Total', unit: 'V' },
          { id: 'batteryVoltageTest', label: 'Voltaje Descarga', unit: 'V' },
          { id: 'batteryCurrentDischarge', label: 'Corriente Descarga', unit: 'A' },
          { id: 'batteryCurrentTest', label: 'Corriente Carga', unit: 'A' }
        ].map(({ id, label, unit }) => (
          <div key={id} className="space-y-2">
            <Label htmlFor={id} className="text-sm">{label} ({unit})</Label>
            <Input
              id={id}
              type="number"
              value={formData[id] || ''}
              onChange={(e) => handleFieldChange(id, e.target.value)}
              className="text-right text-sm"
              placeholder="0.0"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
        <div className="space-y-2">
          <Label htmlFor="batteryQuantity" className="text-sm">Cantidad Baterías</Label>
          <Input
            id="batteryQuantity"
            type="number"
            value={formData.batteryQuantity || ''}
            onChange={(e) => handleFieldChange('batteryQuantity', e.target.value)}
            className="text-right text-sm"
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="batteryReference" className="text-sm">Referencia (Ah)</Label>
          <Input
            id="batteryReference"
            value={formData.batteryReference || ''}
            onChange={(e) => handleFieldChange('batteryReference', e.target.value)}
            className="text-right text-sm"
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="batteryAutonomy" className="text-sm">Autonomía (min)</Label>
          <Input
            id="batteryAutonomy"
            type="number"
            value={formData.batteryAutonomy || ''}
            onChange={(e) => handleFieldChange('batteryAutonomy', e.target.value)}
            className="text-right text-sm"
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="batteryFecha" className="text-sm">Fecha Fabricacion (FI)</Label>
          <Input
            id="batteryFecha"
            value={formData.batteryFecha || ''}
            onChange={(e) => handleFieldChange('batteryFecha', e.target.value)}
            className="text-right text-sm"
            placeholder="0"
          />
        </div>
      </div>
    </div>
  );
  
  if (isMobile) {
    return (
      <CollapsibleSection title="Parámetros de Baterías" icon={FileText}>
        {content}
      </CollapsibleSection>
    );
  }
  
  return (
    <div className="space-y-4">
      <h4 className="font-medium pt-4">Parámetros de Baterías</h4>
      {content}
    </div>
  );
};

// Define una interfaz para los valores específicos del formulario de estado del equipo
interface EquipmentStatusFormData {
  rectifierStatus?: string;
  chargerStatus?: string;
  inverterStatus?: string;
  batteryStatus?: string;
  
  // Otros campos que puedas tener
  [key: string]: string | number | undefined;
}

// Define la interfaz para las propiedades del componente EquipmentStatusSection
interface EquipmentStatusSectionProps {
  formData: EquipmentStatusFormData;
  handleFieldChange: (field: string, value: string) => void;
  isMobile: boolean;
}

// Componente para la sección de estado del equipo
const EquipmentStatusSection: React.FC<EquipmentStatusSectionProps> = ({ 
  formData, 
  handleFieldChange, 
  isMobile 
}) => {
  const content = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="space-y-2">
        <Label htmlFor="rectifierStatus" className="text-sm">Estado Rectificador</Label>
        <select
          id="rectifierStatus"
          value={formData.rectifierStatus || ''}
          onChange={(e) => handleFieldChange('rectifierStatus', e.target.value)}
          className="w-full p-2 border rounded-md bg-white text-sm"
        >
          <option value="">Seleccionar estado</option>
          <option value="bueno">Bueno</option>
          <option value="revisar">Revisar</option>
          <option value="falla">Falla</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="chargerStatus" className="text-sm">Estado Cargador</Label>
        <select
          id="chargerStatus"
          value={formData.chargerStatus || ''}
          onChange={(e) => handleFieldChange('chargerStatus', e.target.value)}
          className="w-full p-2 border rounded-md bg-white text-sm"
        >
          <option value="">Seleccionar estado</option>
          <option value="bueno">Bueno</option>
          <option value="revisar">Revisar</option>
          <option value="falla">Falla</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inverterStatus" className="text-sm">Estado Inversor</Label>
        <select
          id="inverterStatus"
          value={formData.inverterStatus || ''}
          onChange={(e) => handleFieldChange('inverterStatus', e.target.value)}
          className="w-full p-2 border rounded-md bg-white text-sm"
        >
          <option value="">Seleccionar estado</option>
          <option value="bueno">Bueno</option>
          <option value="revisar">Revisar</option>
          <option value="falla">Falla</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="batteryStatus" className="text-sm">Estado Batería</Label>
        <select
          id="batteryStatus"
          value={formData.batteryStatus || ''}
          onChange={(e) => handleFieldChange('batteryStatus', e.target.value)}
          className="w-full p-2 border rounded-md bg-white text-sm"
        >
          <option value="">Seleccionar estado</option>
          <option value="bueno">Bueno</option>
          <option value="regular">Regular</option>
          <option value="remplazar">Remplazar</option>
        </select>
      </div>
    </div>
  );
  
  if (isMobile) {
    return (
      <CollapsibleSection title="Estado del Equipo" icon={Wrench}>
        {content}
      </CollapsibleSection>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Wrench className="w-5 h-5" />
        Estado del Equipo
      </h3>
      {content}
    </div>
  );
};

// Define una interfaz para los valores del formulario de descripción
interface DescriptionFormData {
  description?: string;
  recommendations?: string;
  // Otros campos que puedas tener
  [key: string]: string | number | undefined;
}

// Define la interfaz para las propiedades del componente DescriptionSection
interface DescriptionSectionProps {
  formData: DescriptionFormData;
  handleFieldChange: (field: string, value: string) => void;
  isMobile: boolean;
}

// Componente para la sección de descripción y recomendaciones
const DescriptionSection: React.FC<DescriptionSectionProps> = ({ formData, handleFieldChange, isMobile }) => {
  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="description">Descripción del trabajo realizado</Label>
        <textarea
          id="description"
          value={formData.description || ''}
          onChange={(e) => handleFieldChange('description', e.target.value)}
          className="w-full min-h-[100px] p-2 border rounded-md text-justify"
          placeholder="Detalle el trabajo realizado..."
        />
      </div>

      <div className="space-y-2 mt-4">
        <Label htmlFor="recommendations">Recomendaciones</Label>
        <textarea
          id="recommendations"
          value={formData.recommendations || ''}
          onChange={(e) => handleFieldChange('recommendations', e.target.value)}
          className="w-full min-h-[100px] p-2 border rounded-md text-justify"
          placeholder="Ingrese las recomendaciones..."
        />
      </div>
    </div>
  );
  
  if (isMobile) {
    return (
      <CollapsibleSection title="Descripción y Recomendaciones" icon={FileText}>
        {content}
      </CollapsibleSection>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Descripción y Recomendaciones
      </h3>
      {content}
    </div>
  );
};

// Define una interfaz para la estructura de las fotos
interface Photo {
  id: number;
  url: string | ArrayBuffer | null;
  description?: string;
  // Otros campos que puedas tener para las fotos
}

// Define una interfaz para los valores del formulario relacionados con fotos
interface PhotoFormData {
  photos?: Photo[];
  // Otros campos que puedas tener
  [key: string]: Photo[] | string | number | boolean | undefined;
}

// Define la interfaz para las propiedades del componente PhotosSection
interface PhotosSectionProps {
  formData: PhotoFormData;
  setFormData: React.Dispatch<React.SetStateAction<PhotoFormData>>;
  isMobile: boolean;
}

// Define el tipo para el evento de input de archivo
type FileInputEvent = React.ChangeEvent<HTMLInputElement>;

// Componente para la sección de fotos
const PhotosSection: React.FC<PhotosSectionProps> = ({ formData, setFormData, isMobile }) => {
  const addPhoto = (e: FileInputEvent) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (result) {
          // Asegúrate de que url sea string
        const url = typeof result === 'string' 
        ? result 
        : ''; // Proporciona un string vacío o algún otro valor por defecto
      
          setFormData(prev => ({
            ...prev,
            photos: [...(prev.photos || []), {
              id: Date.now(),
              url,
              description: ''
            }]
          }));
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };
  
  const removePhoto = (photoId: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos?.filter(p => p.id !== photoId) || []
    }));
  };
  
  const updatePhotoDescription = (photoId: number, description: string) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos?.map(p =>
        p.id === photoId
          ? { ...p, description }
          : p
      ) || []
    }));
  };
  
  const content = (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button 
          type="button"
          onClick={() => document.getElementById('photoInput')?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Camera className="w-4 h-4 mr-2" />
          Tomar Foto
        </Button>
        <input
          type="file"
          id="photoInput"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={addPhoto}
        />
      </div>

      {/* Grid de Fotos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(formData.photos || []).map((photo, index) => (
          <div key={photo.id} className="space-y-2 border rounded-lg p-2">
            <div className="relative">
            {typeof photo.url === 'string' ? (
            <Image
              src={photo.url as string}
              alt={`Foto ${index + 1}`}
              width={500}
              height={192}
              className="object-cover rounded-lg"
              style={{ width: '100%', height: '12rem' }} // 48px = 12rem
            />
            ) : (
              <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
            <span>Imagen no disponible</span>
          </div>
        )}
              <button
                type="button"
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                onClick={() => removePhoto(photo.id)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              placeholder="Descripción de la foto..."
              className="w-full p-2 text-sm border rounded-md"
              value={photo.description}
              onChange={(e) => updatePhotoDescription(photo.id, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
  
  if (isMobile) {
    return (
      <CollapsibleSection title="Registro Fotográfico" icon={Camera}>
        {content}
      </CollapsibleSection>
    );
  }
  
  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <Camera className="w-5 h-5" />
        Registro Fotográfico
      </h3>
      {content}
    </div>
  );
};

// Define una interfaz para los valores del formulario relacionados con firmas
interface SignaturesFormData {
  clientSignature?: string | null;
  clientSignatureName?: string;
  clientSignatureId?: string;
  technicianSignature?: string | null;
  technicianName?: string;
  technicianId?: string;
  // Añade aquí cualquier otro campo relacionado con firmas
  [key: string]: string | number | boolean | null | undefined;
}

// Componente para la sección de firmas
const SignaturesSection: React.FC<SignaturesSectionProps> = ({ formData, handleFieldChange, isMobile }) => {
  // Determinar si las firmas están guardadas
  const isClientSignatureSaved = formData.clientSignature ? true : false;
  const isTechnicianSignatureSaved = formData.technicianSignature ? true : false;
  
  // Para depuración
  console.log("Estado de las firmas:");
  console.log("- Cliente guardada:", isClientSignatureSaved);
  console.log("- Técnico guardada:", isTechnicianSignatureSaved);

  const handleClientSignatureSave = (dataUrl: string) => {
    console.log("Guardando firma del cliente");
    handleFieldChange('clientSignature', dataUrl);
  };

  const handleTechnicianSignatureSave = (dataUrl: string) => {
    console.log("Guardando firma del técnico");
    handleFieldChange('technicianSignature', dataUrl);
  };

const content = (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    {/* Firma del Cliente */}
    <div className="space-y-4">
      <h4 className="font-medium text-center">Firma del Cliente</h4>
      <SignaturePad
        id="client-signature" // ID único para el pad del cliente
        onSave={handleClientSignatureSave}
        onClear={() => {
          console.log("Borrando firma del cliente");
          handleFieldChange('clientSignature', null);
        }}
        isSaved={isClientSignatureSaved}
      />
      <div className="space-y-2">
        <Input
          id="clientSignatureName"
          value={formData.clientSignatureName || ''}
          onChange={(e) => handleFieldChange('clientSignatureName', e.target.value)}
          placeholder="Nombre del Cliente"
          className="text-center text-sm"
        />
        <Input
          id="clientSignatureId"
          value={formData.clientSignatureId || ''}
          onChange={(e) => handleFieldChange('clientSignatureId', e.target.value)}
          placeholder="Número de Identificación"
          className="text-center text-sm"
        />
      </div>
    </div>

    {/* Firma del Técnico */}
    <div className="space-y-4">
      <h4 className="font-medium text-center">Firma del Técnico</h4>
      <SignaturePad
        id="technician-signature" // ID único para el pad del técnico
        onSave={handleTechnicianSignatureSave}
        onClear={() => {
          console.log("Borrando firma del técnico");
          handleFieldChange('technicianSignature', null);
        }}
        isSaved={isTechnicianSignatureSaved}
      />
      <div className="space-y-2">
        <Input
          id="technicianName"
          value={String(formData.technicianName || '')}
          onChange={(e) => handleFieldChange('technicianName', e.target.value)}
          placeholder="Nombre del Técnico"
          className="text-center text-sm"
        />
        <Input
          id="technicianId"
          value={String(formData.technicianId || '')}
          onChange={(e) => handleFieldChange('technicianId', e.target.value)}
          placeholder="Número de Identificación"
          className="text-center text-sm"
        />
      </div>
    </div>
  </div>
);
  
  if (isMobile) {
    return (
      <CollapsibleSection title="Firmas" icon={Pen}>
        {content}
      </CollapsibleSection>
    );
  }
  
  return (
    <div className="space-y-6">
      <h3 className="font-semibold flex items-center gap-2">
        <Pen className="w-5 h-5" />
        Firmas
      </h3>
      {content}
    </div>
  );
};

// Componente principal con detección de dispositivo
const TechnicalForm = () => {
  const [formData, setFormData] = useState({});
  const [reportNumber, setReportNumber] = useState(1);
  const [isEditingReportNumber, setIsEditingReportNumber] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const currentDate = new Date().toLocaleDateString();
  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Detectar si es un dispositivo móvil
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Comprobar al cargar
    checkIfMobile();
    
    // Comprobar al cambiar el tamaño de la ventana
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  type FileInputEvent = React.ChangeEvent<HTMLInputElement>;

  // Función para manejar el cambio en el número de reporte
const handleReportNumberChange = (e) => {
  const value = parseInt(e.target.value);
  // Asegurarse de que el valor sea un número positivo
  if (value && value > 0) {
    setReportNumber(value);
  } else {
    setReportNumber(1); // Valor por defecto si no es válido
  }
};

  const handleLogoChange = (e: FileInputEvent) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
      if (event.target && event.target.result) { 
        setLogo(event.target.result as string);
       }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFieldChange = (field: string, value: string | number | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const companyInfo = {
    name: "Ion Energy S.A.S",
    address: "CALLE 73 65-39 ",
    phone: "+57 312 4493845",
    email: "comercial@ionenergy.com.co",
  };
  
  interface FormData {
    serviceType?: string;
    equipmentBrand?: string;
    equipmentModel?: string;
    equipmentSerial?: string;
    equipmentUbicacion?: string;
    description?: string;

     // Datos del cliente
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  
  // Parámetros eléctricos - Voltaje de entrada
  voltageInL1: string;
  voltageInL2: string;
  voltageInL3: string;
  voltageInFF: string;
  
  // Parámetros eléctricos - Corriente de entrada
  currentInL1: string;
  currentInL2: string;
  currentInL3: string;
  currentInN: string;
  
  // Parámetros eléctricos - Voltaje de salida
  voltageOutL1: string;
  voltageOutL2: string;
  voltageOutL3: string;
  voltageOutFF: string;
  
  // Parámetros eléctricos - Corriente de salida
  currentOutL1: string;
  currentOutL2: string;
  currentOutL3: string;
  currentOutN: string;
  
  // Parámetros de batería
  batteryVoltageTotal: string;
  batteryVoltageTest: string;
  batteryCurrentDischarge: string;
  batteryCurrentTest: string;
  batteryQuantity: string;
  batteryReference: string;
  batteryAutonomy: string;
  batteryFecha: string;
  rectifierStatus: string;
  chargerStatus: string;
  inverterStatus: string;
  batteryStatus: string;
  
  // Recomendaciones
  recommendations: string;
  
  // Firmas
  clientSignatureName: string;
  clientSignatureId: string;
  technicianName: string;
  technicianId: string;
}

 // Función para generar PDF optimizada sin espacios en blanco
const generatePDF = async () => {
  const form = formRef.current;
  if (!form) return;

  // Crear documento PDF
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margins = { top: 10, right: 10, bottom: 15, left: 10 }; // Aumentar margen inferior para pie de página
  let yPos = margins.top;

  // Función para comprobar si se necesita una nueva página
  const checkNewPage = (requiredSpace) => {
    if (yPos + requiredSpace > pageHeight - margins.bottom) {
      pdf.addPage();
      yPos = margins.top;
      return true;
    }
    return false;
  };

  // Capturar el encabezado - minimizar su altura
  const headerElement = (form as HTMLElement).querySelector('.header');
  if (headerElement) {
    const headerCanvas = await html2canvas(headerElement as HTMLElement);
    const headerImgData = headerCanvas.toDataURL('image/png');
    const headerHeight = 40; 
    pdf.addImage(headerImgData, 'PNG', margins.left, yPos, pageWidth - (margins.left + margins.right), headerHeight);
    yPos += headerHeight + 5; // Menor espacio después del encabezado
  }

  // Sección de información del cliente (compacta)
  pdf.setFontSize(12); // Reducir tamaño de fuente
  pdf.setFont('helvetica', 'bold');
  pdf.text('Información del Cliente', margins.left, yPos);
  yPos += 5; // Reducir espacio después del título
  
  pdf.setFontSize(9); // Tamaño más pequeño para detalles
  pdf.setFont('helvetica', 'normal');
  
  // Crear mapa de información del cliente filtrando valores vacíos
  const clientInfo = {
    "Empresa": formData.clientCompany || '-',
    "Dirección": formData.clientAddress || '-',
    "Ciudad": formData.clientCity || '-',
    "Contacto": formData.clientContact || '-',
    "Email": formData.clientEmail || '-',
    "Teléfono": formData.clientPhone || '-'
  };
  
  // Convertir a array de items para su layout
  const clientInfoItems = Object.entries(clientInfo)
    .filter(([_, value]) => value !== '-') // Solo incluir valores no vacíos
    .map(([label, value]) => ({ label, value }));
  
  // Calcular dimensiones de columna optimizadas
  const clientColWidth = (pageWidth - (margins.left + margins.right)) / 2;
  
  // Determinar elementos por columna - distribuir equitativamente
  const itemsPerColumn = Math.ceil(clientInfoItems.length / 2);
  
  // Organizar info del cliente en dos columnas
  const firstColItems = clientInfoItems.slice(0, itemsPerColumn);
  const secondColItems = clientInfoItems.slice(itemsPerColumn);
  
  const rowHeight = 4; // Reducir altura de fila
  let maxRowsUsed = 0;
  
  // Dibujar elementos en primera columna
  firstColItems.forEach((item, index) => {
    pdf.text(`${item.label}: ${item.value}`, margins.left, yPos + (index * rowHeight));
    maxRowsUsed = Math.max(maxRowsUsed, index + 1);
  });
  
  // Dibujar elementos en segunda columna
  secondColItems.forEach((item, index) => {
    pdf.text(`${item.label}: ${item.value}`, margins.left + clientColWidth, yPos + (index * rowHeight));
    maxRowsUsed = Math.max(maxRowsUsed, index + 1);
  });
  
  yPos += (maxRowsUsed * rowHeight) + 5; // Menor espacio después de la sección

  // Detalles del servicio - compactar
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Detalles del Servicio', margins.left, yPos);
  yPos += 7;
  
  // Primero destacar el tipo de servicio
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Tipo de Servicio:', margins.left, yPos);

  // Agregar el valor del tipo de servicio a la derecha
  pdf.setFont('helvetica', 'normal');
  const serviceType = formData.serviceType ? formData.serviceType.charAt(0).toUpperCase() + formData.serviceType.slice(1) : '-';
  pdf.text(serviceType, margins.left + 35, yPos);

  yPos += 3; // Espacio después del tipo de servicio

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');

  // Calcular dimensiones de celda para diseño de 4 columnas (ahora sin el tipo de servicio)
  const serviceColWidth = (pageWidth - (margins.left + margins.right)) / 4;
  
  // Filtrar valores vacíos para mostrar solo información relevante
  const serviceParams = [
    { label: 'Marca', value: formData.equipmentBrand || null }, 
    { label: 'Modelo Equipo', value: formData.equipmentModel || null },
    { label: 'Serial Equipo', value: formData.equipmentSerial || null },
    { label: 'Ubicacion', value: formData.equipmentUbicacion || null }
  ].filter(param => param.value !== null);
  
  // Si hay datos de servicio, mostrarlos en una fila compacta
  if (serviceParams.length > 0) {
    const serviceColWidth = (pageWidth - (margins.left + margins.right)) / serviceParams.length;
    
    // Fondo para detalles del servicio
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margins.left, yPos, pageWidth - (margins.left + margins.right), rowHeight * 1.5, 'F');
    
    // Mostrar parámetros del servicio
    serviceParams.forEach((param, index) => {
      const xPos = margins.left + (index * serviceColWidth);
      pdf.text(`${param.label}: ${param.value}`, xPos + 2, yPos + (rowHeight * 0.9));
    });
    
    yPos += (rowHeight * 1.5) + 5;
  } else {
    // Si no hay datos, mostrar mensaje
    pdf.text("Sin información de servicio", margins.left, yPos);
    yPos += rowHeight + 3;
  }

  // Verificar si tenemos parámetros eléctricos para mostrar
  const hasElectricalParams = [
    formData.voltageInL1, formData.voltageInL2, formData.voltageInL3, formData.voltageInFF,
    formData.currentInL1, formData.currentInL2, formData.currentInL3, formData.currentInN,
    formData.voltageOutL1, formData.voltageOutL2, formData.voltageOutL3, formData.voltageOutFF,
    formData.currentOutL1, formData.currentOutL2, formData.currentOutL3, formData.currentOutN
  ].some(param => param);

  // Sección de parámetros eléctricos - solo mostrar si hay datos
  if (hasElectricalParams) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Parámetros Eléctricos', margins.left, yPos);
    yPos += 5;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');

    // Función optimizada para tablas de parámetros
    const createParameterTable = (title, data, startY) => {
      // Verificar si todos los valores están vacíos
      if (data.every(val => !val || val === '-')) {
        return startY; // No dibujar tabla vacía
      }
      
      // Verificar si necesitamos cambiar de página
      if (checkNewPage(15)) {
        startY = yPos;
      }
      
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, margins.left, startY);
      pdf.setFont('helvetica', 'normal');
      
      const headers = ['L1', 'L2', 'L3', 'N/T'];
      const tableWidth = pageWidth - (margins.left + margins.right);
      const cellWidth = tableWidth / headers.length;
      const cellHeight = 6; // Reducir altura de celda
      
      // Encabezados de tabla
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margins.left, startY + 1.5, tableWidth, cellHeight, 'F');
      
      headers.forEach((header, i) => {
        const xPos = margins.left + (i * cellWidth);
        pdf.text(header, xPos + (cellWidth / 2), startY + 5.5, { align: 'center' });
      });
      
      // Datos de tabla
      data.forEach((value, i) => {
        const xPos = margins.left + (i * cellWidth);
        pdf.text(value || '-', xPos + (cellWidth / 2), startY + 5.5 + cellHeight, { align: 'center' });
      });
      
      return startY + (2 * cellHeight) + 1;
    };

    // Tablas de parámetros eléctricos - solo mostrar si tienen valores
    if ([formData.voltageInL1, formData.voltageInL2, formData.voltageInL3, formData.voltageInFF].some(param => param)) {
      yPos = createParameterTable('Voltaje de Entrada (V)', [
        String(formData.voltageInL1 || '-'),
        String(formData.voltageInL2 || '-'),
        String(formData.voltageInL3 || '-'),
        String(formData.voltageInFF || '-')
      ], yPos);
    }
    
    if ([formData.currentInL1, formData.currentInL2, formData.currentInL3, formData.currentInN].some(param => param)) {
      yPos = createParameterTable('Corriente de Entrada (A)', [
        String(formData.currentInL1 || '-'),
        String(formData.currentInL2 || '-'),
        String(formData.currentInL3 || '-'),
        String(formData.currentInN || '-')
      ], yPos + 2);
    }
    
    if ([formData.voltageOutL1, formData.voltageOutL2, formData.voltageOutL3, formData.voltageOutFF].some(param => param)) {
      yPos = createParameterTable('Voltaje de Salida (V)', [
        String(formData.voltageOutL1 || '-'),
        String(formData.voltageOutL2 || '-'),
        String(formData.voltageOutL3 || '-'),
        String(formData.voltageOutFF || '-')
      ], yPos + 2);
    }
    
    if ([formData.currentOutL1, formData.currentOutL2, formData.currentOutL3, formData.currentOutN].some(param => param)) {
      yPos = createParameterTable('Corriente de Salida (A)', [
        String(formData.currentOutL1 || '-'),
        String(formData.currentOutL2 || '-'),
        String(formData.currentOutL3 || '-'),
        String(formData.currentOutN || '-')
      ], yPos + 2);
    }
  }

  // Verificar si hay datos de batería
  const hasBatteryParams = [
    formData.batteryVoltageTotal, formData.batteryVoltageTest, 
    formData.batteryCurrentDischarge, formData.batteryCurrentTest,
    formData.batteryQuantity, formData.batteryReference, 
    formData.batteryAutonomy, formData.batteryFecha,
    formData.rectifierStatus, formData.chargerStatus, 
    formData.inverterStatus, formData.batteryStatus
  ].some(param => param);

  // Parámetros de batería - solo mostrar si hay datos
  if (hasBatteryParams) {
    // Verificar espacio para nueva sección
    if (checkNewPage(30)) {
      // Ya estamos en una nueva página, yPos ya está actualizado
    } else {
      yPos += 5; // Pequeño espacio antes de la sección
    }
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Parámetros de Baterías', margins.left, yPos);
    yPos += 5;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    
    // Filtrar parámetros vacíos para mostrar solo información relevante
    const batteryParams = [
      { label: 'Voltaje Total (V)', value: formData.batteryVoltageTotal || null },
      { label: 'Voltaje Descarga (V)', value: formData.batteryVoltageTest || null },
      { label: 'Corriente Descarga (A)', value: formData.batteryCurrentDischarge || null },
      { label: 'Corriente Carga (A)', value: formData.batteryCurrentTest || null },
      { label: 'Cantidad', value: formData.batteryQuantity || null },
      { label: 'Referencia (Ah)', value: formData.batteryReference || null },
      { label: 'Autonomía (min)', value: formData.batteryAutonomy || null },
      { label: 'Fecha Bateria', value: formData.batteryFecha || null }
    ].filter(param => param.value !== null);
    
    if (batteryParams.length > 0) {
      // Determinar número de columnas óptimo según cantidad de parámetros
      const columns = Math.min(4, batteryParams.length);
      const batteryColWidth = (pageWidth - (margins.left + margins.right)) / columns;
      
      // Distribuir parámetros en filas y columnas
      for (let i = 0; i < batteryParams.length; i++) {
        const row = Math.floor(i / columns);
        const col = i % columns;
        const param = batteryParams[i];
        
        const xPos = margins.left + (col * batteryColWidth);
        const paramYPos = yPos + (row * rowHeight * 1.1);
        
        // Si una nueva fila excede el espacio disponible, crear nueva página
        if (row > 0 && col === 0 && checkNewPage(rowHeight * 1.1)) {
          // Ya estamos en nueva página, paramYPos se debe recalcular
          pdf.text(`${param.label}: ${param.value}`, xPos, yPos);
        } else {
          pdf.text(`${param.label}: ${param.value}`, xPos, paramYPos);
        }
      }
      
      // Actualizar posición después de la tabla de baterías
      const rows = Math.ceil(batteryParams.length / columns);
      yPos += (rows * rowHeight * 1.1) + 3;
    } else {
      pdf.text("Sin información de baterías", margins.left, yPos);
      yPos += rowHeight + 3;
    }
  }
    // Sección de estado del equipo
    if (yPos > pageHeight - 50) {
      pdf.addPage();
      yPos = margins.top;
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Estado del Equipo', margins.left, yPos);
    yPos += 7;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    // Calcular dimensiones de celda para diseño de 4 columnas
    const statusColWidth = (pageWidth - (margins.left + margins.right)) / 4;

    // Crear arreglo de estados para mostrar
    const statusParams = [
      { 
        label: 'Rectificador', 
        value: formData.rectifierStatus ? 
          formData.rectifierStatus.charAt(0).toUpperCase() + formData.rectifierStatus.slice(1) : 
          '-' 
      },
      { 
        label: 'Cargador', 
        value: formData.chargerStatus ? 
          formData.chargerStatus.charAt(0).toUpperCase() + formData.chargerStatus.slice(1) : 
          '-' 
      },
      { 
        label: 'Inversor', 
        value: formData.inverterStatus ? 
          formData.inverterStatus.charAt(0).toUpperCase() + formData.inverterStatus.slice(1) : 
          '-' 
      },
      { 
        label: 'Batería', 
        value: formData.batteryStatus ? 
          formData.batteryStatus.charAt(0).toUpperCase() + formData.batteryStatus.slice(1) : 
          '-' 
      }
    ];

    // Dibujar un fondo para la fila de estados
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margins.left, yPos, pageWidth - (margins.left + margins.right), rowHeight * 1.5, 'F');

    // Dibujar los estados en una cuadrícula 4x1
    statusParams.forEach((param, index) => {
      const xPos = margins.left + (index * statusColWidth);
      pdf.text(`${param.label}: ${param.value}`, xPos + 3, yPos + (rowHeight * 0.8));
    });

    yPos += (rowHeight * 1.5) + 10; // Aumentar el espacio antes de la siguiente sección

  // Sección de descripción - solo si hay contenido
  if (formData.description) {
    // Verificar espacio necesario (estimado)
    const estimatedLines = Math.ceil(String(formData.description).length / 50); // aprox. 50 chars por línea
    const estimatedHeight = estimatedLines * 4 + 15; // altura de línea * número de líneas + cabecera
    
    if (checkNewPage(estimatedHeight)) {
      // Ya estamos en nueva página
    } else {
      yPos += 5; // Pequeño espacio antes de la sección
    }
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Descripción del Trabajo', margins.left, yPos);
    yPos += 5;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    
    const textWidth = pageWidth - (margins.left + margins.right) - 6; // Margen interno reducido
    const descriptionLines = pdf.splitTextToSize(String(formData.description), textWidth);
    
    // Calcular altura necesaria
    const lineHeight = 4;
    const descHeight = (descriptionLines.length * lineHeight) + 6; // Margen interno reducido
    
    // Fondo para descripción
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margins.left, yPos, textWidth + 6, descHeight, 'F');
    
    // Borde ligero
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(margins.left, yPos, textWidth + 6, descHeight);
    
    // Texto de descripción
    pdf.text(descriptionLines, margins.left + 3, yPos + 5);
    
    yPos += descHeight + 3;
  }
  
  // Recomendaciones - solo si hay contenido
  if (formData.recommendations) {
    // Verificar espacio necesario (estimado)
    const estimatedLines = Math.ceil(String(formData.recommendations).length / 50);
    const estimatedHeight = estimatedLines * 4 + 15;
    
    if (checkNewPage(estimatedHeight)) {
      // Ya estamos en nueva página
    } else {
      yPos += 5;
    }
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Recomendaciones', margins.left, yPos);
    yPos += 5;
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    
    const textWidth = pageWidth - (margins.left + margins.right) - 6;
    const recommendationLines = pdf.splitTextToSize(String(formData.recommendations), textWidth);
    
    const lineHeight = 4;
    const recHeight = (recommendationLines.length * lineHeight) + 6;
    
    pdf.setFillColor(245, 245, 245);
    pdf.rect(margins.left, yPos, textWidth + 6, recHeight, 'F');
    
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(margins.left, yPos, textWidth + 6, recHeight);
    
    pdf.text(recommendationLines, margins.left + 3, yPos + 5);
    
    yPos += recHeight + 5;
  }

  // Sección de fotos - solo si hay fotos
  if (formData.photos && formData.photos.length > 0) {
    // Verificar espacio para título
    if (checkNewPage(10)) {
      // Ya estamos en nueva página
    } else {
      yPos += 3;
    }
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Registro Fotográfico', margins.left, yPos);
    yPos += 7;
    
    // Layout de fotos optimizado
    const photosPerRow = 2;
    const photoPadding = 3; // Menos espacio entre fotos
    const availableWidth = pageWidth - (margins.left + margins.right);
    const photoWidth = (availableWidth - ((photosPerRow - 1) * photoPadding)) / photosPerRow;
    const photoHeight = photoWidth * 0.75; // Mantener proporción 4:3
    const descriptionHeight = 6; // Menor altura para descripción
    const photoBlockHeight = photoHeight + descriptionHeight + 2;
    
    // Variables para seguimiento de posición
    let currentRow = 0;
    let rowStartY = yPos;

    // Procesar cada foto
    for (let i = 0; i < formData.photos.length; i++) {
      const photo = formData.photos[i];
      const col = i % photosPerRow;
      
      // Si comenzamos una nueva fila
    if (col === 0) {
      // Calcular la posición Y para esta fila
      rowStartY = yPos + (currentRow * photoBlockHeight);
      
      // Verificar si necesitamos nueva página para esta fila
      if (rowStartY + photoBlockHeight > pageHeight - margins.bottom) {
        pdf.addPage();
        yPos = margins.top;
        rowStartY = yPos;
        currentRow = 0; // Reiniciar conteo de filas en la nueva página
      }
    }

      // Coordenadas X,Y
      const xPos = margins.left + (col * (photoWidth + photoPadding));
      
      // Añadir la foto
      try {
        if (photo.url && typeof photo.url === 'string') {
          pdf.addImage(photo.url, 'JPEG', xPos, rowStartY, photoWidth, photoHeight);
          
          // Borde fino para la foto
          pdf.setDrawColor(200, 200, 200);
          pdf.rect(xPos, rowStartY, photoWidth, photoHeight);
          
          // Fondo y texto de descripción
          pdf.setFillColor(245, 245, 245);
          pdf.rect(xPos, rowStartY + photoHeight, photoWidth, descriptionHeight, 'F');
          
          pdf.setFontSize(7); // Texto más pequeño para descripciones
          const descText = photo.description || `Foto ${i + 1}`;
          // Truncar texto largo
          const maxChars = Math.floor(photoWidth / 1.6);
          const truncatedText = descText.length > maxChars ? 
            descText.substring(0, maxChars - 3) + '...' : descText;
          pdf.text(truncatedText, xPos + (photoWidth / 2), rowStartY + photoHeight + 4, { align: 'center' });
        }
      } catch (error) {
        console.error('Error adding image:', error);
        pdf.setFillColor(240, 240, 240);
        pdf.rect(xPos, rowStartY, photoWidth, photoHeight, 'F');
        pdf.setFontSize(8);
        pdf.text('Error imagen', xPos + (photoWidth/2), rowStartY + (photoHeight/2), { align: 'center' });
      }
      
      // Si es la última columna de la fila, incrementar contador de filas
    if (col === photosPerRow - 1 || i === formData.photos.length - 1) {
      currentRow++;
    }
    
      // Actualizar yPos basado en la última fila de fotos
      if (i === formData.photos.length - 1) {
        yPos = rowStartY + photoBlockHeight + 5;
      }
    }
  }

  // Sección de firmas
  const signatureHeight = 25; // Altura reducida para firmas
  const estimatedSignatureSection = 70; // Estimación total de la sección
  
  // Verificar si queda suficiente espacio en la página actual
  if (checkNewPage(estimatedSignatureSection)) {
    // Ya estamos en nueva página
  } else {
    yPos += 5;
  }
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Firmas de Conformidad', margins.left, yPos);
  yPos += 7;
  
  // Calcular dimensiones para firmas
  const signatureWidth = (pageWidth - (margins.left + margins.right) - 5) / 2;
  
  // Firma del cliente
  if (formData.clientSignature) {
    pdf.addImage(formData.clientSignature, 'PNG', margins.left, yPos, signatureWidth, signatureHeight);
  } else {
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margins.left, yPos, signatureWidth, signatureHeight);
  }
  
  pdf.setFontSize(10);
  pdf.text('Cliente', margins.left + (signatureWidth / 2), yPos - 3, { align: 'center' });
  
  // Firma del técnico
  const techSigX = margins.left + signatureWidth + 5;
  
  if (formData.technicianSignature) {
    pdf.addImage(formData.technicianSignature, 'PNG', techSigX, yPos, signatureWidth, signatureHeight);
  } else {
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(techSigX, yPos, signatureWidth, signatureHeight);
  }
  
  pdf.setFontSize(10);
  pdf.text('Técnico', techSigX + (signatureWidth / 2), yPos - 3, { align: 'center' });
  
  yPos += signatureHeight + 3;
  
  // Información de firmantes - más compacta
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  
  const clientName = formData.clientSignatureName || 'Nombre del Cliente';
  const clientId = formData.clientSignatureId || 'Identificación';
  pdf.text(clientName, margins.left + (signatureWidth / 2), yPos, { align: 'center' });
  pdf.text(clientId, margins.left + (signatureWidth / 2), yPos + 4, { align: 'center' });
  
  const techName = formData.technicianName || 'Nombre del Técnico';
  const techId = formData.technicianId || 'Identificación';
  pdf.text(techName, techSigX + (signatureWidth / 2), yPos, { align: 'center' });
  pdf.text(techId, techSigX + (signatureWidth / 2), yPos + 4, { align: 'center' });
  
  // Pie de página en todas las páginas
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7); // Texto más pequeño para pie de página
    pdf.setTextColor(100, 100, 100);
    
    // Mostrar número de página, numero de reporte y fecha, y nombre de empresa en una línea compacta
    pdf.text(`Reporte N° ${String(reportNumber).padStart(4, '0')} | Fecha: ${currentDate} | Página ${i} de ${totalPages} | ${companyInfo.name}`, 
      pageWidth / 2, pageHeight - 5, { align: 'center' });
  }

  // Guardar el PDF
  const deviceType = isMobile ? 'mobile' : 'desktop';
  pdf.save(`RT Nº ${String(reportNumber).padStart(4, '0')}-${deviceType}.pdf`);
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    await generatePDF();
    setReportNumber(prev => prev + 1);
  };

  const electricalParameters = {
    inputVoltage: [
      { id: 'voltageInL1', label: 'L1', unit: 'V' },
      { id: 'voltageInL2', label: 'L2', unit: 'V' },
      { id: 'voltageInL3', label: 'L3', unit: 'V' },
      { id: 'voltageInFF', label: 'FF', unit: 'V' }
    ],
    inputCurrent: [
      { id: 'currentInL1', label: 'L1', unit: 'A' },
      { id: 'currentInL2', label: 'L2', unit: 'A' },
      { id: 'currentInL3', label: 'L3', unit: 'A' },
      { id: 'currentInN', label: 'Neutro-Tierra', unit: 'V' }
    ],
    outputVoltage: [
      { id: 'voltageOutL1', label: 'L1', unit: 'V' },
      { id: 'voltageOutL2', label: 'L2', unit: 'V' },
      { id: 'voltageOutL3', label: 'L3', unit: 'V' },
      { id: 'voltageOutFF', label: 'FF', unit: 'V' }
    ],
    outputCurrent: [
      { id: 'currentOutL1', label: 'L1', unit: 'A' },
      { id: 'currentOutL2', label: 'L2', unit: 'A' },
      { id: 'currentOutL3', label: 'L3', unit: 'A' },
      { id: 'currentOutN', label: 'Neutro-Tierra', unit: 'V' }
    ]
  };

  // Renderizado principal con modo responsivo
  return (
    <div className="container max-w-4xl mx-auto p-4">
      <Card className="w-full" ref={formRef}>
        <CardHeader className="space-y-2 header">
          <div className="grid grid-cols-3 items-start gap-4">
            {/* Logo section */}
            <div className="relative col-span-3 sm:col-span-1">
              {logo ? (
                <div className="w-32 h-20 sm:w-40 sm:h-24 relative group mx-auto sm:mx-0">
                  <Image
                    src={logo}
                    alt="Company Logo"
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 300px"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-50 hidden group-hover:flex items-center justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-white p-1"
                      onClick={() => setLogo(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="w-32 h-24 bg-gray-200 flex flex-col items-center justify-center rounded cursor-pointer hover:bg-gray-300 mx-auto sm:mx-0"
                     onClick={() => fileInputRef.current?.click()}>
                  <span className="text-gray-500 font-bold text-sm">LOGO</span>
                  <span className="text-gray-500 text-xs">Click para cambiar</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
            
            <div className="text-center col-span-3 sm:col-span-1">
              <h1 className="text-3xl font-bold mb-2">Reporte Técnico</h1>
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <span className="text-lg font-medium mr-2">N° Reporte:</span>
                  {isEditingReportNumber ? (
                    <div className="flex items-center">
                      <input
                        type="number"
                        min="1"
                        value={reportNumber}
                        onChange={handleReportNumberChange}
                        onBlur={() => setIsEditingReportNumber(false)}
                        autoFocus
                        className="w-20 text-center border rounded p-1"
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsEditingReportNumber(true)}
                      className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded flex items-center"
                    >
                      <span className="font-medium text-red-500">{String(reportNumber).padStart(4, '0')}</span>
                      <Pen className="w-3 h-3 ml-1 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-600">Fecha: {currentDate}</div>
              </div>
            </div>  

            <div className="text-center sm:text-right col-span-3 sm:col-span-1">
              <h2 className="font-bold text-2xl">{companyInfo.name}</h2>
              <p className="text-sm text-gray-600">{companyInfo.address}</p>
              <p className="text-sm text-gray-600">{companyInfo.phone}</p>
              <p className="text-sm text-gray-600">{companyInfo.email}</p>
            </div>
          </div>
          
          <div className="border-t border-b py-2 mt-4" />
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <ClientSection values={formData} onChange={handleFieldChange} isMobile={isMobile} />
            
            <ServiceTypeSection 
              value={formData.serviceType || ''} 
              onChange={(value) => handleFieldChange('serviceType', value)} 
              isMobile={isMobile} 
            />

            <ServiceSection values={formData} onChange={handleFieldChange} isMobile={isMobile} />
            
            {/* Contenido técnico */}
            {isMobile ? (
              <>
                <ElectricalSection 
                  electricalParameters={electricalParameters} 
                  formData={formData} 
                  handleFieldChange={handleFieldChange} 
                  isMobile={isMobile} 
                />
                <BatterySection 
                  formData={formData} 
                  handleFieldChange={handleFieldChange} 
                  isMobile={isMobile} 
                />
              </>
            ) : (
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Parámetros Eléctricos
                </h3>

                {/* Parámetros Eléctricos */}
                <ElectricalInputGroup
                  title="Voltaje de Entrada"
                  fields={electricalParameters.inputVoltage}
                  values={formData}
                  onChange={handleFieldChange}
                />
                <ElectricalInputGroup
                  title="Corriente de Entrada"
                  fields={electricalParameters.inputCurrent}
                  values={formData}
                  onChange={handleFieldChange}
                />
                <ElectricalInputGroup
                  title="Voltaje de Salida"
                  fields={electricalParameters.outputVoltage}
                  values={formData}
                  onChange={handleFieldChange}
                />
                <ElectricalInputGroup
                  title="Corriente de Salida"
                  fields={electricalParameters.outputCurrent}
                  values={formData}
                  onChange={handleFieldChange}
                />

                {/* Parámetros de Baterías */}
                <BatterySection 
                  formData={formData} 
                  handleFieldChange={handleFieldChange} 
                  isMobile={isMobile} 
                />

                {/* Estados del equipo */}
                <EquipmentStatusSection 
                  formData={formData} 
                  handleFieldChange={handleFieldChange} 
                  isMobile={isMobile}
                />
                
              </div>
            )}
            
            <DescriptionSection 
              formData={formData} 
              handleFieldChange={handleFieldChange} 
              isMobile={isMobile} 
            />
            
            <PhotosSection 
              formData={formData} 
              setFormData={setFormData}
              isMobile={isMobile} 
            />
            
            <SignaturesSection 
              formData={{
                clientSignature: formData.clientSignature || null,
                clientSignatureName: formData.clientSignatureName || '',
                clientSignatureId: formData.clientSignatureId || '',
                technicianSignature: formData.technicianSignature || null,
                technicianName: formData.technicianName || '',
                technicianId: formData.technicianId || ''
              }}
              handleFieldChange={handleFieldChange}
              isMobile={isMobile}  
            />

            <div className="flex justify-end mt-6">
              <Button 
                type="submit" 
                className="bg-green-600 hover:bg-blue-700 text-white"
              >
                Generar Reporte
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      {/* Botón flotante para dispositivos móviles */}
      {isMobile && (
        <div className="fixed bottom-4 right-4">
          <Button 
            type="button" 
            onClick={() => handleSubmit(new Event('submit'))}
            className="rounded-full w-14 h-14 bg-green-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg"
          >
            <Download className="w-6 h-6" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default TechnicalForm;