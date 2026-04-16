import type { Metadata } from "next";
import { CheckCircle, Calendar, Hash, User, Tag, Cpu, Zap, MapPin } from "lucide-react";

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const cliente = params.cliente ?? "Cliente";
  const n = params.n ?? "";
  return {
    title: `Informe ${n} — ${cliente} | Ion Energy`,
    description: `Reporte técnico de mantenimiento para ${cliente}`,
  };
}

const fields = [
  { key: "cliente",   label: "Cliente",        Icon: User    },
  { key: "serial",    label: "N° de Serie",     Icon: Hash    },
  { key: "marca",     label: "Marca",           Icon: Tag     },
  { key: "modelo",    label: "Modelo",          Icon: Cpu     },
  { key: "capacidad", label: "Capacidad",       Icon: Zap     },
  { key: "ubicacion", label: "Ubicación",       Icon: MapPin  },
] as const;

export default async function InformePage({ searchParams }: Props) {
  const params = await searchParams;

  const n      = params.n      ?? "—";
  const fecha  = params.fecha  ?? "—";
  const hasData = Object.values(params).some(Boolean);

  if (!hasData) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center text-gray-400">
          <p className="text-lg font-medium">QR inválido o sin datos</p>
          <p className="text-sm mt-1">Escanea el código QR del informe técnico.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-md mb-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-3">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Informe Técnico Verificado</h1>
        <p className="text-sm text-gray-500 mt-1">Ion Energy S.A.S</p>
      </div>

      {/* Card principal */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Número y fecha */}
        <div className="bg-green-600 px-6 py-4 flex items-center justify-between text-white">
          <div>
            <p className="text-xs font-medium opacity-80 uppercase tracking-wide">Reporte N°</p>
            <p className="text-2xl font-bold">{n}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium opacity-80 uppercase tracking-wide flex items-center gap-1 justify-end">
              <Calendar className="w-3 h-3" /> Fecha
            </p>
            <p className="text-base font-semibold">{fecha}</p>
          </div>
        </div>

        {/* Datos del equipo */}
        <div className="divide-y divide-gray-50">
          {fields.map(({ key, label, Icon }) => {
            const value = params[key];
            if (!value) return null;
            return (
              <div key={key} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                  <p className="text-sm font-semibold text-gray-800 truncate">{value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-xs text-gray-400 text-center">
        Este documento fue generado por el sistema Servtech de Ion Energy S.A.S.<br />
        Para más información contacte a su técnico asignado.
      </p>
    </main>
  );
}
