import { Suspense } from "react";
import CambiarMiClaveForm from "./cambiar-mi-clave-form";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CambiarMiClavePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Suspense fallback={<div className="w-full max-w-md" />}>
        <CambiarMiClaveForm />
      </Suspense>
    </main>
  );
}