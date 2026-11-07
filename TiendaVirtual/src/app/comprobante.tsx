// Comprobante de la compra. El PDF es opcional (botón secundario).
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usuarioGuardado } from '../db';
import * as estado from '../estado';
import { descargarFactura, pesos } from '../factura';

export default function Comprobante() {
  const usuario = usuarioGuardado();
  const venta = estado.ventaVista;

  if (!venta || !usuario) {
    return <Text style={{ padding: 20 }}>No hay comprobante para mostrar</Text>;
  }

  const descargar = () => {
    descargarFactura(venta, usuario).catch((e) => Alert.alert('No se pudo crear el PDF', e.message));
  };

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={estilos.encabezado}>
        <Text style={{ fontSize: 50 }}>{venta.pendiente ? '⏳' : '✅'}</Text>
        <Text style={estilos.estado}>{venta.pendiente ? 'Compra guardada sin internet' : '¡Pago aprobado!'}</Text>
        {venta.pendiente && (
          <Text style={{ color: '#666', textAlign: 'center' }}>Se enviará a la tienda cuando tengas conexión.</Text>
        )}
      </View>

      <View style={estilos.tarjeta}>
        <Dato titulo="Comprobante N°" valor={String(venta.id)} />
        <Dato titulo="Fecha" valor={new Date(venta.fecha).toLocaleString('es-CO')} />
        <Dato titulo="Cliente" valor={usuario.nombre} />
        <Dato titulo="Medio de pago" valor={venta.metodo_pago} />
        <Dato titulo="Entrega" valor={venta.direccion ? 'Domicilio: ' + venta.direccion : 'Recoger en tienda'} />
      </View>

      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>Productos</Text>
        {venta.items.map((i) => (
          <View key={i.id} style={estilos.fila}>
            <Text>{i.cantidad} x {i.nombre}</Text>
            <Text>{pesos(i.precio * i.cantidad)}</Text>
          </View>
        ))}
        <View style={estilos.linea} />
        <Dato titulo="Subtotal" valor={pesos(venta.subtotal)} />
        <Dato titulo={`IVA (${estado.IVA * 100}%)`} valor={pesos(venta.iva)} />
        <Dato titulo="Envío" valor={venta.envio ? pesos(venta.envio) : 'Gratis'} />
        <View style={estilos.fila}>
          <Text style={estilos.total}>Total pagado</Text>
          <Text style={estilos.total}>{pesos(venta.total)}</Text>
        </View>
      </View>

      <Pressable style={estilos.botonPrincipal} onPress={() => router.back()}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Volver</Text>
      </Pressable>
      <Pressable style={estilos.botonSecundario} onPress={descargar}>
        <Text style={{ color: '#1e6fd9', fontWeight: 'bold' }}>📄 Descargar factura PDF</Text>
      </Pressable>
    </ScrollView>
  );
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <View style={estilos.fila}>
      <Text style={{ color: '#666' }}>{titulo}</Text>
      <Text style={{ flexShrink: 1, textAlign: 'right' }}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f4f6f8' },
  encabezado: { alignItems: 'center', padding: 20 },
  estado: { fontSize: 22, fontWeight: 'bold', marginTop: 6 },
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 14, borderRadius: 10 },
  titulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3, gap: 10 },
  linea: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  total: { fontSize: 18, fontWeight: 'bold', color: '#1e6fd9' },
  botonPrincipal: { backgroundColor: '#1e6fd9', margin: 10, marginTop: 20, padding: 14, borderRadius: 10, alignItems: 'center' },
  botonSecundario: { borderWidth: 1, borderColor: '#1e6fd9', marginHorizontal: 10, padding: 14, borderRadius: 10, alignItems: 'center' },
});
