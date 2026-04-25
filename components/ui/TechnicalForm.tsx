/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { buscarClientes, buscarEquipos, guardarCliente, guardarEquipo, guardarInforme, actualizarPdfUrl, getEmpresaConfig, listarHistorialEquipo, uploadReportePdf, siguienteNumeroInforme, formatearNumeroInforme, obtenerNumeroActual, siguienteQrEquipo, buscarEquipoPorSerial, validarEmailCliente, listarMarcas, ClienteRecord, EquipoRecord, InformeRecord, MarcaRecord } from '@/lib/supabase'
import { queueInforme } from '@/lib/offline-queue'
import AireParams from './AireParams'
import PlantaParams from './PlantaParams'
import FotovoltaicoParams from './FotovoltaicoParams'
import OtrosParams from './OtrosParams'
import ImpresoraParams from './ImpresoraParams'
import ApantallamientoParams from './ApantallamientoParams'

type Photo = { id: number; url: string; description: string; posX?: number; posY?: number };
type MaterialRow = { id: string; item: string; qty: string; ref: string };
type ReportType = 'ups' | 'aire' | 'planta' | 'fotovoltaico' | 'otros' | 'impresora' | 'apantallamiento';

// ── IndexedDB: persistencia de fotos ────────────────────────
const IDB_NAME = 'apptech_db'
const IDB_STORE = 'photos'

function openPhotoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror = () => reject(req.error)
  })
}
async function savePhotosIDB(photos: Photo[]): Promise<void> {
  const db = await openPhotoDB()
  const tx = db.transaction(IDB_STORE, 'readwrite')
  tx.objectStore(IDB_STORE).put({ key: 'current', photos })
}
async function loadPhotosIDB(): Promise<Photo[]> {
  const db = await openPhotoDB()
  return new Promise(resolve => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get('current')
    req.onsuccess = () => resolve(req.result?.photos ?? [])
    req.onerror   = () => resolve([])
  })
}
async function clearPhotosIDB(): Promise<void> {
  const db = await openPhotoDB()
  db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).delete('current')
}

// Foto con arrastre para reposicionar dentro del recuadro
const DraggablePhoto = ({ photo, onPositionChange }: {
  photo: Photo
  onPositionChange: (id: number, x: number, y: number) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const lastPos  = useRef({ x: 0, y: 0 })
  const posX = photo.posX ?? 50
  const posY = photo.posY ?? 50

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
    const nx = Math.min(100, Math.max(0, posX + dx))
    const ny = Math.min(100, Math.max(0, posY + dy))
    onPositionChange(photo.id, nx, ny)
  }
  const endDrag = () => { dragging.current = false }

  return (
    <div
      ref={containerRef}
      className="w-full h-48 overflow-hidden rounded-lg cursor-grab active:cursor-grabbing select-none relative"
      onMouseDown={e => startDrag(e.clientX, e.clientY)}
      onMouseMove={e => moveDrag(e.clientX, e.clientY)}
      onMouseUp={endDrag} onMouseLeave={endDrag}
      onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
      onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientX, e.touches[0].clientY) }}
      onTouchEnd={endDrag}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt="foto"
        draggable={false}
        className="w-full h-full object-cover pointer-events-none"
        style={{ objectPosition: `${posX}% ${posY}%` }}
      />
      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] bg-black/40 text-white px-2 py-0.5 rounded-full pointer-events-none">
        ✋ Arrastra para encuadrar
      </span>
    </div>
  )
}

// Renderiza logo con lógica object-contain (logo siempre completo, centrado)
function renderLogoForPdf(url: string, zoom: number, targetW: number, targetH: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')!
      const scale = Math.min(targetW / img.width, targetH / img.height) * zoom
      const sw = img.width  * scale
      const sh = img.height * scale
      const dx = (targetW - sw) / 2
      const dy = (targetH - sh) / 2
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetW, targetH)
      ctx.drawImage(img, dx, dy, sw, sh)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => resolve(url)
    img.src = url
  })
}

// Recorta imagen con lógica object-cover + posición + zoom del usuario, para PDF
function cropForPdf(url: string, posX: number, posY: number, targetW: number, targetH: number, zoom = 1): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = targetW
      canvas.height = targetH
      const ctx = canvas.getContext('2d')!
      // object-cover: escalar para cubrir el área + zoom adicional
      const scale = Math.max(targetW / img.width, targetH / img.height) * zoom
      const sw = img.width  * scale
      const sh = img.height * scale
      // offset según posición del usuario (posX/posY en %)
      const ox = (sw - targetW) * (posX / 100)
      const oy = (sh - targetH) * (posY / 100)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetW, targetH)
      ctx.drawImage(img, -ox, -oy, sw, sh)
      resolve(canvas.toDataURL('image/jpeg', 0.75))
    }
    img.onerror = () => resolve(url)
    img.src = url
  })
}

// Descarga una foto al dispositivo
function downloadPhoto(dataUrl: string, index: number) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `foto_${Date.now()}_${index + 1}.jpg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const REPORT_TYPES: { id: ReportType; label: string; icon: string }[] = [
  { id: 'ups',          label: 'UPS / Baterías',       icon: '🔋' },
  { id: 'aire',         label: 'Aires Acondicionados', icon: '❄️' },
  { id: 'planta',       label: 'Plantas Eléctricas',   icon: '⚡' },
  { id: 'fotovoltaico', label: 'Sistema Fotovoltaico', icon: '☀️' },
  { id: 'impresora',        label: 'Impresoras',           icon: '🖨️' },
  { id: 'apantallamiento', label: 'Apant. / Tierra',      icon: '⛈️' },
  { id: 'otros',           label: 'Otros Informes',       icon: '📋' },
];

type FormData = {
  reportType?: ReportType;
  clientCompany?: string; clientContact?: string; clientAddress?: string;
  clientEmail?: string; clientCity?: string; clientPhone?: string;
  technicianSelect?: string; technicianName?: string; technicianId?: string;
  workOrder?: string; timeStart?: string; timeEnd?: string; nextVisit?: string;
  equipmentBrand?: string; equipmentModel?: string; equipmentCapacity?: string;
  equipmentSerial?: string; equipmentLocation?: string; equipmentUbicacion?: string;
  capacity?: string; qrCode?: string;
  rectifierStatus?: string; chargerStatus?: string; inverterStatus?: string; batteryStatus?: string;
  workDescription?: string; recommendations?: string;
  clientSignature?: string | null; technicianSignature?: string | null;
  selectedServices?: string[]; checkedItems?: string[];
  photos?: Photo[]; materials?: MaterialRow[];
  [key: string]: unknown;
};
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Wrench, User, FileText, Camera, X, Pen, Download, ChevronDown, Clock, Plus, Trash2, Package, LogOut, Mail, MessageCircle } from 'lucide-react';

// Optimized SignaturePad Component
const SignaturePad = ({ onSave, onClear, isSaved = false, id }: { onSave: (data: string) => void; onClear: () => void; isSaved?: boolean; id: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 150 });
  const [signatureSaved, setSignatureSaved] = useState(isSaved);

  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Optimized canvas sizing with debounce
  const adjustCanvasSize = useCallback(() => {
    const container = canvasRef.current?.parentElement;
    if (container) {
      const width = Math.min(container.clientWidth - 20, 600);
      setCanvasSize({
        width: width,
        height: Math.max(width / 2, 120)
      });
    }
  }, []);

  // Debounced resize handler
  const debouncedResize = useCallback(() => {
    if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    resizeTimeoutRef.current = setTimeout(adjustCanvasSize, 150);
  }, [adjustCanvasSize]);

  useEffect(() => {
    adjustCanvasSize();
    window.addEventListener('resize', debouncedResize);
    return () => {
      window.removeEventListener('resize', debouncedResize);
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
    };
  }, [debouncedResize, adjustCanvasSize]);
  
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Optimize canvas for better performance
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        setContext(ctx);
      }
    }
  }, [canvasSize]);

  useEffect(() => {
    setSignatureSaved(isSaved);
  }, [isSaved, id]);

  // Optimized coordinate calculation with pointer events
  const getCoordinates = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return { offsetX: 0, offsetY: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      offsetX: (e.clientX - rect.left) * scaleX,
      offsetY: (e.clientY - rect.top) * scaleY
    };
  }, []);

  const startDrawing = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!context) return;
    
    const { offsetX, offsetY } = getCoordinates(e);
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    setSignatureSaved(false);
  }, [context, getCoordinates]);

  const draw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !context) return;
    
    const { offsetX, offsetY } = getCoordinates(e);
    context.lineTo(offsetX, offsetY);
    context.stroke();
  }, [isDrawing, context, getCoordinates]);

  const stopDrawing = useCallback(() => {
    if (isDrawing && context) {
      context.closePath();
    }
    setIsDrawing(false);
  }, [isDrawing, context]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
    setSignatureSaved(false);
  }, [onClear]);

  const save = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    onSave(canvas.toDataURL('image/png', 0.8)); // Optimize quality
    setSignatureSaved(true);
  }, [onSave]);

  return (
    <div className="space-y-4">
      <div className="border rounded-lg p-2 bg-white">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="w-full border border-gray-200 rounded touch-none cursor-crosshair"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{ 
            touchAction: 'none',
            maxWidth: '100%',
            height: 'auto'
          }}
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

// Optimized CollapsibleSection Component
const CollapsibleSection = ({ title, icon: IconComponent, children, initiallyOpen = false }: { title: string; icon: React.ElementType; children: React.ReactNode; initiallyOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  
  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  return (
    <div className="border rounded-lg">
      <button 
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
        onClick={toggleOpen}
        type="button"
      >
        <h3 className="font-semibold flex items-center gap-2">
          {IconComponent && <IconComponent className="w-5 h-5" />}
          {title}
        </h3>
        <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="p-4 border-t">
          {children}
        </div>
      )}
    </div>
  );
};

// Optimized ElectricalInputGroup
const ElectricalInputGroup = ({ title, fields, values, onChange }: { title: string; fields: { id: string; label: string; unit: string }[]; values: Record<string, unknown>; onChange: (id: string, value: string) => void }) => (
  <div className="space-y-4">
    <h4 className="font-medium pt-2">{title}</h4>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {fields.map(({ id, label, unit }) => (
        <div key={id} className="space-y-2">
          <Label htmlFor={id} className="text-sm">{label} ({unit})</Label>
          <Input
            id={id}
            type="number"
            value={String(values[id] ?? '')}
            onChange={(e) => onChange(id, e.target.value)}
            className="text-right text-sm"
            placeholder="0.0"
            inputMode="decimal"
          />
        </div>
      ))}
    </div>
  </div>
);

// Optimized Photo handling component
const PhotosSection = ({ formData, setFormData, isMobile }: { formData: Record<string, any>; setFormData: React.Dispatch<React.SetStateAction<any>>; isMobile: boolean }) => {
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);

  const processAndAddPhoto = useCallback((file: File) => {
    if (file.size > 30 * 1024 * 1024) {
      alert('El archivo es muy grande. Máximo 30MB.');
      return;
    }

    setProcessingPhoto(true);

    // createObjectURL es mucho más rápido que FileReader en iOS Safari
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      // Ceder el hilo al navegador antes de las operaciones pesadas de canvas
      // Esto evita el "cuelga" en iPhones con fotos de alta resolución
      setTimeout(() => {
        try {
          const MAX_W = 1200, MAX_H = 900;
          const ratio = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
          const w = Math.round(img.width  * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(objectUrl);           // liberar memoria
          const url = canvas.toDataURL('image/jpeg', 0.70);
          const newPhoto: Photo = { id: Date.now() + Math.random(), url, description: '' };
          setFormData((prev: Record<string, any>) => {
            const updated = { ...prev, photos: [...(prev.photos || []), newPhoto] };
            savePhotosIDB(updated.photos).catch(() => {});
            return updated;
          });
        } catch {
          alert('Error al procesar la imagen. Intenta con otra foto.');
        } finally {
          setProcessingPhoto(false);
        }
      }, 30);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setProcessingPhoto(false);
      alert('No se pudo cargar la imagen.');
    };

    img.src = objectUrl;
  }, [setFormData]);

  const handleCamera  = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (file) processAndAddPhoto(file);
    e.target.value = '';
  }, [processAndAddPhoto]);

  const handleGallery = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Procesar en serie con pequeño delay entre cada una para no saturar el hilo
    files.forEach((file, i) => setTimeout(() => processAndAddPhoto(file), i * 100));
    e.target.value = '';
  }, [processAndAddPhoto]);

  const removePhoto = useCallback((photoId: number) => {
    setFormData((prev: Record<string, any>) => {
      const photos = (prev.photos || []).filter((p: any) => p.id !== photoId);
      savePhotosIDB(photos).catch(() => {});
      return { ...prev, photos };
    });
  }, [setFormData]);

  const updatePhotoDescription = useCallback((photoId: number, description: string) => {
    setFormData((prev: Record<string, any>) => {
      const photos = prev.photos?.map((p: any) => p.id === photoId ? { ...p, description } : p) || [];
      savePhotosIDB(photos).catch(() => {});
      return { ...prev, photos };
    });
  }, [setFormData]);

  const updatePhotoPosition = useCallback((photoId: number, posX: number, posY: number) => {
    setFormData((prev: Record<string, any>) => {
      const photos = prev.photos?.map((p: any) => p.id === photoId ? { ...p, posX, posY } : p) || [];
      savePhotosIDB(photos).catch(() => {});
      return { ...prev, photos };
    });
  }, [setFormData]);

  const content = (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {/* En iOS, capture="environment" puede abrir la vista previa del sistema —
            usamos un input SIN capture para dar al usuario la opción cámara/galería
            directamente desde el selector nativo de iOS, que es más estable */}
        <Button
          type="button"
          disabled={processingPhoto}
          onClick={() => cameraInputRef.current?.click()}
          className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60"
        >
          {processingPhoto
            ? <><span className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" /> Procesando…</>
            : <><Camera className="w-4 h-4 mr-2" /> Tomar / Adjuntar Foto</>
          }
        </Button>

        {/* Un solo input sin capture — iOS muestra menú: Tomar foto / Elegir de biblioteca */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,image/heic,image/heif"
          className="hidden"
          onChange={handleCamera}
        />
        {/* Galería explícita para desktop / Android */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleGallery}
        />
        {(formData.photos?.length > 0) && (
          <span className="text-xs text-gray-400">{formData.photos.length} foto(s)</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(formData.photos || []).map((photo: Photo, index: number) => (
          <div key={photo.id} className="space-y-2 border rounded-lg p-2">
            <div className="relative">
              {typeof photo.url === 'string' ? (
                <DraggablePhoto photo={photo} onPositionChange={updatePhotoPosition} />
              ) : (
                <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span>Imagen no disponible</span>
                </div>
              )}
              {/* Botón eliminar */}
              <button type="button"
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                onClick={() => removePhoto(photo.id)}>
                <X className="w-4 h-4" />
              </button>
              {/* Botón descargar */}
              <button type="button"
                className="absolute top-2 right-10 p-1 bg-green-600 text-white rounded-full hover:bg-green-700"
                title="Guardar en dispositivo"
                onClick={() => downloadPhoto(photo.url, index)}>
                ⬇
              </button>
            </div>
            <textarea placeholder="Descripción de la foto..."
              className="w-full p-2 text-sm border rounded-md resize-none"
              value={photo.description}
              onChange={(e) => updatePhotoDescription(photo.id, e.target.value)}
              rows={2} />
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

// Checklist Component
const ChecklistSection = ({ checkedItems, onCheckChange }: { checkedItems: string[]; onCheckChange: (items: string[]) => void }) => {
  const groups = [
    {
      title: 'Inspección Visual',
      items: [
        'Limpieza general del equipo',
        'Revisión de conexiones eléctricas',
        'Revisión de ventilación y temperatura',
        'Inspección de fusibles y breakers',
        'Revisión de LEDs y alarmas activas'
      ]
    },
    {
      title: 'Pruebas Eléctricas',
      items: [
        'Prueba de transferencia automática',
        'Medición de voltaje entrada/salida',
        'Verificación de frecuencia',
        'Prueba de bypass manual',
        'Verificación de alarmas del sistema'
      ]
    },
    {
      title: 'Baterías',
      items: [
        'Limpieza de bornes y terminales',
        'Medición de voltaje total',
        'Medición por banco',
        'Prueba de descarga',
        'Verificación de temperatura de baterías',
        'Revisión de fecha de fabricación'
      ]
    },
    {
      title: 'Documentación',
      items: [
        'Registro fotográfico completado',
        'Parámetros eléctricos registrados',
        'Firma del cliente obtenida',
        'Recomendaciones documentadas'
      ]
    }
  ];

  const checked = checkedItems || [];
  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0);
  const doneItems = checked.length;
  const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

  const toggleItem = (item: string) => {
    if (checked.includes(item)) {
      onCheckChange(checked.filter(i => i !== item));
    } else {
      onCheckChange([...checked, item]);
    }
  };

  return (
    <CollapsibleSection title="Lista de Actividades" icon={FileText}>
      <div className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{doneItems} de {totalItems} actividades completadas</span>
            <span className="font-medium text-green-600">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Groups — grid horizontal igual que AireParams/PlantaParams */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {groups.map((group) => {
            const groupDone = group.items.filter(i => checked.includes(i)).length;
            return (
              <div key={group.title} className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                  <span className="text-xs font-medium text-gray-700">{group.title}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {groupDone}/{group.items.length}
                  </span>
                </div>
                <div className="divide-y">
                  {group.items.map((item: string) => {
                    const isChecked = checked.includes(item);
                    return (
                      <label
                        key={item}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleItem(item)}
                          className="h-4 w-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                        />
                        <span className={`text-xs ${isChecked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {item}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </CollapsibleSection>
  );
};

