// =============================================
//  Datos compartidos entre pantallas (en memoria)
// =============================================
import { useSyncExternalStore } from 'react';
import type { ItemCarrito, Producto, Venta } from './db';

// Valores de la tienda (cámbialos aquí)
export const IVA = 0.19; // 19%
export const COSTO_ENVIO = 20000;

// ---------- Carrito ----------
// Cuando el carrito cambia, todas las pantallas que usan useCarrito() se actualizan solas.
export let carrito: ItemCarrito[] = [];
const oyentes = new Set<() => void>();

export function setCarrito(nuevo: ItemCarrito[]) {
  carrito = nuevo;
  oyentes.forEach((avisar) => avisar());
}

export function useCarrito() {
  return useSyncExternalStore(
    (avisar) => {
      oyentes.add(avisar);
      return () => oyentes.delete(avisar);
    },
    () => carrito
  );
}

export const cantidadEnCarrito = (id: number) => carrito.find((i) => i.id === id)?.cantidad ?? 0;

// Suma 1 unidad. Devuelve false si ya no hay stock.
export function agregarAlCarrito(p: Producto) {
  const cantidad = cantidadEnCarrito(p.id);
  if (cantidad >= p.stock) return false;
  setCarrito(
    cantidad > 0
      ? carrito.map((i) => (i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i))
      : [...carrito, { ...p, cantidad: 1 }]
  );
  return true;
}

// Resta 1 unidad (si llega a 0 se quita del carrito)
export function quitarDelCarrito(id: number) {
  setCarrito(carrito.map((i) => (i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i)).filter((i) => i.cantidad > 0));
}

// ---------- Pantallas de detalle ----------
// Producto que se muestra en la pantalla de detalle
export let productoVisto: Producto | null = null;
export function verProducto(p: Producto) {
  productoVisto = p;
}

// Venta que se muestra en la pantalla de comprobante
export let ventaVista: Venta | null = null;
export function verComprobante(v: Venta) {
  ventaVista = v;
}
