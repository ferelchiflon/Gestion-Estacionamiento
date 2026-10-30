import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { crearGasto, listarGastos, totalesGastos } from "@/lib/gastos";
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