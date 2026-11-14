// =============================================
//  Seguimiento del pedido (simulado)
//  - Ubica la dirección en el mapa con OpenStreetMap (Nominatim, gratis)
//  - Calcula por dónde va el domiciliario y a qué hora llega
// =============================================

// Ubicación de la tienda (cámbiala en Render con TIENDA_LAT y TIENDA_LNG). Por defecto: Bogotá.
const TIENDA = {
  lat: Number(process.env.TIENDA_LAT || 4.6486),
  lng: Number(process.env.TIENDA_LNG || -74.0628),
};

// Tiempos del envío (cámbialos aquí)
const MINUTOS_PREPARACION = 2; // tiempo empacando el pedido
const VELOCIDAD_KMH = 30; // velocidad del domiciliario

// Busca las coordenadas de una dirección. Devuelve { lat, lng } o null.
async function ubicarDireccion(direccion) {
  // Nominatim no entiende bien el "#" de las direcciones colombianas
  const texto = direccion.replace(/#/g, ' ').replace(/\s+/g, ' ').trim();
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=co&q=' +
    encodeURIComponent(texto);
  try {
    // Nominatim exige identificar la app en el User-Agent
    const res = await fetch(url, { headers: { 'User-Agent': 'TiendaBicicletas/1.0 (proyecto academico)' } });
    const datos = await res.json();
    if (datos[0]) return { lat: Number(datos[0].lat), lng: Number(datos[0].lon) };
  } catch (e) {
    console.error('No se pudo ubicar la dirección:', e.message);
  }
  return null;
}

// Si no se encuentra la dirección, se usa un punto cerca de la tienda (para que el demo funcione)
function puntoCercano(ventaId) {
  const angulo = (ventaId * 137) % 360 * (Math.PI / 180);
  return { lat: TIENDA.lat + 0.03 * Math.sin(angulo), lng: TIENDA.lng + 0.03 * Math.cos(angulo) };
}

// Distancia en km entre dos puntos (fórmula de Haversine)
function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Arma el estado del seguimiento según la hora en que se pagó
function calcular(venta, destino) {
  const inicio = new Date(venta.pagado_en || venta.fecha).getTime();
  const ahora = Date.now();
  const domicilio = !!venta.direccion;
  const km = domicilio ? distanciaKm(TIENDA, destino) : 0;
  const minutosViaje = domicilio ? Math.max(3, Math.round((km / VELOCIDAD_KMH) * 60)) : 0;

  const salida = inicio + MINUTOS_PREPARACION * 60000;
  const llegada = salida + minutosViaje * 60000;

  // Avance del recorrido: 0 = en la tienda, 1 = entregado
  let progreso = 0;
  if (ahora >= llegada) progreso = 1;
  else if (ahora > salida) progreso = (ahora - salida) / (llegada - salida);

  const actual = {
    lat: TIENDA.lat + (destino.lat - TIENDA.lat) * progreso,
    lng: TIENDA.lng + (destino.lng - TIENDA.lng) * progreso,
  };

  const etapas = domicilio
    ? [
        { nombre: 'Pedido confirmado', hora: inicio },
        { nombre: 'Preparando tu pedido', hora: inicio },
        { nombre: 'En camino', hora: salida },
        { nombre: 'Entregado', hora: llegada },
      ]
    : [
        { nombre: 'Pedido confirmado', hora: inicio },
        { nombre: 'Preparando tu pedido', hora: inicio },
        { nombre: 'Listo para recoger en tienda', hora: salida },
      ];

  return {
    domicilio,
    tienda: TIENDA,
    destino,
    actual,
    progreso,
    distancia_km: Math.round(km * 10) / 10,
    llegada: new Date(domicilio ? llegada : salida).toISOString(),
    entregado: ahora >= (domicilio ? llegada : salida),
    etapas: etapas.map((e) => ({ nombre: e.nombre, hora: new Date(e.hora).toISOString(), hecho: ahora >= e.hora })),
  };
}

module.exports = { TIENDA, ubicarDireccion, puntoCercano, calcular };
