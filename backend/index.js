// =============================================
//  API Tienda de Bicicletas (Express + Postgres)
// =============================================
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Pool } = require('pg');
const pagos = require('./pagos');
const seguimiento = require('./seguimiento');
const postventa = require('./postventa');
const { enviarFactura, crearPdf } = require('./correo');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Clave para el panel admin (configúrala en Render como ADMIN_KEY)
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true })); // los avisos de OpenNode llegan como formulario

// URL pública del backend (Render la pone sola). Sirve para que OpenNode nos avise.
const URL_PUBLICA = process.env.RENDER_EXTERNAL_URL || process.env.URL_PUBLICA || '';
const PORT = process.env.PORT || 3000;

// Link público de la factura (va en el código QR del PDF y en el correo).
// Usa un código aleatorio para que nadie pueda adivinar facturas ajenas.
const urlFactura = (venta) => `${URL_PUBLICA || 'http://localhost:' + PORT}/factura/${venta.codigo}`;

// ---------- Crear tablas al arrancar ----------
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY, nombre TEXT, precio NUMERIC);
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS descripcion TEXT;
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen TEXT;
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 10;
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagenes JSONB DEFAULT '[]';
    -- dirección desde donde se despacha el producto (bodega) y sus coordenadas
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS direccion TEXT;
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
    ALTER TABLE productos ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
    -- datos de entrega del cliente (se llenan en Perfil)
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS direccion TEXT;
    ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono TEXT;

    CREATE TABLE IF NOT EXISTS ventas (
      id SERIAL PRIMARY KEY, items JSONB, total NUMERIC,
      fecha TIMESTAMP DEFAULT NOW());
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS usuario_id INTEGER;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cliente TEXT;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS subtotal NUMERIC;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS iva NUMERIC;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS envio NUMERIC;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS direccion TEXT;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS metodo_pago TEXT;
    -- estado: pagado | pendiente_pago (Bitcoin sin pagar) | expirado | cancelado
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pagado';
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cobro_id TEXT;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS checkout_url TEXT;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS btc_direccion TEXT;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS btc_satoshis BIGINT;
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS codigo TEXT;      -- código secreto de la factura (para el QR)
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS pagado_en TIMESTAMP; -- desde aquí cuenta el seguimiento
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION; -- coordenadas de la dirección de envío
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
    -- numero = número de compra de CADA cliente (su primera compra es la 1, la segunda la 2...)
    ALTER TABLE ventas ADD COLUMN IF NOT EXISTS numero INTEGER;
    ${postventa.SQL_TABLAS}
    UPDATE ventas v SET numero = r.n
      FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY usuario_id ORDER BY id) AS n FROM ventas) r
      WHERE v.id = r.id AND v.numero IS NULL;
    UPDATE ventas SET codigo = md5(random()::text || id::text) WHERE codigo IS NULL;
    UPDATE ventas SET pagado_en = fecha WHERE pagado_en IS NULL AND COALESCE(estado, 'pagado') = 'pagado';
  `);

  // Quitar los productos de prueba viejos (arroz, leche, pan)
  await pool.query(`DELETE FROM productos WHERE nombre IN ('Arroz', 'Leche', 'Pan')`);

  // Bicicletas de ejemplo si no hay productos
  const { rows } = await pool.query('SELECT COUNT(*) FROM productos');
  if (rows[0].count === '0') {
    await pool.query(`INSERT INTO productos (nombre, precio, descripcion) VALUES
      ('Bicicleta MTB Rin 29', 1500000, 'Montañera, 21 cambios, frenos de disco'),
      ('Bicicleta de Ruta', 2800000, 'Marco de aluminio, 18 cambios'),
      ('Bicicleta Urbana', 900000, 'Ideal para la ciudad, con canasta')`);
  }
}

// Middleware: solo deja pasar si mandan la clave admin
function soloAdmin(req, res, next) {
  if (req.headers['x-admin-key'] !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Clave de admin incorrecta' });
  }
  next();
}

app.get('/', (req, res) => res.send('API Tienda de Bicicletas funcionando'));

// ---------- Usuarios ----------
app.post('/registro', async (req, res) => {
  const { nombre, email, password, direccion, telefono } = req.body;
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password, direccion, telefono) VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, email, direccion, telefono`,
      [nombre, email.toLowerCase(), hash, direccion || null, telefono || null]
    );
    res.json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: 'Ese correo ya está registrado' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [
    (email || '').toLowerCase(),
  ]);
  const usuario = rows[0];
  if (!usuario || !(await bcrypt.compare(password || '', usuario.password))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  }
  res.json({
    id: usuario.id, nombre: usuario.nombre, email: usuario.email,
    direccion: usuario.direccion, telefono: usuario.telefono,
  });
});

