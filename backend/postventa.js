// =============================================
//  Postventa: cancelar pedidos, devoluciones y garantías
// =============================================
const { MINUTOS_PREPARACION } = require('./seguimiento');

// Reglas (cámbialas aquí)
const DIAS_DEVOLUCION = 30; // días para pedir devolución
const DIAS_GARANTIA = 365; // días de garantía

const DIA = 24 * 60 * 60 * 1000;

// Qué puede hacer el cliente con una venta (según el estado y el tiempo que ha pasado)
function opciones(venta, solicitudes = []) {
  const estado = venta.estado || 'pagado';
  const pagado = new Date(venta.pagado_en || venta.fecha).getTime();
  const ahora = Date.now();
  const yaSalio = ahora >= pagado + MINUTOS_PREPARACION * 60000; // el pedido ya salió de la tienda
  const pendiente = (tipo) => solicitudes.some((s) => s.tipo === tipo && s.estado === 'pendiente');

  return {
    // Se puede cancelar si no se ha pagado (Bitcoin) o si todavía no ha salido de la tienda
    puede_cancelar: estado === 'pendiente_pago' || (estado === 'pagado' && !yaSalio),
    puede_devolver: estado === 'pagado' && yaSalio && ahora - pagado <= DIAS_DEVOLUCION * DIA && !pendiente('devolucion'),
    puede_garantia: estado === 'pagado' && yaSalio && ahora - pagado <= DIAS_GARANTIA * DIA && !pendiente('garantia'),
  };
}

// Registra las rutas de postventa en el servidor
function rutas(app, pool, { soloAdmin, devolverStock }) {
  // Venta que pertenece al usuario (o null)
  async function ventaDelUsuario(ventaId, usuarioId) {
    const { rows } = await pool.query('SELECT * FROM ventas WHERE id = $1 AND usuario_id = $2', [ventaId, usuarioId]);
    return rows[0] || null;
  }

  async function solicitudesDe(ventaId) {
    const { rows } = await pool.query('SELECT * FROM solicitudes WHERE venta_id = $1', [ventaId]);
    return rows;
  }

  // ---------- Cancelar pedido ----------
  app.post('/ventas/:id/cancelar', async (req, res) => {
    const venta = await ventaDelUsuario(req.params.id, req.body.usuario_id);
    if (!venta) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (!opciones(venta).puede_cancelar) {
      return res.status(400).json({ error: 'El pedido ya salió de la tienda. Puedes pedir una devolución.' });
    }
    // Solo cambia si sigue en el mismo estado (evita cancelar dos veces)
    const { rows } = await pool.query(
      "UPDATE ventas SET estado = 'cancelado' WHERE id = $1 AND estado = $2 RETURNING *",
      [venta.id, venta.estado || 'pagado']
    );
    if (!rows[0]) return res.status(400).json({ error: 'No se pudo cancelar' });
    await devolverStock(rows[0].items);
    res.json({
      ...rows[0],
      mensaje: venta.estado === 'pagado'
        ? 'Pedido cancelado. El reembolso se hará al mismo medio de pago (simulado).'
        : 'Pedido cancelado.',
    });
  });

  // ---------- Crear solicitud de devolución o garantía ----------
  // body: { usuario_id, tipo: 'devolucion' | 'garantia', items: [{id, nombre, cantidad}], motivo }
  app.post('/ventas/:id/solicitudes', async (req, res) => {
    const { usuario_id, tipo, items, motivo } = req.body;
    if (!['devolucion', 'garantia'].includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (!items?.length) return res.status(400).json({ error: 'Elige al menos un producto' });
    if (!motivo || motivo.trim().length < 5) return res.status(400).json({ error: 'Cuéntanos el motivo' });

    const venta = await ventaDelUsuario(req.params.id, usuario_id);
    if (!venta) return res.status(404).json({ error: 'Pedido no encontrado' });
    const op = opciones(venta, await solicitudesDe(venta.id));
    if (tipo === 'devolucion' && !op.puede_devolver) {
      return res.status(400).json({ error: `La devolución se puede pedir hasta ${DIAS_DEVOLUCION} días después de la compra.` });
    }
    if (tipo === 'garantia' && !op.puede_garantia) {
      return res.status(400).json({ error: 'Este pedido ya no tiene garantía disponible.' });
    }

    // Solo productos y cantidades que sí están en la compra
    const comprados = venta.items;
    const validos = items
      .map((i) => {
        const original = comprados.find((c) => c.id === i.id);
        if (!original) return null;
        return { id: original.id, nombre: original.nombre, precio: original.precio,
                 cantidad: Math.min(Math.max(1, Number(i.cantidad) || 1), original.cantidad) };
      })
      .filter(Boolean);
    if (!validos.length) return res.status(400).json({ error: 'Esos productos no están en el pedido' });

    const { rows } = await pool.query(
      `INSERT INTO solicitudes (venta_id, usuario_id, tipo, items, motivo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [venta.id, usuario_id, tipo, JSON.stringify(validos), motivo.trim()]
    );
    res.json(rows[0]);
  });

  // Solicitudes de un usuario (app)
  app.get('/solicitudes/usuario/:id', async (req, res) => {
    const { rows } = await pool.query(
      `SELECT s.*, v.numero AS venta_numero
       FROM solicitudes s LEFT JOIN ventas v ON v.id = s.venta_id
       WHERE s.usuario_id = $1 ORDER BY s.id DESC`,
      [req.params.id]
    );
    res.json(rows);
  });

  // ---------- Admin ----------
  app.get('/solicitudes', soloAdmin, async (req, res) => {
    const { rows } = await pool.query(`
      SELECT s.*, u.nombre AS cliente, u.email
      FROM solicitudes s LEFT JOIN usuarios u ON u.id = s.usuario_id
      ORDER BY (s.estado = 'pendiente') DESC, s.id DESC`);
    res.json(rows);
  });

  // Aprobar o rechazar. body: { estado: 'aprobada' | 'rechazada', respuesta }
  app.put('/solicitudes/:id', soloAdmin, async (req, res) => {
    const { estado, respuesta } = req.body;
    if (!['aprobada', 'rechazada'].includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    const { rows } = await pool.query(
      `UPDATE solicitudes SET estado = $1, respuesta = $2, respondida_en = NOW()
       WHERE id = $3 AND estado = 'pendiente' RETURNING *`,
      [estado, respuesta || '', req.params.id]
    );
    const solicitud = rows[0];
    if (!solicitud) return res.status(400).json({ error: 'La solicitud ya fue respondida' });
    // Devolución aprobada: los productos vuelven al inventario
    if (solicitud.tipo === 'devolucion' && estado === 'aprobada') await devolverStock(solicitud.items);
    res.json(solicitud);
  });
}

// Tabla de solicitudes
const SQL_TABLAS = `
  CREATE TABLE IF NOT EXISTS solicitudes (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER,
    usuario_id INTEGER,
    tipo TEXT,                         -- devolucion | garantia
    items JSONB,                       -- productos de la solicitud
    motivo TEXT,
    estado TEXT DEFAULT 'pendiente',   -- pendiente | aprobada | rechazada
    respuesta TEXT,
    fecha TIMESTAMP DEFAULT NOW(),
    respondida_en TIMESTAMP
  );`;

module.exports = { opciones, rutas, SQL_TABLAS, DIAS_DEVOLUCION, DIAS_GARANTIA };
