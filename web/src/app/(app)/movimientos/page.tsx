import { requirePageUser } from "@/lib/auth/guards";
import MovimientosManager from "./movimientos-manager";

export const dynamic = "force-dynamic";

export default async function MovimientosPage() {
  const user = await requirePageUser(
    ["admin", "operador", "contador"],
    "operaciones.read"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Control de Estacionamiento
          </h1>
          <p className="text-sm text-slate-500">
            Ingreso rápido por patente, cobro de estadías y monitoreo de vehículos activos
          </p>
        </div>
      </div>

      <MovimientosManager userRole={user.rol} />
    </div>
  );
}