// Actualizar el perfil (nombre, dirección y teléfono). Se valida con el correo del usuario.
app.put('/usuarios/:id/perfil', async (req, res) => {
  const { email, nombre, direccion, telefono } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre no puede quedar vacío' });
  const { rows } = await pool.query(
    `UPDATE usuarios SET nombre = $1, direccion = $2, telefono = $3
     WHERE id = $4 AND email = $5 RETURNING id, nombre, email, direccion, telefono`,
    [nombre.trim(), direccion || null, telefono || null, req.params.id, (email || '').toLowerCase()]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
});

// ---------- Productos ----------
app.get('/productos', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM productos ORDER BY id');
  res.json(rows);
});

// imagenes = lista de URLs (varias fotos de la bicicleta). La primera es la portada.
// direccion = desde dónde se despacha; se busca en el mapa al guardar
async function ubicar(direccion) {
  if (!direccion || !direccion.trim()) return { lat: null, lng: null };
  return (await seguimiento.ubicarDireccion(direccion)) || { lat: null, lng: null };
}

app.post('/productos', soloAdmin, async (req, res) => {
  const { nombre, precio, descripcion, stock, imagenes = [], direccion } = req.body;
  const punto = await ubicar(direccion);
  const { rows } = await pool.query(
    `INSERT INTO productos (nombre, precio, descripcion, imagen, imagenes, stock, direccion, lat, lng)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [nombre, precio, descripcion, imagenes[0] || null, JSON.stringify(imagenes), stock, direccion || null, punto.lat, punto.lng]
  );
  res.json(rows[0]);
});

app.put('/productos/:id', soloAdmin, async (req, res) => {
  const { nombre, precio, descripcion, stock, imagenes = [], direccion } = req.body;
  const punto = await ubicar(direccion);
  const { rows } = await pool.query(
    `UPDATE productos SET nombre=$1, precio=$2, descripcion=$3, imagen=$4, imagenes=$5, stock=$6,
       direccion=$7, lat=$8, lng=$9 WHERE id=$10 RETURNING *`,
    [nombre, precio, descripcion, imagenes[0] || null, JSON.stringify(imagenes), stock,
     direccion || null, punto.lat, punto.lng, req.params.id]
  );
  res.json(rows[0]);
});

app.delete('/productos/:id', soloAdmin, async (req, res) => {
  await pool.query('DELETE FROM productos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Ventas ----------
// Datos del cliente (nombre y correo) de una venta
async function clienteDe(venta) {
  const { rows } = await pool.query('SELECT nombre, email FROM usuarios WHERE id = $1', [venta.usuario_id]);
  return rows[0];
}

// Manda la factura al correo sin hacer esperar la respuesta
function mandarFactura(venta) {
  clienteDe(venta)
    .then((cliente) => cliente && enviarFactura(venta, cliente, urlFactura(venta)))
    .catch((e) => console.error('Error con la factura:', e.message));
}

// Pasa una venta Bitcoin a "pagado" (solo una vez) y manda la factura
async function marcarPagada(ventaId) {
  const { rows } = await pool.query(
    "UPDATE ventas SET estado = 'pagado', pagado_en = NOW() WHERE id = $1 AND estado = 'pendiente_pago' RETURNING *",
    [ventaId]
  );
  if (rows[0]) mandarFactura(rows[0]);
}

// Devuelve productos al inventario
async function devolverStock(items) {
  for (const item of items || []) {
    await pool.query('UPDATE productos SET stock = stock + $1 WHERE id = $2', [item.cantidad, item.id]);
  }
}

// Cancela una venta sin pagar y devuelve el stock
async function cancelarVenta(ventaId, estado) {
  const { rows } = await pool.query(
    "UPDATE ventas SET estado = $2 WHERE id = $1 AND estado = 'pendiente_pago' RETURNING *",
    [ventaId, estado]
  );
  await devolverStock(rows[0]?.items);
}

// Registra la compra y descuenta el stock (todo o nada, con una transacción).
// Si bitcoin = true, queda "pendiente_pago" y se crea el cobro en OpenNode.
app.post('/ventas', async (req, res) => {
  const { items, subtotal, iva, envio, total, direccion, metodo_pago, usuario_id, cliente, bitcoin } = req.body;
  const estado = bitcoin ? 'pendiente_pago' : 'pagado';
  const conexion = await pool.connect();
  let venta;
  try {
    await conexion.query('BEGIN');
    for (const item of items) {
      const r = await conexion.query(
        'UPDATE productos SET stock = stock - $1 WHERE id = $2 AND stock >= $1',
        [item.cantidad, item.id]
      );
      if (r.rowCount === 0) throw new Error('No hay stock suficiente de ' + item.nombre);
    }
    const { rows } = await conexion.query(
      `INSERT INTO ventas (items, subtotal, iva, envio, total, direccion, metodo_pago, usuario_id, cliente, estado,
                           codigo, pagado_en, numero)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $10 = 'pagado' THEN NOW() END,
               (SELECT COALESCE(MAX(numero), 0) + 1 FROM ventas WHERE usuario_id = $8))
       RETURNING *`,
      [
        JSON.stringify(items), subtotal, iva, envio, total, direccion, metodo_pago, usuario_id, cliente, estado,
        crypto.randomUUID(),
      ]
    );
    await conexion.query('COMMIT');
    venta = rows[0];
  } catch (e) {
    await conexion.query('ROLLBACK');
    return res.status(400).json({ error: e.message });
  } finally {
    conexion.release();
  }

  // Pago normal (simulado): ya quedó pagada, se manda la factura
  if (!bitcoin) {
    mandarFactura(venta);
    return res.json(venta);
  }

  // Pago Bitcoin: crear el cobro en OpenNode
  try {
    const usuario = await clienteDe(venta);
    const cobro = await pagos.crearCobro({
      ventaId: venta.id,
      total: Number(total),
      email: usuario?.email,
      nombre: usuario?.nombre,
      urlAviso: URL_PUBLICA ? URL_PUBLICA + '/webhook/opennode' : undefined,
    });
    const { rows } = await pool.query(
      `UPDATE ventas SET cobro_id = $1, checkout_url = $2, metodo_pago = $3, btc_direccion = $4, btc_satoshis = $5
       WHERE id = $6 RETURNING *`,
      [
        cobro.id, cobro.checkout_url,
        `Bitcoin${pagos.SIMULADO ? ' (simulado)' : ''} - ${cobro.satoshis} sats`,
        cobro.direccion, cobro.satoshis, venta.id,
      ]
    );
    res.json(rows[0]);
  } catch (e) {
    await cancelarVenta(venta.id, 'cancelado');
    res.status(400).json({ error: 'No se pudo crear el pago Bitcoin. ' + e.message });
  }
});

// Estado de una venta. Si es Bitcoin y sigue pendiente, le pregunta a OpenNode.
app.get('/ventas/:id/estado', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
  const venta = rows[0];
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado === 'pendiente_pago' && venta.cobro_id) {
    try {
      const estado = await pagos.estadoCobro(venta.cobro_id);
      if (estado === 'paid') await marcarPagada(venta.id);
      if (estado === 'expired') await cancelarVenta(venta.id, 'expirado');
    } catch (e) {
      console.error('No se pudo consultar OpenNode:', e.message);
    }
  }
  const actual = (await pool.query('SELECT * FROM ventas WHERE id = $1', [req.params.id])).rows[0];
  const solicitudes = (await pool.query('SELECT tipo, estado FROM solicitudes WHERE venta_id = $1', [venta.id])).rows;
  res.json({ ...actual, ...postventa.opciones(actual, solicitudes) });
});

// MODO SIMULADO: el botón "Simular pago confirmado" de la app llama aquí
app.post('/ventas/:id/simular-pago', async (req, res) => {
  if (!pagos.SIMULADO) return res.status(400).json({ error: 'Solo disponible en modo simulado' });
  await marcarPagada(req.params.id);
  const { rows } = await pool.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
  res.json(rows[0]);
});

// Factura en PDF (link del QR y botón "Descargar" de la app). Se descarga directo.
app.get('/factura/:codigo', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ventas WHERE codigo = $1', [req.params.codigo]);
  const venta = rows[0];
  if (!venta) return res.status(404).send('Factura no encontrada');
  const cliente = (await clienteDe(venta)) || { nombre: venta.cliente || '-', email: '-' };
  const pdf = await crearPdf(venta, cliente, urlFactura(venta));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="factura-${venta.numero ?? venta.id}.pdf"`);
  res.send(pdf);
});

