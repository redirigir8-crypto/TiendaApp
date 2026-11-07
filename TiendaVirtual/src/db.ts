// =============================================
//  Datos de la app: backend (Render) + respaldo SQLite
// =============================================
import * as SQLite from 'expo-sqlite';

// URL del backend en Render
export const API = 'https://tiendaapp-9xc4.onrender.com';

export type Producto = {
  id: number;
  nombre: string;
  precio: number;
  descripcion?: string;
  imagen?: string;
};
export type ItemCarrito = Producto & { cantidad: number };
export type Usuario = { id: number; nombre: string; email: string };
export type Venta = {
  id: number | string;
  items: ItemCarrito[];
  total: number;
  fecha: string;
  pendiente?: boolean; // true = guardada en el celular, sin enviar
};

const db = SQLite.openDatabaseSync('tienda.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY, nombre TEXT, precio REAL, descripcion TEXT, imagen TEXT);
  CREATE TABLE IF NOT EXISTS ventas_pendientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, items TEXT, total REAL, fecha TEXT);
  CREATE TABLE IF NOT EXISTS sesion (
    id INTEGER PRIMARY KEY, nombre TEXT, email TEXT);
`);

// Ayudante para hacer POST con JSON
async function post(ruta: string, cuerpo: object) {
  const res = await fetch(API + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// ---------- Sesión ----------
export function usuarioGuardado() {
  return db.getFirstSync<Usuario>('SELECT * FROM sesion');
}

function guardarSesion(u: Usuario) {
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
  db.runSync('DELETE FROM sesion');
}

// ---------- Productos ----------
// Con internet: los trae de Render y los guarda en SQLite.
// Sin internet: usa los que ya estaban en SQLite.
export async function cargarProductos(): Promise<Producto[]> {
  try {
    const res = await fetch(API + '/productos');
    const data: Producto[] = await res.json();
    db.runSync('DELETE FROM productos');
    for (const p of data) {
      db.runSync('INSERT INTO productos VALUES (?, ?, ?, ?, ?)', [
        p.id, p.nombre, Number(p.precio), p.descripcion ?? '', p.imagen ?? '',
      ]);
    }
  } catch {
    console.log('Sin internet: usando productos guardados');
  }
  return db.getAllSync<Producto>('SELECT * FROM productos ORDER BY id');
}

// ---------- Ventas ----------
// Intenta enviar la compra. Si no hay internet, la guarda en el celular.
export async function comprar(usuario: Usuario, items: ItemCarrito[], total: number): Promise<Venta> {
  try {
    const v = await post('/ventas', { items, total, usuario_id: usuario.id, cliente: usuario.nombre });
    return { ...v, total: Number(v.total) };
  } catch {
    const fecha = new Date().toISOString();
    const r = db.runSync('INSERT INTO ventas_pendientes (items, total, fecha) VALUES (?, ?, ?)', [
      JSON.stringify(items), total, fecha,
    ]);
    return { id: 'P' + r.lastInsertRowId, items, total, fecha, pendiente: true };
  }
}

// Envía las compras que quedaron guardadas sin internet
export async function sincronizar(usuario: Usuario) {
  const pendientes = db.getAllSync<any>('SELECT * FROM ventas_pendientes');
  for (const v of pendientes) {
    try {
      await post('/ventas', {
        items: JSON.parse(v.items), total: v.total, usuario_id: usuario.id, cliente: usuario.nombre,
      });
      db.runSync('DELETE FROM ventas_pendientes WHERE id = ?', [v.id]);
    } catch {
      break; // sigue sin internet
    }
  }
}

// Mis compras: las del servidor + las pendientes del celular
export async function misCompras(usuario: Usuario): Promise<Venta[]> {
  let delServidor: Venta[] = [];
  try {
    await sincronizar(usuario);
    const res = await fetch(API + '/ventas/usuario/' + usuario.id);
    delServidor = (await res.json()).map((v: any) => ({ ...v, total: Number(v.total) }));
  } catch {
    console.log('Sin internet: solo compras pendientes');
  }
  const pendientes: Venta[] = db
    .getAllSync<any>('SELECT * FROM ventas_pendientes ORDER BY id DESC')
    .map((v) => ({ id: 'P' + v.id, items: JSON.parse(v.items), total: v.total, fecha: v.fecha, pendiente: true }));
  return [...pendientes, ...delServidor];
}
