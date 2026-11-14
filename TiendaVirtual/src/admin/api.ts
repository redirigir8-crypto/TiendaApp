// =============================================
//  Conexión del panel de administrador con el backend
//  Todas las peticiones llevan la clave de admin en el header "x-admin-key"
// =============================================
import { API, guardarConfig, leerConfig } from '../db';

let claveMemoria: string | null = null; // en web no hay SQLite

export const claveAdmin = () => claveMemoria ?? leerConfig('claveAdmin');

export function cerrarAdmin() {
  claveMemoria = null;
  guardarConfig('claveAdmin', null);
}

async function pedir(ruta: string, metodo = 'GET', cuerpo?: object) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', 'x-admin-key': claveAdmin() ?? '' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// Revisa la clave pidiendo las ventas. Si sirve, la guarda.
export async function entrarAdmin(clave: string) {
  claveMemoria = clave;
  try {
    await pedir('/ventas');
    guardarConfig('claveAdmin', clave);
  } catch (e) {
    claveMemoria = null;
    throw e;
  }
}

// ---------- Tipos ----------
export type ProductoAdmin = {
  id: number;
  nombre: string;
  precio: number;
  stock: number;
  descripcion?: string;
  imagen?: string;
  imagenes?: string[];
  direccion?: string; // desde dónde se despacha
};
export type VentaAdmin = {
  id: number;
  numero?: number; // número de compra de ese cliente
  cliente?: string;
  items: { id: number; nombre: string; cantidad: number; precio: number }[];
  subtotal: number;
  iva: number;
  envio: number;
  total: number;
  direccion?: string;
  metodo_pago?: string;
  estado?: string;
  fecha: string;
};
export type UsuarioAdmin = {
  id: number;
  nombre: string;
  email: string;
  compras: number;
  total_gastado: number;
  ultima_compra?: string;
};
export type SolicitudAdmin = {
  id: number;
  venta_id: number;
  tipo: 'devolucion' | 'garantia';
  items: { id: number; nombre: string; cantidad: number }[];
  motivo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  respuesta?: string;
  fecha: string;
  cliente?: string;
  email?: string;
};

// Postgres manda los números como texto: aquí se convierten
const num = (x: any) => Number(x ?? 0);

// ---------- Productos ----------
export const productos = async (): Promise<ProductoAdmin[]> =>
  (await pedir('/productos')).map((p: any) => ({ ...p, precio: num(p.precio), stock: num(p.stock) }));
export const guardarProducto = (p: Omit<ProductoAdmin, 'id'>, id?: number) =>
  id ? pedir('/productos/' + id, 'PUT', p) : pedir('/productos', 'POST', p);
export const borrarProducto = (id: number) => pedir('/productos/' + id, 'DELETE');

// ---------- Ventas, usuarios y solicitudes ----------
export const ventas = async (): Promise<VentaAdmin[]> =>
  (await pedir('/ventas')).map((v: any) => ({
    ...v, subtotal: num(v.subtotal), iva: num(v.iva), envio: num(v.envio), total: num(v.total),
  }));
export const usuarios = async (): Promise<UsuarioAdmin[]> =>
  (await pedir('/usuarios')).map((u: any) => ({ ...u, compras: num(u.compras), total_gastado: num(u.total_gastado) }));
export const solicitudes = (): Promise<SolicitudAdmin[]> => pedir('/solicitudes');
export const responderSolicitud = (id: number, estado: 'aprobada' | 'rechazada', respuesta: string) =>
  pedir('/solicitudes/' + id, 'PUT', { estado, respuesta });