// Seguimiento del pedido: dónde va y a qué hora llega
app.get('/ventas/:id/seguimiento', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
  const venta = rows[0];
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if (venta.estado === 'cancelado') return res.status(400).json({ error: 'Este pedido fue cancelado' });
  if ((venta.estado || 'pagado') !== 'pagado') {
    return res.status(400).json({ error: 'El seguimiento empieza cuando el pago esté confirmado' });
  }

  // La primera vez se busca la dirección en el mapa y se guarda
  let destino = seguimiento.TIENDA;
  let aproximado = false;
  if (venta.direccion) {
    if (venta.lat == null) {
      const punto = await seguimiento.ubicarDireccion(venta.direccion);
      aproximado = !punto;
      const final = punto || seguimiento.puntoCercano(venta.id);
      await pool.query('UPDATE ventas SET lat = $1, lng = $2 WHERE id = $3', [final.lat, final.lng, venta.id]);
      venta.lat = final.lat;
      venta.lng = final.lng;
    }
    destino = { lat: venta.lat, lng: venta.lng };
  }
  // Sale desde la dirección del primer producto que tenga ubicación (si no, desde la tienda)
  const ids = (venta.items || []).map((i) => i.id);
  const origenProducto = (
    await pool.query('SELECT direccion, lat, lng FROM productos WHERE id = ANY($1) AND lat IS NOT NULL LIMIT 1', [ids])
  ).rows[0];
  const origen = origenProducto ? { lat: origenProducto.lat, lng: origenProducto.lng } : seguimiento.TIENDA;
  res.json({
    ...seguimiento.calcular(venta, destino, origen),
    direccion: venta.direccion,
    origen_direccion: origenProducto?.direccion || 'Tienda principal',
    aproximado,
  });
});