// Service Info Section: OT, hours, next visit
const ServiceInfoSection = ({ formData, onChange, technician }: { formData: Record<string, any>; onChange: (field: string, value: string) => void; technician: string }) => {
  const duration = React.useMemo(() => {
    const start = formData.timeStart;
    const end   = formData.timeEnd;
    if (!start || !end) return '';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm);
    if (total <= 0) return '';
    const h = Math.floor(total / 60);
    const m = total % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  }, [formData.timeStart, formData.timeEnd]);

  const nowHHMM = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <CollapsibleSection title="Información del Servicio" icon={Clock} initiallyOpen={true}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="workOrder">N° Orden de Trabajo (OT)</Label>
          <Input
            id="workOrder"
            value={String(formData.workOrder ?? '')}
            onChange={(e) => onChange('workOrder', e.target.value)}
            placeholder="OT-0001"
          />
        </div>
        <div className="space-y-2">
          <Label>Técnico Responsable</Label>
          <div className="h-10 px-3 flex items-center border rounded-md bg-gray-50 text-sm font-medium text-green-700">
            {technician}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="nextVisit">Próxima Visita Programada</Label>
          <Input
            id="nextVisit"
            type="date"
            value={String(formData.nextVisit ?? '')}
            onChange={(e) => onChange('nextVisit', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeStart">Hora de Entrada</Label>
          <div className="flex gap-2">
            <Input
              id="timeStart"
              type="time"
              value={String(formData.timeStart ?? '')}
              onChange={(e) => onChange('timeStart', e.target.value)}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => onChange('timeStart', nowHHMM())}
              title="Registrar hora actual de entrada"
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 rounded-md text-xs font-medium text-white transition-colors ${
                formData.timeStart ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {formData.timeStart ? '✓' : 'Iniciar'}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timeEnd">Hora de Salida</Label>
          <div className="flex gap-2">
            <Input
              id="timeEnd"
              type="time"
              value={String(formData.timeEnd ?? '')}
              onChange={(e) => onChange('timeEnd', e.target.value)}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => onChange('timeEnd', nowHHMM())}
              title="Registrar hora actual de salida"
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 rounded-md text-xs font-medium text-white transition-colors ${
                formData.timeEnd ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {formData.timeEnd ? '✓' : 'Finalizar'}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Tiempo Total</Label>
          <div className="h-10 px-3 flex items-center border rounded-md bg-gray-50 text-sm font-medium text-green-700">
            {duration || <span className="text-gray-400 font-normal">Registra entrada y salida</span>}
          </div>
        </div>
      </div>
      {formData.nextVisit && (
        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
          Próxima visita: <strong>{new Date(formData.nextVisit + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
        </div>
      )}
    </CollapsibleSection>
  );
};

// Materials Section
const MaterialsSection = ({ formData, setFormData }: { formData: Record<string, any>; setFormData: React.Dispatch<React.SetStateAction<any>> }) => {
  const materials = formData.materials || [];

  const addRow = useCallback(() => {
    setFormData((prev: FormData) => ({
      ...prev,
      materials: [...(prev.materials || []), { id: Date.now(), item: '', qty: '', ref: '' }]
    }));
  }, [setFormData]);

  const removeRow = useCallback((id: string) => {
    setFormData((prev: FormData) => ({
      ...prev,
      materials: (prev.materials || []).filter(m => m.id !== id)
    }));
  }, [setFormData]);

  const updateRow = useCallback((id: string, field: string, value: string) => {
    setFormData((prev: FormData) => ({
      ...prev,
      materials: (prev.materials || []).map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
  }, [setFormData]);

  return (
    <CollapsibleSection title="Materiales y Repuestos Utilizados" icon={Package}>
      <div className="space-y-3">
        {materials.length > 0 && (
          <div className="grid grid-cols-12 gap-2 px-1">
            <span className="col-span-6 text-xs font-medium text-gray-500">Descripción</span>
            <span className="col-span-2 text-xs font-medium text-gray-500 text-center">Cant.</span>
            <span className="col-span-3 text-xs font-medium text-gray-500">Referencia</span>
            <span className="col-span-1"></span>
          </div>
        )}
        {materials.map((mat: MaterialRow) => (
          <div key={mat.id} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-6">
              <Input
                value={mat.item}
                onChange={(e) => updateRow(mat.id, 'item', e.target.value)}
                placeholder="Nombre del material"
                className="text-sm"
              />
            </div>
            <div className="col-span-2">
              <Input
                value={mat.qty}
                onChange={(e) => updateRow(mat.id, 'qty', e.target.value)}
                placeholder="0"
                className="text-sm text-center"
                type="number"
                min="0"
              />
            </div>
            <div className="col-span-3">
              <Input
                value={mat.ref}
                onChange={(e) => updateRow(mat.id, 'ref', e.target.value)}
                placeholder="Ref."
                className="text-sm"
              />
            </div>
            <div className="col-span-1 flex justify-center">
              <button
                type="button"
                onClick={() => removeRow(mat.id)}
                className="p-1 text-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          onClick={addRow}
          variant="outline"
          className="w-full border-dashed text-gray-500 hover:text-gray-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar material
        </Button>
        {materials.length > 0 && (
          <p className="text-xs text-gray-400 text-right">{materials.length} ítem{materials.length !== 1 ? 's' : ''} registrado{materials.length !== 1 ? 's' : ''}</p>
        )}
      </div>
    </CollapsibleSection>
  );
};

// Service Type Section with multi-select
const ServiceTypeSection = ({ selectedServices, onServiceChange }: { selectedServices: string[]; onServiceChange: (services: string[]) => void }) => {
  const serviceOptions = [
    'Mantenimiento Preventivo',
    'Servicio Emergente',
    'Revision y Diagnóstico',
    'Mantenimiento Correctivo',
    'Instalación y Arranque',
    'Garantía'
  ];

  const handleServiceToggle = (service: string) => {
    const currentServices = selectedServices || [];
    const isSelected = currentServices.includes(service);
    
    if (isSelected) {
      // Remove service
      onServiceChange(currentServices.filter(s => s !== service));
    } else {
      // Add service
      onServiceChange([...currentServices, service]);
    }
  };

  return (
    <CollapsibleSection title="Tipo de Servicio" icon={Wrench} initiallyOpen={true}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {serviceOptions.map((service: string) => {
            const isSelected = (selectedServices || []).includes(service);
            return (
              <label
                key={service}
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50 text-blue-900' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleServiceToggle(service)}
                  className="mr-3 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">{service}</span>
              </label>
            );
          })}
        </div>
        
        {/* Display selected services */}
        {selectedServices && selectedServices.length > 0 && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm font-medium text-green-800 mb-2">
              Servicios seleccionados ({selectedServices.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedServices.map((service: string, index: number) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-md"
                >
                  {service}
                  <button
                    type="button"
                    onClick={() => handleServiceToggle(service)}
                    className="ml-1 text-green-600 hover:text-green-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};

// Main Component with optimizations
const TIPO_PREFIX: Record<string, string> = {
  ups: 'UPS', aire: 'AIR', planta: 'PLT', fotovoltaico: 'FTV', impresora: 'IMP', apantallamiento: 'APT', otros: 'OTR',
}

const fmtReportNum = (n: number, tipo = 'ups') => formatearNumeroInforme(n, tipo);

const TechnicalForm = ({ technician, empresaId, onLogout, externalToken, asignacionToken, presetData, onAsignacionDone }: { technician: string; empresaId?: string; onLogout?: () => void; externalToken?: string; asignacionToken?: string; presetData?: Record<string, unknown>; onAsignacionDone?: () => void }) => {
  const [formData, setFormData] = useState<FormData>({});
  const [reportNumber, setReportNumber] = useState(1);
  const [isEditingReportNumber, setIsEditingReportNumber] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoPosX, setLogoPosX] = useState(50);
  const [logoPosY, setLogoPosY] = useState(50);
  const [logoZoom, setLogoZoom] = useState(1);
  const [marcas, setMarcas] = useState<MarcaRecord[]>([]);
  const [marcaSeleccionada, setMarcaSeleccionada] = useState<MarcaRecord | null>(null);
  const [marcaLogo, setMarcaLogo] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState('');
  const [emailValidando, setEmailValidando] = useState(false);
  const [emailValidez, setEmailValidez] = useState<'idle' | 'ok' | 'error'>('idle');
  const [emailValidezNombre, setEmailValidezNombre] = useState('');
  const emailValidDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shareAction, setShareAction] = useState<'download' | 'email' | 'whatsapp'>('download');

  // Autocomplete Supabase
  const [clientSuggestions, setClientSuggestions] = useState<ClienteRecord[]>([])
  const [showClientSug, setShowClientSug] = useState(false)
  const [equipmentSuggestions, setEquipmentSuggestions] = useState<EquipoRecord[]>([])
  const [showEquipmentSug, setShowEquipmentSug] = useState(false)
  const [selectedEquipoId, setSelectedEquipoId] = useState<string | null>(null)
  const [historial, setHistorial] = useState<InformeRecord[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const [historialTab, setHistorialTab] = useState(0)

  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const formRef = useRef<HTMLDivElement>(null);

  // Devuelve true si el campo viene pre-llenado por una asignación (debe ser bloqueado)
  const isPreset = (field: string) => !!(presetData && presetData[field] != null && presetData[field] !== '')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cargar datos guardados al iniciar
  useEffect(() => {
    try {
      const savedData = localStorage.getItem('apptech_form_data');
      const savedReportNumber = localStorage.getItem('apptech_report_number');
      const savedLogo = localStorage.getItem('apptech_logo');

      if (savedData) setFormData({ ...JSON.parse(savedData), ...(presetData ?? {}) });
      else if (presetData) setFormData(presetData as FormData);
      if (savedReportNumber) setReportNumber(parseInt(savedReportNumber));
      if (savedLogo) setLogo(savedLogo);
      const savedPosX = localStorage.getItem('apptech_logo_posX')
      const savedPosY = localStorage.getItem('apptech_logo_posY')
      const savedZoom = localStorage.getItem('apptech_logo_zoom')
      if (savedPosX) setLogoPosX(parseFloat(savedPosX))
      if (savedPosY) setLogoPosY(parseFloat(savedPosY))
      if (savedZoom) setLogoZoom(parseFloat(savedZoom))
    } catch (_e) {
      console.warn('Error cargando datos guardados:');
    }
    // Cargar fotos desde IndexedDB
    loadPhotosIDB().then(photos => {
      if (photos.length > 0) {
        setFormData((prev: any) => ({ ...prev, photos }));
      }
    }).catch(() => {});
  }, []);

  // Guardar automáticamente sin causar re-renders (usando ref para el timer)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      try {
        const dataToSave = { ...formData, photos: [] };
        localStorage.setItem('apptech_form_data', JSON.stringify(dataToSave));
        localStorage.setItem('apptech_report_number', String(reportNumber));
        if (logo) localStorage.setItem('apptech_logo', logo);
        localStorage.setItem('apptech_logo_posX', String(logoPosX))
        localStorage.setItem('apptech_logo_posY', String(logoPosY))
        localStorage.setItem('apptech_logo_zoom', String(logoZoom))
        setSaveStatus('saved');
      } catch (_e) {
        console.warn('Error guardando datos:');
        setSaveStatus('idle');
      }
    }, 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [formData, reportNumber, logo, logoPosX, logoPosY, logoZoom]);

  // Optimized mobile detection with proper cleanup
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();

    let mobileCheckTimeout: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(mobileCheckTimeout);
      mobileCheckTimeout = setTimeout(checkIfMobile, 100);
    };

    window.addEventListener('resize', debouncedResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(mobileCheckTimeout);
    };
  }, []);

  const handleReportNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setReportNumber(value && value > 0 ? value : 1);
  }, []);

  // Comprime cualquier imagen a JPEG con límite de dimensión y calidad
  const compressImage = useCallback((dataUrl: string, maxW: number, maxH: number, quality: number): Promise<string> => {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * ratio)
        canvas.height = Math.round(img.height * ratio)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  }, [])

  const handleFieldChange = useCallback((field: string, value: unknown) => {
    setFormData((prev: FormData) => ({ ...prev, [field]: value }));
  }, []);

  const handleServiceChange = useCallback((services: string[]) => {
    setFormData((prev: FormData) => ({ ...prev, selectedServices: services }));
  }, []);

  // ── Autocomplete clientes Supabase ────────────────────────
  const handleClientCompanyChange = useCallback(async (value: string) => {
    handleFieldChange('clientCompany', value)
    if (value.length < 2) { setClientSuggestions([]); return }
    const results = await buscarClientes(value, empresaId)
    setClientSuggestions(results)
    setShowClientSug(results.length > 0)
  }, [handleFieldChange])

  const selectClient = useCallback((client: ClienteRecord) => {
    setFormData(prev => ({
      ...prev,
      clientCompany: client.company,
      clientContact: client.contact ?? '',
      clientAddress: client.address ?? '',
      clientEmail:   client.email   ?? '',
      clientCity:    client.city    ?? '',
      clientPhone:   client.phone   ?? '',
    }))
    setShowClientSug(false)
  }, [])

  // ── Autocomplete equipos Supabase ─────────────────────────
  const handleEquipmentSerialChange = useCallback(async (value: string) => {
    handleFieldChange('equipmentSerial', value)
    // Limpiar QR si el serial es borrado
    if (!value.trim()) {
      handleFieldChange('qrCode', '')
      setEquipmentSuggestions([])
      return
    }
    if (value.length < 2) { setEquipmentSuggestions([]); return }
    const results = await buscarEquipos(value, empresaId)
    setEquipmentSuggestions(results)
    setShowEquipmentSug(results.length > 0)
  }, [handleFieldChange])

  // Cuando el serial pierde el foco y no hay equipo seleccionado, auto-generar QR
  const handleEquipmentSerialBlur = useCallback(async () => {
    setTimeout(async () => {
      setShowEquipmentSug(false)
      const serial = String(formData.equipmentSerial ?? '').trim()
      const currentQr = String(formData.qrCode ?? '').trim()
      if (!serial || currentQr) return // ya tiene QR o no hay serial
      // Buscar si existe en BD
      const found = await buscarEquipoPorSerial(serial, empresaId).catch(() => null)
      if (found) {
        // Equipo ya existe — cargar todos sus datos
        await selectEquipment(found)
      } else if (empresaId) {
        // Equipo nuevo — generar siguiente QR
        const nextQr = await siguienteQrEquipo(empresaId).catch(() => '')
        if (nextQr) handleFieldChange('qrCode', nextQr)
      }
    }, 200)
  }, [formData, empresaId])

  const selectEquipment = useCallback(async (eq: EquipoRecord) => {
    setFormData(prev => ({
      ...prev,
      // Equipo
      equipmentBrand:     eq.brand     ?? '',
      equipmentModel:     eq.model     ?? '',
      equipmentCapacity:  eq.capacity  ?? '',
      capacity:           eq.capacity  ?? '',   // campo que usa el formulario
      equipmentSerial:    eq.serial    ?? '',
      equipmentUbicacion: eq.ubicacion ?? '',
      qrCode:             eq.qr_code   ?? '',
      // Cliente vinculado
      ...(eq.client_company ? {
        clientCompany:  eq.client_company,
        clientContact:  eq.client_contact  ?? '',
        clientAddress:  eq.client_address  ?? '',
        clientEmail:    eq.client_email    ?? '',
        clientCity:     eq.client_city     ?? '',
        clientPhone:    eq.client_phone    ?? '',
      } : {}),
    }))
    setShowEquipmentSug(false)
    setSelectedEquipoId(eq.id)

    if (eq.id) {
      setLoadingHistorial(true)
      setShowHistorial(true)
      const visitas = await listarHistorialEquipo(eq.id, eq.qr_code ?? undefined, empresaId)
      setHistorial(visitas)
      setHistorialTab(0)
      setLoadingHistorial(false)
    }
  }, [])

  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (!empresaId) return
    getEmpresaConfig(empresaId).then(config => {
      if (!config) return
      setCompanyInfo({
        name:    config.nombre_comercial ?? '',
        address: config.direccion        ?? '',
        city:    (config as any).ciudad  ?? '',
        phone:   config.telefono         ?? '',
        email:   config.email_contacto   ?? '',
      })
      if (config.logo) {
        // Siempre cargar el logo de la empresa desde la DB (evita contaminación entre empresas)
        compressImage(config.logo, 400, 200, 0.7).then(compressed => {
          setLogo(compressed)
          localStorage.setItem('apptech_logo', compressed)
        })
      } else {
        // Si la empresa no tiene logo, limpiar cualquier logo de otra empresa en caché
        setLogo('')
        localStorage.removeItem('apptech_logo')
      }
    })
  }, [empresaId]);

  // Cargar marcas de la empresa
  useEffect(() => {
    if (!empresaId) return
    listarMarcas(empresaId).then(setMarcas)
  }, [empresaId])

  // Cargar el número de informe actual desde Supabase (solo lectura, sin incrementar)
  useEffect(() => {
    if (!empresaId || externalToken || !navigator.onLine) return
    obtenerNumeroActual(empresaId).then(n => setReportNumber(n)).catch(() => {})
  }, [empresaId, externalToken]);

  const seleccionarMarca = async (marca: MarcaRecord | null) => {
    setMarcaSeleccionada(marca)
    if (marca?.logo_url) {
      const compressed = await compressImage(marca.logo_url, 400, 200, 0.7)
      setMarcaLogo(compressed)
    } else {
      setMarcaLogo(null)
    }
  }

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

  const _handleClearForm = useCallback(() => {
    const choice = window.confirm(
      'Aceptar → Limpiar solo datos del equipo (mantiene cliente)\nCancelar → No hacer nada'
    );
    if (choice) {
      setFormData((prev: FormData) => ({
        clientCompany: prev.clientCompany,
        clientContact: prev.clientContact,
        clientAddress: prev.clientAddress,
        clientEmail:   prev.clientEmail,
        clientCity:    prev.clientCity,
        clientPhone:   prev.clientPhone,
      }));
    }
  }, []);


  const emailPhotosRef = useRef<Photo[] | null>(null)

  // PDF Generation Function — returns jsPDF instance
  const buildPDF = useCallback(async () => {
    const serial   = String(formData.equipmentSerial   ?? '').trim()
    const brand    = String(formData.equipmentBrand    ?? '').trim()
    const model    = String(formData.equipmentModel    ?? '').trim()
    const capacity = String(formData.capacity          ?? '').trim()
    const location = String(formData.equipmentUbicacion ?? formData.equipmentLocation ?? '').trim()
    const client   = String(formData.clientCompany     ?? '').trim()
    const fecha    = new Date().toLocaleDateString('es-CO')
    let savedInformeId: string | undefined

    // Obtener número consecutivo atómico desde la BD (solo cuando hay conexión)
    let activeReportNum = reportNumber
    if (!externalToken && empresaId && navigator.onLine) {
      try {
        const next = await siguienteNumeroInforme(empresaId, formData.reportType ?? 'ups')
        activeReportNum = next
        setReportNumber(next)
        localStorage.setItem('apptech_report_number', String(next))
      } catch { /* fallback al número local */ }
    }
    const repNum = fmtReportNum(activeReportNum, formData.reportType ?? 'ups')
    const qrCodeId = String(formData.qrCode ?? '').trim()
    const tecnico  = String(formData.technicianName ?? technician).trim()

    // Generar QR primero (independiente de Supabase)
    let qrCanvas: HTMLCanvasElement | null = null
    try {
      const QRCode = await import('qrcode')
      const qrText = qrCodeId
        ? `https://snelapp.com/equipo/${encodeURIComponent(qrCodeId)}`
        : `https://snelapp.com/informe?n=${repNum}&fecha=${encodeURIComponent(fecha)}&cliente=${encodeURIComponent(client)}`
      const canvas = document.createElement('canvas')
      await QRCode.toCanvas(canvas, qrText, {
        width: 200, margin: 2, errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
      qrCanvas = canvas
    } catch (e) { console.error('Error generando QR:', e) }

    // Sincronizar con Supabase (no bloquea el PDF)
    try {
      if (asignacionToken) {
        // Modo asignación: guardar vía API con token de asignación
        await fetch('/api/submit-asignacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: asignacionToken,
            informe: {
              qr_code: qrCodeId || undefined,
              numero_informe: repNum,
              fecha, cliente: client, serial, marca: brand,
              modelo: model, capacidad: capacity, ubicacion: location, tecnico,
              tipo_reporte: formData.reportType ?? 'ups',
              observaciones:   String(formData.description    ?? '').trim() || undefined,
              recomendaciones: String(formData.recommendations ?? '').trim() || undefined,
            },
          }),
        }).then(r => r.ok && onAsignacionDone?.()).catch(() => {})
      } else if (externalToken) {
        // Modo externo: guardar vía API con token
        await fetch('/api/submit-informe-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: externalToken,
            informe: {
              qr_code: qrCodeId || undefined,
              numero_informe: repNum,
              fecha, cliente: client, serial, marca: brand,
              modelo: model, capacidad: capacity, ubicacion: location, tecnico,
              tipo_reporte: formData.reportType ?? 'ups',
              observaciones:   String(formData.description    ?? '').trim() || undefined,
              recomendaciones: String(formData.recommendations ?? '').trim() || undefined,
            },
          }),
        }).catch(() => {})
      } else {
        let savedClientId: string | undefined
        if (client) {
          const savedClient = await guardarCliente({
            company: client,
            contact: formData.clientContact as string ?? '',
            address: formData.clientAddress as string ?? '',
            email:   formData.clientEmail   as string ?? '',
            city:    formData.clientCity    as string ?? '',
            phone:   formData.clientPhone   as string ?? '',
          }).catch(() => null)
          savedClientId = savedClient?.id
        }
        if (brand || model || serial) {
          await guardarEquipo({
            brand, model, capacity,
            ubicacion: location,
            serial: serial || `${brand}-${model}-${Date.now()}`,
            qr_code: qrCodeId || undefined,
            client_id: savedClientId,
          }).catch(() => {})
        }
        const informePayload = {
          qr_code: qrCodeId || undefined,
          numero_informe: repNum,
          fecha, cliente: client, serial, marca: brand,
          modelo: model, capacidad: capacity, ubicacion: location, tecnico,
          equipo_id: selectedEquipoId ?? undefined,
          tipo_reporte: formData.reportType ?? 'ups',
          empresa_id: empresaId,
          observaciones:   String(formData.description    ?? '').trim() || undefined,
          recomendaciones: String(formData.recommendations ?? '').trim() || undefined,
        }
        if (!navigator.onLine) {
          // Offline: queue for later sync
          await queueInforme({
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            informe: {
              qr_code: informePayload.qr_code,
              fecha: informePayload.fecha,
              cliente: informePayload.cliente,
              serial: informePayload.serial,
              marca: informePayload.marca,
              modelo: informePayload.modelo,
              capacidad: informePayload.capacidad,
              ubicacion: informePayload.ubicacion,
              tecnico: informePayload.tecnico,
              equipo_id: informePayload.equipo_id,
              tipo_reporte: informePayload.tipo_reporte,
              observaciones: informePayload.observaciones,
              recomendaciones: informePayload.recomendaciones,
            },
            empresa_id: empresaId ?? '',
          }).catch(() => {})
        } else {
          const informeResult = await guardarInforme(informePayload).catch(() => ({ ok: false as const }))
          if (informeResult.ok && informeResult.id) {
            savedInformeId = informeResult.id
          }
        }
      }
    } catch (_e) { /* Supabase opcional */ }

    // Create a new jsPDF instance
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = margin;

    // Helper function to add section divider line
    const addSectionDivider = () => {
      yPosition += 3;
      pdf.setLineWidth(0.3);
      pdf.setDrawColor(150, 150, 150); // Gray color
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;
    };

    // Helper function to add footer to each page
    const addFooter = (pageNumber: number, totalPages: number) => {
      const footerY = pageHeight - 10; // 10mm from bottom
      
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100); // Gray color
      
      // Left: Report number and date
      const reportInfo = `Reporte N° ${repNum} | ${currentDate}`;
      pdf.text(reportInfo, margin, footerY);
      
      // Center: Company name (marca si está seleccionada)
      pdf.text(marcaSeleccionada ? marcaSeleccionada.nombre : companyInfo.name, pageWidth / 2, footerY, { align: 'center' });
      
      // Right: Page number
      pdf.text(`Página ${pageNumber} de ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
      
      // Reset text color to black
      pdf.setTextColor(0, 0, 0);
    };

    // Helper function to add new page if needed
    const checkPageBreak = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin - 15) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper function to add text with word wrap
    const addText = (text: string, x: number, y: number, maxWidth = contentWidth, options: { fontSize?: number; lineHeight?: number; bold?: boolean; align?: string } = {}) => {
      const fontSize = options.fontSize || 10;
      const lineHeight = options.lineHeight || fontSize * 0.4;
      
      pdf.setFontSize(fontSize);
      if (options.bold) pdf.setFont('helvetica', 'bold');
      else pdf.setFont('helvetica', 'normal');

      if (text) {
        const lines = pdf.splitTextToSize(text, maxWidth);
        lines.forEach((line: string, index: number) => {
          checkPageBreak(lineHeight);
          pdf.text(line, x, y + (index * lineHeight));
          yPosition = Math.max(yPosition, y + (index * lineHeight) + lineHeight);
        });
      }
      return yPosition;
    };

    // Tipo de informe (etiqueta para el label)
    const tipoLabel: Record<string, string> = {
      ups:          'UPS / Baterías',
      aire:         'Aires Acondicionados',
      planta:       'Planta Eléctrica',
      fotovoltaico: 'Sistema Fotovoltaico',
      impresora:        'Mantenimiento de Impresoras',
      apantallamiento:  formData.apanSubtipo === 'puesta_tierra' ? 'Sistema de Puesta a Tierra' : 'Sistema de Apantallamiento',
      otros:            'Otros Servicios',
    }
    const tipoInforme = tipoLabel[formData.reportType as string] ?? 'UPS / Baterías'

    // Logo (izquierda) — usa marca si está seleccionada, si no la empresa
    const pdfLogo = marcaLogo ?? logo
    const pdfName = marcaSeleccionada ? marcaSeleccionada.nombre : companyInfo.name
    const logoW = 40, logoH = 20
    if (pdfLogo) {
      try {
        const croppedLogo = await renderLogoForPdf(pdfLogo, logoZoom, 256, 128)
        pdf.addImage(croppedLogo, 'JPEG', margin, yPosition, logoW, logoH)
      } catch (_e) { console.warn('Could not add logo to PDF') }
    }

    // Title and report info (center) — mismo tamaño que datos empresa
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('REPORTE TÉCNICO', pageWidth / 2, yPosition + 5, { align: 'center' });

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80, 80, 80);
    pdf.text(tipoInforme.toUpperCase(), pageWidth / 2, yPosition + 10, { align: 'center' });
    pdf.setTextColor(0, 0, 0);

    pdf.setFontSize(9);
    pdf.setTextColor(200, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`N° Reporte: ${repNum}`, pageWidth / 2, yPosition + 15, { align: 'center' });
    pdf.setTextColor(0, 0, 0);

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Fecha: ${currentDate} — ${currentTime}`, pageWidth / 2, yPosition + 20, { align: 'center' });

    // Company info (derecha, con espacio para QR a su derecha)
    const qrSize = 18
    const companyX = pageWidth - margin - qrSize - 3
    // Ancho máximo disponible para el bloque de empresa (desde la mitad de la página + margen)
    const companyMaxW = companyX - (pageWidth / 2 + 8)

    // Nombre de empresa: ajustar tamaño y partir en líneas si es largo
    pdf.setFont('helvetica', 'bold');
    let nameFontSize = 10
    pdf.setFontSize(nameFontSize);
    let nameLines = pdf.splitTextToSize(pdfName, companyMaxW)
    // Si no cabe en 2 líneas con 10pt, reducir a 8pt
    if (nameLines.length > 2) {
      nameFontSize = 8
      pdf.setFontSize(nameFontSize);
      nameLines = pdf.splitTextToSize(pdfName, companyMaxW)
    }
    const lineH = nameFontSize * 0.45
    nameLines.forEach((line: string, i: number) => {
      pdf.text(line, companyX, yPosition + 5 + (i * lineH), { align: 'right' })
    })

    const pdfAddress = marcaSeleccionada?.direccion ?? companyInfo.address
    const pdfPhone   = marcaSeleccionada?.telefono  ?? companyInfo.phone
    const pdfEmail   = marcaSeleccionada?.email     ?? companyInfo.email
    const pdfCity    = marcaSeleccionada?.ciudad    ?? companyInfo.city

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    let ciY = yPosition + 5 + (nameLines.length * lineH) + 2
    if (pdfAddress) { pdf.text(pdfAddress, companyX, ciY, { align: 'right' }); ciY += 4 }
    if (pdfPhone)   { pdf.text(pdfPhone,   companyX, ciY, { align: 'right' }); ciY += 4 }
    if (pdfEmail)   { pdf.text(pdfEmail,   companyX, ciY, { align: 'right' }); ciY += 4 }
    if (pdfCity)    { pdf.text(pdfCity,    companyX, ciY, { align: 'right' }) }

    // QR code — al lado derecho de los datos de empresa (16×16 mm)
    const qrX = pageWidth - margin - qrSize
    const qrY = yPosition + 1
    if (qrCanvas) {
      try {
        pdf.addImage(qrCanvas, 'PNG', qrX, qrY, qrSize, qrSize)
        pdf.setFontSize(5)
        pdf.setFont('helvetica', 'normal')
        pdf.setTextColor(120, 120, 120)
        pdf.text('Historial', qrX + qrSize / 2, qrY + qrSize + 2, { align: 'center' })
        pdf.setTextColor(0, 0, 0)
      } catch (e) { console.error('Error agregando QR al PDF:', e) }
    }

    yPosition += 28;  // altura cabecera + gap

    // Horizontal line
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;

    // Client Information Section
    checkPageBreak(30);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('INFORMACIÓN DEL CLIENTE', margin, yPosition);
    yPosition += 8;

    const clientData: [string, string][] = [
      ['Empresa:', formData.clientCompany || 'N/A'],
      ['Contacto:', formData.clientContact || 'N/A'],
      ['Dirección:', formData.clientAddress || 'N/A'],
      ['Email:', formData.clientEmail || 'N/A'],
      ['Ciudad:', formData.clientCity || 'N/A'],
      ['Teléfono:', formData.clientPhone || 'N/A']
    ];

    clientData.forEach(([label, value], index: number) => {
      checkPageBreak(6);
      const columnWidth = contentWidth / 2;
      const xPos = margin + ((index % 2) * columnWidth);
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(label, xPos, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, xPos + 25, yPosition);
      
      // Move to next row after every 2 items
      if (index % 2 === 1) {
        yPosition += 5;
      }
    });

    // If odd number of items, still move to next line
    if (clientData.length % 2 === 1) {
      yPosition += 5;
    }

    yPosition += 5;

    // Add section divider
    addSectionDivider();

    // Service Type Section
    if (formData.selectedServices && formData.selectedServices.length > 0) {
      checkPageBreak(20);
      
      // Join all services in a single line with larger font
      const servicesText = formData.selectedServices.join(' • ');
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TIPO DE SERVICIO: ', margin, yPosition);
      
      // Calculate width of the title to position services next to it
      const titleWidth = pdf.getTextWidth('TIPO DE SERVICIO: ');
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      
      // Check if text fits in remaining space on the same line
      const remainingWidth = contentWidth - titleWidth;
      const textWidth = pdf.getTextWidth(servicesText);
      
      if (textWidth <= remainingWidth) {
        // Single line display next to title
        pdf.text(servicesText, margin + titleWidth, yPosition);
        yPosition += 8;
      } else {
        // Move to next line if too long
        yPosition += 6;
        const lines = pdf.splitTextToSize(servicesText, contentWidth);
        lines.forEach((line: string) => {
          checkPageBreak(6);
          pdf.text(line, margin, yPosition);
          yPosition += 6;
        });
      }
      
      yPosition += 2;
    }

    // Service Info Section (OT, technician, hours, next visit)
    checkPageBreak(20);
    const hasServiceInfo = formData.workOrder || formData.technicianSelect || formData.timeStart || formData.nextVisit;
    if (hasServiceInfo) {
      const infoData: [string, string][] = [
        ['OT:', formData.workOrder || 'N/A'],
        ['Técnico:', technician || formData.technicianName || 'N/A'],
        ['Hora Entrada:', formData.timeStart || 'N/A'],
        ['Hora Salida:', formData.timeEnd || 'N/A'],
      ];

      // Calculate duration
      let durationText = 'N/A';
      if (formData.timeStart && formData.timeEnd) {
        const [sh, sm] = formData.timeStart.split(':').map(Number);
        const [eh, em] = formData.timeEnd.split(':').map(Number);
        const total = (eh * 60 + em) - (sh * 60 + sm);
        if (total > 0) {
          const h = Math.floor(total / 60);
          const m = total % 60;
          durationText = h > 0 ? `${h}h ${m}min` : `${m}min`;
        }
      }
      infoData.push(['Duración:', durationText]);
      if (formData.nextVisit) {
        const nv = new Date(formData.nextVisit + 'T12:00:00').toLocaleDateString('es-CO');
        infoData.push(['Próx. Visita:', nv]);
      }

      const infoColW = contentWidth / 3;
      infoData.forEach(([label, value], idx: number) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const xPos = margin + col * infoColW;
        const yPos = yPosition + row * 6;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text(label, xPos, yPos);
        pdf.setFont('helvetica', 'normal');
        pdf.text(value, xPos + 22, yPos);
      });
      yPosition += Math.ceil(infoData.length / 3) * 6 + 4;
      addSectionDivider();
    }

    // Materials Section
    if (formData.materials && formData.materials.length > 0) {
      checkPageBreak(15 + formData.materials.length * 6);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('MATERIALES Y REPUESTOS UTILIZADOS', margin, yPosition);
      yPosition += 8;

      // Table header
      pdf.setFillColor(235, 235, 235);
      pdf.rect(margin, yPosition - 4, contentWidth, 6, 'F');
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Descripción', margin + 2, yPosition);
      pdf.text('Cant.', margin + contentWidth * 0.65, yPosition);
      pdf.text('Referencia', margin + contentWidth * 0.75, yPosition);
      yPosition += 6;

      // Table rows
      formData.materials.forEach((mat, idx) => {
        checkPageBreak(6);
        if (idx % 2 === 0) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, yPosition - 4, contentWidth, 6, 'F');
        }
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        const itemText = pdf.splitTextToSize(mat.item || '', contentWidth * 0.62)[0];
        pdf.text(itemText, margin + 2, yPosition);
        pdf.text(String(mat.qty || ''), margin + contentWidth * 0.65, yPosition);
        pdf.text(mat.ref || '', margin + contentWidth * 0.75, yPosition);
        yPosition += 6;
      });
      yPosition += 4;
      addSectionDivider();
    }
    if ((!formData.reportType || formData.reportType === 'ups') && formData.checkedItems && formData.checkedItems.length > 0) {
      const allGroups = [
        { title: 'Inspección Visual', items: ['Limpieza general del equipo','Revisión de conexiones eléctricas','Revisión de ventilación y temperatura','Inspección de fusibles y breakers','Revisión de LEDs y alarmas activas'] },
        { title: 'Pruebas Eléctricas', items: ['Prueba de transferencia automática','Medición de voltaje entrada/salida','Verificación de frecuencia','Prueba de bypass manual','Verificación de alarmas del sistema'] },
        { title: 'Baterías', items: ['Limpieza de bornes y terminales','Medición de voltaje total','Medición por banco','Prueba de descarga','Verificación de temperatura de baterías','Revisión de fecha de fabricación'] },
        { title: 'Documentación', items: ['Registro fotográfico completado','Parámetros eléctricos registrados','Firma del cliente obtenida','Recomendaciones documentadas'] }
      ];

      checkPageBreak(15);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('LISTA DE ACTIVIDADES', margin, yPosition);
      yPosition += 8;

      const totalItems = allGroups.reduce((acc, g) => acc + g.items.length, 0);
      const doneItems = formData.checkedItems.length;
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`${doneItems} de ${totalItems} actividades completadas (${Math.round(doneItems/totalItems*100)}%)`, margin, yPosition);
      pdf.setTextColor(0, 0, 0);
      yPosition += 6;

      const numCols = 4;
      const colW = contentWidth / numCols;
      const rowH = 5;
      const groupTitleH = 7;

      allGroups.forEach((group) => {
        const numRows = Math.ceil(group.items.length / numCols);
        const groupHeight = groupTitleH + numRows * rowH + 3;

        // Page break before group if not enough space
        if (yPosition + groupHeight > pageHeight - margin - 15) {
          pdf.addPage();
          yPosition = margin;
        }

        // Group title bar
        pdf.setFillColor(235, 235, 235);
        pdf.rect(margin, yPosition - 4, contentWidth, 6, 'F');
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(group.title, margin + 2, yPosition);
        yPosition += groupTitleH;

        // Items in 4 columns
        group.items.forEach((item, idx) => {
          const col = idx % numCols;
          const row = Math.floor(idx / numCols);
          const xPos = margin + col * colW;
          const yPos = yPosition + row * rowH;
          const isChecked = (formData.checkedItems || []).includes(item);

          pdf.setFontSize(7.5);
          pdf.setFont('helvetica', 'normal');

          // Check mark
          pdf.setTextColor(isChecked ? 22 : 160, isChecked ? 158 : 160, isChecked ? 117 : 160);
          pdf.text(isChecked ? '[OK]' : '[ ]', xPos, yPos);

          // Item text — truncate to fit column
          pdf.setTextColor(isChecked ? 100 : 40, isChecked ? 100 : 40, isChecked ? 100 : 40);
          const maxTextWidth = colW - 14;
          const fittedText = pdf.splitTextToSize(item, maxTextWidth)[0];
          pdf.text(fittedText, xPos + 11, yPos);
        });

        yPosition += numRows * rowH + 4;
        pdf.setTextColor(0, 0, 0);
      });

      yPosition += 3;
      addSectionDivider();
    }
    checkPageBreak(15);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DETALLES DEL EQUIPO', margin, yPosition);
    yPosition += 8;

    const equipmentData: [string, string][] = [
      ['Marca:', formData.equipmentBrand || 'N/A'],
      ['Modelo:', formData.equipmentModel || 'N/A'],
      ['Capacidad:', formData.capacity || 'N/A'],
      ['Serial:', formData.equipmentSerial || 'N/A'],
      ['Ubicación:', formData.equipmentUbicacion || 'N/A']
    ];

    const equipColumnWidth = contentWidth / 5;
