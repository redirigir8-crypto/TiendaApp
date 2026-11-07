// =============================================
//  API Tienda de Bicicletas (Express + Postgres)
// =============================================
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Clave para el panel admin (configúrala en Render como ADMIN_KEY)
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';

const app = express();
app.use(cors());
app.use(express.json());

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
// Registra la compra y descuenta el stock (todo o nada, con una transacción)
app.post('/ventas', async (req, res) => {
  const { items, subtotal, iva, envio, total, direccion, metodo_pago, usuario_id, cliente } = req.body;
  const conexion = await pool.connect();
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
      `INSERT INTO ventas (items, subtotal, iva, envio, total, direccion, metodo_pago, usuario_id, cliente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [JSON.stringify(items), subtotal, iva, envio, total, direccion, metodo_pago, usuario_id, cliente]
    );
    await conexion.query('COMMIT');
    res.json(rows[0]);
  } catch (e) {
    await conexion.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    conexion.release();
  }
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
