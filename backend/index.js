// =============================================
//  API Tienda de Bicicletas (Express + Postgres)
// =============================================
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pagos = require('./pagos');
const { enviarFactura } = require('./correo');

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
  const { nombre, email, password } = req.body;
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nombre, email, password) VALUES ($1, $2, $3) RETURNING id, nombre, email',
      [nombre, email.toLowerCase(), hash]
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
  res.json({ id: usuario.id, nombre: usuario.nombre, email: usuario.email });
});

// ---------- Productos ----------
app.get('/productos', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM productos ORDER BY id');
  res.json(rows);
});

// imagenes = lista de URLs (varias fotos de la bicicleta). La primera es la portada.
app.post('/productos', soloAdmin, async (req, res) => {
  const { nombre, precio, descripcion, stock, imagenes = [] } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO productos (nombre, precio, descripcion, imagen, imagenes, stock) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [nombre, precio, descripcion, imagenes[0] || null, JSON.stringify(imagenes), stock]
  );
  res.json(rows[0]);
});

app.put('/productos/:id', soloAdmin, async (req, res) => {
  const { nombre, precio, descripcion, stock, imagenes = [] } = req.body;
  const { rows } = await pool.query(
    'UPDATE productos SET nombre=$1, precio=$2, descripcion=$3, imagen=$4, imagenes=$5, stock=$6 WHERE id=$7 RETURNING *',
    [nombre, precio, descripcion, imagenes[0] || null, JSON.stringify(imagenes), stock, req.params.id]
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
    .then((cliente) => cliente && enviarFactura(venta, cliente))
    .catch((e) => console.error('Error con la factura:', e.message));
}

// Pasa una venta Bitcoin a "pagado" (solo una vez) y manda la factura
async function marcarPagada(ventaId) {
  const { rows } = await pool.query(
    "UPDATE ventas SET estado = 'pagado' WHERE id = $1 AND estado = 'pendiente_pago' RETURNING *",
    [ventaId]
  );
  if (rows[0]) mandarFactura(rows[0]);
}

// Cancela una venta sin pagar y devuelve el stock
async function cancelarVenta(ventaId, estado) {
  const { rows } = await pool.query(
    "UPDATE ventas SET estado = $2 WHERE id = $1 AND estado = 'pendiente_pago' RETURNING *",
    [ventaId, estado]
  );
  for (const item of rows[0]?.items || []) {
    await pool.query('UPDATE productos SET stock = stock + $1 WHERE id = $2', [item.cantidad, item.id]);
  }
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
      `INSERT INTO ventas (items, subtotal, iva, envio, total, direccion, metodo_pago, usuario_id, cliente, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [JSON.stringify(items), subtotal, iva, envio, total, direccion, metodo_pago, usuario_id, cliente, estado]
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
      'UPDATE ventas SET cobro_id = $1, checkout_url = $2, metodo_pago = $3 WHERE id = $4 RETURNING *',
      [cobro.id, cobro.checkout_url, `Bitcoin (${cobro.satoshis} sats)`, venta.id]
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
  const actual = await pool.query('SELECT * FROM ventas WHERE id = $1', [req.params.id]);
  res.json(actual.rows[0]);
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

// Todas las ventas (solo admin)
app.get('/ventas', soloAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ventas ORDER BY id DESC');
  res.json(rows);
});

// Compras de un usuario (para la app)
app.get('/ventas/usuario/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM ventas WHERE usuario_id = $1 ORDER BY id DESC',
    [req.params.id]
  );
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
init()
  .then(() => app.listen(PORT, () => console.log('API en puerto ' + PORT)))
  .catch((e) => console.error('Error al iniciar:', e.message));
