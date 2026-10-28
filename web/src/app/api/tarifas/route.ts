import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { auditar } from "@/lib/audit";
import {
  tarifaCreateSchema,
} from "@/lib/validations/modulo3";
import {
  obtenerTarifaVigente,
  verificarSolapamientoTarifa,
} from "@/lib/tarifas";
import {
  errorResponse,
  assertSameOrigin,
  clientIp,
  ApiError,
} from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "tarifas.read");

    const searchParams = request.nextUrl.searchParams;
    const tipo = searchParams.get("tipo");
    const vigentesOnly = searchParams.get("vigentes") === "true";

    const pool = getPool();

    if (tipo && vigentesOnly) {
      const tarifaVigente = await obtenerTarifaVigente(tipo as Parameters<typeof obtenerTarifaVigente>[0]);
      return Response.json(tarifaVigente);
    }

    const conditions: string[] = ["eliminado_en IS NULL"];
    const params: unknown[] = [];

    if (tipo) {
      params.push(tipo);
      conditions.push(`tipo_vehiculo = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT 
        id,
        tipo_vehiculo,
        tarifa_hora::numeric(14,2) AS tarifa_hora,
        to_char(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
        to_char(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta,
        CASE 
          WHEN fecha_desde <= CURRENT_DATE AND (fecha_hasta IS NULL OR fecha_hasta >= CURRENT_DATE)
          THEN true 
          ELSE false 
        END AS es_vigente
      FROM tarifas
      ${whereClause}
      ORDER BY tipo_vehiculo ASC, fecha_desde DESC
    `;

    const res = await pool.query(sql, params);
    return Response.json({ data: res.rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser(["admin"], "tarifas.write");

    const body = await request.json();
    const data = tarifaCreateSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Validar solapamiento de rangos de fechas
      const solapa = await verificarSolapamientoTarifa(
        data.tipo_vehiculo,
        data.fecha_desde,
        data.fecha_hasta,
        undefined,
        client
      );

      if (solapa) {
        throw new ApiError(
          409,
          "TARIFA_SOLAPADA",
          `Ya existe una tarifa para ${data.tipo_vehiculo} que se solapa con el rango de fechas indicado`
        );
      }

      // 2. Insertar tarifa
      const insertRes = await client.query(
        `INSERT INTO tarifas (tipo_vehiculo, tarifa_hora, fecha_desde, fecha_hasta)
         VALUES ($1, $2, $3, $4)
         RETURNING id, tipo_vehiculo, tarifa_hora::numeric(14,2), to_char(fecha_desde, 'YYYY-MM-DD') as fecha_desde, to_char(fecha_hasta, 'YYYY-MM-DD') as fecha_hasta`,
        [
          data.tipo_vehiculo,
          data.tarifa_hora,
          data.fecha_desde,
          data.fecha_hasta || null,
        ]
      );

      const nuevaTarifa = insertRes.rows[0];

      await auditar(client, {
        usuarioId: user.id,
        accion: "INSERT",
        tabla: "tarifas",
        registroId: nuevaTarifa.id,
        despues: nuevaTarifa,
        ip: clientIp(request),
      });

      await client.query("COMMIT");

      return Response.json(nuevaTarifa, { status: 201 });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return errorResponse(error);
  }
}
