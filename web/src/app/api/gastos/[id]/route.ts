import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth/guards";
import { getPool } from "@/lib/db";
import { obtenerGasto, actualizarGasto, eliminarGasto } from "@/lib/gastos";
import { errorResponse, clientIp, ApiError } from "@/lib/http";
import { gastoUpdateSchema } from "@/lib/validations/gastos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiUser(["admin", "operador", "contador"], "fiscal.read");

    const { id } = await params;
    const gastoId = parseInt(id, 10);

    if (isNaN(gastoId)) {
      throw new ApiError(400, "INVALID_ID", "ID inválido");
    }

    const pool = getPool();
    const gasto = await obtenerGasto(pool, gastoId);

    if (!gasto) {
      throw new ApiError(404, "NOT_FOUND", "Gasto no encontrado");
    }

    return Response.json({ data: gasto });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser(["admin", "operador", "contador"], "fiscal.write");

    const { id } = await params;
    const gastoId = parseInt(id, 10);

    if (isNaN(gastoId)) {
      throw new ApiError(400, "INVALID_ID", "ID inválido");
    }

    const body = await request.json();
    const parsed = gastoUpdateSchema.safeParse({ ...body, id: gastoId });

    if (!parsed.success) {
      return Response.json(
        {
          error: "Datos inválidos",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    // Convert undefined to null for optional fields
    const { id: _, ...datosRaw } = parsed.data;
    const datos = {
      ...datosRaw,
      cuit_proveedor: datosRaw.cuit_proveedor ?? null,
      punto_venta: datosRaw.punto_venta ?? null,
      numero_comprobante: datosRaw.numero_comprobante ?? null,
      categoria_id: datosRaw.categoria_id ?? null,
      forma_pago: datosRaw.forma_pago ?? null,
      notas: datosRaw.notas ?? null,
    };

    const pool = getPool();
    const gasto = await actualizarGasto(pool, gastoId, datos, {
      usuarioId: user.id,
      ip: clientIp(request),
    });

    return Response.json({ success: true, data: gasto, message: "Gasto actualizado" });
  } catch (error) {
    if (error instanceof Error && error.message.includes("duplicate key")) {
      return Response.json(
        { error: "Ya existe un comprobante con ese tipo, punto de venta, número y proveedor", code: "GASTO_DUPLICADO" },
        { status: 409 },
      );
    }
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireApiUser(["admin"], "fiscal.write");

    const { id } = await params;
    const gastoId = parseInt(id, 10);

    if (isNaN(gastoId)) {
      throw new ApiError(400, "INVALID_ID", "ID inválido");
    }

    const pool = getPool();
    await eliminarGasto(pool, gastoId, { usuarioId: user.id });

    return Response.json({ success: true, message: "Gasto eliminado" });
  } catch (error) {
    return errorResponse(error);
  }
}