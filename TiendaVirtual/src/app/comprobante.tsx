// Comprobante de la compra. El PDF es opcional (botón secundario).
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { cancelarPedido, estadoVenta, numeroCompra, simularPago, usuarioGuardado } from '../db';
import * as estado from '../estado';
import { descargarFactura, pesos } from '../factura';

export default function Comprobante() {
  const usuario = usuarioGuardado();
  const [venta, setVenta] = useState(estado.ventaVista);
  const esperandoBitcoin = venta?.estado === 'pendiente_pago';
  const fallido = venta?.estado === 'expirado' || venta?.estado === 'cancelado';

  // Al abrir (o volver a) la pantalla: trae del servidor el estado y qué se puede hacer
  // (cancelar, devolución, garantía)
  useFocusEffect(
    useCallback(() => {
      const v = estado.ventaVista;
      if (v && !v.pendiente) estadoVenta(v.id).then(setVenta).catch(() => {});
    }, [])
  );

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

  // Monto en BTC (8 decimales) para mostrar y para el QR
  const btc = ((venta.btc_satoshis ?? 0) / 100000000).toFixed(8);

  const confirmarSimulado = () => {
    simularPago(venta.id)
      .then(setVenta)
      .catch((e) => Alert.alert('No se pudo confirmar', e.message));
  };

  const cancelar = () => {
    Alert.alert('¿Cancelar el pedido?', 'Los productos vuelven a la tienda y se te reembolsa el dinero.', [
      { text: 'No' },
      {
        text: 'Sí, cancelar',
        style: 'destructive',
        onPress: () =>
          cancelarPedido(usuario, venta.id)
            .then(({ venta: v, mensaje }) => {
              setVenta(v);
              Alert.alert('Pedido cancelado', mensaje);
            })
            .catch((e) => Alert.alert('No se pudo cancelar', e.message)),
      },
    ]);
  };

  // Abre el formulario de devolución o garantía
  const solicitar = (tipo: 'devolucion' | 'garantia') => {
    estado.verComprobante(venta);
    router.push({ pathname: '/solicitud', params: { tipo } });
  };

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
            {/* Modo simulado: QR con la dirección y el monto + botón para confirmar */}
            {!venta.checkout_url && !!venta.btc_direccion && (
              <View style={estilos.cajaQr}>
                <Image source={{ uri: urlQr(venta.btc_direccion, btc) }} style={{ width: 200, height: 200 }} />
                <Text style={estilos.montoBtc}>{btc} BTC</Text>
                <Text style={estilos.gris}>({venta.btc_satoshis} satoshis = {pesos(venta.total)})</Text>
                <Text selectable style={estilos.direccion}>{venta.btc_direccion}</Text>
                <Pressable style={estilos.botonBitcoin} onPress={confirmarSimulado}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>Simular pago confirmado</Text>
                </Pressable>
                <Text style={estilos.aviso}>Modo simulado: no se envían bitcoins reales.</Text>
              </View>
            )}
          </>
        ) : fallido ? (
          <>
            <Text style={{ fontSize: 50 }}>❌</Text>
            <Text style={estilos.estado}>{venta.estado === 'cancelado' ? 'Pedido cancelado' : 'El pago Bitcoin expiró'}</Text>
            <Text style={estilos.gris}>
              {venta.estado === 'cancelado' && venta.pagado_en
                ? 'El reembolso se hará al mismo medio de pago (simulado).'
                : 'No se cobró nada y los productos volvieron al inventario.'}
            </Text>
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
        <Dato titulo="Compra N°" valor={numeroCompra(venta)} />
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
      {!esperandoBitcoin && !fallido && !venta.pendiente && (
        <Pressable
          style={[estilos.botonPrincipal, { backgroundColor: '#22a050', marginTop: 10 }]}
          onPress={() => router.push({ pathname: '/seguimiento', params: { id: String(venta.id) } })}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>📍 Seguir mi pedido</Text>
        </Pressable>
      )}
      {!esperandoBitcoin && !fallido && (
        <Pressable style={estilos.botonSecundario} onPress={descargar}>
          <Text style={{ color: '#1e6fd9', fontWeight: 'bold' }}>📄 Descargar factura PDF</Text>
        </Pressable>
      )}

      {/* ---------- ¿Algún problema? ---------- */}
      {(venta.puede_cancelar || venta.puede_devolver || venta.puede_garantia) && (
        <View style={estilos.tarjeta}>
          <Text style={estilos.titulo}>¿Algún problema con tu pedido?</Text>
          {venta.puede_cancelar && (
            <Pressable style={[estilos.botonPostventa, { borderColor: '#d93a3a' }]} onPress={cancelar}>
              <Text style={{ color: '#d93a3a', fontWeight: 'bold' }}>✖ Cancelar pedido</Text>
            </Pressable>
          )}
          {venta.puede_devolver && (
            <Pressable style={estilos.botonPostventa} onPress={() => solicitar('devolucion')}>
              <Text style={estilos.textoPostventa}>↩ Solicitar devolución</Text>
            </Pressable>
          )}
          {venta.puede_garantia && (
            <Pressable style={estilos.botonPostventa} onPress={() => solicitar('garantia')}>
              <Text style={estilos.textoPostventa}>🛠 Solicitar garantía</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

// Imagen del QR con el formato estándar de Bitcoin: bitcoin:<dirección>?amount=<BTC>
function urlQr(direccion: string, btc: string) {
  const datos = encodeURIComponent(`bitcoin:${direccion}?amount=${btc}`);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${datos}`;
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
  botonPostventa: { borderWidth: 1, borderColor: '#777', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  textoPostventa: { color: '#444', fontWeight: 'bold' },
  pantalla: { flex: 1, backgroundColor: '#f4f6f8' },
  encabezado: { alignItems: 'center', padding: 20 },
  estado: { fontSize: 22, fontWeight: 'bold', marginTop: 6, textAlign: 'center' },
  gris: { color: '#666', textAlign: 'center', marginTop: 4 },
  cajaQr: { alignItems: 'center', marginTop: 12 },
  montoBtc: { fontSize: 20, fontWeight: 'bold', color: '#f7931a', marginTop: 8 },
  direccion: { fontSize: 12, color: '#444', marginTop: 6, textAlign: 'center' },
  aviso: { color: '#999', fontSize: 12, marginTop: 8 },
  botonBitcoin: { backgroundColor: '#f7931a', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, marginTop: 12 },
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 14, borderRadius: 10 },
  titulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3, gap: 10 },
  linea: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  total: { fontSize: 18, fontWeight: 'bold', color: '#1e6fd9' },
  botonPrincipal: { backgroundColor: '#1e6fd9', margin: 10, marginTop: 20, padding: 14, borderRadius: 10, alignItems: 'center' },
  botonSecundario: { borderWidth: 1, borderColor: '#1e6fd9', marginHorizontal: 10, padding: 14, borderRadius: 10, alignItems: 'center' },
});