const equipLabelWidth = 15; // Fixed width for labels
const equipValueWidth = equipColumnWidth - equipLabelWidth - 2; // Space for values with margin

// Helper function to fit text in available space
const fitEquipmentText = (text: string, maxWidth: number, fontSize = 6): { text: string; fontSize: number } => {
  pdf.setFontSize(fontSize);
  let textWidth = pdf.getTextWidth(text);
  
  // If text fits, return as is
  if (textWidth <= maxWidth) {
    return { text, fontSize };
  }
  
  // Try smaller font sizes
  for (let size = fontSize - 1; size >= 6; size--) {
    pdf.setFontSize(size);
    textWidth = pdf.getTextWidth(text);
    if (textWidth <= maxWidth) {
      return { text, fontSize: size };
    }
  }
  
  // If still too long, truncate with ellipsis
  pdf.setFontSize(6);
  const ellipsis = '...';
  const ellipsisWidth = pdf.getTextWidth(ellipsis);
  const availableWidth = maxWidth - ellipsisWidth;
  
  let truncatedText = text;
  while (pdf.getTextWidth(truncatedText) > availableWidth && truncatedText.length > 0) {
    truncatedText = truncatedText.slice(0, -1);
  }
  
  return { text: truncatedText + ellipsis, fontSize: 6 };
};

