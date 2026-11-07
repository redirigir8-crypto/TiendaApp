// Historial de compras del usuario, con botón para descargar la factura
import { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { misCompras, usuarioGuardado, Venta } from '../db';
import { descargarFactura, pesos } from '../factura';

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

  // Al abrir la pantalla carga las compras
  useEffect(() => {
    if (usuario) misCompras(usuario).then(setCompras);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FlatList
      style={{ backgroundColor: '#f4f6f8' }}
      data={compras}
      keyExtractor={(v) => String(v.id)}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
      ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 30 }}>Aún no tienes compras</Text>}
      renderItem={({ item }) => (
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>
            Factura N° {item.id} {item.pendiente ? '(pendiente)' : ''}
          </Text>
          <Text style={{ color: '#666' }}>{new Date(item.fecha).toLocaleString('es-CO')}</Text>
          {item.items.map((i) => (
            <Text key={i.id}>
              {i.cantidad} x {i.nombre}
            </Text>
          ))}
          <Text style={estilos.total}>Total: {pesos(item.total)}</Text>
          <Pressable style={estilos.boton} onPress={() => usuario && descargarFactura(item, usuario)}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Descargar factura PDF</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const estilos = StyleSheet.create({
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 14, borderRadius: 10 },
  titulo: { fontSize: 16, fontWeight: 'bold' },
  total: { fontWeight: 'bold', color: '#1e6fd9', marginTop: 6 },
  boton: { backgroundColor: '#1e6fd9', padding: 10, borderRadius: 6, alignItems: 'center', marginTop: 10 },
});
