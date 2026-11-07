const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: url,
  ssl: url.includes('render.com') ? { rejectUnauthorized: false } : false,
});

const app = express();
app.use(cors());
app.use(express.json());

// Crea las tablas y unos productos de ejemplo al arrancar
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY, nombre TEXT, precio NUMERIC);
    CREATE TABLE IF NOT EXISTS ventas (
      id SERIAL PRIMARY KEY, items JSONB, total NUMERIC,
      fecha TIMESTAMP DEFAULT NOW());
  `);
  const { rows } = await pool.query('SELECT COUNT(*) FROM productos');
  if (rows[0].count === '0') {
    await pool.query(`INSERT INTO productos (nombre, precio) VALUES
      ('Arroz', 3000), ('Leche', 4500), ('Pan', 2000)`);
  }
}

app.get('/productos', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM productos ORDER BY id');
  res.json(rows);
});

app.post('/ventas', async (req, res) => {
  const { items, total } = req.body;
  await pool.query('INSERT INTO ventas (items, total) VALUES ($1, $2)',
    [JSON.stringify(items), total]);
  res.json({ ok: true });
});

app.get('/ventas', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM ventas ORDER BY id DESC');
  res.json(rows);
});

const PORT = process.env.PORT || 3000;
init().then(() => app.listen(PORT, () => console.log('API en puerto ' + PORT)));