import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ApiError, errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const usuario = await getCurrentUser();
    if (!usuario) {
      throw new ApiError(401, "UNAUTHENTICATED", "Sesión requerida");
    }
    return NextResponse.json({ user: usuario });
  } catch (error) {
    return errorResponse(error);
  }
}
