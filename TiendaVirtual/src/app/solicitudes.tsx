// Mis devoluciones y garantías, con la respuesta de la tienda
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { misSolicitudes, Solicitud, usuarioGuardado } from '../db';

const ESTADOS = {
  pendiente: { texto: '⏳ En revisión', color: '#b07a00' },
  aprobada: { texto: '✅ Aprobada', color: '#22a050' },
  rechazada: { texto: '❌ Rechazada', color: '#d93a3a' },
};

export default function Solicitudes() {
  const [lista, setLista] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    const u = usuarioGuardado();
    if (!u) return;
    setCargando(true);
    misSolicitudes(u)
      .then(setLista)
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  useFocusEffect(cargar);

  return (
    <FlatList
      style={{ backgroundColor: '#f4f6f8' }}
      data={lista}
      keyExtractor={(s) => String(s.id)}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
      ListEmptyComponent={
        <Text style={{ textAlign: 'center', marginTop: 30, color: '#666' }}>
          No tienes devoluciones ni garantías.{'\n'}Puedes pedirlas desde el comprobante de una compra.
        </Text>
      }
      renderItem={({ item }) => {
        const est = ESTADOS[item.estado];
        return (
          <View style={estilos.tarjeta}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={estilos.titulo}>
                {item.tipo === 'devolucion' ? '↩ Devolución' : '🛠 Garantía'} · Pedido N° {item.venta_id}
              </Text>
              <Text style={{ color: est.color, fontWeight: 'bold' }}>{est.texto}</Text>
            </View>
            <Text style={{ color: '#666' }}>{new Date(item.fecha).toLocaleString('es-CO')}</Text>
            {item.items.map((i) => (
              <Text key={i.id}>
                {i.cantidad} x {i.nombre}
              </Text>
            ))}
            <Text style={{ marginTop: 4 }}>Motivo: {item.motivo}</Text>
            {!!item.respuesta && (
              <View style={estilos.respuesta}>
                <Text style={{ fontWeight: 'bold' }}>Respuesta de la tienda:</Text>
                <Text>{item.respuesta}</Text>
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 14, borderRadius: 10 },
  titulo: { fontWeight: 'bold', flexShrink: 1 },
  respuesta: { backgroundColor: '#f0f4fa', padding: 10, borderRadius: 8, marginTop: 8 },
});
