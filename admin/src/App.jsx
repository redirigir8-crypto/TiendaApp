import { useEffect, useState } from 'react';

// URL del backend en Render
const API = 'https://tiendaapp-9xc4.onrender.com';

const formVacio = { nombre: '', precio: '', descripcion: '', imagen: '' };

export default function App() {
  const [clave, setClave] = useState(localStorage.getItem('clave') || '');
  const [entro, setEntro] = useState(false);
  const [pestana, setPestana] = useState('productos');
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
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
    const datos = { ...form, precio: Number(form.precio) };
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
      descripcion: p.descripcion || '',
      imagen: p.imagen || '',
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
      </div>

      {pestana === 'productos' && (
        <>
          <form className="tarjeta" onSubmit={guardar}>
            <h3>{editandoId ? 'Editar bicicleta' : 'Nueva bicicleta'}</h3>
            <input placeholder="Nombre" value={form.nombre} onChange={cambiar('nombre')} required />
            <input placeholder="Precio" type="number" value={form.precio} onChange={cambiar('precio')} required />
            <textarea placeholder="Descripción" value={form.descripcion} onChange={cambiar('descripcion')} />
            <input placeholder="URL de la imagen (opcional)" value={form.imagen} onChange={cambiar('imagen')} />
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
                <tr><th>Imagen</th><th>Nombre</th><th>Precio</th><th></th></tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.imagen ? <img className="mini" src={p.imagen} /> : '🚲'}</td>
                    <td>{p.nombre}</td>
                    <td>${Number(p.precio).toLocaleString('es-CO')}</td>
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
              <tr><th>#</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Fecha</th></tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td>{v.id}</td>
                  <td>{v.cliente || '-'}</td>
                  <td>{(v.items || []).map((i) => `${i.cantidad || 1}x ${i.nombre}`).join(', ')}</td>
                  <td>${Number(v.total).toLocaleString('es-CO')}</td>
                  <td>{new Date(v.fecha).toLocaleString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
