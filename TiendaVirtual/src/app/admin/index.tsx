// Resumen del negocio: indicadores, ventas de la semana y lo más vendido
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import * as api from '@/admin/api';
import { C, Etiqueta, pesos, s, Tarjeta } from '@/admin/ui';

type Datos = {
  ventas: api.VentaAdmin[];
  productos: api.ProductoAdmin[];
  solicitudes: api.SolicitudAdmin[];
  usuarios: api.UsuarioAdmin[];
};

const pagada = (v: api.VentaAdmin) => (v.estado ?? 'pagado') === 'pagado';
const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export default function Resumen() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    setCargando(true);
    Promise.all([api.ventas(), api.productos(), api.solicitudes(), api.usuarios()])
      .then(([ventas, productos, solicitudes, usuarios]) => {
        setDatos({ ventas, productos, solicitudes, usuarios });
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  if (!datos) {
    return (
      <View style={[s.pantalla, { justifyContent: 'center' }]}>
        <Text style={{ textAlign: 'center', color: C.gris }}>{error || 'Cargando...'}</Text>
      </View>
    );
  }

  // ---------- Cálculos ----------
  const hoy = new Date();
  const pagadas = datos.ventas.filter(pagada);
  const ingresos = pagadas.reduce((t, v) => t + v.total, 0);
  const deHoy = pagadas.filter((v) => mismoDia(new Date(v.fecha), hoy));
  const ingresosHoy = deHoy.reduce((t, v) => t + v.total, 0);
  const pendientes = datos.solicitudes.filter((x) => x.estado === 'pendiente').length;
  const agotados = datos.productos.filter((p) => p.stock <= 0);
  const pocoStock = datos.productos.filter((p) => p.stock > 0 && p.stock <= 2);

  // Ingresos de los últimos 7 días (para la gráfica)
  const semana = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date();
    dia.setDate(hoy.getDate() - (6 - i));
    const total = pagadas.filter((v) => mismoDia(new Date(v.fecha), dia)).reduce((t, v) => t + v.total, 0);
    return { dia, total };
  });
  const maximo = Math.max(1, ...semana.map((d) => d.total));

  // Productos más vendidos (unidades)
  const unidades: Record<string, number> = {};
  for (const v of pagadas) for (const i of v.items) unidades[i.nombre] = (unidades[i.nombre] ?? 0) + i.cantidad;
  const top = Object.entries(unidades).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <ScrollView
      style={s.pantalla}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}>
      {/* ---------- Ingresos ---------- */}
      <View style={{ backgroundColor: C.oscuro, padding: 20, paddingTop: 8, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Text style={{ color: '#94a3b8' }}>Ingresos totales</Text>
        <Text style={{ color: 'white', fontSize: 34, fontWeight: '800', marginTop: 2 }}>{pesos(ingresos)}</Text>
        <Text style={{ color: '#a5b4fc', marginTop: 4 }}>
          Hoy: {pesos(ingresosHoy)} · {deHoy.length} {deHoy.length === 1 ? 'venta' : 'ventas'}
        </Text>
      </View>

      {/* ---------- Indicadores ---------- */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 }}>
        <Indicador emoji="🧾" valor={pagadas.length} texto="Pedidos" onPress={() => router.navigate('/admin/ventas')} />
        <Indicador emoji="👥" valor={datos.usuarios.length} texto="Clientes" onPress={() => router.navigate('/admin/usuarios')} />
        <Indicador emoji="🛠" valor={pendientes} texto="Solicitudes" alerta={pendientes > 0}
          onPress={() => router.navigate('/admin/solicitudes')} />
        <Indicador emoji="📦" valor={agotados.length} texto="Agotados" alerta={agotados.length > 0}
          onPress={() => router.navigate('/admin/productos')} />
      </View>

      {/* ---------- Gráfica de la semana ---------- */}
      <Tarjeta>
        <Text style={s.titulo}>Ventas de los últimos 7 días</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, marginTop: 16, gap: 8 }}>
          {semana.map(({ dia, total }) => (
            <View key={dia.toDateString()} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: '100%',
                  height: Math.max(4, (total / maximo) * 110),
                  backgroundColor: mismoDia(dia, hoy) ? C.primario : '#c7d2fe',
                  borderRadius: 8,
                }}
              />
              <Text style={{ fontSize: 11, color: C.gris, marginTop: 6 }}>
                {dia.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}
              </Text>
            </View>
          ))}
        </View>
      </Tarjeta>

      {/* ---------- Más vendidos ---------- */}
      <Tarjeta>
        <Text style={[s.titulo, { marginBottom: 8 }]}>🏆 Más vendidos</Text>
        {top.length === 0 && <Text style={s.subtitulo}>Todavía no hay ventas</Text>}
        {top.map(([nombre, cant], i) => (
          <View key={nombre} style={[s.fila, { paddingVertical: 8 }]}>
            <Text style={{ color: C.texto, flex: 1 }}>
              {['🥇', '🥈', '🥉'][i]} {nombre}
            </Text>
            <Text style={{ fontWeight: '700', color: C.texto }}>{cant} und.</Text>
          </View>
        ))}
      </Tarjeta>

      {/* ---------- Inventario ---------- */}
      {(agotados.length > 0 || pocoStock.length > 0) && (
        <Tarjeta>
          <Text style={[s.titulo, { marginBottom: 8 }]}>⚠️ Inventario</Text>
          {[...agotados, ...pocoStock].map((p) => (
            <View key={p.id} style={[s.fila, { paddingVertical: 6 }]}>
              <Text style={{ color: C.texto, flex: 1 }}>{p.nombre}</Text>
              <Etiqueta texto={p.stock <= 0 ? 'Agotado' : `Quedan ${p.stock}`} tono={p.stock <= 0 ? 'rojo' : 'ambar'} />
            </View>
          ))}
        </Tarjeta>
      )}

      {/* ---------- Últimas ventas ---------- */}
      <Tarjeta>
        <Text style={[s.titulo, { marginBottom: 8 }]}>Últimas ventas</Text>
        {datos.ventas.slice(0, 5).map((v) => (
          <View key={v.id} style={[s.fila, { paddingVertical: 8, borderTopWidth: 1, borderColor: C.borde }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: C.texto }}>#{v.id} · {v.cliente || 'Cliente'}</Text>
              <Text style={s.subtitulo}>{new Date(v.fecha).toLocaleString('es-CO')}</Text>
            </View>
            <Text style={{ fontWeight: '800', color: pagada(v) ? C.texto : C.gris }}>{pesos(v.total)}</Text>
          </View>
        ))}
      </Tarjeta>
    </ScrollView>
  );
}

// Cuadrito con un número importante (al tocarlo abre la pestaña correspondiente)
function Indicador({
  emoji, valor, texto, alerta, onPress,
}: { emoji: string; valor: number; texto: string; alerta?: boolean; onPress: () => void }) {
  return (
    <View style={{ width: '50%', padding: 6 }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          { backgroundColor: alerta ? C.ambarSuave : C.tarjeta, borderRadius: 16, padding: 16 },
          pressed && { opacity: 0.7 },
        ]}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
        <Text style={{ fontSize: 26, fontWeight: '800', color: alerta ? C.ambar : C.texto, marginTop: 6 }}>{valor}</Text>
        <Text style={{ color: C.gris }}>{texto}</Text>
      </Pressable>
    </View>
  );
}
