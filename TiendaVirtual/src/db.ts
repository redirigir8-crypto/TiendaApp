// =============================================
//  Datos de la app: backend (Render) + respaldo SQLite
// =============================================
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// URL del backend en Render
export const API = 'https://tiendaapp-9xc4.onrender.com';

export type Producto = {
  id: number;
  nombre: string;
  precio: number;
  descripcion?: string;
  imagen?: string;
  imagenes?: string[]; // varias fotos de la bicicleta
  stock: number;
};

// Lista de fotos del producto (la primera es la portada)
export function fotosDe(p: Producto): string[] {
  if (p.imagenes && p.imagenes.length > 0) return p.imagenes;
  return p.imagen ? [p.imagen] : [];
}
export type ItemCarrito = Producto & { cantidad: number };
export type Usuario = { id: number; nombre: string; email: string };

// Datos de una compra (lo que se manda al servidor)
export type DatosCompra = {
  items: ItemCarrito[];
  subtotal: number;
  iva: number;
  envio: number;
  total: number;
  direccion: string; // vacío = recoge en tienda
  metodo_pago: string; // ej: "Tarjeta **** 1234", "Nequi 300...", "Transferencia"
  bitcoin?: boolean; // true = pagar con Bitcoin (OpenNode)
};
export type Venta = DatosCompra & {
  id: number | string;
  fecha: string;
  pendiente?: boolean; // true = guardada en el celular, sin enviar
  estado?: string; // pagado | pendiente_pago | expirado | cancelado
  checkout_url?: string; // link para pagar con Bitcoin (OpenNode real)
  btc_direccion?: string; // dirección Bitcoin a la que se paga
  btc_satoshis?: number; // monto en satoshis (1 BTC = 100.000.000 sats)
  codigo?: string; // código secreto de la factura (para descargarla del servidor)
  // Qué puede hacer el cliente (lo calcula el servidor)
  puede_cancelar?: boolean;
  puede_devolver?: boolean;
  puede_garantia?: boolean;
  pagado_en?: string;
};

// Error que devuelve el servidor (ej: "sin stock"). Se distingue de "no hay internet".
class ErrorServidor extends Error {}

// SQLite solo se usa en el celular. En el navegador la app funciona solo con internet.
const db = Platform.OS === 'web' ? null : SQLite.openDatabaseSync('tienda.db');
let sesionWeb: Usuario | null = null; // sesión en memoria cuando es web

db?.execSync(`
  CREATE TABLE IF NOT EXISTS productos_cache (id INTEGER PRIMARY KEY, datos TEXT);
  CREATE TABLE IF NOT EXISTS compras_pendientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, datos TEXT, fecha TEXT);
  CREATE TABLE IF NOT EXISTS sesion (
    id INTEGER PRIMARY KEY, nombre TEXT, email TEXT);
  CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);
`);

// ---------- Configuración guardada en el celular ----------
// Ej: la carpeta donde se guardan las facturas PDF
export function leerConfig(clave: string) {
  return db?.getFirstSync<{ valor: string }>('SELECT valor FROM config WHERE clave = ?', [clave])?.valor ?? null;
}
export function guardarConfig(clave: string, valor: string | null) {
  if (valor === null) db?.runSync('DELETE FROM config WHERE clave = ?', [clave]);
  else db?.runSync('INSERT OR REPLACE INTO config (clave, valor) VALUES (?, ?)', [clave, valor]);
}

