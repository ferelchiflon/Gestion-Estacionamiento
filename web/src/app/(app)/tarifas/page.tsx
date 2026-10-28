import { requirePageUser } from "@/lib/auth/guards";
import TarifasManager from "./tarifas-manager";

export const dynamic = "force-dynamic";

export default async function TarifasPage() {
  const user = await requirePageUser(
    ["admin", "operador", "contador"],
    "tarifas.read"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tarifas y Vigencias
          </h1>
          <p className="text-sm text-slate-500">
            Esquemas de precios por hora para cada tipo de vehículo según rango de fechas
          </p>
        </div>
      </div>

      <TarifasManager userRole={user.rol} />
    </div>
  );
}
