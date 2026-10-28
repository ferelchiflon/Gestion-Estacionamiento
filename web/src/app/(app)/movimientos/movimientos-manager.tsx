"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  LogIn,
  LogOut,
  AlertCircle,
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight,
  SquareParking,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { Rol } from "@/lib/permissions";
import { normalizarPatente, formatMoneySign, formatFechaHora } from "@/lib/format";
import { TIPOS_VEHICULO, type TipoVehiculo } from "@/lib/validations/modulo2";
import { FORMAS_PAGO, type FormaPago } from "@/lib/validations/modulo4";

type Movimiento = {
  id: number;
  patente: string;
  plaza_id: number;
  plaza_numero: string;
  plaza_sector: string;
  hora_entrada: string;
  hora_salida: string | null;
  monto_calculado: number | string;
  monto_pagado: number | string;
  estado_pago: "pendiente" | "pagado" | "deuda";
  forma_pago: string | null;
  vehiculo_tipo: TipoVehiculo | null;
  vehiculo_marca: string | null;
  vehiculo_modelo: string | null;
  cliente_id: number | null;
  cliente_nombre: string | null;
  cliente_saldo: number | string | null;
  recibo_id: number | null;
  recibo_numero: number | null;
  // Campos calculados por el servidor para activos
  tiempo_transcurrido_minutos?: number;
  horas_estimadas?: number;
  monto_estimado?: number;
  tarifa_hora_aplicada?: number;
};

type PlazaLibre = {
  id: number;
  numero: string;
  sector: string;
  tipo_vehiculo: TipoVehiculo;
};

type VehiculoLookup = {
  exists: boolean;
  patente: string;
  tipo?: TipoVehiculo;
  marca?: string | null;
  modelo?: string | null;
  color?: string | null;
  cliente_id?: number | null;
  cliente_nombre?: string | null;
  tiene_deuda: boolean;
  monto_deuda: number;
};

