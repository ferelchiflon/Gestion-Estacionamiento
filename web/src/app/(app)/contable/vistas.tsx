import { formatMoneySign } from "@/lib/format";
import type {
  ReporteIvaCompras,
  ReporteIvaVentas,
  ReportePosicionIva,
} from "@/lib/contable";

/**
 * Vistas del módulo contable de REFERENCIA INTERNA.
 * Todas comparten los mismos formatos y el encabezado de advertencia.
 */

export function Advertencias({ advertencias }: { advertencias: string[] }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100 px-4 py-2 text-xs text-slate-600">
        {advertencias.map((advertencia) => (
          <li key={advertencia} className="py-1">
            • {advertencia}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Tarjeta({
  titulo,
  valor,
  color = "text-slate-900",
}: {
  titulo: string;
  valor: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{valor}</p>
    </div>
  );
}

export function VistaVentas({ reporte }: { reporte: ReporteIvaVentas }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tarjeta titulo="Operaciones" valor={reporte.totales.operaciones} />
        <Tarjeta titulo="Neto" valor={formatMoneySign(reporte.totales.neto)} />
        <Tarjeta titulo="IVA" valor={formatMoneySign(reporte.totales.iva)} color="text-blue-600" />
        <Tarjeta
          titulo="Total"
          valor={formatMoneySign(reporte.totales.total)}
          color="text-emerald-600"
        />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-semibold text-amber-900">
          Alícuota general aplicada: {reporte.alicuota_general}% — el sistema no discrimina la
          alícuota por operación
        </p>
      </div>

      <Advertencias advertencias={reporte.advertencias} />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Totales por alícuota</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Alícuota</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Operaciones</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Neto</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">IVA</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.totales_por_alicuota.map((fila) => (
                <tr key={fila.alicuota}>
                  <td className="px-4 py-2 text-sm font-medium text-slate-900">{fila.alicuota}%</td>
                  <td className="px-4 py-2 text-sm text-right text-slate-700">{fila.operaciones}</td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-slate-700">
                    {formatMoneySign(fila.neto)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                    {formatMoneySign(fila.iva)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono font-semibold text-slate-900">
                    {formatMoneySign(fila.total)}
                  </td>
                </tr>
              ))}
              {reporte.totales_por_alicuota.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay ingresos con comprobante en el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Detalle por operación</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Fecha</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Tipo</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Detalle</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Cliente</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Recibo</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Neto</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">IVA</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.operaciones.map((op) => (
                <tr key={op.recibo_id}>
                  <td className="px-4 py-2 text-sm text-slate-700">{op.fecha}</td>
                  <td className="px-4 py-2 text-sm">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {op.tipo === "movimiento" ? "Estacionamiento" : "Alquiler"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-700">{op.detalle}</td>
                  <td className="px-4 py-2 text-sm text-slate-700">{op.cliente ?? "—"}</td>
                  <td className="px-4 py-2 text-sm font-mono text-slate-600">
                    {String(op.recibo_numero).padStart(6, "0")}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-slate-700">
                    {formatMoneySign(op.neto)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                    {formatMoneySign(op.iva)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono font-semibold text-slate-900">
                    {formatMoneySign(op.monto_total)}
                  </td>
                </tr>
              ))}
              {reporte.operaciones.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay operaciones con comprobante en el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


export function VistaCompras({ reporte }: { reporte: ReporteIvaCompras }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tarjeta titulo="Comprobantes" valor={reporte.totales.comprobantes} />
        <Tarjeta titulo="Neto gravado" valor={formatMoneySign(reporte.totales.neto_gravado)} />
        <Tarjeta titulo="IVA" valor={formatMoneySign(reporte.totales.iva)} color="text-blue-600" />
        <Tarjeta
          titulo="Total"
          valor={formatMoneySign(reporte.totales.total)}
          color="text-emerald-600"
        />
      </div>

      <Advertencias advertencias={reporte.advertencias} />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Totales por alícuota</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Alícuota</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Comprobantes</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">IVA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.totales_por_alicuota.map((fila) => (
                <tr key={fila.alicuota}>
                  <td className="px-4 py-2 text-sm font-medium text-slate-900">{fila.alicuota}%</td>
                  <td className="px-4 py-2 text-sm text-right text-slate-700">{fila.comprobantes}</td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                    {formatMoneySign(fila.iva)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Detalle por comprobante</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Fecha</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Proveedor</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Comprobante</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Neto</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">IVA 21</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">IVA 10,5</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">IVA 27</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.comprobantes.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm text-slate-700">{c.fecha}</td>
                  <td className="px-4 py-2 text-sm text-slate-700">
                    {c.proveedor}
                    {c.cuit_proveedor && (
                      <span className="block text-xs text-slate-400">{c.cuit_proveedor}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-600">
                    {c.tipo_comprobante}
                    {c.numero_comprobante && (
                      <span className="block font-mono text-xs text-slate-400">
                        {c.punto_venta ? `${String(c.punto_venta).padStart(5, "0")}-` : ""}
                        {String(c.numero_comprobante).padStart(8, "0")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-slate-700">
                    {formatMoneySign(c.neto_gravado)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                    {formatMoneySign(c.iva_21)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                    {formatMoneySign(c.iva_105)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                    {formatMoneySign(c.iva_27)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono font-semibold text-slate-900">
                    {formatMoneySign(c.total)}
                  </td>
                </tr>
              ))}
              {reporte.comprobantes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay comprobantes de compra en el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


export function VistaPosicion({ reporte }: { reporte: ReportePosicionIva }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-medium text-slate-500">
          Saldo del período (IVA ventas - IVA compras - percepciones)
        </p>
        <p
          className={`mt-1 text-4xl font-bold ${
            reporte.estado_total === "a_favor"
              ? "text-emerald-600"
              : reporte.estado_total === "a_pagar"
                ? "text-red-600"
                : "text-slate-900"
          }`}
        >
          {formatMoneySign(reporte.saldo_total)}
        </p>
        <p className="mt-1 text-sm text-slate-500">{etiquetaEstado(reporte.estado_total)}</p>
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Solo como referencia: el saldo no implica un pago automático ni reemplaza la
          liquidación que realiza el contador.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Tarjeta
          titulo="IVA ventas"
          valor={formatMoneySign(reporte.totales_ventas.iva)}
          color="text-blue-600"
        />
        <Tarjeta
          titulo="IVA compras"
          valor={formatMoneySign(reporte.totales_compras.iva)}
          color="text-blue-600"
        />
        <Tarjeta titulo="Percepciones IVA" valor={formatMoneySign(reporte.percepciones_iva)} />
        <Tarjeta
          titulo="Total ventas"
          valor={formatMoneySign(reporte.totales_ventas.total)}
          color="text-emerald-600"
        />
      </div>

      <Advertencias advertencias={reporte.advertencias} />

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Saldo por alícuota (referencia)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Alícuota</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">IVA ventas</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">IVA compras</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Saldo</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reporte.filas.map((fila) => (
                <tr key={fila.alicuota}>
                  <td className="px-4 py-2 text-sm font-medium text-slate-900">{fila.alicuota}%</td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                    {formatMoneySign(fila.iva_ventas)}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-blue-600">
                    {formatMoneySign(fila.iva_compras)}
                  </td>
                  <td
                    className={`px-4 py-2 text-sm text-right font-mono font-semibold ${
                      fila.estado === "a_favor"
                        ? "text-emerald-600"
                        : fila.estado === "a_pagar"
                          ? "text-red-600"
                          : "text-slate-900"
                    }`}
                  >
                    {formatMoneySign(fila.saldo)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {etiquetaEstado(fila.estado)}
                    </span>
                  </td>
                </tr>
              ))}
              {reporte.filas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No hay IVA registrado en el período seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function etiquetaEstado(estado: string): string {
  if (estado === "a_pagar") return "A pagar (referencia)";
  if (estado === "a_favor") return "A favor (referencia)";
  return "En equilibrio";
}

