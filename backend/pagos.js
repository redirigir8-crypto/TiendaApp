// =============================================
//  Pasarela Bitcoin con OpenNode
//  - En Render configura OPENNODE_KEY (llave de dev.opennode.com)
//  - OPENNODE_ENV = 'dev' (pruebas, testnet) o 'live' (real). Por defecto 'dev'.
// =============================================
const crypto = require('crypto');

const KEY = process.env.OPENNODE_KEY;
const DEV = (process.env.OPENNODE_ENV || 'dev') !== 'live';
const API = DEV ? 'https://dev-api.opennode.com' : 'https://api.opennode.com';

// Llamada a la API de OpenNode
async function opennode(metodo, ruta, cuerpo) {
  if (!KEY) throw new Error('Falta configurar OPENNODE_KEY en el servidor');
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: KEY, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error('OpenNode: ' + (json.message || res.status));
  return json.data;
}

// Pesos colombianos -> satoshis (1 BTC = 100.000.000 satoshis), usando el precio actual
async function pesosASatoshis(pesos) {
  const tasas = await opennode('GET', '/v1/rates');
  const pesosPorBtc = tasas.BTCCOP.COP;
  return Math.max(1, Math.round((pesos / pesosPorBtc) * 100000000));
}

// Crea el cobro y devuelve { id, checkout_url, satoshis }
async function crearCobro({ ventaId, total, email, nombre, urlAviso }) {
  const satoshis = await pesosASatoshis(total);
  const cobro = await opennode('POST', '/v1/charges', {
    amount: satoshis, // sin "currency" = el monto va en satoshis
    description: `Tienda de Bicicletas - Pedido #${ventaId}`,
    order_id: String(ventaId),
    customer_email: email,
    customer_name: nombre,
    callback_url: urlAviso, // OpenNode avisa aquí cuando cambia el estado
    ttl: 60, // minutos para pagar
  });
  return { id: cobro.id, checkout_url: cobro.hosted_checkout_url, satoshis };
}

// Consulta el estado del cobro: unpaid, processing, paid, expired, ...
async function estadoCobro(id) {
  const cobro = await opennode('GET', '/v2/charges/' + id);
  return cobro.status;
}

// Revisa que el aviso (webhook) sí venga de OpenNode
function avisoValido({ id, hashed_order }) {
  if (!KEY || !id || !hashed_order) return false;
  const firma = crypto.createHmac('sha256', KEY).update(id).digest('hex');
  return firma === hashed_order;
}

module.exports = { crearCobro, estadoCobro, avisoValido, DEV };
