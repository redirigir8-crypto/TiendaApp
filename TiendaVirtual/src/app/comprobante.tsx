// Comprobante de la compra. El PDF es opcional (botón secundario).
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { estadoVenta, usuarioGuardado } from '../db';
import * as estado from '../estado';
import { descargarFactura, pesos } from '../factura';

export default function Comprobante() {
  const usuario = usuarioGuardado();
  const [venta, setVenta] = useState(estado.ventaVista);
  const esperandoBitcoin = venta?.estado === 'pendiente_pago';
  const fallido = venta?.estado === 'expirado' || venta?.estado === 'cancelado';

  // Si es Bitcoin y no se ha pagado, pregunta al servidor cada 5 segundos
  useEffect(() => {
    if (!esperandoBitcoin || !venta) return;
    const revisar = setInterval(() => {
      estadoVenta(venta.id).then(setVenta).catch(() => {});
    }, 5000);
    return () => clearInterval(revisar);
  }, [esperandoBitcoin, venta]);

  if (!venta || !usuario) {
    return <Text style={{ padding: 20 }}>No hay comprobante para mostrar</Text>;
  }

  const descargar = () => {
    descargarFactura(venta, usuario).catch((e) => Alert.alert('No se pudo crear el PDF', e.message));
  };

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={estilos.encabezado}>
        {venta.pendiente ? (
          <>
            <Text style={{ fontSize: 50 }}>⏳</Text>
            <Text style={estilos.estado}>Compra guardada sin internet</Text>
            <Text style={estilos.gris}>Se enviará a la tienda cuando tengas conexión.</Text>
          </>
        ) : esperandoBitcoin ? (
          <>
            <Text style={{ fontSize: 50 }}>₿</Text>
            <Text style={estilos.estado}>Esperando el pago Bitcoin</Text>
            <ActivityIndicator style={{ marginVertical: 8 }} color="#f7931a" />
            <Text style={estilos.gris}>Esta pantalla se actualiza sola cuando el pago se confirme.</Text>
            {!!venta.checkout_url && (
              <Pressable style={estilos.botonBitcoin} onPress={() => WebBrowser.openBrowserAsync(venta.checkout_url!)}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Abrir página de pago</Text>
              </Pressable>
            )}
          </>
        ) : fallido ? (
          <>
            <Text style={{ fontSize: 50 }}>❌</Text>
            <Text style={estilos.estado}>El pago Bitcoin expiró</Text>
            <Text style={estilos.gris}>No se cobró nada y los productos volvieron al inventario.</Text>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 50 }}>✅</Text>
            <Text style={estilos.estado}>¡Pago aprobado!</Text>
            <Text style={estilos.gris}>Te enviamos la factura a {usuario.email}</Text>
          </>
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
      {!esperandoBitcoin && !fallido && (
        <Pressable style={estilos.botonSecundario} onPress={descargar}>
          <Text style={{ color: '#1e6fd9', fontWeight: 'bold' }}>📄 Descargar factura PDF</Text>
        </Pressable>
      )}
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
  estado: { fontSize: 22, fontWeight: 'bold', marginTop: 6, textAlign: 'center' },
  gris: { color: '#666', textAlign: 'center', marginTop: 4 },
  botonBitcoin: { backgroundColor: '#f7931a', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, marginTop: 12 },
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 14, borderRadius: 10 },
  titulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3, gap: 10 },
  linea: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  total: { fontSize: 18, fontWeight: 'bold', color: '#1e6fd9' },
  botonPrincipal: { backgroundColor: '#1e6fd9', margin: 10, marginTop: 20, padding: 14, borderRadius: 10, alignItems: 'center' },
  botonSecundario: { borderWidth: 1, borderColor: '#1e6fd9', marginHorizontal: 10, padding: 14, borderRadius: 10, alignItems: 'center' },
});
