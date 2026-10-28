import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestión Estacionamiento",
  description:
    "Sistema de gestión de estacionamiento con control de usuarios y roles.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
