import { requirePageUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { ShieldAlert, TrendingUp, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BotAdminPage() {
  await requirePageUser(["admin"], "auditoria.read");

  const pool = await getPool();

  const [stats, sinRespuesta, frecuentes, noUtiles, utilesPorTema] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE util = 'si')::int AS utiles,
        COUNT(*) FILTER (WHERE util = 'no')::int AS no_utiles,
        COUNT(*) FILTER (WHERE sin_respuesta)::int AS sin_respuesta
      FROM bot_conversaciones
    `),
    pool.query(`
      SELECT id, pregunta, fecha, pantalla, puntaje
      FROM bot_conversaciones
      WHERE sin_respuesta
      ORDER BY fecha DESC
      LIMIT 50
    `),
    pool.query(`
      SELECT import os
c Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Ccontent :ic Cco_ver_contratos', 'contratos'),
          ('ct_pagar_cuota', 'contratos'),
          ('de_ver_deudas', 'deudas'),
          ('de_marcar_pagada', 'deudas'),
          ('ga_cargar_gasto', 'gastos'),
          ('imp_iva_basico', 'impuestos'),
          ('imp_arca', 'impuestos'),
          ('imp_iibb', 'impuestos'),
          ('imp_balance', 'impuestos'),
          ('imp_mensual', 'impuestos'),
          ('cfg_fiscal', 'configuracion'),
          ('cfg_tarifas', 'configuracion')
        ) AS kb(id, modulo)
      ) kb ON bot_conversaciones.entrada_id = kb.id
      GROUP BY modulo
      ORDER BY modulo
    `),
  ]);

  const kbVersion = "2026-10-22";
  const kbTotal = 20;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asistente · Base de conocimiento</h1>
          <p className="text-sm text-slate-500">v{kbVersion} · {kbTotal} entradas · Panel de mejora continua</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total conversaciones" value={stats.rows[0]?.total ?? 0} icon={<MessageSquare className="text-slate-600" size={20} />} />
        <StatCard label="Útiles" value={stats.rows[0]?.utiles ?? 0} icon={<ThumbsUp className="text-green-600" size={20} />} />
        <StatCard label="No útiles" value={stats.rows[0]?.no_utiles ?? 0} icon={<ThumbsDown className="text-red-600" size={20} />} />
        <StatCard label="Sin respuesta" value={stats.rows[0]?.sin_respuesta ?? 0} icon={<ShieldAlert className="text-amber-600" size={20} />} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900 flex items-center justify-between">
          <span>Preguntas sin respuesta ({sinRespuesta.rows.length})</span>
        </div>
        {sinRespuesta.rows.length === 0 ? (
          <div className="p-4 text-center text-slate-500">¡Todo respondido! 🎉</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pregunta</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pantalla</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Puntaje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sinRespuesta.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(r.fecha).toLocaleString("es-AR")}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 max-w-md truncate">{r.pregunta}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{r.pantalla ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-500">{r.puntaje ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Entradas más consultadas ({frecuentes.rows.length})</div>
        {frecuentes.rows.length === 0 ? (
          <div className="p-4 text-center text-slate-500">Sin datos aún</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Entrada ID</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Frecuencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {frecuentes.rows.map((r) => (
                  <tr key={r.entrada_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{r.entrada_id}</td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700">{r.frecuencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Marcadas como "No útil" ({noUtiles.rows.length})</div>
        {noUtiles.rows.length === 0 ? (
          <div className="p-4 text-center text-slate-500">Ninguna por ahora 👍</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Pregunta</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Respuesta dada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {noUtiles.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-600">{new Date(r.fecha).toLocaleString("es-AR")}</td>
                    <td className="px-4 py-3 text-sm text-slate-900 max-w-md truncate">{r.pregunta}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-md truncate">{r.respuesta ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-semibold text-slate-900">Utilidad por tema ({utilesPorTema.rows.length})</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Módulo</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Útiles</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">No útiles</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Sin respuesta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {utilesPorTema.rows.map((r) => (
                <tr key={r.modulo} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 capitalize">{r.modulo}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-700">{r.total}</td>
                  <td className="px-4 py-3 text-right text-sm text-green-700">{r.utiles}</td>
                  <td className="px-4 py-3 text-right text-sm text-red-700">{r.no_utiles}</td>
                  <td className="px-4 py-3 text-right text-sm text-amber-700">{r.sin_respuesta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
        <p className="text-sm text-slate-600">
          <strong>Versión KB:</strong> 2026-10-22 &nbsp;·&nbsp; <strong>Entradas totales:</strong> 20
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">{icon}</div>
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}
