import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ModoSinConexion from "@/components/ModoSinConexion";
import DialogoHost from "@/components/Dialogo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Porcícola El Mirador",
  description: "Gestión de producción porcina",
  // Al instalarla en la pantalla de inicio del iPhone:
  // barra de estado blanca con texto oscuro (coincide con el fondo blanco).
  appleWebApp: {
    capable: true,
    title: "El Mirador",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // El contenido llega hasta los bordes (isla dinámica incluida);
  // cada página respeta env(safe-area-inset-*).
  viewportFit: "cover",
  // Color inicial de la zona de la isla dinámica; cada página lo actualiza.
  themeColor: "#ffffff",
  colorScheme: "only light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-white antialiased`}
      style={{ backgroundColor: "#ffffff" }}
    >
      <body className="min-h-full flex flex-col bg-white">
        <ModoSinConexion />
        <DialogoHost />
        {children}
      </body>
    </html>
  );
}
