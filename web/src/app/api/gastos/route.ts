import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { crearGasto, listarGastos, totalesGastos } from "@/lib/gastos";
import { csvResponse } from "@/lib/csv";
import { errorResponse, ApiError, clientIp } from "@/lib/http";
import { gastoCreateSchema, gastoQuerySchema } from "@/lib/validations/gastos";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "fiscal.read");

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = gastoQuerySchema.safeParse(searchParams);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Parámetros inválidos", parsed.error.issues);
    }

    const pool = getPool();
    // Export CSV del listado filtrado (referencia interna, no formato oficial).
    // Ignora paginación: exporta todas las filas que matchean los filtros (tope 10.000).
    if (searchParams.export === "csv") {
      const [csvResult] = await Promise.all([
        listarGastos(pool, {
          ...parsed.data,
          limit: 10000,
          offset: 0,
        }),
      ]);

      return csvResponse(
        `gastos_${new Date().toISOString().slice(0, 10)}.csv`,
        [
          "Fecha",
          "Proveedor",
          "CUIT",
          "Tipo comprobante",
          "Punto venta",
          "Número",
          "Neto gravado",
          "IVA 21",
          "IVA 10,5",
          "IVA 27",
          "No gravado",
          "Percepción IVA",
          "Percepción IIBB",
          "Total",
          "Categoría",
          "Forma de pago",
          "Notas",
        ],
        csvResult.data.map((g) => [
          new Date(g.fecha).toISOString().slice(0, 10),
          g.proveedor,
          g.cuit_proveedor ?? "",
          g.tipo_comprobante,
          g.punto_venta ?? "",
          g.numero_comprobante ?? "",
          g.neto_gravado,
          g.iva_21,
          g.iva_105,
          g.iva_27,
          g.no_gravado,
          g.percepcion_iva,
          g.percepcion_iibb,
          g.total,
          g.categoria_nombre ?? "",
          g.forma_pago ?? "",
          g.notas ?? "",
        ]),
      );
    }

    const [dataResult, totales] = await Promise.all([
      listarGastos(pool, { ...parsed.data, limit: parsed.data.limit, offset: (parsed.data.page - 1) * parsed.data.limit }),
      totalesGastos(pool, parsed.data),
    ]);

    return Response.json({
      data: dataResult.data,
      totales,
      pagination: {
        page: parsed.data.page,
        limit: parsed.data.limit,
        total: dataResult.total,
        totalPages: Math.ceil(dataResult.total / parsed.data.limit) || 1,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser(["admin", "operador", "contador"], "fiscal.write");

    const body = await request.json();
    const parsed = gastoCreateSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(400, "VALIDATION_ERROR", "Datos inválidos", parsed.error.issues);
    }

    // Convert undefined to null for optional fields
    const datos = {
      ...parsed.data,
      cuit_proveedor: parsed.data.cuit_proveedor ?? null,
      punto_venta: parsed.data.punto_venta ?? null,
      numero_comprobante: parsed.data.numero_comprobante ?? null,
      categoria_id: parsed.data.categoria_id ?? null,
      forma_pago: parsed.data.forma_pago ?? null,
      notas: parsed.data.notas ?? null,
    };

    const pool = getPool();
    const gasto = await crearGasto(pool, datos, {
      usuarioId: user.id,
      ip: clientIp(request),
    });

    return Response.json({ success: true, data: gasto, message: "Gasto registrado" }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}