// Display all equipment details in one row (4 columns)
equipmentData.forEach(([label, value], index: number) => {
  const xPos = margin + (index * equipColumnWidth);
  
  // Display label
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text(label, xPos, yPosition);
  
  // Display value with auto-fitting
  const fittedValue = fitEquipmentText(value, equipValueWidth, 8);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(fittedValue.fontSize);
  pdf.text(fittedValue.text, xPos + equipLabelWidth, yPosition);
});

yPosition += 8;

    // Add section divider
    addSectionDivider();

    // ── Parámetros UPS (eléctricos + baterías + estado) ──────────
    if (!formData.reportType || formData.reportType === 'ups') {

    // Electrical Parameters Section
    checkPageBreak(40);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PARÁMETROS ELÉCTRICOS', margin, yPosition);
    yPosition += 8;

    // Voltage Input - single row, aligned
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Voltaje de Entrada:', margin, yPosition);
    yPosition += 6;

    const voltageInput: [string, string][] = [
      ['L1:', `${formData.voltageInL1 || '0'} V`],
      ['L2:', `${formData.voltageInL2 || '0'} V`],
      ['L3:', `${formData.voltageInL3 || '0'} V`],
      ['FF:', `${formData.voltageInFF || '0'} V`]
    ];

    // Calculate equal spacing for 4 columns
    const paramColumnWidth = contentWidth / 4;
    const labelWidth = 15;

    pdf.setFontSize(9);
    voltageInput.forEach(([label, value], index: number) => {
      const xPos = margin + (index * paramColumnWidth);
      
      // Label
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, xPos, yPosition);
      
      // Value - aligned
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, xPos + labelWidth, yPosition);
    });
    
    yPosition += 8;

    // Current Input - single row, aligned
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Corriente de Entrada:', margin, yPosition);
    yPosition += 6;

    const currentInput: [string, string][] = [
      ['L1:', `${formData.currentInL1 || '0'} A`],
      ['L2:', `${formData.currentInL2 || '0'} A`],
      ['L3:', `${formData.currentInL3 || '0'} A`],
      ['N-T:', `${formData.currentInN || '0'} V`]
    ];

    pdf.setFontSize(9);
    currentInput.forEach(([label, value], index: number) => {
      const xPos = margin + (index * paramColumnWidth);
      
      // Label
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, xPos, yPosition);
      
      // Value - aligned
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, xPos + labelWidth, yPosition);
    });
    
    yPosition += 8;

    // Voltage Output - single row, aligned
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Voltaje de Salida:', margin, yPosition);
    yPosition += 6;

    const voltageOutput: [string, string][] = [
      ['L1:', `${formData.voltageOutL1 || '0'} V`],
      ['L2:', `${formData.voltageOutL2 || '0'} V`],
      ['L3:', `${formData.voltageOutL3 || '0'} V`],
      ['FF:', `${formData.voltageOutFF || '0'} V`]
    ];

    pdf.setFontSize(9);
    voltageOutput.forEach(([label, value], index: number) => {
      const xPos = margin + (index * paramColumnWidth);
      
      // Label
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, xPos, yPosition);
      
      // Value - aligned
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, xPos + labelWidth, yPosition);
    });
    
    yPosition += 8;

    // Current Output - single row, aligned
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Corriente de Salida:', margin, yPosition);
    yPosition += 6;

    const currentOutput: [string, string][] = [
      ['L1:', `${formData.currentOutL1 || '0'} A`],
      ['L2:', `${formData.currentOutL2 || '0'} A`],
      ['L3:', `${formData.currentOutL3 || '0'} A`],
      ['N-T:', `${formData.currentOutN || '0'} V`]
    ];

    pdf.setFontSize(9);
    currentOutput.forEach(([label, value], index: number) => {
      const xPos = margin + (index * paramColumnWidth);
      
      // Label
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, xPos, yPosition);
      
      // Value - aligned
      pdf.setFont('helvetica', 'normal');
      pdf.text(value, xPos + labelWidth, yPosition);
    });
    
    yPosition += 4;

    // Add section divider
    addSectionDivider();

    // Battery Parameters Section
    checkPageBreak(30);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PARÁMETROS DE BATERÍAS', margin, yPosition);
    yPosition += 12;

    const batteryData: [string, string][] = [
      ['Voltaje Total:', `${formData.batteryVoltageTotal || '0'} VDC`],
      ['Voltaje Descarga:', `${formData.batteryVoltageTest || '0'} VDC`],
      ['Corriente Descarga:', `${formData.batteryCurrentDischarge || '0'} ADC`],
      ['Corriente Carga:', `${formData.batteryCurrentTest || '0'} ADC`],
      ['Battery string:', `${formData.batteryString || '0'} `],
      ['Numero Bancos:', `${formData.batteryBank || '0'} `],
      ['Cantidad:', `${formData.batteryQuantity || '0'}`],
      ['Referencia:', `${formData.batteryReference || '0'} Ah`],
      ['Marca Bateria:', `${formData.batteryBrand|| 'N/A'}`],
      ['Autonomía:', `${formData.batteryAutonomy || '0'} min`],
      ['Fecha Fabricación:', `${formData.batteryFecha || 'N/A'}`]
    ];

    // Display battery parameters in 3 columns
    const batteryColumnWidth = contentWidth / 3;
    const batteryLabelWidth = 35;
    const batteryValueWidth = batteryColumnWidth - batteryLabelWidth - 3;

    // Helper function to fit battery text in available space
    const fitBatteryText = (text: string, maxWidth: number, fontSize = 8): { text: string; fontSize: number } => {
      pdf.setFontSize(fontSize);
      let textWidth = pdf.getTextWidth(text);
      
      if (textWidth <= maxWidth) {
        return { text, fontSize };
      }
      
      // Try smaller font sizes
      for (let size = fontSize - 1; size >= 7; size--) {
        pdf.setFontSize(size);
        textWidth = pdf.getTextWidth(text);
        if (textWidth <= maxWidth) {
          return { text, fontSize: size };
        }
      }
      
      // If still too long, truncate
      pdf.setFontSize(7);
      const ellipsis = '...';
      const ellipsisWidth = pdf.getTextWidth(ellipsis);
      const availableWidth = maxWidth - ellipsisWidth;
      
      let truncatedText = text;
      while (pdf.getTextWidth(truncatedText) > availableWidth && truncatedText.length > 0) {
        truncatedText = truncatedText.slice(0, -1);
      }
      
      return { text: truncatedText + ellipsis, fontSize: 7 };
    };

    batteryData.forEach(([label, value], index: number) => {
      const columnIndex = index % 3;
      const rowIndex = Math.floor(index / 3);
      const xPos = margin + (columnIndex * batteryColumnWidth);
      const currentYPos = yPosition + (rowIndex * 6);
      
      checkPageBreak(6);
      
      // Display label
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(label, xPos, currentYPos);
      
      // Display value with auto-fitting
      const fittedValue = fitBatteryText(value, batteryValueWidth, 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(fittedValue.fontSize);
      pdf.text(fittedValue.text, xPos + batteryLabelWidth, currentYPos);
    });

    // Move yPosition to after all battery parameters
    yPosition += Math.ceil(batteryData.length / 3) * 6 + 2;

    // Add section divider
    addSectionDivider();

    // Equipment Status Section
    checkPageBreak(25);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ESTADO DEL EQUIPO', margin, yPosition);
    yPosition += 8;

    const statusData = [
      ['Rectificador:', formData.rectifierStatus || 'N/A'],
      ['Cargador:', formData.chargerStatus || 'N/A'],
      ['Inversor:', formData.inverterStatus || 'N/A'],
      ['Batería:', formData.batteryStatus || 'N/A']
    ];

    // Display equipment status in 4 columns (single row)
    const statusColumnWidth = contentWidth / 4;
    const statusLabelWidth = 25; // Fixed width for labels
    const statusValueWidth = statusColumnWidth - statusLabelWidth - 2; // Space for values

    // Helper function to fit status text in available space
    const fitStatusText = (text: string, maxWidth: number, fontSize = 8): { text: string; fontSize: number } => {
      pdf.setFontSize(fontSize);
      let textWidth = pdf.getTextWidth(text);
      
      // If text fits, return as is
      if (textWidth <= maxWidth) {
        return { text, fontSize };
      }
      
      // Try smaller font sizes
      for (let size = fontSize - 1; size >= 7; size--) {
        pdf.setFontSize(size);
        textWidth = pdf.getTextWidth(text);
        if (textWidth <= maxWidth) {
          return { text, fontSize: size };
        }
      }
      
      // If still too long, truncate with ellipsis
      pdf.setFontSize(7);
      const ellipsis = '...';
      const ellipsisWidth = pdf.getTextWidth(ellipsis);
      const availableWidth = maxWidth - ellipsisWidth;
      
      let truncatedText = text;
      while (pdf.getTextWidth(truncatedText) > availableWidth && truncatedText.length > 0) {
        truncatedText = truncatedText.slice(0, -1);
      }
      
      return { text: truncatedText + ellipsis, fontSize: 7 };
    };

    // Display all equipment status in one row (4 columns)
    statusData.forEach(([label, value], index: number) => {
      const xPos = margin + (index * statusColumnWidth);
      
      // Display label
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text(label, xPos, yPosition);
      
      // Display value with auto-fitting and capitalize first letter
      const capitalizedValue = value.charAt(0).toUpperCase() + value.slice(1);
      const fittedValue = fitStatusText(capitalizedValue, statusValueWidth, 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(fittedValue.fontSize);
      pdf.text(fittedValue.text, xPos + statusLabelWidth, yPosition);
    });

    yPosition += 8;

    // Add section divider
    addSectionDivider();

    } // end UPS-only block

    // ── Sección Aires Acondicionados ──────────────────────────
    if (formData.reportType === 'aire') {
      const acGroups = [
        { title: 'Unidad Interior',       items: ['Limpieza de filtros de aire','Limpieza de serpentín evaporador','Revisión bandeja de condensados','Limpieza línea de drenaje','Revisión del ventilador interior','Revisión de conexiones eléctricas internas'] },
        { title: 'Unidad Exterior',       items: ['Limpieza de serpentín condensador','Revisión del ventilador exterior','Revisión de conexiones eléctricas externas','Revisión de soportes y anclaje','Revisión de protecciones eléctricas'] },
        { title: 'Sistema Refrigerante',  items: ['Medición de presiones de operación','Verificación de carga de refrigerante','Revisión de fugas en tuberías','Revisión de aislamiento de tuberías','Verificación de válvulas de servicio'] },
        { title: 'Documentación',         items: ['Registro fotográfico completado','Parámetros operacionales registrados','Firma del cliente obtenida','Recomendaciones documentadas'] },
      ]
      const acChecked: string[] = (formData.checkedItems as string[]) ?? []
      const acTotal = acGroups.reduce((s, g) => s + g.items.length, 0)
      if (acChecked.length > 0 || acTotal > 0) {
        addSectionDivider()
        checkPageBreak(15)
        pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
        pdf.text('LISTA DE ACTIVIDADES', margin, yPosition)
        yPosition += 7
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80,80,80)
        pdf.text(`${acChecked.length} de ${acTotal} actividades completadas (${Math.round(acChecked.length/acTotal*100)}%)`, margin, yPosition)
        pdf.setTextColor(0,0,0); yPosition += 6
        const acCols = 4; const acColW = contentWidth / acCols
        acGroups.forEach(group => {
          checkPageBreak(20)
          pdf.setFillColor(235,235,235)
          pdf.rect(margin, yPosition - 4, contentWidth, 6, 'F')
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold')
          pdf.text(group.title, margin + 2, yPosition)
          yPosition += 7
          group.items.forEach((item, idx) => {
            const col = idx % acCols; const row = Math.floor(idx / acCols)
            if (col === 0) checkPageBreak(6)
            const isChecked = acChecked.includes(item)
            const xPos = margin + col * acColW
            const yPos = yPosition + row * 5
            pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal')
            pdf.setTextColor(isChecked ? 22 : 160, isChecked ? 158 : 160, isChecked ? 117 : 160)
            pdf.text(isChecked ? '[OK]' : '[ ]', xPos, yPos)
            pdf.setTextColor(isChecked ? 100 : 40, isChecked ? 100 : 40, isChecked ? 100 : 40)
            const t = pdf.splitTextToSize(item, acColW - 14)[0]
            pdf.text(t, xPos + 11, yPos)
          })
          yPosition += Math.ceil(group.items.length / acCols) * 5 + 4
          pdf.setTextColor(0,0,0)
        })
      }
      // Parámetros AC
      const acFields: [string, string][] = [
        ['Tipo de unidad:', String(formData.acType || 'N/A')],
        ['Capacidad:', formData.acCapacityBTU ? `${formData.acCapacityBTU} BTU/h` : 'N/A'],
        ['Refrigerante:', String(formData.acRefrigerant || 'N/A')],
        ['Pres. Succión:', formData.acPressureSuction ? `${formData.acPressureSuction} psi` : 'N/A'],
        ['Pres. Descarga:', formData.acPressureDischarge ? `${formData.acPressureDischarge} psi` : 'N/A'],
        ['Temp. Succión:', formData.acTempSuction ? `${formData.acTempSuction} °C` : 'N/A'],
        ['Temp. Descarga:', formData.acTempDischarge ? `${formData.acTempDischarge} °C` : 'N/A'],
        ['Temp. Suministro:', formData.acTempSupply ? `${formData.acTempSupply} °C` : 'N/A'],
        ['Temp. Retorno:', formData.acTempReturn ? `${formData.acTempReturn} °C` : 'N/A'],
        ['Temp. Ambiente:', formData.acTempAmbient ? `${formData.acTempAmbient} °C` : 'N/A'],
        ['Carga Refrig.:', formData.acRefrigerantCharge ? `${formData.acRefrigerantCharge} lbs` : 'N/A'],
        ['V. Compresor:', formData.acVoltageComp ? `${formData.acVoltageComp} V` : 'N/A'],
        ['A. Compresor:', formData.acCurrentComp ? `${formData.acCurrentComp} A` : 'N/A'],
        ['Potencia Comp.:', formData.acPowerComp ? `${formData.acPowerComp} W` : 'N/A'],
        ['Frecuencia:', formData.acFrequency ? `${formData.acFrequency} Hz` : 'N/A'],
        ['V. Ventil. Int.:', formData.acVoltFanInt ? `${formData.acVoltFanInt} V` : 'N/A'],
        ['A. Ventil. Int.:', formData.acAmpFanInt ? `${formData.acAmpFanInt} A` : 'N/A'],
        ['V. Ventil. Ext.:', formData.acVoltFanExt ? `${formData.acVoltFanExt} V` : 'N/A'],
        ['A. Ventil. Ext.:', formData.acAmpFanExt ? `${formData.acAmpFanExt} A` : 'N/A'],
      ]
      addSectionDivider()
      checkPageBreak(15)
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
      pdf.text('PARÁMETROS DEL SISTEMA AC', margin, yPosition)
      yPosition += 8
      const acPC = 4; const acPW = contentWidth / acPC
      acFields.forEach(([label, value], idx) => {
        const col = idx % acPC; const row = Math.floor(idx / acPC)
        if (col === 0) checkPageBreak(6)
        const xPos = margin + col * acPW
        const yPos = yPosition + row * 7
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
        pdf.text(label, xPos, yPos)
        pdf.setFont('helvetica', 'normal')
        pdf.text(pdf.splitTextToSize(value, acPW - 2)[0], xPos, yPos + 4)
      })
      yPosition += Math.ceil(acFields.length / acPC) * 7 + 4
      // Estado AC
      const acStatus: [string, string][] = [
        ['Compresor:', String(formData.acStatusCompressor || 'N/A')],
        ['Evaporador:', String(formData.acStatusEvaporator || 'N/A')],
        ['Condensador:', String(formData.acStatusCondenser || 'N/A')],
        ['V. Expansión:', String(formData.acStatusExpansion || 'N/A')],
        ['Sistema Drenaje:', String(formData.acStatusDrain || 'N/A')],
        ['Sist. Eléctrico:', String(formData.acStatusElectrical || 'N/A')],
      ]
      addSectionDivider()
      checkPageBreak(15)
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
      pdf.text('ESTADO DEL EQUIPO', margin, yPosition)
      yPosition += 8
      const acSC = 3; const acSW = contentWidth / acSC
      acStatus.forEach(([label, value], idx) => {
        const col = idx % acSC; const row = Math.floor(idx / acSC)
        if (col === 0) checkPageBreak(6)
        const xPos = margin + col * acSW
        const yPos = yPosition + row * 7
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
        pdf.text(label, xPos, yPos)
        pdf.setFont('helvetica', 'normal')
        const cap = (value.charAt(0).toUpperCase() + value.slice(1))
        pdf.text(cap, xPos, yPos + 4)
      })
      yPosition += Math.ceil(acStatus.length / acSC) * 7 + 4
      addSectionDivider()
    }

    // ── Sección Plantas Eléctricas ─────────────────────────────
    if (formData.reportType === 'planta') {
      const genGroups = [
        { title: 'Motor y Combustible', items: ['Revisión nivel de combustible','Revisión nivel de aceite motor','Revisión nivel de refrigerante','Inspección de fugas de combustible','Inspección de fugas de aceite','Revisión del sistema de escape'] },
        { title: 'Sistema Eléctrico',   items: ['Revisión batería de arranque','Medición voltaje de batería','Revisión de conexiones eléctricas','Revisión del alternador','Prueba de transferencia automática (ATS)','Verificación de protecciones eléctricas'] },
        { title: 'Prueba de Carga',     items: ['Arranque sin carga','Prueba con carga al 25%','Prueba con carga al 50%','Prueba con carga al 75%','Verificación de frecuencia y voltaje','Registro de parámetros en operación'] },
        { title: 'Documentación',       items: ['Registro fotográfico completado','Parámetros operacionales registrados','Firma del cliente obtenida','Recomendaciones documentadas'] },
      ]
      const genChecked: string[] = (formData.checkedItems as string[]) ?? []
      const genTotal = genGroups.reduce((s, g) => s + g.items.length, 0)
      if (genChecked.length > 0 || genTotal > 0) {
        addSectionDivider()
        checkPageBreak(15)
        pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
        pdf.text('LISTA DE ACTIVIDADES', margin, yPosition)
        yPosition += 7
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80,80,80)
        pdf.text(`${genChecked.length} de ${genTotal} actividades completadas (${Math.round(genChecked.length/genTotal*100)}%)`, margin, yPosition)
        pdf.setTextColor(0,0,0); yPosition += 6
        const gCols = 4; const gColW = contentWidth / gCols
        genGroups.forEach(group => {
          checkPageBreak(20)
          pdf.setFillColor(235,235,235)
          pdf.rect(margin, yPosition - 4, contentWidth, 6, 'F')
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold')
          pdf.text(group.title, margin + 2, yPosition)
          yPosition += 7
          group.items.forEach((item, idx) => {
            const col = idx % gCols; const row = Math.floor(idx / gCols)
            if (col === 0) checkPageBreak(6)
            const isChecked = genChecked.includes(item)
            const xPos = margin + col * gColW
            const yPos = yPosition + row * 5
            pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal')
            pdf.setTextColor(isChecked ? 22 : 160, isChecked ? 158 : 160, isChecked ? 117 : 160)
            pdf.text(isChecked ? '[OK]' : '[ ]', xPos, yPos)
            pdf.setTextColor(isChecked ? 100 : 40, isChecked ? 100 : 40, isChecked ? 100 : 40)
            const t = pdf.splitTextToSize(item, gColW - 14)[0]
            pdf.text(t, xPos + 11, yPos)
          })
          yPosition += Math.ceil(group.items.length / gCols) * 5 + 4
          pdf.setTextColor(0,0,0)
        })
      }
      // Parámetros planta
      const genFields: [string, string][] = [
        ['Tipo combustible:', String(formData.genFuelType || 'N/A')],
        ['Potencia:', formData.genPowerKVA ? `${formData.genPowerKVA} kVA` : 'N/A'],
        ['Horas operación:', formData.genHours ? `${formData.genHours} h` : 'N/A'],
        ['Combustible:', formData.genFuelLevel ? `${formData.genFuelLevel}%` : 'N/A'],
        ['Aceite:', formData.genOilLevel ? `${formData.genOilLevel} mm` : 'N/A'],
        ['Refrigerante:', formData.genCoolantLevel ? `${formData.genCoolantLevel}%` : 'N/A'],
        ['Pres. Aceite:', formData.genOilPressure ? `${formData.genOilPressure} psi` : 'N/A'],
        ['Temp. Motor:', formData.genEngineTemp ? `${formData.genEngineTemp} °C` : 'N/A'],
        ['RPM:', formData.genRPM ? String(formData.genRPM) : 'N/A'],
        ['Frecuencia:', formData.genFrequency ? `${formData.genFrequency} Hz` : 'N/A'],
        ['Tiempo prueba:', formData.genRunTime ? `${formData.genRunTime} min` : 'N/A'],
        ['V. Salida L1:', formData.genVoltL1 ? `${formData.genVoltL1} V` : 'N/A'],
        ['V. Salida L2:', formData.genVoltL2 ? `${formData.genVoltL2} V` : 'N/A'],
        ['V. Salida L3:', formData.genVoltL3 ? `${formData.genVoltL3} V` : 'N/A'],
        ['V. Salida FF:', formData.genVoltFF ? `${formData.genVoltFF} V` : 'N/A'],
        ['A. Salida L1:', formData.genAmpL1 ? `${formData.genAmpL1} A` : 'N/A'],
        ['A. Salida L2:', formData.genAmpL2 ? `${formData.genAmpL2} A` : 'N/A'],
        ['A. Salida L3:', formData.genAmpL3 ? `${formData.genAmpL3} A` : 'N/A'],
        ['Bat. Arranque:', formData.genBattVolt ? `${formData.genBattVolt} V` : 'N/A'],
      ]
      addSectionDivider()
      checkPageBreak(15)
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
      pdf.text('PARÁMETROS DE LA PLANTA ELÉCTRICA', margin, yPosition)
      yPosition += 8
      const gPC = 4; const gPW = contentWidth / gPC
      genFields.forEach(([label, value], idx) => {
        const col = idx % gPC; const row = Math.floor(idx / gPC)
        if (col === 0) checkPageBreak(6)
        const xPos = margin + col * gPW
        const yPos = yPosition + row * 7
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
        pdf.text(label, xPos, yPos)
        pdf.setFont('helvetica', 'normal')
        pdf.text(pdf.splitTextToSize(value, gPW - 2)[0], xPos, yPos + 4)
      })
      yPosition += Math.ceil(genFields.length / gPC) * 7 + 4
      // Estado planta
      const genStatus: [string, string][] = [
        ['Motor:', String(formData.genStatusEngine || 'N/A')],
        ['Alternador:', String(formData.genStatusAlternator || 'N/A')],
        ['Bat. Arranque:', String(formData.genStatusStartBatt || 'N/A')],
        ['Transferencia (ATS):', String(formData.genStatusATS || 'N/A')],
        ['Sist. Combustible:', String(formData.genStatusFuelSystem || 'N/A')],
        ['Sist. Enfriamiento:', String(formData.genStatusCooling || 'N/A')],
      ]
      addSectionDivider()
      checkPageBreak(15)
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
      pdf.text('ESTADO DEL EQUIPO', margin, yPosition)
      yPosition += 8
      const gSC = 3; const gSW = contentWidth / gSC
      genStatus.forEach(([label, value], idx) => {
        const col = idx % gSC; const row = Math.floor(idx / gSC)
        if (col === 0) checkPageBreak(6)
        const xPos = margin + col * gSW
        const yPos = yPosition + row * 7
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
        pdf.text(label, xPos, yPos)
        pdf.setFont('helvetica', 'normal')
        pdf.text(value.charAt(0).toUpperCase() + value.slice(1), xPos, yPos + 4)
      })
      yPosition += Math.ceil(genStatus.length / gSC) * 7 + 4
      addSectionDivider()
    }

    // ── Sección Sistema Fotovoltaico ──────────────────────────
    if (formData.reportType === 'fotovoltaico') {
      const pvGroups = [
        { title: 'Paneles Solares',       items: ['Limpieza de módulos fotovoltaicos','Inspección visual de daños / microfisuras','Revisión de sombras sobre paneles','Verificación de conexiones en caja de combinación','Revisión de estructura y anclajes','Medición de Voc e Isc por string'] },
        { title: 'Inversor y Protecciones', items: ['Revisión del inversor (errores / alarmas)','Verificación de parámetros de operación','Revisión de protecciones DC (fusibles / DPS)','Revisión de protecciones AC (interruptores)','Verificación de puesta a tierra','Revisión de ventilación del inversor'] },
        { title: 'Baterías (si aplica)', items: ['Medición de voltaje de banco','Verificación de estado de carga (SOC)','Revisión de bornes y conexiones','Verificación de temperatura de baterías','Revisión del controlador de carga'] },
        { title: 'Documentación',         items: ['Registro fotográfico completado','Parámetros de generación registrados','Firma del cliente obtenida','Recomendaciones documentadas'] },
      ]
      const pvChecked: string[] = (formData.checkedItems as string[]) ?? []
      const pvTotal = pvGroups.reduce((s, g) => s + g.items.length, 0)
      if (pvChecked.length > 0 || pvTotal > 0) {
        addSectionDivider()
        checkPageBreak(15)
        pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
        pdf.text('LISTA DE ACTIVIDADES', margin, yPosition)
        yPosition += 7
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80,80,80)
        pdf.text(`${pvChecked.length} de ${pvTotal} actividades completadas (${Math.round(pvChecked.length/pvTotal*100)}%)`, margin, yPosition)
        pdf.setTextColor(0,0,0); yPosition += 6
        const pvCols = 4; const pvColW = contentWidth / pvCols
        pvGroups.forEach(group => {
          checkPageBreak(20)
          pdf.setFillColor(235,235,235)
          pdf.rect(margin, yPosition - 4, contentWidth, 6, 'F')
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold')
          pdf.text(group.title, margin + 2, yPosition)
          yPosition += 7
          group.items.forEach((item, idx) => {
            const col = idx % pvCols; const row = Math.floor(idx / pvCols)
            if (col === 0) checkPageBreak(6)
            const isChecked = pvChecked.includes(item)
            const xPos = margin + col * pvColW
            const yPos = yPosition + row * 5
            pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal')
            pdf.setTextColor(isChecked ? 22 : 160, isChecked ? 158 : 160, isChecked ? 117 : 160)
            pdf.text(isChecked ? '[OK]' : '[ ]', xPos, yPos)
            pdf.setTextColor(isChecked ? 100 : 40, isChecked ? 100 : 40, isChecked ? 100 : 40)
            const t = pdf.splitTextToSize(item, pvColW - 14)[0]
            pdf.text(t, xPos + 11, yPos)
          })
          yPosition += Math.ceil(group.items.length / pvCols) * 5 + 4
          pdf.setTextColor(0,0,0)
        })
      }
      // Especificaciones + DC + AC + Baterías FV
      const pvFields: [string, string][] = [
        ['Tipo de sistema:', String(formData.pvSystemType || 'N/A')],
        ['Potencia pico:', formData.pvPeakPower ? `${formData.pvPeakPower} kWp` : 'N/A'],
        ['N° de paneles:', formData.pvPanelCount ? String(formData.pvPanelCount) : 'N/A'],
        ['Panel (modelo):', String(formData.pvPanelModel || 'N/A')],
        ['Tipo inversor:', String(formData.pvInverterType || 'N/A')],
        ['Inversor (modelo):', String(formData.pvInverterModel || 'N/A')],
        ['Voc:', formData.pvVoc ? `${formData.pvVoc} V` : 'N/A'],
        ['Isc:', formData.pvIsc ? `${formData.pvIsc} A` : 'N/A'],
        ['Vmp:', formData.pvVmp ? `${formData.pvVmp} V` : 'N/A'],
        ['Imp:', formData.pvImp ? `${formData.pvImp} A` : 'N/A'],
        ['Potencia DC:', formData.pvDcPower ? `${formData.pvDcPower} W` : 'N/A'],
        ['Irradiancia:', formData.pvIrradiance ? `${formData.pvIrradiance} W/m²` : 'N/A'],
        ['Temp. Panel:', formData.pvPanelTemp ? `${formData.pvPanelTemp} °C` : 'N/A'],
        ['Temp. Ambiente:', formData.pvAmbientTemp ? `${formData.pvAmbientTemp} °C` : 'N/A'],
        ['V. AC L1:', formData.pvAcVoltL1 ? `${formData.pvAcVoltL1} V` : 'N/A'],
        ['V. AC L2:', formData.pvAcVoltL2 ? `${formData.pvAcVoltL2} V` : 'N/A'],
        ['V. AC L3:', formData.pvAcVoltL3 ? `${formData.pvAcVoltL3} V` : 'N/A'],
        ['Frecuencia:', formData.pvFrequency ? `${formData.pvFrequency} Hz` : 'N/A'],
        ['A. AC L1:', formData.pvAcCurrentL1 ? `${formData.pvAcCurrentL1} A` : 'N/A'],
        ['A. AC L2:', formData.pvAcCurrentL2 ? `${formData.pvAcCurrentL2} A` : 'N/A'],
        ['A. AC L3:', formData.pvAcCurrentL3 ? `${formData.pvAcCurrentL3} A` : 'N/A'],
        ['Potencia AC:', formData.pvAcPower ? `${formData.pvAcPower} kW` : 'N/A'],
        ['Eficiencia:', formData.pvEfficiency ? `${formData.pvEfficiency}%` : 'N/A'],
        ['Energía del día:', formData.pvEnergyDay ? `${formData.pvEnergyDay} kWh` : 'N/A'],
        ['Energía total:', formData.pvEnergyTotal ? `${formData.pvEnergyTotal} kWh` : 'N/A'],
        ['CO₂ evitado:', formData.pvCO2Saved ? `${formData.pvCO2Saved} kg` : 'N/A'],
        ['Bat. Voltaje:', formData.pvBattVoltage ? `${formData.pvBattVoltage} V` : 'N/A'],
        ['Bat. SOC:', formData.pvBattSOC ? `${formData.pvBattSOC}%` : 'N/A'],
        ['Bat. Corriente:', formData.pvBattCurrent ? `${formData.pvBattCurrent} A` : 'N/A'],
        ['Bat. Temp.:', formData.pvBattTemp ? `${formData.pvBattTemp} °C` : 'N/A'],
      ]
      addSectionDivider()
      checkPageBreak(15)
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
      pdf.text('PARÁMETROS DEL SISTEMA FOTOVOLTAICO', margin, yPosition)
      yPosition += 8
      const pvPC = 4; const pvPW = contentWidth / pvPC
      pvFields.forEach(([label, value], idx) => {
        const col = idx % pvPC; const row = Math.floor(idx / pvPC)
        if (col === 0) checkPageBreak(6)
        const xPos = margin + col * pvPW
        const yPos = yPosition + row * 7
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
        pdf.text(label, xPos, yPos)
        pdf.setFont('helvetica', 'normal')
        pdf.text(pdf.splitTextToSize(value, pvPW - 2)[0], xPos, yPos + 4)
      })
      yPosition += Math.ceil(pvFields.length / pvPC) * 7 + 4
      // Estado FV
      const pvStatus: [string, string][] = [
        ['Módulos FV:', String(formData.pvStatusPanels || 'N/A')],
        ['Inversor:', String(formData.pvStatusInverter || 'N/A')],
        ['Estructura:', String(formData.pvStatusStructure || 'N/A')],
        ['Protec. DC:', String(formData.pvStatusProtDC || 'N/A')],
        ['Protec. AC:', String(formData.pvStatusProtAC || 'N/A')],
        ['Baterías:', String(formData.pvStatusBattery || 'N/A')],
      ]
      addSectionDivider()
      checkPageBreak(15)
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
      pdf.text('ESTADO DEL SISTEMA', margin, yPosition)
      yPosition += 8
      const pvSC = 3; const pvSW = contentWidth / pvSC
      pvStatus.forEach(([label, value], idx) => {
        const col = idx % pvSC; const row = Math.floor(idx / pvSC)
        if (col === 0) checkPageBreak(6)
        const xPos = margin + col * pvSW
        const yPos = yPosition + row * 7
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
        pdf.text(label, xPos, yPos)
        pdf.setFont('helvetica', 'normal')
        pdf.text(value.charAt(0).toUpperCase() + value.slice(1), xPos, yPos + 4)
      })
      yPosition += Math.ceil(pvStatus.length / pvSC) * 7 + 4
      addSectionDivider()
    }

    // ── Sección Impresora ──────────────────────────────────────
    if (formData.reportType === 'impresora') {
      // Checklist de actividades
      const imprChecks: { id: number; text: string; checked: boolean }[] = (formData.impresoraChecklist as { id: number; text: string; checked: boolean }[]) ?? []
      if (imprChecks.length > 0) {
        addSectionDivider()
        checkPageBreak(15)
        pdf.setFontSize(12)
        pdf.setFont('helvetica', 'bold')
        pdf.text('LISTA DE ACTIVIDADES', margin, yPosition)
        yPosition += 8
        const doneIC = imprChecks.filter(c => c.checked).length
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80,80,80)
        pdf.text(`${doneIC} de ${imprChecks.length} actividades completadas (${Math.round(doneIC/imprChecks.length*100)}%)`, margin, yPosition)
        pdf.setTextColor(0,0,0); yPosition += 6
        const cols2 = 2; const colW2 = contentWidth / cols2
        imprChecks.forEach((c, idx) => {
          const col = idx % cols2; const row = Math.floor(idx / cols2)
          if (col === 0) checkPageBreak(6)
          const xPos = margin + col * colW2
          const yPos = yPosition + row * 5.5
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal')
          pdf.text(c.checked ? '[OK]' : '[ ]', xPos, yPos)
          const fitted = pdf.splitTextToSize(c.text, colW2 - 12)
          pdf.text(fitted[0], xPos + 10, yPos)
        })
        yPosition += Math.ceil(imprChecks.length / cols2) * 5.5 + 4
      }

      // Especificaciones + consumibles + prueba
      const imprFields: [string, string][] = [
        ['Tipo de impresora:', String(formData.impresoraTipo || 'N/A')],
        ['Formato de papel:', String(formData.impresoraFormato || 'N/A')],
        ['Conectividad:', String(formData.impresoraConectividad || 'N/A')],
        ['Contador de páginas:', formData.impresoraContador ? String(formData.impresoraContador) : 'N/A'],
        ['Nivel toner/tinta:', String(formData.impresoraNivelToner || 'N/A')],
        ['Toner reemplazado:', String(formData.impresoraTonerReemplazado || 'N/A')],
        ['Estado del fusor:', String(formData.impresoraFusor || 'N/A')],
        ['Kit de mantenimiento:', String(formData.impresoraKitMant || 'N/A')],
        ['Pagina de prueba:', String(formData.impresoraPrueba || 'N/A')],
        ['Calidad de impresion:', String(formData.impresoraCalidad || 'N/A')],
        ['Fallas encontradas:', String(formData.impresoraFallas || 'Ninguna')],
      ]
      addSectionDivider()
      checkPageBreak(15)
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
      pdf.text('ESPECIFICACIONES DE LA IMPRESORA', margin, yPosition)
      yPosition += 8
      const cols3 = 3; const colW3 = contentWidth / cols3
      imprFields.forEach(([label, value], idx) => {
        const col = idx % cols3; const row = Math.floor(idx / cols3)
        if (col === 0) checkPageBreak(6)
        const xPos = margin + col * colW3
        const yPos = yPosition + row * 7
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
        pdf.text(label, xPos, yPos)
        pdf.setFont('helvetica', 'normal')
        const val = pdf.splitTextToSize(value, colW3 - 2)
        pdf.text(val[0], xPos, yPos + 4)
      })
      yPosition += Math.ceil(imprFields.length / cols3) * 7 + 4
      addSectionDivider()
    }

    // ── Sección Apantallamiento ────────────────────────────────
    if (formData.reportType === 'apantallamiento') {
      // Checklist
      const apanChecks: { id: number; text: string; checked: boolean }[] = (formData.apanChecklist as { id: number; text: string; checked: boolean }[]) ?? []
      if (apanChecks.length > 0) {
        addSectionDivider()
        checkPageBreak(15)
        pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
        pdf.text('LISTA DE ACTIVIDADES', margin, yPosition)
        yPosition += 8
        const doneAP = apanChecks.filter(c => c.checked).length
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80,80,80)
        pdf.text(`${doneAP} de ${apanChecks.length} actividades completadas (${Math.round(doneAP/apanChecks.length*100)}%)`, margin, yPosition)
        pdf.setTextColor(0,0,0); yPosition += 6
        const apCols = 2; const apColW = contentWidth / apCols
        apanChecks.forEach((c, idx) => {
          const col = idx % apCols; const row = Math.floor(idx / apCols)
          if (col === 0) checkPageBreak(6)
          const xPos = margin + col * apColW
          const yPos = yPosition + row * 5.5
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal')
          pdf.text(c.checked ? '[OK]' : '[ ]', xPos, yPos)
          const fitted = pdf.splitTextToSize(c.text, apColW - 12)
          pdf.text(fitted[0], xPos + 10, yPos)
        })
        yPosition += Math.ceil(apanChecks.length / apCols) * 5.5 + 4
      }

      // Datos + Medición + Resultado
      const esPuestaTierra = formData.apanSubtipo === 'puesta_tierra'
      const apanFields: [string, string][] = esPuestaTierra ? [
        ['Tipo de electrodo:', String(formData.ptElectrodo || 'N/A')],
        ['Material conductor:', String(formData.ptMaterial || 'N/A')],
        ['Seccion conductor (mm2):', formData.ptSeccion ? String(formData.ptSeccion) : 'N/A'],
        ['Ano de instalacion:', formData.apanAnoInstalacion ? String(formData.apanAnoInstalacion) : 'N/A'],
        ['Resistencia de tierra (Ohm):', formData.apanResistencia ? String(formData.apanResistencia) : 'N/A'],
        ['Valor maximo permitido:', String(formData.apanResistenciaMax || 'N/A')],
        ['Metodo de medicion:', String(formData.apanMetodo || 'N/A')],
        ['Instrumento:', String(formData.apanInstrumento || 'N/A')],
        ['Temperatura (°C):', formData.apanTemperatura ? String(formData.apanTemperatura) : 'N/A'],
        ['Humedad relativa (%):', formData.apanHumedad ? String(formData.apanHumedad) : 'N/A'],
        ['Estado de electrodos:', String(formData.ptEstadoElectrodo || 'N/A')],
        ['Estado conductores:', String(formData.ptEstadoConductor || 'N/A')],
        ['Equipotencializacion:', String(formData.ptEquipotencial || 'N/A')],
        ['Resultado general:', String(formData.apanResultado || 'N/A')],
        ['Normativa aplicada:', String(formData.apanNorma || 'N/A')],
      ] : [
        ['Tipo de sistema:', String(formData.apanTipo || 'N/A')],
        ['Nivel de proteccion:', String(formData.apanNivel || 'N/A')],
        ['Altura punta captadora (m):', formData.apanAltura ? String(formData.apanAltura) : 'N/A'],
        ['Ano de instalacion:', formData.apanAnoInstalacion ? String(formData.apanAnoInstalacion) : 'N/A'],
        ['Resistencia de tierra (Ohm):', formData.apanResistencia ? String(formData.apanResistencia) : 'N/A'],
        ['Valor maximo permitido:', String(formData.apanResistenciaMax || 'N/A')],
        ['Metodo de medicion:', String(formData.apanMetodo || 'N/A')],
        ['Instrumento:', String(formData.apanInstrumento || 'N/A')],
        ['Temperatura (°C):', formData.apanTemperatura ? String(formData.apanTemperatura) : 'N/A'],
        ['Humedad relativa (%):', formData.apanHumedad ? String(formData.apanHumedad) : 'N/A'],
        ['Estado conductor bajada:', String(formData.apanBajante || 'N/A')],
        ['Estado punta captadora:', String(formData.apanPunta || 'N/A')],
        ['Estado uniones/conectores:', String(formData.apanUniones || 'N/A')],
        ['Resultado general:', String(formData.apanResultado || 'N/A')],
        ['Normativa aplicada:', String(formData.apanNorma || 'N/A')],
      ]
      addSectionDivider()
      checkPageBreak(15)
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
      pdf.text(esPuestaTierra ? 'SISTEMA DE PUESTA A TIERRA' : 'SISTEMA DE APANTALLAMIENTO', margin, yPosition)
      yPosition += 8
      const apFCols = 3; const apFColW = contentWidth / apFCols
      apanFields.forEach(([label, value], idx) => {
        const col = idx % apFCols; const row = Math.floor(idx / apFCols)
        if (col === 0) checkPageBreak(6)
        const xPos = margin + col * apFColW
        const yPos = yPosition + row * 7
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
        pdf.text(label, xPos, yPos)
        pdf.setFont('helvetica', 'normal')
        const val = pdf.splitTextToSize(value, apFColW - 2)
        pdf.text(val[0], xPos, yPos + 4)
      })
      yPosition += Math.ceil(apanFields.length / apFCols) * 7 + 4
      addSectionDivider()
    }

    // ── Sección Otros Servicios ────────────────────────────────
    if (formData.reportType === 'otros') {
      const categoriaLabel: Record<string, string> = {
        tablero:     'Tablero Eléctrico',
        redes:       'Redes / Cableado Estructurado',
        computo:     'Mantenimiento de Cómputo',
        instalacion: 'Instalación Eléctrica',
        otro:        'Otro servicio',
      }
      const catNombre = categoriaLabel[formData.otrosCategoria as string] ?? 'Otros Servicios'

      addSectionDivider()
      checkPageBreak(10)
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold')
      pdf.text(`SERVICIO: ${catNombre.toUpperCase()}`, margin, yPosition)
      yPosition += 6

      if (formData.otrosDescripcion) {
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80,80,80)
        pdf.text(String(formData.otrosDescripcion), margin, yPosition)
        pdf.setTextColor(0,0,0); yPosition += 6
      }

      // Checklist
      const otrosChecks: { id: number; text: string; checked: boolean }[] = (formData.otrosChecklist as { id: number; text: string; checked: boolean }[]) ?? []
      if (otrosChecks.length > 0) {
        addSectionDivider()
        checkPageBreak(15)
        pdf.setFontSize(11); pdf.setFont('helvetica', 'bold')
        pdf.text('LISTA DE ACTIVIDADES', margin, yPosition)
        yPosition += 7
        const doneOT = otrosChecks.filter(c => c.checked).length
        pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(80,80,80)
        pdf.text(`${doneOT} de ${otrosChecks.length} actividades completadas (${Math.round(doneOT/otrosChecks.length*100)}%)`, margin, yPosition)
        pdf.setTextColor(0,0,0); yPosition += 6
        const otCols = 2; const otColW = contentWidth / otCols
        otrosChecks.forEach((c, idx) => {
          const col = idx % otCols; const row = Math.floor(idx / otCols)
          if (col === 0) checkPageBreak(6)
          const xPos = margin + col * otColW
          const yPos = yPosition + row * 5.5
          pdf.setFontSize(8); pdf.setFont('helvetica', 'normal')
          pdf.text(c.checked ? '[OK]' : '[ ]', xPos, yPos)
          const fitted = pdf.splitTextToSize(c.text, otColW - 12)
          pdf.text(fitted[0], xPos + 10, yPos)
        })
        yPosition += Math.ceil(otrosChecks.length / otCols) * 5.5 + 4
      }

      // Parámetros medidos
      const otrosParams: { id: number; label: string; value: string; unit: string }[] = (formData.otrosParams as { id: number; label: string; value: string; unit: string }[]) ?? []
      if (otrosParams.length > 0) {
        addSectionDivider()
        checkPageBreak(15)
        pdf.setFontSize(11); pdf.setFont('helvetica', 'bold')
        pdf.text('PARÁMETROS MEDIDOS', margin, yPosition)
        yPosition += 7
        const pCols = 3; const pColW = contentWidth / pCols
        otrosParams.forEach(({ label, value, unit }, idx) => {
          const col = idx % pCols; const row = Math.floor(idx / pCols)
          if (col === 0) checkPageBreak(6)
          const xPos = margin + col * pColW
          const yPos = yPosition + row * 7
          pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
          const lbl = pdf.splitTextToSize(label || 'Parámetro', pColW - 2)
          pdf.text(lbl[0], xPos, yPos)
          pdf.setFont('helvetica', 'normal')
          pdf.text(`${value || '—'} ${unit || ''}`.trim(), xPos, yPos + 4)
        })
        yPosition += Math.ceil(otrosParams.length / pCols) * 7 + 4
      }

      // Resultado
      if (formData.otrosEstado || formData.otrosResultado) {
        addSectionDivider()
        checkPageBreak(15)
        pdf.setFontSize(11); pdf.setFont('helvetica', 'bold')
        pdf.text('RESULTADO DE LA INSPECCIÓN', margin, yPosition)
        yPosition += 7
        const resFields: [string, string][] = [
          ['Estado general:', String(formData.otrosEstado || 'N/A')],
          ['Resultado:', String(formData.otrosResultado || 'N/A')],
        ]
        resFields.forEach(([label, value], idx) => {
          const col = idx % 2; const xPos = margin + col * (contentWidth / 2)
          pdf.setFontSize(8); pdf.setFont('helvetica', 'bold')
          pdf.text(label, xPos, yPosition)
          pdf.setFont('helvetica', 'normal')
          const val = pdf.splitTextToSize(value, contentWidth / 2 - 2)
          pdf.text(val[0], xPos, yPosition + 4)
        })
        yPosition += 12
      }

      addSectionDivider()
    }

    // Photos Section — ANTES de descripción y recomendaciones
    const rawPhotos: Photo[] = emailPhotosRef.current ?? (formData.photos ?? [])
    const photosToRender: Photo[] = await Promise.all(
      rawPhotos.map(async (p) => ({
        ...p,
        url: typeof p.url === 'string'
          ? await cropForPdf(p.url, p.posX ?? 50, p.posY ?? 50, 776, 400)
          : p.url,
      }))
    )
    if (photosToRender.length > 0) {
      addSectionDivider();
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('REGISTRO FOTOGRÁFICO', margin, yPosition);
      yPosition += 10;

      const photoMargin = 5;
      const availableWidth = contentWidth - photoMargin;
      const photoWidth = availableWidth / 2;
      const photoHeight = 45;
      const descriptionHeight = 10;
      const rowSpacing = 3;

      for (let i = 0; i < photosToRender.length; i += 2) {
        const photo1 = photosToRender[i];
        const photo2 = photosToRender[i + 1];

        if (yPosition + photoHeight + descriptionHeight > pageHeight - margin - 15) {
          pdf.addPage();
          yPosition = margin;
        }

        try {
          if (typeof photo1.url === 'string') {
            const photo1X = margin;
            pdf.addImage(photo1.url, 'JPEG', photo1X, yPosition, photoWidth, photoHeight);
            if (photo1.description) {
              pdf.setFontSize(8);
              pdf.setFont('helvetica', 'bold');
              const lines = pdf.splitTextToSize(photo1.description, photoWidth);
              let descY = yPosition + photoHeight + 8;
              lines.forEach((line: string, idx: number) => {
                if (idx < 1) { pdf.text(line, photo1X + photoWidth / 2, descY, { align: 'center' }); descY += 3; }
              });
            }
          }
          if (photo2 && typeof photo2.url === 'string') {
            const photo2X = margin + photoWidth + photoMargin;
            pdf.addImage(photo2.url, 'JPEG', photo2X, yPosition, photoWidth, photoHeight);
            if (photo2.description) {
              pdf.setFontSize(8);
              pdf.setFont('helvetica', 'bold');
              const lines = pdf.splitTextToSize(photo2.description, photoWidth);
              let descY = yPosition + photoHeight + 8;
              lines.forEach((line: string, idx: number) => {
                if (idx < 1) { pdf.text(line, photo2X + photoWidth / 2, descY, { align: 'center' }); descY += 3; }
              });
            }
          }
        } catch (_e) {
          console.warn(`Could not add photos ${i + 1}${photo2 ? ` and ${i + 2}` : ''} to PDF`);
        }

        yPosition += photoHeight + descriptionHeight + rowSpacing;
      }
    }

    // Description Section
    if (formData.description) {
      addSectionDivider();
      checkPageBreak(20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DESCRIPCIÓN DEL TRABAJO', margin, yPosition);
      yPosition += 8;
      yPosition = addText(String(formData.description ?? ''), margin, yPosition, contentWidth, { fontSize: 9 });
      yPosition += 5;
    }

    // Recommendations Section
    if (formData.recommendations) {
      addSectionDivider();
      checkPageBreak(20);
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('RECOMENDACIONES', margin, yPosition);
      yPosition += 8;
      yPosition = addText(String(formData.recommendations ?? ''), margin, yPosition, contentWidth, { fontSize: 9 });
      yPosition += 5;
    }

    // Signatures Section
    // Add section divider
    addSectionDivider();
    
    checkPageBreak(60); // Ensure space for signatures
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text('FIRMAS', margin, yPosition);
    yPosition += 15;

    const signatureWidth = (contentWidth / 2) - 10;
    const signatureHeight = 30;
    
    // Client signature
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Firma del Cliente', margin, yPosition);
    
    if (formData.clientSignature) {
      try {
        pdf.addImage(formData.clientSignature, 'PNG', margin, yPosition + 5, signatureWidth, signatureHeight);
      } catch (_e) {
        console.warn('Could not add client signature to PDF');
        // Draw empty signature box if signature fails to load
        pdf.setLineWidth(0.5);
        pdf.setDrawColor(150, 150, 150);
        pdf.rect(margin, yPosition + 5, signatureWidth, signatureHeight);
      }
    } else {
      // Draw empty signature box when no signature
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(150, 150, 150); // Gray border
      pdf.rect(margin, yPosition + 5, signatureWidth, signatureHeight);
    }
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0); // Ensure black text
    pdf.text(`Nombre: ${formData.clientSignatureName || ''}`, margin, yPosition + 40);
    pdf.text(`ID: ${formData.clientSignatureId || ''}`, margin, yPosition + 45);

    // Technician signature
    const techSignatureX = margin + signatureWidth + 20;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Firma del Técnico', techSignatureX, yPosition);
    
    if (formData.technicianSignature) {
      try {
        pdf.addImage(formData.technicianSignature, 'PNG', techSignatureX, yPosition + 5, signatureWidth, signatureHeight);
      } catch (_e) {
        console.warn('Could not add technician signature to PDF');
        // Draw empty signature box if signature fails to load
        pdf.setLineWidth(0.5);
        pdf.setDrawColor(150, 150, 150);
        pdf.rect(techSignatureX, yPosition + 5, signatureWidth, signatureHeight);
      }
    } else {
      // Draw empty signature box when no signature
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(150, 150, 150); // Gray border
      pdf.rect(techSignatureX, yPosition + 5, signatureWidth, signatureHeight);
    }
    
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0); // Ensure black text
    pdf.text(`Nombre: ${formData.technicianName || ''}`, techSignatureX, yPosition + 40);
    pdf.text(`ID: ${formData.technicianId || ''}`, techSignatureX, yPosition + 45);

    // Generate filename and save
    const filename = `RT_${repNum}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Add footer to all pages
    const totalPages = (pdf.internal as any).getNumberOfPages ? (pdf.internal as any).getNumberOfPages() : pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      addFooter(i, totalPages);
    }

    // Subir PDF a Supabase Storage (solo cuando hay conexión)
    let pdfUrl: string | null = null
    if (empresaId && !externalToken && navigator.onLine) {
      try {
        const arrayBuffer = pdf.output('arraybuffer')
        pdfUrl = await uploadReportePdf(arrayBuffer, empresaId, filename)
        if (pdfUrl && savedInformeId) {
          actualizarPdfUrl(savedInformeId, pdfUrl).catch(() => {})
        }
      } catch { /* Storage opcional */ }
    }

    return { pdf, filename, pdfUrl };
  }, [formData, reportNumber, logo, currentDate, currentTime, companyInfo, technician]);

  const generatePDF = useCallback(async () => {
    const { pdf, filename } = await buildPDF();
    pdf.save(filename);
    return filename;
  }, [buildPDF]);

  const compressImageForEmail = useCallback((dataUrl: string): Promise<string> => {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const MAX = 600
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * ratio)
        canvas.height = Math.round(img.height * ratio)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.45))
      }
      img.onerror = () => resolve(dataUrl)
      img.src = dataUrl
    })
  }, [])

  // Validación en tiempo real del correo en el modal
  const handleEmailToChange = useCallback((value: string) => {
    setEmailTo(value);
    setEmailValidez('idle');
    setEmailValidezNombre('');
    if (emailValidDebounce.current) clearTimeout(emailValidDebounce.current);
    if (!value.trim() || !empresaId) return;
    emailValidDebounce.current = setTimeout(async () => {
      setEmailValidando(true);
      const res = await validarEmailCliente(value.trim(), empresaId);
      setEmailValidando(false);
      if (res.valido) {
        setEmailValidez('ok');
        setEmailValidezNombre(res.nombre ?? '');
      } else {
        setEmailValidez('error');
      }
    }, 500);
  }, [empresaId]);

  const handleEmailSend = useCallback(async () => {
    const target = emailTo.trim() || String(formData.clientEmail ?? '').trim();
    if (!target) { setShowEmailModal(true); return; }

    // Sin conexión: intentar Web Share API (menú nativo del dispositivo)
    if (!navigator.onLine) {
      setEmailStatus('sending');
      setIsLoading(true);
      try {
        const { pdf, filename } = await buildPDF();
        const arrayBuffer = pdf.output('arraybuffer');
        const file = new File([arrayBuffer], filename, { type: 'application/pdf' });

        // Web Share API con archivo — funciona en iOS Safari y Android Chrome
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: filename.replace('.pdf', ''),
            text: `Reporte técnico para ${target}`,
            files: [file],
          });
          // Si el usuario compartió exitosamente, limpiar el formulario
          setShowEmailModal(false);
          setFormData((prev: FormData) => ({
            technicianSelect: prev.technicianSelect,
            technicianName:   prev.technicianName,
            technicianId:     prev.technicianId,
          }));
          setEmailTo('');
          setEmailValidez('idle');
          setEmailValidezNombre('');
          clearPhotosIDB().catch(() => {});
          setEmailStatus('sent');
          setTimeout(() => setEmailStatus('idle'), 3000);
        } else {
          // Fallback: descarga directa si el dispositivo no soporta Web Share con archivos
          pdf.save(filename);
          setEmailError('PDF descargado. Adjúntalo manualmente en tu app de correo.');
          setEmailStatus('error');
          setTimeout(() => { setEmailStatus('idle'); setEmailError(''); }, 8000);
        }
      } catch (e: unknown) {
        // El usuario canceló el share — no es un error real
        if (e instanceof Error && e.name !== 'AbortError') {
          setEmailError('No se pudo compartir el PDF. Intenta cuando tengas conexión.');
          setEmailStatus('error');
          setTimeout(() => { setEmailStatus('idle'); setEmailError(''); }, 6000);
        } else {
          setEmailStatus('idle');
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setEmailStatus('sending');
    setIsLoading(true);
    try {
      // Comprimir fotos antes de generar el PDF para correo
      emailPhotosRef.current = await Promise.all(
        (formData.photos ?? []).map(async (p: Photo) => ({
          ...p,
          url: typeof p.url === 'string' ? await compressImageForEmail(p.url) : p.url,
        }))
      )
      const { pdf, filename, pdfUrl } = await buildPDF();
      emailPhotosRef.current = null;

      // pdfUrl ya fue subido a Storage dentro de buildPDF.
      // Fallback a base64 solo si el upload falló y el PDF es pequeño (<3 MB)
      let pdfBase64: string | undefined
      if (!pdfUrl) {
        const arrayBuffer = pdf.output('arraybuffer')
        if (arrayBuffer.byteLength < 3_000_000) {
          const bytes = new Uint8Array(arrayBuffer)
          let binary = ''
          bytes.forEach(b => { binary += String.fromCharCode(b) })
          pdfBase64 = btoa(binary)
        }
      }

      if (!pdfUrl && !pdfBase64) {
        throw new Error('El PDF es demasiado grande. Reduce la cantidad de fotos e intenta de nuevo.')
      }

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: target,
          subject: `Reporte Técnico — ${formData.clientCompany ?? companyInfo.name}`,
          clientName: formData.clientContact ?? formData.clientCompany,
          technicianName: formData.technicianName ?? technician,
          companyName: companyInfo.name,
          companyEmail: companyInfo.email,
          date: currentDate,
          pdfUrl,
          pdfBase64,
          filename,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEmailStatus('sent');
      setShowEmailModal(false);

      // Limpiar formulario igual que al descargar PDF
      setFormData((prev: FormData) => ({
        technicianSelect: prev.technicianSelect,
        technicianName:   prev.technicianName,
        technicianId:     prev.technicianId,
      }));
      setShowHistorial(false);
      setHistorial([]);
      setHistorialTab(0);
      setSelectedEquipoId(null);
      setEmailTo('');
      setEmailValidez('idle');
      setEmailValidezNombre('');
      clearPhotosIDB().catch(() => {});

      setTimeout(() => setEmailStatus('idle'), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      console.error('Email error:', msg);
      setEmailError(msg);
      setEmailStatus('error');
      setTimeout(() => setEmailStatus('idle'), 6000);
    } finally {
      setIsLoading(false);
    }
  }, [buildPDF, emailTo, formData, technician, currentDate]);

  const handleWhatsAppShare = useCallback(async () => {
    setIsLoading(true);
    // Abrir ventana sincrónicamente (antes del async) para evitar bloqueo de popup
    const waWindow = window.open('', '_blank');
    try {
      const { pdf, filename } = await buildPDF();
      pdf.save(filename);

      const qr = String(formData.qrCode ?? '').trim();
      const link = qr ? `\n🔗 snelapp.com/equipo/${qr}` : '';
      const text =
        `*Reporte Técnico — ${companyInfo.name}*\n` +
        `📋 Cliente: ${formData.clientCompany ?? ''}\n` +
        `🔧 Equipo: ${formData.equipmentBrand ?? ''} ${formData.equipmentModel ?? ''}\n` +
        `🔑 Serial: ${formData.equipmentSerial ?? ''}\n` +
        `📅 Fecha: ${currentDate}` +
        link +
        `\n\n_El PDF fue descargado en tu dispositivo._`;

      if (waWindow) {
        waWindow.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
      }
    } catch (err: unknown) {
      if (waWindow) waWindow.close();
      if (err instanceof Error && err.name !== 'AbortError') console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [buildPDF, formData, currentDate]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await generatePDF();
      // El número consecutivo ya fue asignado atómicamente por la BD en buildPDF

      // Limpiar todo el formulario, conservar solo técnico
      setFormData((prev: FormData) => ({
        technicianSelect:  prev.technicianSelect,
        technicianName:    prev.technicianName,
        technicianId:      prev.technicianId,
      }));

      // Cerrar y limpiar historial
      setShowHistorial(false)
      setHistorial([])
      setHistorialTab(0)
      setSelectedEquipoId(null)
      clearPhotosIDB().catch(() => {})

      alert('Reporte generado exitosamente.');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el reporte');
    } finally {
      setIsLoading(false);
    }
  }, [formData, reportNumber, logo, currentDate, companyInfo]);

  
  return (
    <div className="container max-w-4xl mx-auto p-4">
      <Card className="w-full" ref={formRef}>
        <CardHeader className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-4">
            {/* Logo section — solo visualización, gestión desde Admin */}
            <div className="order-2 sm:order-1 mx-auto sm:mx-0">
              {logo ? (
                <div className="w-64 h-32 overflow-hidden rounded-lg bg-white flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logo}
                    alt="Company Logo"
                    draggable={false}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    style={{
                      transform: `scale(${logoZoom})`,
                      transformOrigin: 'center center',
                    }}
                  />
                </div>
              ) : (
                <div className="w-64 h-32 bg-gray-100 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300">
                  <span className="text-gray-400 font-semibold text-sm">LOGO</span>
                  <span className="text-gray-400 text-xs mt-1">Configura en Admin</span>
                </div>
              )}
            </div>
            
            {/* Title section */}
            <div className="text-center order-1 sm:order-2">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Reporte Técnico</h1>
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <span className="text-lg font-medium mr-2">N° Reporte:</span>
                  <span className="font-medium text-red-500 px-2 py-1 bg-gray-50 rounded">
                    {fmtReportNum(reportNumber, formData.reportType ?? 'ups')}
                  </span>
                </div>
                <div className="text-sm text-gray-600">Fecha: {currentDate} — {currentTime}</div>
                <div className="text-xs h-4" style={{ color: saveStatus === 'saved' ? '#16a34a' : '#9ca3af' }}>
                  {saveStatus === 'saving' ? 'Guardando...' : saveStatus === 'saved' ? '✓ Guardado' : ''}
                </div>
              </div>
            </div>  

            {/* Company info */}
            <div className="text-center sm:text-right order-3">
              <h2 className="font-bold text-xl sm:text-2xl">
                {marcaSeleccionada ? marcaSeleccionada.nombre : companyInfo.name}
              </h2>
              {marcaSeleccionada && (
                <p className="text-xs text-green-600 font-medium">Servicio prestado por {companyInfo.name}</p>
              )}
              {(marcaSeleccionada?.direccion ?? companyInfo.address) && <p className="text-sm text-gray-600">{marcaSeleccionada?.direccion ?? companyInfo.address}</p>}
              {(marcaSeleccionada?.telefono  ?? companyInfo.phone)   && <p className="text-sm text-gray-600">{marcaSeleccionada?.telefono ?? companyInfo.phone}</p>}
              {(marcaSeleccionada?.email     ?? companyInfo.email)   && <p className="text-sm text-gray-600">{marcaSeleccionada?.email ?? companyInfo.email}</p>}
              {(marcaSeleccionada?.ciudad    ?? companyInfo.city)    && <p className="text-sm text-gray-600">{marcaSeleccionada?.ciudad ?? companyInfo.city}</p>}
              <div className="flex items-center justify-center sm:justify-end mt-2">
                <span className="text-sm font-medium text-green-700">👤 {technician}</span>
              </div>
            </div>
          </div>
          
          <div className="border-t border-b py-2 mt-4" />
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6" onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault() }}>
            {/* Selector tipo de reporte */}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {REPORT_TYPES.map(({ id, label, icon }) => {
                const active = (formData.reportType ?? 'ups') === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleFieldChange('reportType', id)}
                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 text-sm font-medium transition-all
                      ${active
                        ? 'border-green-600 bg-green-50 text-green-700 shadow-sm'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="text-xs text-center leading-tight">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selector de marca / empresa representada */}
            {marcas.length > 0 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs font-medium text-blue-700 mb-2">¿Emitir informe a nombre de otra empresa?</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => seleccionarMarca(null)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      !marcaSeleccionada
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-blue-200 text-blue-600 hover:bg-blue-100'
                    }`}
                  >
                    Mi empresa
                  </button>
                  {marcas.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => seleccionarMarca(m)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                        marcaSeleccionada?.id === m.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-blue-200 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {m.nombre}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Client Information */}
            <CollapsibleSection title="Información del Cliente" icon={User} initiallyOpen={true}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientCompany">Empresa</Label>
                    <div className="relative">
                      <Input
                        id="clientCompany"
                        value={String(formData.clientCompany ?? '')}
                        onChange={(e) => !isPreset('clientCompany') && handleClientCompanyChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowClientSug(false), 150)}
                        placeholder="Nombre de la empresa"
                        autoComplete="off"
                        readOnly={isPreset('clientCompany')}
                        className={isPreset('clientCompany') ? 'bg-blue-50 border-blue-200 cursor-default' : ''}
                      />
                      {showClientSug && (
                        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                          {clientSuggestions.map(c => (
                            <li
                              key={c.id}
                              onMouseDown={() => selectClient(c)}
                              className="px-3 py-2 cursor-pointer hover:bg-green-50 text-sm"
                            >
                              <span className="font-medium">{c.company}</span>
                              {c.city && <span className="text-gray-400 ml-2 text-xs">— {c.city}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientAddress">Dirección</Label>
                    <Input
                      id="clientAddress"
                      value={String(formData.clientAddress ?? '')}
                      onChange={(e) => !isPreset('clientAddress') && handleFieldChange('clientAddress', e.target.value)}
                      placeholder="Dirección de la empresa"
                      readOnly={isPreset('clientAddress')}
                      className={isPreset('clientAddress') ? 'bg-blue-50 border-blue-200 cursor-default' : ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientCity">Ciudad</Label>
                    <Input
                      id="clientCity"
                      value={String(formData.clientCity ?? '')}
                      onChange={(e) => handleFieldChange('clientCity', e.target.value)}
                      placeholder="Ciudad"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientContact">Contacto</Label>
                    <Input
                      id="clientContact"
                      value={String(formData.clientContact ?? '')}
                      onChange={(e) => handleFieldChange('clientContact', e.target.value)}
                      placeholder="Nombre del contacto"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientEmail">Correo Electrónico</Label>
                    <Input
                      id="clientEmail"
                      type="email"
                      value={String(formData.clientEmail ?? '')}
                      onChange={(e) => handleFieldChange('clientEmail', e.target.value)}
                      placeholder="correo@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Teléfono</Label>
                    <Input
                      id="clientPhone"
                      value={String(formData.clientPhone ?? '')}
                      onChange={(e) => handleFieldChange('clientPhone', e.target.value)}
                      placeholder="Número de contacto"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Lista de Actividades — posición 2, igual para todos los tipos */}
            {(!formData.reportType || formData.reportType === 'ups') && (
              <ChecklistSection
                checkedItems={formData.checkedItems || []}
                onCheckChange={(items) => handleFieldChange('checkedItems', items)}
              />
            )}
            {formData.reportType === 'aire'         && <AireParams         showOnly="checklist" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'planta'       && <PlantaParams       showOnly="checklist" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'fotovoltaico' && <FotovoltaicoParams showOnly="checklist" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'impresora'        && <ImpresoraParams        showOnly="checklist" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'apantallamiento' && <ApantallamientoParams  showOnly="checklist" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'otros'           && <OtrosParams            showOnly="checklist" formData={formData} onChange={handleFieldChange} />}

            {/* Información del Servicio */}
            <ServiceInfoSection
              formData={formData}
              onChange={handleFieldChange}
              technician={technician}
            />

            {/* Service Type - Multi-select */}
            <ServiceTypeSection 
              selectedServices={formData.selectedServices || []}
              onServiceChange={handleServiceChange}
            />

            {/* Materiales y Repuestos */}
            <MaterialsSection
              formData={formData}
              setFormData={setFormData}
            />

            {/* Service Details */}
            <CollapsibleSection title="Detalles del Equipo" icon={Wrench}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="equipmentBrand">Marca</Label>
                  <Input
                    id="equipmentBrand"
                    value={String(formData.equipmentBrand ?? '')}
                    onChange={(e) => !isPreset('equipmentBrand') && handleFieldChange('equipmentBrand', e.target.value)}
                    placeholder="Marca del equipo"
                    readOnly={isPreset('equipmentBrand')}
                    className={isPreset('equipmentBrand') ? 'bg-blue-50 border-blue-200 cursor-default' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equipmentModel">Modelo</Label>
                  <Input
                    id="equipmentModel"
                    value={String(formData.equipmentModel ?? '')}
                    onChange={(e) => !isPreset('equipmentModel') && handleFieldChange('equipmentModel', e.target.value)}
                    placeholder="Modelo del equipo"
                    readOnly={isPreset('equipmentModel')}
                    className={isPreset('equipmentModel') ? 'bg-blue-50 border-blue-200 cursor-default' : ''}
                  />
                </div>
                {(!formData.reportType || formData.reportType === 'ups') && (
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacidad (KVA)</Label>
                  <Input
                    id="capacity"
                    value={String(formData.capacity ?? '')}
                    onChange={(e) => handleFieldChange('capacity', e.target.value)}
                    placeholder="Potencia del equipo"
                  />
                </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="equipmentSerial">Serial</Label>
                  <div className="relative">
                    <Input
                      id="equipmentSerial"
                      value={String(formData.equipmentSerial ?? '')}
                      onChange={(e) => !isPreset('equipmentSerial') && handleEquipmentSerialChange(e.target.value)}
                      onBlur={!isPreset('equipmentSerial') ? handleEquipmentSerialBlur : undefined}
                      placeholder="Número de serie"
                      autoComplete="off"
                      readOnly={isPreset('equipmentSerial')}
                      className={isPreset('equipmentSerial') ? 'bg-blue-50 border-blue-200 cursor-default' : ''}
                    />
                    {showEquipmentSug && (
                      <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                        {equipmentSuggestions.map(eq => (
                          <li
                            key={eq.id}
                            onMouseDown={() => selectEquipment(eq)}
                            className="px-3 py-2 cursor-pointer hover:bg-green-50 text-sm"
                          >
                            <span className="font-medium">{eq.serial || '(sin serial)'}</span>
                            <span className="text-gray-500 ml-2">{[eq.brand, eq.model].filter(Boolean).join(' ')}</span>
                            {eq.client_company && <span className="text-gray-400 ml-2 text-xs">— {eq.client_company}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="equipmentUbicacion">Ubicación</Label>
                  <Input
                    id="equipmentUbicacion"
                    value={String(formData.equipmentUbicacion ?? '')}
                    onChange={(e) => !isPreset('equipmentUbicacion') && handleFieldChange('equipmentUbicacion', e.target.value)}
                    placeholder="Ubicación del equipo"
                    readOnly={isPreset('equipmentUbicacion')}
                    className={isPreset('equipmentUbicacion') ? 'bg-blue-50 border-blue-200 cursor-default' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qrCode">Código QR <span className="text-xs text-gray-400">(auto)</span></Label>
                  <div className="relative">
                    <Input
                      id="qrCode"
                      value={String(formData.qrCode ?? '')}
                      readOnly
                      placeholder="Se genera al ingresar serial"
                      className="bg-gray-50 text-gray-600 cursor-default"
                    />
                    {formData.qrCode && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">✓</span>
                    )}
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Historial de visitas del equipo */}
            {showHistorial && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowHistorial(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-blue-800"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Historial de visitas
                    {!loadingHistorial && <span className="bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded-full">{historial.length}</span>}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showHistorial ? 'rotate-180' : ''}`} />
                </button>

                <div className="px-4 pb-4">
                  {loadingHistorial ? (
                    <p className="text-sm text-blue-500 py-2">Cargando historial…</p>
                  ) : historial.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">Sin visitas previas registradas.</p>
                  ) : (
                    <>
                      {/* Pestañas horizontales */}
                      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                        {historial.map((v, i) => (
                          <button
                            key={v.id ?? i}
                            type="button"
                            onClick={() => setHistorialTab(i)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-t-lg text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                              historialTab === i
                                ? 'bg-white border-blue-600 text-blue-700'
                                : 'bg-blue-100/60 border-transparent text-blue-500 hover:bg-white/60'
                            }`}
                          >
                            {v.numero_informe ?? (v.fecha ? v.fecha.replace(/(\d{2})\/(\d{2})\/(\d{4})/, (_, d, m, y) => `${d}/${m}/${y.slice(-2)}`) : `Visita ${i + 1}`)}
                          </button>
                        ))}
                      </div>

                      {/* Contenido de la pestaña activa */}
                      {historial[historialTab] && (() => {
                        const v = historial[historialTab]
                        return (
                          <div className="bg-white rounded-b-xl rounded-tr-xl border border-blue-100 px-4 py-3">
                            {/* Fila superior: info en 2 columnas */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Informe</p>
                                <p className="text-xs font-bold text-blue-700 flex items-center gap-2 flex-wrap">
                                  <span>#{v.numero_informe ?? v.reporte_numero ?? '—'}
                                  {v.fecha && <span className="ml-1 font-normal text-gray-400">· {v.fecha.replace(/(\d{2})\/(\d{2})\/(\d{4})/, (_, d, m, y) => `${d}/${m}/${y.slice(-2)}`)}</span>}
                                  </span>
                                  {v.pdf_url && (
                                    <a
                                      href={v.pdf_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full transition-colors"
                                      title="Descargar PDF"
                                    >
                                      <Download className="w-3 h-3" /> PDF
                                    </a>
                                  )}
                                </p>
                              </div>
                              {v.tipo_reporte && (
                                <div>
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Tipo</p>
                                  <p className="text-xs font-medium text-gray-700 capitalize">{v.tipo_reporte}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wide">Técnico</p>
                                <p className="text-xs font-medium text-gray-800">{v.tecnico ?? '—'}</p>
                              </div>
                              {v.ubicacion && (
                                <div>
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Ubicación</p>
                                  <p className="text-xs text-gray-700 truncate">{v.ubicacion}</p>
                                </div>
                              )}
                            </div>
                            {/* Observaciones y Recomendaciones full-width */}
                            {(v.observaciones || v.recomendaciones) && (
                              <div className="border-t border-gray-100 pt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                                {v.observaciones && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Observaciones</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{v.observaciones}</p>
                                  </div>
                                )}
                                {v.recomendaciones && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Recomendaciones</p>
                                    <p className="text-xs text-gray-700 leading-relaxed">{v.recomendaciones}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Parámetros específicos — todos los tipos excepto UPS */}
            {formData.reportType === 'aire'         && <AireParams         showOnly="params" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'planta'       && <PlantaParams       showOnly="params" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'fotovoltaico' && <FotovoltaicoParams showOnly="params" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'impresora'        && <ImpresoraParams        showOnly="params" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'apantallamiento' && <ApantallamientoParams  showOnly="params" formData={formData} onChange={handleFieldChange} />}
            {formData.reportType === 'otros'           && <OtrosParams            showOnly="params" formData={formData} onChange={handleFieldChange} />}

            {/* Parámetros Eléctricos — solo UPS */}
            {(!formData.reportType || formData.reportType === 'ups') && (
            <>
            <CollapsibleSection title="Parámetros Eléctricos" icon={FileText}>
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
            </CollapsibleSection>

            {/* Battery Parameters — solo UPS */}
            <CollapsibleSection title="Parámetros de Baterías" icon={FileText}>
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
                        value={String(formData[id] ?? '')}
                        onChange={(e) => handleFieldChange(id, e.target.value)}
                        className="text-right text-sm"
                        placeholder="0.0"
                        inputMode="decimal"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="batteryString" className="text-sm">Baterías por Bancos</Label>
                    <Input
                      id="batteryString"
                      type="number"
                      value={String(formData.batteryString ?? '')}
                      onChange={(e) => handleFieldChange('batteryString', e.target.value)}
                      className="text-right text-sm"
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batteryBank" className="text-sm">Numeros de Bancos</Label>
                    <Input
                      id="batteryBank"
                      type="number"
                      value={String(formData.batteryBank ?? '')}
                      onChange={(e) => handleFieldChange('batteryBank', e.target.value)}
                      className="text-right text-sm"
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batteryQuantity" className="text-sm">Total de Baterias</Label>
                    <Input
                      id="batteryQuantity"
                      type="number"
                      value={String(formData.batteryQuantity ?? '')}
                      onChange={(e) => handleFieldChange('batteryQuantity', e.target.value)}
                      className="text-right text-sm"
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batteryReference" className="text-sm">Referencia (Ah)</Label>
                    <Input
                      id="batteryReference"
                      value={String(formData.batteryReference ?? '')}
                      onChange={(e) => handleFieldChange('batteryReference', e.target.value)}
                      className="text-right text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batteryBrand" className="text-sm">Marca Baterias </Label>
                    <Input
                      id="batteryBrand"
                      value={String(formData.batteryBrand ?? '')}
                      onChange={(e) => handleFieldChange('batteryBrand', e.target.value)}
                      className="text-right text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batteryFecha" className="text-sm">Fecha Fabricacion (FI)</Label>
                    <Input
                      id="batteryFecha"
                      value={String(formData.batteryFecha ?? '')}
                      onChange={(e) => handleFieldChange('batteryFecha', e.target.value)}
                      className="text-right text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="batteryAutonomy" className="text-sm">Autonomía (min)</Label>
                    <Input
                      id="batteryAutonomy"
                      type="number"
                      value={String(formData.batteryAutonomy ?? '')}
                      onChange={(e) => handleFieldChange('batteryAutonomy', e.target.value)}
                      className="text-right text-sm"
                      placeholder="0"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>
            </>) /* fin bloque UPS */}

            {/* Equipment Status — solo UPS */}
            {(!formData.reportType || formData.reportType === 'ups') && <CollapsibleSection title="Estado del Equipo" icon={Wrench}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rectifierStatus" className="text-sm">Estado Rectificador</Label>
                  <select
                    id="rectifierStatus"
                    value={String(formData.rectifierStatus ?? '')}
                    onChange={(e) => handleFieldChange('rectifierStatus', e.target.value)}
                    className="w-full p-2 border rounded-md bg-white text-sm"
                  >
                    <option value="">Seleccionar estado</option>
                    <option value="bueno">Bueno</option>
                    <option value="falla">Falla</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chargerStatus" className="text-sm">Estado Cargador</Label>
                  <select
                    id="chargerStatus"
                    value={String(formData.chargerStatus ?? '')}
                    onChange={(e) => handleFieldChange('chargerStatus', e.target.value)}
                    className="w-full p-2 border rounded-md bg-white text-sm"
                  >
                    <option value="">Seleccionar estado</option>
                    <option value="bueno">Bueno</option>
                    <option value="falla">Falla</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inverterStatus" className="text-sm">Estado Inversor</Label>
                  <select
                    id="inverterStatus"
                    value={String(formData.inverterStatus ?? '')}
                    onChange={(e) => handleFieldChange('inverterStatus', e.target.value)}
                    className="w-full p-2 border rounded-md bg-white text-sm"
                  >
                    <option value="">Seleccionar estado</option>
                    <option value="bueno">Bueno</option>
                    <option value="falla">Falla</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batteryStatus" className="text-sm">Estado Batería</Label>
                  <select
                    id="batteryStatus"
                    value={String(formData.batteryStatus ?? '')}
                    onChange={(e) => handleFieldChange('batteryStatus', e.target.value)}
                    className="w-full p-2 border rounded-md bg-white text-sm"
                  >
                    <option value="">Seleccionar estado</option>
                    <option value="bueno">Bueno</option>
                    <option value="remplazar">Remplazar</option>
                  </select>
                </div>
              </div>
            </CollapsibleSection>}

            {/* Photos */}
            <PhotosSection
              formData={formData}
              setFormData={setFormData}
              isMobile={isMobile}
            />

            {/* Description and Recommendations */}
            <CollapsibleSection title="Descripción y Recomendaciones" icon={FileText}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción del trabajo realizado</Label>
                  <textarea
                    id="description"
                    value={String(formData.description ?? '')}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    className="w-full min-h-[100px] p-2 border rounded-md text-justify resize-none"
                    placeholder="Detalle el trabajo realizado..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recommendations">Recomendaciones</Label>
                  <textarea
                    id="recommendations"
                    value={String(formData.recommendations ?? '')}
                    onChange={(e) => handleFieldChange('recommendations', e.target.value)}
                    className="w-full min-h-[100px] p-2 border rounded-md text-justify resize-none"
                    placeholder="Ingrese las recomendaciones..."
                    rows={4}
                  />
                </div>
              </div>
            </CollapsibleSection>
            
            {/* Signatures */}
            <CollapsibleSection title="Firmas" icon={Pen}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Client Signature */}
                <div className="space-y-4">
                  <h4 className="font-medium text-center">Firma del Cliente</h4>
                  <SignaturePad
                    id="client-signature"
                    onSave={(dataUrl) => handleFieldChange('clientSignature', dataUrl)}
                    onClear={() => handleFieldChange('clientSignature', null)}
                    isSaved={!!formData.clientSignature}
                  />
                  <div className="space-y-2">
                    <Input
                      id="clientSignatureName"
                      value={String(formData.clientSignatureName ?? '')}
                      onChange={(e) => handleFieldChange('clientSignatureName', e.target.value)}
                      placeholder="Nombre del Cliente"
                      className="text-center text-sm"
                    />
                    <Input
                      id="clientSignatureId"
                      value={String(formData.clientSignatureId ?? '')}
                      onChange={(e) => handleFieldChange('clientSignatureId', e.target.value)}
                      placeholder="Número de Identificación"
                      className="text-center text-sm"
                    />
                  </div>
                </div>

                {/* Technician Signature */}
                <div className="space-y-4">
                  <h4 className="font-medium text-center">Firma del Técnico</h4>
                  <SignaturePad
                    id="technician-signature"
                    onSave={(dataUrl) => handleFieldChange('technicianSignature', dataUrl)}
                    onClear={() => handleFieldChange('technicianSignature', null)}
                    isSaved={!!formData.technicianSignature}
                  />
                  <div className="space-y-2">
                    <Input
                      id="technicianName"
                      value={String(formData.technicianName ?? technician ?? '')}
                      onChange={(e) => handleFieldChange('technicianName', e.target.value)}
                      placeholder="Nombre del Técnico"
                      className="text-center text-sm"
                    />
                    <Input
                      id="technicianId"
                      value={String(formData.technicianId ?? '')}
                      onChange={(e) => handleFieldChange('technicianId', e.target.value)}
                      placeholder="Número de Identificación"
                      className="text-center text-sm"
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mt-8">
              {/* WhatsApp */}
              <Button
                type="button"
                disabled={isLoading}
                onClick={handleWhatsAppShare}
                className={`w-full sm:w-40 transition-colors duration-200 text-white ${isLoading ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <MessageCircle className="w-4 h-4 mr-2" />
                )}
                WhatsApp
              </Button>

              {/* Correo */}
              <Button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setEmailTo(String(formData.clientEmail ?? ''));
                  setShowEmailModal(true);
                }}
                className={`w-full sm:w-40 transition-colors duration-200 text-white ${isLoading ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                Correo
              </Button>

              {/* Descargar */}
              <Button
                type="submit"
                disabled={isLoading}
                className={`w-full sm:w-40 transition-colors duration-200 text-white ${isLoading ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                Descargar PDF
              </Button>
            </div>

            {/* Email Modal */}
            {showEmailModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-600" /> Enviar por correo
                  </h3>

                  <div className="space-y-1">
                    <label className="text-sm text-gray-600">Correo del destinatario</label>
                    <div className="relative">
                      <Input
                        type="email"
                        value={emailTo}
                        onChange={e => handleEmailToChange(e.target.value)}
                        placeholder="cliente@empresa.com"
                        autoFocus
                        className={
                          emailValidez === 'ok'    ? 'border-green-400 pr-8' :
                          emailValidez === 'error' ? 'border-red-400 pr-8'   : 'pr-8'
                        }
                      />
                      {/* Indicador de validación */}
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm">
                        {emailValidando && (
                          <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                        )}
                        {!emailValidando && emailValidez === 'ok'    && <span className="text-green-500">✓</span>}
                        {!emailValidando && emailValidez === 'error' && <span className="text-red-500">✗</span>}
                      </span>
                    </div>

                    {/* Mensaje de validación */}
                    {emailValidez === 'ok' && emailValidezNombre && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <span>✓</span> Registrado como: <strong>{emailValidezNombre}</strong>
                      </p>
                    )}
                    {emailValidez === 'error' && (
                      <p className="text-xs text-orange-500">
                        Correo no encontrado en clientes — se enviará de todas formas.
                      </p>
                    )}
                  </div>

                  {emailStatus === 'error' && (
                    <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{emailError || 'Error al enviar'}</p>
                  )}
                  {emailStatus === 'sent' && (
                    <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">✓ Correo enviado correctamente.</p>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => { setShowEmailModal(false); setEmailValidez('idle'); setEmailTo(''); }}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={emailStatus === 'sending' || !emailTo.trim() || emailValidando}
                      onClick={handleEmailSend}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                    >
                      {emailStatus === 'sending' ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Enviando…
                        </div>
                      ) : 'Enviar'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
      
      {/* Floating Action Button for Mobile */}
      {isMobile && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button 
            type="button" 
            onClick={handleSubmit}
            disabled={isLoading}
            className="rounded-full w-14 h-14 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            ) : (
              <Download className="w-6 h-6" />
            )}
          </Button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
            <p className="text-gray-700">Generando reporte...</p>
          </div>
        </div>
      )}
    </div>
  );
};


export default TechnicalForm;