// Aviso automático de OpenNode cuando cambia el estado de un cobro
app.post('/webhook/opennode', async (req, res) => {
  if (!pagos.avisoValido(req.body)) return res.status(401).send('firma inválida');
  const { rows } = await pool.query('SELECT id FROM ventas WHERE cobro_id = $1', [req.body.id]);
  if (rows[0]) {
    if (req.body.status === 'paid') await marcarPagada(rows[0].id);
    if (req.body.status === 'expired') await cancelarVenta(rows[0].id, 'expirado');
  }
  res.send('ok');
});

// Usuarios registrados con cuántas compras tienen y cuánto han gastado (solo admin)
app.get('/usuarios', soloAdmin, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT u.id, u.nombre, u.email,
           COUNT(v.id) FILTER (WHERE COALESCE(v.estado, 'pagado') = 'pagado') AS compras,
           COALESCE(SUM(v.total) FILTER (WHERE COALESCE(v.estado, 'pagado') = 'pagado'), 0) AS total_gastado,
           MAX(v.fecha) AS ultima_compra
    FROM usuarios u
    LEFT JOIN ventas v ON v.usuario_id = u.id
    GROUP BY u.id
    ORDER BY u.id DESC`);
  res.json(rows);
});

// Todas las ventas (solo admin)
app.get('/ventas', soloAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ventas ORDER BY id DESC');
  res.json(rows);
});

// Compras de un usuario (para la app)
// (incluye qué puede hacer el cliente: cancelar, devolver, garantía)
app.get('/ventas/usuario/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM ventas WHERE usuario_id = $1 ORDER BY id DESC',
    [req.params.id]
  );
  const solicitudes = (
    await pool.query('SELECT venta_id, tipo, estado FROM solicitudes WHERE usuario_id = $1', [req.params.id])
  ).rows;
  res.json(rows.map((v) => ({ ...v, ...postventa.opciones(v, solicitudes.filter((s) => s.venta_id === v.id)) })));
});

// Cancelar pedido, devoluciones y garantías
postventa.rutas(app, pool, { soloAdmin, devolverStock });

init()
  .then(() => app.listen(PORT, () => console.log('API en puerto ' + PORT)))
  .catch((e) => console.error('Error al iniciar:', e.message));
