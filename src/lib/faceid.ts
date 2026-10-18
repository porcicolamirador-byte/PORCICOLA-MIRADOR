/*
 * Face ID (o Touch ID) para abrir los ajustes privados, usando las llaves de
 * acceso del iPhone (WebAuthn). El rostro lo verifica el propio teléfono; la
 * app solo guarda el identificador de la llave en este dispositivo.
 * Si Face ID falla o no está disponible, siempre queda el código.
 */

const CLAVE = "faceid-ajustes";

/** Motivo del último fallo al entrar (solo en memoria, para mostrarlo en el aviso) */
let ultimoFallo = "";
export const motivoFalloFaceId = () => ultimoFallo;

const aBase64 = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function deBase64(texto: string): Uint8Array<ArrayBuffer> {
  const b64 = texto.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((texto.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const aleatorio = (n: number) => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(n)));

function idGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

/** Si ya se activó Face ID en este teléfono */
export function faceIdActivo(): boolean {
  return !!idGuardado();
}

/** Si el teléfono tiene Face ID / Touch ID disponible para la app */
export async function faceIdDisponible(): Promise<boolean> {
  try {
    if (typeof window === "undefined" || !window.isSecureContext || !window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Registra el rostro. Debe llamarse directamente al tocar un botón
 * (el iPhone solo muestra Face ID como respuesta a un toque).
 */
export async function activarFaceId(): Promise<boolean> {
  try {
    const credencial = (await navigator.credentials.create({
      publicKey: {
        challenge: aleatorio(32),
        rp: { name: "Porcícola El Mirador", id: location.hostname },
        user: { id: aleatorio(16), name: "Ajustes privados", displayName: "Ajustes privados" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
        attestation: "none",
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!credencial) return false;
    localStorage.setItem(CLAVE, aBase64(credencial.rawId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Pide el rostro. Devuelve true solo si el teléfono confirmó a la persona.
 * Igual que activarFaceId, debe llamarse directamente al tocar.
 */
export async function verificarFaceId(): Promise<boolean> {
  const id = idGuardado();
  if (!id) return false;
  try {
    const credencial = (await navigator.credentials.get({
      publicKey: {
        challenge: aleatorio(32),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: deBase64(id) }],
        userVerification: "required",
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;
    if (!credencial || aBase64(credencial.rawId) !== id) {
      ultimoFallo = "la llave no coincide";
      return false;
    }
    // Bandera "usuario verificado" (bit 2) en los datos del autenticador
    const datos = new Uint8Array((credencial.response as AuthenticatorAssertionResponse).authenticatorData);
    const ok = datos.length > 32 && (datos[32] & 0x04) !== 0;
    ultimoFallo = ok ? "" : "rostro no verificado";
    return ok;
  } catch (e) {
    const nombre = (e as { name?: string })?.name ?? "";
    ultimoFallo = nombre === "NotAllowedError" ? "cancelado o no permitido" : nombre || "error";
    return false;
  }
}

export function desactivarFaceId() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // sin almacenamiento: nada que borrar
  }
}
