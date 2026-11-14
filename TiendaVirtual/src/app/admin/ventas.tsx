// Ventas: todas las compras con filtros por estado
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';
import * as api from '@/admin/api';
import { C, Etiqueta, Filtros, pesos, s, Tarjeta, Vacio } from '@/admin/ui';

type Filtro = 'todas' | 'pagado' | 'pendiente_pago' | 'cancelado';

const ESTADO: Record<string, { texto: string; tono: 'verde' | 'ambar' | 'rojo' }> = {
  pagado: { texto: 'Pagado', tono: 'verde' },
  pendiente_pago: { texto: 'Esperando Bitcoin', tono: 'ambar' },
  expirado: { texto: 'Expirado', tono: 'rojo' },
  cancelado: { texto: 'Cancelado', tono: 'rojo' },
};

export default function Ventas() {
  const [lista, setLista] = useState<api.VentaAdmin[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    api.ventas().then(setLista).catch((e) => Alert.alert('Error', e.message)).finally(() => setCargando(false));
  }, []);
  useFocusEffect(cargar);

  const visibles = lista.filter((v) => {
    const estado = v.estado ?? 'pagado';
    if (filtro === 'todas') return true;
    if (filtro === 'cancelado') return estado === 'cancelado' || estado === 'expirado';
    return estado === filtro;
  });
  const total = visibles.filter((v) => (v.estado ?? 'pagado') === 'pagado').reduce((t, v) => t + v.total, 0);

  return (
    <View style={s.pantalla}>
      <Filtros
        valor={filtro}
        onChange={setFiltro}
        opciones={[
          { valor: 'todas', texto: 'Todas' },
          { valor: 'pagado', texto: 'Pagadas' },
          { valor: 'pendiente_pago', texto: 'Pendientes' },
          { valor: 'cancelado', texto: 'Canceladas' },
        ]}
      />
      <Text style={[s.subtitulo, { paddingHorizontal: 16, marginTop: 10 }]}>
        {visibles.length} ventas · cobrado {pesos(total)}
      </Text>
      <FlatList
        data={visibles}
        keyExtractor={(v) => String(v.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListEmptyComponent={<Vacio texto="No hay ventas con este filtro" />}
        renderItem={({ item }) => {
          const est = ESTADO[item.estado ?? 'pagado'] ?? { texto: item.estado ?? '', tono: 'ambar' as const };
          return (
            <Tarjeta>
              <View style={s.fila}>
                <Text style={s.titulo}>
                  #{item.id}
                  {item.numero ? <Text style={s.subtitulo}>  (compra {item.numero} del cliente)</Text> : null}
                </Text>
                <Etiqueta texto={est.texto} tono={est.tono} />
              </View>
              <Text style={[s.subtitulo, { marginTop: 2 }]}>
                {item.cliente || 'Cliente'} · {new Date(item.fecha).toLocaleString('es-CO')}
              </Text>

              <View style={{ marginVertical: 10, gap: 2 }}>
                {item.items.map((i) => (
                  <Text key={i.id} style={{ color: C.texto }}>
                    {i.cantidad} × {i.nombre}
                  </Text>
                ))}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {!!item.metodo_pago && <Etiqueta texto={'💳 ' + item.metodo_pago} tono="primario" />}
                <Etiqueta texto={item.direccion ? '🏠 Domicilio' : '🏪 Recoge en tienda'} tono="gris" />
              </View>
              {!!item.direccion && <Text style={[s.subtitulo, { marginTop: 6 }]}>📍 {item.direccion}</Text>}

              <View style={[s.fila, { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: C.borde }]}>
                <Text style={s.subtitulo}>IVA {pesos(item.iva)} · Envío {item.envio ? pesos(item.envio) : 'gratis'}</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: C.texto }}>{pesos(item.total)}</Text>
              </View>
            </Tarjeta>
          );
        }}
      />
    </View>
  );
}