// Ayudante para hacer POST con JSON
async function post(ruta: string, cuerpo: object) {
  const res = await fetch(API + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const data = await res.json();
  if (!res.ok) throw new ErrorServidor(data.error || 'Error del servidor');
  return data;
}

// Convierte los números que llegan de Postgres como texto
const aVenta = (v: any): Venta => ({
  ...v,
  subtotal: Number(v.subtotal ?? v.total),
  iva: Number(v.iva ?? 0),
  envio: Number(v.envio ?? 0),
  total: Number(v.total),
  direccion: v.direccion ?? '',
  metodo_pago: v.metodo_pago ?? '',
  btc_satoshis: v.btc_satoshis ? Number(v.btc_satoshis) : undefined,
});

// ---------- Sesión ----------
export function usuarioGuardado() {
  if (!db) return sesionWeb;
  return db.getFirstSync<Usuario>('SELECT * FROM sesion');
}

function guardarSesion(u: Usuario) {
  if (!db) {
    sesionWeb = u;
    return;
  }
  db.runSync('DELETE FROM sesion');
  db.runSync('INSERT INTO sesion (id, nombre, email) VALUES (?, ?, ?)', [u.id, u.nombre, u.email]);
}

export async function login(email: string, password: string) {
  const u: Usuario = await post('/login', { email, password });
  guardarSesion(u);
  return u;
}

export async function registro(nombre: string, email: string, password: string) {
  const u: Usuario = await post('/registro', { nombre, email, password });
  guardarSesion(u);
  return u;
}

export function cerrarSesion() {
  sesionWeb = null;
  db?.runSync('DELETE FROM sesion');
}

// ---------- Productos ----------
// Con internet: los trae de Render y los guarda en SQLite.
// Sin internet: usa los que ya estaban en SQLite.
export async function cargarProductos(): Promise<Producto[]> {
  try {
    const res = await fetch(API + '/productos');
    const data: Producto[] = (await res.json()).map((p: any) => ({
      ...p,
      precio: Number(p.precio),
      stock: Number(p.stock ?? 0),
    }));
    if (!db) return data;
    db.runSync('DELETE FROM productos_cache');
    for (const p of data) {
      db.runSync('INSERT INTO productos_cache (id, datos) VALUES (?, ?)', [p.id, JSON.stringify(p)]);
    }
    return data;
  } catch {
    console.log('Sin internet: usando productos guardados');
  }
  if (!db) return [];
  return db
    .getAllSync<{ datos: string }>('SELECT datos FROM productos_cache ORDER BY id')
    .map((f) => JSON.parse(f.datos));
}

// ---------- Ventas ----------
// Intenta enviar la compra. Si no hay internet, la guarda en el celular.
// Si el servidor la rechaza (ej: sin stock), lanza el error para mostrarlo.
export async function comprar(usuario: Usuario, compra: DatosCompra): Promise<Venta> {
  try {
    const v = await post('/ventas', { ...compra, usuario_id: usuario.id, cliente: usuario.nombre });
    return aVenta(v);
  } catch (e) {
    if (e instanceof ErrorServidor || !db) throw e;
    if (compra.bitcoin) throw new Error('Necesitas internet para pagar con Bitcoin');
    const fecha = new Date().toISOString();
    const r = db.runSync('INSERT INTO compras_pendientes (datos, fecha) VALUES (?, ?)', [
      JSON.stringify(compra), fecha,
    ]);
    return { ...compra, id: 'P' + r.lastInsertRowId, fecha, pendiente: true };
  }
}

// Pregunta al servidor si una compra Bitcoin ya se pagó
export async function estadoVenta(id: number | string): Promise<Venta> {
  const res = await fetch(`${API}/ventas/${id}/estado`);
  return aVenta(await res.json());
}

// ---------- Postventa: cancelar, devoluciones y garantías ----------
export type TipoSolicitud = 'devolucion' | 'garantia';
export type Solicitud = {
  id: number;
  venta_id: number;
  tipo: TipoSolicitud;
  items: { id: number; nombre: string; cantidad: number }[];
  motivo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  respuesta?: string;
  fecha: string;
};

// Cancela el pedido. Devuelve la venta actualizada y un mensaje para mostrar.
export async function cancelarPedido(usuario: Usuario, id: number | string) {
  const v = await post(`/ventas/${id}/cancelar`, { usuario_id: usuario.id });
  return { venta: aVenta(v), mensaje: v.mensaje as string };
}

export async function crearSolicitud(
  usuario: Usuario,
  ventaId: number | string,
  tipo: TipoSolicitud,
  items: { id: number; cantidad: number }[],
  motivo: string
): Promise<Solicitud> {
  return post(`/ventas/${ventaId}/solicitudes`, { usuario_id: usuario.id, tipo, items, motivo });
}

export async function misSolicitudes(usuario: Usuario): Promise<Solicitud[]> {
  const res = await fetch(`${API}/solicitudes/usuario/${usuario.id}`);
  return res.json();
}

// MODO SIMULADO: confirma el pago Bitcoin (botón "Simular pago confirmado")
export async function simularPago(id: number | string): Promise<Venta> {
  return aVenta(await post(`/ventas/${id}/simular-pago`, {}));
}

// ---------- Seguimiento del pedido ----------
export type Punto = { lat: number; lng: number };
export type Seguimiento = {
  domicilio: boolean;
  tienda: Punto;
  destino: Punto;
  actual: Punto; // dónde va el domiciliario
  progreso: number; // 0 = en la tienda, 1 = entregado
  distancia_km: number;
  llegada: string; // hora estimada de llegada
  entregado: boolean;
  aproximado: boolean; // true = no se encontró la dirección exacta en el mapa
  direccion: string;
  etapas: { nombre: string; hora: string; hecho: boolean }[];
};

export async function verSeguimiento(id: number | string): Promise<Seguimiento> {
  const res = await fetch(`${API}/ventas/${id}/seguimiento`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'No se pudo cargar el seguimiento');
  return data;
}

// Envía las compras que quedaron guardadas sin internet
export async function sincronizar(usuario: Usuario) {
  if (!db) return;
  const pendientes = db.getAllSync<any>('SELECT * FROM compras_pendientes');
  for (const p of pendientes) {
    try {
      await post('/ventas', { ...JSON.parse(p.datos), usuario_id: usuario.id, cliente: usuario.nombre });
      db.runSync('DELETE FROM compras_pendientes WHERE id = ?', [p.id]);
    } catch (e) {
      if (!(e instanceof ErrorServidor)) break; // sigue sin internet
      // si el servidor la rechaza (ej: sin stock) se queda pendiente y sigue con la siguiente
    }
  }
}

// Mis compras: las del servidor + las pendientes del celular
export async function misCompras(usuario: Usuario): Promise<Venta[]> {
  let delServidor: Venta[] = [];
  try {
    await sincronizar(usuario);
    const res = await fetch(API + '/ventas/usuario/' + usuario.id);
    delServidor = (await res.json()).map(aVenta);
  } catch {
    console.log('Sin internet: solo compras pendientes');
  }
  if (!db) return delServidor;
  const pendientes: Venta[] = db
    .getAllSync<any>('SELECT * FROM compras_pendientes ORDER BY id DESC')
    .map((p) => ({ ...JSON.parse(p.datos), id: 'P' + p.id, fecha: p.fecha, pendiente: true }));
  return [...pendientes, ...delServidor];
}
