/**
 * Datos de la empresa para cotizaciones (tomados del RUT de la asociación).
 */
export const EMPRESA = {
  razonSocial: "Asociación de Jóvenes Porcicultores El Mirador",
  nit: "902.052.599-4",
  direccion: "Vereda El Tablón",
  municipio: "La Plata, Huila",
  telefonos: "318 369 1295 · 300 443 7186",
  correo: "marlydayanagualicastillo@gmail.com",
  matricula: "S0715271",
} as const;

/** Venta de cerdos en pie: excluida de IVA */
export const NOTA_IVA =
  "Venta excluida del impuesto sobre las ventas (IVA) según el artículo 424 del Estatuto Tributario, partida arancelaria 01.03: animales vivos de la especie porcina.";

export const CONDICIONES_COTIZACION =
  "Anticipo del 50 % para separar los lechones y saldo contra entrega. Entrega en la granja; el transporte corre por cuenta del cliente. Precios sujetos a disponibilidad.";

export const VALIDEZ_COTIZACION_DIAS = 5;
