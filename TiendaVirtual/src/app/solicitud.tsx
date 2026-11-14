// Formulario para pedir una devolución o una garantía
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { crearSolicitud, numeroCompra, TipoSolicitud, usuarioGuardado } from '../db';
import * as estado from '../estado';

// Motivos rápidos para elegir (el cliente puede escribir más detalles)
const MOTIVOS: Record<TipoSolicitud, string[]> = {
  devolucion: ['No es lo que esperaba', 'Llegó dañado', 'Talla o tamaño incorrecto', 'Me equivoqué de producto'],
  garantia: ['Falla en los frenos', 'Falla en los cambios', 'Problema en el marco', 'Ruido o pieza suelta'],
};

export default function Solicitud() {
  const { tipo } = useLocalSearchParams<{ tipo: TipoSolicitud }>();
  const usuario = usuarioGuardado();
  const venta = estado.ventaVista;
  const esDevolucion = tipo === 'devolucion';

  // Cantidad elegida de cada producto (0 = no incluido)
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (!venta || !usuario) return <Text style={{ padding: 20 }}>No hay pedido seleccionado</Text>;

  const cambiar = (id: number, max: number, suma: number) => {
    const nueva = Math.min(max, Math.max(0, (cantidades[id] ?? 0) + suma));
    setCantidades({ ...cantidades, [id]: nueva });
  };

  const enviar = async () => {
    const items = Object.entries(cantidades)
      .filter(([, c]) => c > 0)
      .map(([id, cantidad]) => ({ id: Number(id), cantidad }));
    if (!items.length) return Alert.alert('Falta información', 'Elige al menos un producto');
    if (!motivo) return Alert.alert('Falta información', 'Elige un motivo');

    setEnviando(true);
    try {
      await crearSolicitud(usuario, venta.id, tipo, items, detalle ? `${motivo}. ${detalle}` : motivo);
      Alert.alert(
        'Solicitud enviada',
        'La tienda revisará tu caso. Puedes ver la respuesta en Perfil > Devoluciones y garantías.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('No se pudo enviar', e.message);
    }
    setEnviando(false);
  };

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>{esDevolucion ? '↩ Devolución' : '🛠 Garantía'} · Compra N° {numeroCompra(venta)}</Text>
        <Text style={estilos.gris}>
          {esDevolucion
            ? 'Elige qué productos quieres devolver. Si se aprueba, te reembolsamos el valor.'
            : 'Elige el producto con problemas. Lo revisamos y lo reparamos o cambiamos.'}
        </Text>
      </View>

      {/* ---------- Productos ---------- */}
      <View style={estilos.tarjeta}>
        <Text style={estilos.subtitulo}>Productos</Text>
        {venta.items.map((i) => (
          <View key={i.id} style={estilos.fila}>
            <Text style={{ flex: 1 }}>{i.nombre}</Text>
            <Pressable style={estilos.botonChico} onPress={() => cambiar(i.id, i.cantidad, -1)}>
              <Text style={estilos.textoBoton}>−</Text>
            </Pressable>
            <Text style={{ marginHorizontal: 10 }}>
              {cantidades[i.id] ?? 0} / {i.cantidad}
            </Text>
            <Pressable style={estilos.botonChico} onPress={() => cambiar(i.id, i.cantidad, 1)}>
              <Text style={estilos.textoBoton}>+</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* ---------- Motivo ---------- */}
      <View style={estilos.tarjeta}>
        <Text style={estilos.subtitulo}>Motivo</Text>
        {MOTIVOS[tipo].map((m) => (
          <Pressable key={m} style={[estilos.opcion, motivo === m && estilos.opcionActiva]} onPress={() => setMotivo(m)}>
            <Text>{motivo === m ? '🔘' : '⚪'} {m}</Text>
          </Pressable>
        ))}
        <TextInput
          style={estilos.input}
          placeholder="Cuéntanos más detalles (opcional)"
          multiline
          value={detalle}
          onChangeText={setDetalle}
        />
      </View>

      <Pressable style={estilos.botonEnviar} onPress={enviar} disabled={enviando}>
        {enviando ? <ActivityIndicator color="white" /> : <Text style={estilos.textoBoton}>Enviar solicitud</Text>}
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f4f6f8' },
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 14, borderRadius: 10 },
  titulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  gris: { color: '#666' },
  fila: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  botonChico: { backgroundColor: '#1e6fd9', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6 },
  textoBoton: { color: 'white', fontWeight: 'bold' },
  opcion: { padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 8 },
  opcionActiva: { borderColor: '#1e6fd9', backgroundColor: '#eaf2fd' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, minHeight: 70, textAlignVertical: 'top' },
  botonEnviar: { backgroundColor: '#1e6fd9', margin: 10, marginTop: 16, padding: 16, borderRadius: 10, alignItems: 'center' },
});
