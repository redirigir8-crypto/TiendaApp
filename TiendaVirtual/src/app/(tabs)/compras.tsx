// Historial de compras del usuario. Al tocar una se abre su comprobante.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text } from 'react-native';
import { misCompras, usuarioGuardado, Venta } from '@/db';
import * as estado from '@/estado';
import { pesos } from '@/factura';

export default function Compras() {
  const usuario = usuarioGuardado();
  const [compras, setCompras] = useState<Venta[]>([]);
  const [cargando, setCargando] = useState(false);

  const recargar = async () => {
    if (!usuario) return;
    setCargando(true);
    setCompras(await misCompras(usuario));
    setCargando(false);
  };

  // Cada vez que se abre la pestaña recarga las compras
  useFocusEffect(
    useCallback(() => {
      const u = usuarioGuardado();
      if (u) misCompras(u).then(setCompras);
    }, [])
  );

  const abrir = (v: Venta) => {
    estado.verComprobante(v);
    router.push('/comprobante');
  };

  return (
    <FlatList
      style={{ backgroundColor: '#f4f6f8' }}
      data={compras}
      keyExtractor={(v) => String(v.id)}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
      ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30 }}>Aún no tienes compras</Text>}
      renderItem={({ item }) => (
        <Pressable style={estilos.tarjeta} onPress={() => abrir(item)}>
          <Text style={estilos.titulo}>
            Comprobante N° {item.id} {item.pendiente ? '(sin enviar)' : ''}
            {item.estado === 'pendiente_pago' ? ' ⏳ Esperando Bitcoin' : ''}
            {item.estado === 'expirado' || item.estado === 'cancelado' ? ' ❌ Expirado' : ''}
          </Text>
          <Text style={{ color: '#666' }}>{new Date(item.fecha).toLocaleString('es-CO')}</Text>
          {item.items.map((i) => (
            <Text key={i.id}>
              {i.cantidad} x {i.nombre}
            </Text>
          ))}
          <Text style={estilos.total}>Total: {pesos(item.total)}</Text>
          <Text style={estilos.enlace}>Ver comprobante ›</Text>
        </Pressable>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 14, borderRadius: 10 },
  titulo: { fontSize: 16, fontWeight: 'bold' },
  total: { fontWeight: 'bold', color: '#1e6fd9', marginTop: 6 },
  enlace: { color: '#1e6fd9', marginTop: 6, textAlign: 'right' },
});
