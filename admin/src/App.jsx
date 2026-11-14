import { useEffect, useState } from 'react';

// URL del backend en Render
const API = 'https://tiendaapp-9xc4.onrender.com';

// "imagenes" es un texto con una URL por línea (cada línea = una foto)
const formVacio = { nombre: '', precio: '', stock: '', descripcion: '', imagenes: '', direccion: '' };

// Lista de fotos de un producto (compatible con productos viejos que solo tienen "imagen")
const fotosDe = (p) => (p.imagenes && p.imagenes.length ? p.imagenes : p.imagen ? [p.imagen] : []);
// Cómo se muestra el estado de cada venta
const ESTADOS = {
  pagado: '✅ Pagado',
  pendiente_pago: '⏳ Esperando Bitcoin',
  expirado: '❌ Expirado',
  cancelado: '❌ Cancelado',
};
const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-CO');

export default function App() {
  const [clave, setClave] = useState(localStorage.getItem('clave') || '');
  const [entro, setEntro] = useState(false);
  const [pestana, setPestana] = useState('productos');
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [form, setForm] = useState(formVacio);
  const [editandoId, setEditandoId] = useState(null);

  // Todas las peticiones de admin llevan la clave en el header
  const pedir = (ruta, metodo = 'GET', cuerpo) =>
    fetch(API + ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'x-admin-key': clave },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });

  const cargarProductos = async () => {
    const res = await fetch(API + '/productos');
    setProductos(await res.json());
  };

  const cargarVentas = async () => {
    const res = await pedir('/ventas');
    if (res.ok) setVentas(await res.json());
  };

  const cargarUsuarios = async () => {
    const res = await pedir('/usuarios');
    if (res.ok) setUsuarios(await res.json());
  };

  const cargarSolicitudes = async () => {
    const res = await pedir('/solicitudes');
    if (res.ok) setSolicitudes(await res.json());
  };

  // Aprobar o rechazar una devolución / garantía
  const responder = async (s, estado) => {
    const respuesta = prompt(
      estado === 'aprobada' ? 'Mensaje para el cliente (ej: pasaremos a recoger el producto):' : 'Motivo del rechazo:'
    );
    if (respuesta === null) return; // canceló
    const res = await pedir('/solicitudes/' + s.id, 'PUT', { estado, respuesta });
    if (!res.ok) alert((await res.json()).error);
    cargarSolicitudes();
  };

  const entrar = async (e) => {
    e.preventDefault();
    const res = await pedir('/ventas');
    if (!res.ok) return alert('Clave incorrecta');
    localStorage.setItem('clave', clave);
    setEntro(true);
  };

  useEffect(() => {
    if (entro) {
      cargarProductos();
      cargarVentas();
    }
  }, [entro]);

  const guardar = async (e) => {
    e.preventDefault();
    const datos = {
      ...form,
      precio: Number(form.precio),
      stock: Number(form.stock),
      imagenes: form.imagenes.split('\n').map((u) => u.trim()).filter(Boolean),
    };
    if (editandoId) await pedir('/productos/' + editandoId, 'PUT', datos);
    else await pedir('/productos', 'POST', datos);
    setForm(formVacio);
    setEditandoId(null);
    cargarProductos();
  };

  const editar = (p) => {
    setEditandoId(p.id);
    setForm({
      nombre: p.nombre,
      precio: p.precio,
      stock: p.stock ?? 0,
      descripcion: p.descripcion || '',
      imagenes: fotosDe(p).join('\n'),
      direccion: p.direccion || '',
    });
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return;
    await pedir('/productos/' + id, 'DELETE');
    cargarProductos();
  };

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  // ---------- Pantalla de clave ----------
  if (!entro) {
    return (
      <div className="contenedor">
        <h1>🚲 Panel Admin</h1>
        <form className="tarjeta" onSubmit={entrar}>
          <p>Escribe la clave de administrador:</p>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} />
          <button>Entrar</button>
        </form>
      </div>
    );
  }

  // ---------- Panel ----------
  return (
    <div className="contenedor">
      <h1>🚲 Panel Admin</h1>

      <div className="pestanas" style={{ marginBottom: 16 }}>
        <button className={pestana === 'productos' ? 'activa' : ''} onClick={() => setPestana('productos')}>
          Productos
        </button>
        <button className={pestana === 'ventas' ? 'activa' : ''} onClick={() => { setPestana('ventas'); cargarVentas(); }}>
          Ventas
        </button>
        <button className={pestana === 'usuarios' ? 'activa' : ''} onClick={() => { setPestana('usuarios'); cargarUsuarios(); }}>
          Usuarios
        </button>
        <button className={pestana === 'solicitudes' ? 'activa' : ''} onClick={() => { setPestana('solicitudes'); cargarSolicitudes(); }}>
          Devoluciones y garantías
        </button>
      </div>

      {pestana === 'productos' && (
        <>
          <form className="tarjeta" onSubmit={guardar}>
            <h3>{editandoId ? 'Editar bicicleta' : 'Nueva bicicleta'}</h3>
            <input placeholder="Nombre" value={form.nombre} onChange={cambiar('nombre')} required />
            <input placeholder="Precio (sin IVA)" type="number" value={form.precio} onChange={cambiar('precio')} required />
            <input placeholder="Stock (unidades disponibles)" type="number" value={form.stock} onChange={cambiar('stock')} required />
            <input placeholder="Dirección de despacho (desde dónde sale el producto)" value={form.direccion} onChange={cambiar('direccion')} />
            <textarea placeholder="Descripción" value={form.descripcion} onChange={cambiar('descripcion')} />
            <label>Fotos: pega una URL por línea (la primera es la portada)</label>
            <textarea rows={4} placeholder={'https://...foto-frente.jpg\nhttps://...foto-lado.jpg'} value={form.imagenes} onChange={cambiar('imagenes')} />
            <div className="fotos">
              {form.imagenes.split('\n').filter((u) => u.trim()).map((u) => (
                <img key={u} className="mini" src={u.trim()} />
              ))}
            </div>
            <button>{editandoId ? 'Guardar cambios' : 'Publicar'}</button>
            {editandoId && (
              <button type="button" className="gris" onClick={() => { setEditandoId(null); setForm(formVacio); }}>
                Cancelar
              </button>
            )}
          </form>

          <div className="tarjeta">
            <h3>Productos publicados</h3>
            <table>
              <thead>
                <tr><th>Fotos</th><th>Nombre</th><th>Precio</th><th>Stock</th><th></th></tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {fotosDe(p).length ? <img className="mini" src={fotosDe(p)[0]} /> : '🚲'}
                      {fotosDe(p).length > 1 && <small> +{fotosDe(p).length - 1}</small>}
                    </td>
                    <td>{p.nombre}{p.direccion && <><br /><small>📦 {p.direccion}</small></>}</td>
                    <td>{pesos(p.precio)}</td>
                    <td style={{ color: p.stock > 0 ? 'green' : 'red' }}>{p.stock > 0 ? p.stock : 'Agotado'}</td>
                    <td>
                      <button onClick={() => editar(p)}>Editar</button>
                      <button className="rojo" onClick={() => eliminar(p.id)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pestana === 'ventas' && (
        <div className="tarjeta">
          <h3>Ventas</h3>
          <table>
            <thead>
              <tr><th>#</th><th>Cliente</th><th>Productos</th><th>Pago</th><th>Estado</th><th>Entrega</th><th>IVA</th><th>Total</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.cliente || '-'}</td>
                  <td>{(v.items || []).map((i) => `${i.cantidad || 1}x ${i.nombre}`).join(', ')}</td>
                  <td>{v.metodo_pago || '-'}</td>
                  <td>{ESTADOS[v.estado || 'pagado'] || v.estado}</td>
                  <td>{v.direccion ? 'Domicilio: ' + v.direccion : 'Tienda'}</td>
                  <td>{pesos(v.iva)}</td>
                  <td><b>{pesos(v.total)}</b></td>
                  <td>{new Date(v.fecha).toLocaleString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pestana === 'solicitudes' && (
        <div className="tarjeta">
          <h3>Devoluciones y garantías</h3>
          <table>
            <thead>
              <tr><th>#</th><th>Tipo</th><th>Pedido</th><th>Cliente</th><th>Productos</th><th>Motivo</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {solicitudes.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>{s.tipo === 'devolucion' ? '↩ Devolución' : '🛠 Garantía'}</td>
                  <td>#{s.venta_id}</td>
                  <td>{s.cliente}<br /><small>{s.email}</small></td>
                  <td>{(s.items || []).map((i) => `${i.cantidad}x ${i.nombre}`).join(', ')}</td>
                  <td>{s.motivo}</td>
                  <td>
                    {{ pendiente: '⏳ Pendiente', aprobada: '✅ Aprobada', rechazada: '❌ Rechazada' }[s.estado]}
                    {s.respuesta && <><br /><small>{s.respuesta}</small></>}
                  </td>
                  <td>
                    {s.estado === 'pendiente' && (
                      <>
                        <button onClick={() => responder(s, 'aprobada')}>Aprobar</button>
                        <button className="rojo" onClick={() => responder(s, 'rechazada')}>Rechazar</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p><small>Al aprobar una devolución, los productos vuelven al inventario.</small></p>
        </div>
      )}

      {pestana === 'usuarios' && (
        <div className="tarjeta">
          <h3>Usuarios registrados ({usuarios.length})</h3>
          <table>
            <thead>
              <tr><th>#</th><th>Nombre</th><th>Correo</th><th>Compras</th><th>Total gastado</th><th>Última compra</th></tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.nombre}</td>
                  <td>{u.email}</td>
                  <td>{u.compras}</td>
                  <td><b>{pesos(u.total_gastado)}</b></td>
                  <td>{u.ultima_compra ? new Date(u.ultima_compra).toLocaleString('es-CO') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