export default function MovimientosManager({ userRole }: { userRole: Rol }) {
  const [tab, setTab] = useState<"activos" | "historial">("activos");
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Plazas libres para el ingreso
  const [plazasLibres, setPlazasLibres] = useState<PlazaLibre[]>([]);

  // Modal Ingreso Rápido
  const [modalIngresoOpen, setModalIngresoOpen] = useState(false);
  const [patenteInput, setPatenteInput] = useState("");
  const [vehiculoInfo, setVehiculoInfo] = useState<VehiculoLookup | null>(null);
  const [selectedPlazaId, setSelectedPlazaId] = useState<string>("");
  const [tipoVehiculoSelect, setTipoVehiculoSelect] = useState<TipoVehiculo>("auto");
  const [ingresoError, setIngresoError] = useState<string | null>(null);

  // Modal Cobro / Salida
  const [modalCobroOpen, setModalCobroOpen] = useState(false);
  const [selectedMovimiento, setSelectedMovimiento] = useState<Movimiento | null>(null);
  const [formaPago, setFormaPago] = useState<FormaPago>("efectivo");
  const [registrarComoDeuda, setRegistrarComoDeuda] = useState(false);
  const [cobroError, setCobroError] = useState<string | null>(null);
  const [reciboGenerado, setReciboGenerado] = useState<{ id: number; numero: number } | null>(null);

  const [isPending, startTransition] = useTransition();
  const canWrite = userRole === "admin" || userRole === "operador";

  // Cargar movimientos
  const fetchMovimientos = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
        activos_only: String(tab === "activos"),
      });

      if (search.trim()) params.set("q", search.trim());
      if (tab === "historial") {
        if (fechaDesde) params.set("fecha_desde", fechaDesde);
        if (fechaHasta) params.set("fecha_hasta", fechaHasta);
      }

      const res = await fetch(`/api/movimientos?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudo cargar la lista de movimientos");

      const json = await res.json();
      setMovimientos(json.data);
      setPagination(json.pagination);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [tab, search, fechaDesde, fechaHasta]);

  useEffect(() => {
    fetchMovimientos(1);
  }, [fetchMovimientos]);

  // Cargar plazas libres al abrir modal de ingreso
  const fetchPlazasLibres = useCallback(async () => {
    try {
      const res = await fetch("/api/plazas?estado=libre");
      if (res.ok) {
        const json = await res.json();
        setPlazasLibres(json.data);
        if (json.data.length > 0 && !selectedPlazaId) {
          setSelectedPlazaId(String(json.data[0].id));
        }
      }
    } catch {}
  }, [selectedPlazaId]);

  useEffect(() => {
    if (modalIngresoOpen) {
      fetchPlazasLibres();
    }
  }, [modalIngresoOpen, fetchPlazasLibres]);

  // Búsqueda y autocompletado en vivo de patente
  useEffect(() => {
    const norm = normalizarPatente(patenteInput);
    if (norm.length >= 3) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/vehiculos/buscar?patente=${norm}`);
          if (res.ok) {
            const data: VehiculoLookup = await res.json();
            setVehiculoInfo(data);
            if (data.exists && data.tipo) {
              setTipoVehiculoSelect(data.tipo);
            }
          }
        } catch {}
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setVehiculoInfo(null);
    }
  }, [patenteInput]);

  function handleOpenIngreso() {
    setPatenteInput("");
    setVehiculoInfo(null);
    setTipoVehiculoSelect("auto");
    setIngresoError(null);
    setModalIngresoOpen(true);
  }

  function handleOpenCobro(mov: Movimiento) {
    setSelectedMovimiento(mov);
    setFormaPago("efectivo");
    setRegistrarComoDeuda(false);
    setCobroError(null);
    setReciboGenerado(null);
    setModalCobroOpen(true);
  }

  async function handleSubmitIngreso(e: React.FormEvent) {
    e.preventDefault();
    setIngresoError(null);

    const norm = normalizarPatente(patenteInput);
    if (!norm) {
      setIngresoError("Ingrese una patente válida");
      return;
    }
    if (!selectedPlazaId) {
      setIngresoError("Seleccione una plaza disponible");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/movimientos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: window.location.origin,
          },
          body: JSON.stringify({
            patente: norm,
            plaza_id: Number(selectedPlazaId),
            tipo_vehiculo: tipoVehiculoSelect,
            cliente_id: vehiculoInfo?.cliente_id || null,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Error al registrar ingreso");
        }

        setModalIngresoOpen(false);
        fetchMovimientos(1);
      } catch (err: unknown) {
        setIngresoError(err instanceof Error ? err.message : "Error al registrar ingreso");
      }
    });
  }

  async function handleSubmitCobro(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedMovimiento) return;
    setCobroError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/movimientos/egreso", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: window.location.origin,
          },
          body: JSON.stringify({
            movimiento_id: selectedMovimiento.id,
            forma_pago: formaPago,
            registrar_como_deuda: registrarComoDeuda,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error || "Error al registrar salida y cobro");
        }

        if (json.recibo) {
          setReciboGenerado({ id: json.recibo.id, numero: json.recibo.numero });
        } else {
          // Si fue salida con deuda
          setModalCobroOpen(false);
          fetchMovimientos(pagination.page);
        }
      } catch (err: unknown) {
        setCobroError(err instanceof Error ? err.message : "Error al registrar cobro");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Pestañas y Botón Ingreso Rápido */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("activos")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              tab === "activos"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Vehículos Activos (Estacionados)
          </button>
          <button
            type="button"
            onClick={() => setTab("historial")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              tab === "historial"
                ? "bg-teal-700 text-white shadow-xs"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Historial de Movimientos
          </button>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={handleOpenIngreso}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-teal-800 transition-all"
          >
            <LogIn size={18} />
            Ingreso Rápido (Barrera)
          </button>
        )}
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por patente, cliente o cochera..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-900 focus:border-teal-600 focus:outline-hidden"
          />
        </div>

        {tab === "historial" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="rounded-lg border border-slate-300 p-1.5 text-xs text-slate-700"
              title="Fecha desde"
            />
            <span className="text-xs text-slate-400">a</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="rounded-lg border border-slate-300 p-1.5 text-xs text-slate-700"
              title="Fecha hasta"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Tabla de Movimientos */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Patente</th>
                <th className="px-4 py-3">Plaza</th>
                <th className="px-4 py-3">Ingreso</th>
                {tab === "activos" ? (
                  <>
                    <th className="px-4 py-3">Tiempo Transcurrido</th>
                    <th className="px-4 py-3 text-right">Monto Estimado</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3">Egreso</th>
                    <th className="px-4 py-3 text-right">Monto Cobrado</th>
                    <th className="px-4 py-3 text-center">Estado Pago</th>
                  </>
                )}
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Cargando movimientos...
                  </td>
                </tr>
              ) : movimientos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {tab === "activos"
                      ? "No hay vehículos estacionados actualmente"
                      : "No se encontraron movimientos registrados"}
                  </td>
                </tr>
              ) : (
                movimientos.map((m) => {
                  const minutos = m.tiempo_transcurrido_minutos ?? 0;
                  const horasDisplay = Math.floor(minutos / 60);
                  const minsDisplay = minutos % 60;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <span className="font-mono text-base font-black tracking-wider text-slate-900">
                          {m.patente}
                        </span>
                        <div className="text-2xs text-slate-400 capitalize">
                          {m.vehiculo_tipo || "Auto"} {m.cliente_nombre ? `· ${m.cliente_nombre}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                          <SquareParking size={14} className="text-teal-700" />
                          {m.plaza_numero} <span className="text-slate-400 font-normal">({m.plaza_sector})</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatFechaHora(m.hora_entrada)}
                      </td>

                      {tab === "activos" ? (
                        <>
                          <td className="px-4 py-3 text-xs">
                            <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                              <Clock size={13} className="text-amber-500" />
                              {horasDisplay}h {minsDisplay}m
                            </span>
                            <div className="text-2xs text-slate-400">
                              Cobra: {m.horas_estimadas}h (@ {formatMoneySign(m.tarifa_hora_aplicada)}/h)
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-base font-bold text-slate-900">
                            {formatMoneySign(m.monto_estimado)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {m.hora_salida ? formatFechaHora(m.hora_salida) : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-900">
                            {formatMoneySign(m.monto_pagado)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-2xs font-bold uppercase ${
                                m.estado_pago === "pagado"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : m.estado_pago === "deuda"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {m.estado_pago}
                            </span>
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3 text-right">
                        {tab === "activos" && canWrite ? (
                          <button
                            type="button"
                            onClick={() => handleOpenCobro(m)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                          >
                            <LogOut size={13} />
                            Cobrar y Salida
                          </button>
                        ) : m.recibo_id ? (
                          <Link
                            href={`/recibos/${m.recibo_id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Printer size={13} />
                            Ticket #{m.recibo_numero}
                          </Link>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <span>
              Total: <strong>{pagination.total}</strong> movimientos (Pág. {pagination.page} de {pagination.totalPages})
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => fetchMovimientos(pagination.page - 1)}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchMovimientos(pagination.page + 1)}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Ingreso Rápido */}
      {modalIngresoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="rounded-lg bg-teal-100 p-2 text-teal-800">
                <LogIn size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Ingreso de Vehículo
                </h2>
                <p className="text-xs text-slate-500">
                  Registro atómico de entrada en cochera
                </p>
              </div>
            </div>

            {ingresoError && (
              <div className="my-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                {ingresoError}
              </div>
            )}

            <form onSubmit={handleSubmitIngreso} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Patente / Dominio *
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  maxLength={10}
                  value={patenteInput}
                  onChange={(e) => setPatenteInput(e.target.value.toUpperCase())}
                  className="mt-1 w-full font-mono text-2xl font-black uppercase tracking-widest text-slate-900 rounded-xl border border-slate-300 p-3 text-center focus:border-teal-600 focus:outline-hidden"
                  placeholder="AA123CD"
                />
              </div>

              {/* Tarjeta de reconocimiento de vehículo/cliente */}
              {vehiculoInfo && (
                <div
                  className={`rounded-xl border p-3 text-xs transition-all ${
                    vehiculoInfo.tiene_deuda
                      ? "border-red-200 bg-red-50 text-red-900"
                      : vehiculoInfo.exists
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">
                      {vehiculoInfo.exists
                        ? `Vehículo Registrado (${vehiculoInfo.marca || ""} ${vehiculoInfo.modelo || ""})`
                        : "Vehículo No Registrado (Ocasional)"}
                    </span>
                    {vehiculoInfo.cliente_nombre && (
                      <span className="font-semibold">
                        Cliente: {vehiculoInfo.cliente_nombre}
                      </span>
                    )}
                  </div>

                  {vehiculoInfo.tiene_deuda && (
                    <div className="mt-1 flex items-center gap-1 font-bold text-red-700">
                      <AlertTriangle size={14} />
                      ¡ATENCIÓN! Registra deuda pendiente de{" "}
                      {formatMoneySign(vehiculoInfo.monto_deuda)}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tipo de Vehículo *
                  </label>
                  <select
                    value={tipoVehiculoSelect}
                    onChange={(e) => setTipoVehiculoSelect(e.target.value as TipoVehiculo)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden capitalize"
                  >
                    {TIPOS_VEHICULO.map((t) => (
                      <option key={t} value={t} className="capitalize">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Plaza Libre Disponible *
                  </label>
                  <select
                    required
                    value={selectedPlazaId}
                    onChange={(e) => setSelectedPlazaId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-600 focus:outline-hidden"
                  >
                    {plazasLibres.length === 0 ? (
                      <option value="">No hay plazas libres</option>
                    ) : (
                      plazasLibres.map((p) => (
                        <option key={p.id} value={p.id}>
                          Plaza {p.numero} (Sector {p.sector} · {p.tipo_vehiculo})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => setModalIngresoOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || plazasLibres.length === 0}
                  className="rounded-xl bg-teal-700 px-5 py-2 text-sm font-bold text-white shadow-xs hover:bg-teal-800 disabled:opacity-50"
                >
                  {isPending ? "Registrando..." : "Confirmar Ingreso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cobro y Egreso */}
      {modalCobroOpen && selectedMovimiento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            {reciboGenerado ? (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    ¡Cobro y Salida Registrados!
                  </h3>
                  <p className="text-sm text-slate-500 font-mono">
                    Recibo N° {String(reciboGenerado.numero).padStart(6, "0")}
                  </p>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <Link
                    href={`/recibos/${reciboGenerado.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-teal-800"
                  >
                    <Printer size={16} />
                    Ver / Imprimir Ticket
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setModalCobroOpen(false);
                      fetchMovimientos(pagination.page);
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-800">
                    <LogOut size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Liquidación de Estadía y Salida
                    </h2>
                    <p className="text-xs text-slate-500 font-mono">
                      Patente: {selectedMovimiento.patente} · Cochera {selectedMovimiento.plaza_numero}
                    </p>
                  </div>
                </div>

                {cobroError && (
                  <div className="my-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                    {cobroError}
                  </div>
                )}

                <form onSubmit={handleSubmitCobro} className="mt-4 space-y-4">
                  {/* Resumen de cobro en tarjeta destacada */}
                  <div className="rounded-xl bg-slate-900 p-4 text-white space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Ingreso: {formatFechaHora(selectedMovimiento.hora_entrada)}</span>
                      <span>Horas a facturar: {selectedMovimiento.horas_estimadas}h</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                        Total a Cobrar
                      </span>
                      <span className="font-mono text-3xl font-black text-emerald-400">
                        {formatMoneySign(selectedMovimiento.monto_estimado)}
                      </span>
                    </div>
                  </div>

                  {/* Forma de Pago */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Forma de Pago *
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {FORMAS_PAGO.map((fp) => (
                        <button
                          key={fp}
                          type="button"
                          onClick={() => {
                            setFormaPago(fp);
                            setRegistrarComoDeuda(false);
                          }}
                          className={`rounded-lg border p-2 text-xs font-bold capitalize transition-all ${
                            formaPago === fp && !registrarComoDeuda
                              ? "border-teal-700 bg-teal-50 text-teal-800"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {fp.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Opción Salida con Deuda */}
                  {selectedMovimiento.cliente_id && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-semibold text-amber-900">
                        <input
                          type="checkbox"
                          checked={registrarComoDeuda}
                          onChange={(e) => setRegistrarComoDeuda(e.target.checked)}
                          className="rounded text-amber-600"
                        />
                        <span>Registrar como deuda para cliente ({selectedMovimiento.cliente_nombre})</span>
                      </label>
                      <p className="mt-1 text-2xs text-amber-700">
                        El vehículo saldrá sin cobro y se generará una deuda con vencimiento a 7 días.
                      </p>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setModalCobroOpen(false)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isPending ? "Procesando..." : "Confirmar Cobro y Abrir Barrera"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
