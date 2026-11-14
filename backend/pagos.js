// =============================================
//  Pasarela Bitcoin
//  - Con OPENNODE_KEY en Render: cobro real con OpenNode
//    (OPENNODE_ENV = 'dev' pruebas/testnet o 'live' real. Por defecto 'dev').
//  - Sin OPENNODE_KEY: MODO SIMULADO (muestra QR y se confirma con un botón).
// =============================================
const crypto = require('crypto');

const KEY = process.env.OPENNODE_KEY;
const SIMULADO = !KEY;
const DEV = (process.env.OPENNODE_ENV || 'dev') !== 'live';
const API = DEV ? 'https://dev-api.opennode.com' : 'https://api.opennode.com';

// Dirección Bitcoin de testnet para el modo simulado (puedes poner la tuya en DIRECCION_BTC)
const DIRECCION_SIMULADA = process.env.DIRECCION_BTC || 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';

// Llamada a la API de OpenNode
async function opennode(metodo, ruta, cuerpo) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: KEY || '', 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error('OpenNode: ' + (json.message || res.status));
  return json.data;
}

// Pesos colombianos -> satoshis (1 BTC = 100.000.000 satoshis), con el precio actual.
// (La consulta de precios de OpenNode no necesita llave.)
async function pesosASatoshis(pesos) {
  let pesosPorBtc = 400000000; // precio aproximado por si falla la consulta
  try {
    const tasas = await opennode('GET', '/v1/rates');
    pesosPorBtc = tasas.BTCCOP.COP;
  } catch (e) {
    console.error('No se pudo consultar el precio del BTC, uso uno aproximado:', e.message);
  }
  return Math.max(1, Math.round((pesos / pesosPorBtc) * 100000000));
}

// Crea el cobro y devuelve { id, checkout_url, satoshis, direccion }
async function crearCobro({ ventaId, total, email, nombre, urlAviso }) {
  const satoshis = await pesosASatoshis(total);

  if (SIMULADO) {
    return { id: 'SIM-' + ventaId, checkout_url: null, satoshis, direccion: DIRECCION_SIMULADA };
  }

  const cobro = await opennode('POST', '/v1/charges', {
    amount: satoshis, // sin "currency" = el monto va en satoshis
    description: `Tienda de Bicicletas - Pedido #${ventaId}`,
    order_id: String(ventaId),
    customer_email: email,
    customer_name: nombre,
    callback_url: urlAviso, // OpenNode avisa aquí cuando cambia el estado
    ttl: 60, // minutos para pagar
  });
  return {
    id: cobro.id,
    checkout_url: cobro.hosted_checkout_url,
    satoshis,
    direccion: cobro.chain_invoice?.address || null,
  };
}

// Consulta el estado del cobro: unpaid, processing, paid, expired, ...
async function estadoCobro(id) {
  if (id.startsWith('SIM-')) return 'unpaid'; // en simulado solo se paga con el botón
  const cobro = await opennode('GET', '/v2/charges/' + id);
  return cobro.status;
}

// Revisa que el aviso (webhook) sí venga de OpenNode
function avisoValido({ id, hashed_order }) {
  if (!KEY || !id || !hashed_order) return false;
  const firma = crypto.createHmac('sha256', KEY).update(id).digest('hex');
  return firma === hashed_order;
}

module.exports = { crearCobro, estadoCobro, avisoValido, SIMULADO };
