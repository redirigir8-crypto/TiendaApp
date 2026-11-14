// Pantalla de pago: resumen, envío, IVA y medio de pago (simulado)
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { comprar, usuarioGuardado } from '../db';
import * as estado from '../estado';
import { pesos } from '../factura';

type Metodo = 'tarjeta' | 'transferencia' | 'nequi' | 'bitcoin';

// Datos de la cuenta para la transferencia (ficticios)
const CUENTA = 'Banco Ejemplo · Ahorros 123-456789-00 · Tienda de Bicicletas';

export default function Pagar() {
  const usuario = usuarioGuardado();
  const items = estado.carrito;

  // Si el cliente tiene dirección en su perfil, se propone envío a domicilio a esa dirección
  const [domicilio, setDomicilio] = useState(!!usuario?.direccion);
  const [direccion, setDireccion] = useState(usuario?.direccion ?? '');
  const [metodo, setMetodo] = useState<Metodo>('tarjeta');
  // Tarjeta
  const [numero, setNumero] = useState('');
  const [titular, setTitular] = useState('');
  const [vence, setVence] = useState('');
  const [cvv, setCvv] = useState('');
  // Nequi / Transferencia
  const [celular, setCelular] = useState('');
  const [referencia, setReferencia] = useState('');
  const [procesando, setProcesando] = useState(false);

  // ---------- Cálculos ----------
  const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const iva = Math.round(subtotal * estado.IVA);
  const envio = domicilio ? estado.COSTO_ENVIO : 0;
  const total = subtotal + iva + envio;

  // Revisa que los datos estén completos. Devuelve el texto del error o '' si está bien.
  const validar = () => {
    if (domicilio && direccion.trim().length < 5) return 'Escribe la dirección de envío';
    if (metodo === 'tarjeta') {
      if (numero.replace(/\D/g, '').length !== 16) return 'El número de tarjeta debe tener 16 dígitos';
      if (!titular.trim()) return 'Escribe el nombre del titular';
      if (!/^\d{2}\/\d{2}$/.test(vence)) return 'La fecha debe ser MM/AA';
      if (cvv.length !== 3) return 'El CVV debe tener 3 dígitos';
    }
    if (metodo === 'nequi' && celular.length !== 10) return 'El celular Nequi debe tener 10 dígitos';
    if (metodo === 'transferencia' && !referencia.trim()) return 'Escribe el número de la transferencia';
    return '';
  };

  const textoMetodo = () => {
    if (metodo === 'tarjeta') return 'Tarjeta **** ' + numero.replace(/\D/g, '').slice(-4);
    if (metodo === 'nequi') return 'Nequi ' + celular;
    if (metodo === 'bitcoin') return 'Bitcoin';
    return 'Transferencia (ref. ' + referencia + ')';
  };

  const pagar = async () => {
    const error = validar();
    if (error) return Alert.alert('Revisa los datos', error);
    if (!usuario) return;

    const bitcoin = metodo === 'bitcoin';
    setProcesando(true);
    // Los pagos simulados "esperan al banco" 2 segundos. Bitcoin es real (OpenNode).
    if (!bitcoin) await new Promise((r) => setTimeout(r, 2000));
    try {
      const venta = await comprar(usuario, {
        items, subtotal, iva, envio, total,
        direccion: domicilio ? direccion : '',
        metodo_pago: textoMetodo(),
        bitcoin,
      });
      estado.setCarrito([]);
      estado.verComprobante(venta);
      router.replace('/comprobante');
      // Bitcoin: abre la página de pago de OpenNode (QR / dirección)
      if (bitcoin && venta.checkout_url) await WebBrowser.openBrowserAsync(venta.checkout_url);
    } catch (e: any) {
      Alert.alert('No se pudo completar la compra', e.message);
    }
    setProcesando(false);
  };

  if (procesando) {
    return (
      <View style={[estilos.pantalla, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#1e6fd9" />
        <Text style={{ marginTop: 12 }}>{metodo === 'bitcoin' ? 'Creando cobro Bitcoin...' : 'Procesando pago...'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* ---------- Resumen ---------- */}
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>Tu pedido</Text>
        {items.map((i) => (
          <View key={i.id} style={estilos.fila}>
            <Text>{i.cantidad} x {i.nombre}</Text>
            <Text>{pesos(i.precio * i.cantidad)}</Text>
          </View>
        ))}
      </View>

      {/* ---------- Entrega ---------- */}
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>Entrega</Text>
        <Opcion texto="Recoger en tienda (gratis)" activa={!domicilio} onPress={() => setDomicilio(false)} />
        <Opcion texto={`Envío a domicilio (${pesos(estado.COSTO_ENVIO)})`} activa={domicilio} onPress={() => setDomicilio(true)} />
        {domicilio && (
          <TextInput style={estilos.input} placeholder="Dirección de envío" value={direccion} onChangeText={setDireccion} />
        )}
      </View>

      {/* ---------- Medio de pago ---------- */}
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>Medio de pago</Text>
        <Opcion texto="💳 Tarjeta débito / crédito" activa={metodo === 'tarjeta'} onPress={() => setMetodo('tarjeta')} />
        <Opcion texto="🏦 Transferencia bancaria" activa={metodo === 'transferencia'} onPress={() => setMetodo('transferencia')} />
        <Opcion texto="📱 Nequi" activa={metodo === 'nequi'} onPress={() => setMetodo('nequi')} />
        <Opcion texto="₿ Bitcoin" activa={metodo === 'bitcoin'} onPress={() => setMetodo('bitcoin')} />

        {metodo === 'tarjeta' && (
          <>
            <TextInput style={estilos.input} placeholder="Número de tarjeta (16 dígitos)" keyboardType="number-pad" maxLength={16} value={numero} onChangeText={setNumero} />
            <TextInput style={estilos.input} placeholder="Nombre del titular" value={titular} onChangeText={setTitular} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[estilos.input, { flex: 1 }]} placeholder="MM/AA" maxLength={5} value={vence} onChangeText={setVence} />
              <TextInput style={[estilos.input, { flex: 1 }]} placeholder="CVV" keyboardType="number-pad" maxLength={3} secureTextEntry value={cvv} onChangeText={setCvv} />
            </View>
          </>
        )}
        {metodo === 'transferencia' && (
          <>
            <Text style={estilos.info}>Transfiere {pesos(total)} a: {CUENTA}</Text>
            <TextInput style={estilos.input} placeholder="Número de la transferencia" value={referencia} onChangeText={setReferencia} />
          </>
        )}
        {metodo === 'nequi' && (
          <>
            <Text style={estilos.info}>Te llegará una notificación a tu app Nequi para aprobar el pago.</Text>
            <TextInput style={estilos.input} placeholder="Celular Nequi (10 dígitos)" keyboardType="number-pad" maxLength={10} value={celular} onChangeText={setCelular} />
          </>
        )}
        {metodo === 'bitcoin' && (
          <Text style={estilos.info}>
            Verás un código QR con la dirección y el monto en BTC (al precio de hoy). Paga desde tu
            billetera Bitcoin: el comprobante se actualiza solo cuando se confirme.
          </Text>
        )}
        <Text style={estilos.aviso}>
          {metodo === 'bitcoin'
            ? 'Modo pruebas: no se cobran bitcoins reales.'
            : 'Pago simulado: no se cobra dinero real.'}
        </Text>
      </View>

      {/* ---------- Totales ---------- */}
      <View style={estilos.tarjeta}>
        <View style={estilos.fila}><Text>Subtotal</Text><Text>{pesos(subtotal)}</Text></View>
        <View style={estilos.fila}><Text>IVA ({estado.IVA * 100}%)</Text><Text>{pesos(iva)}</Text></View>
        <View style={estilos.fila}><Text>Envío</Text><Text>{envio ? pesos(envio) : 'Gratis'}</Text></View>
        <View style={estilos.fila}>
          <Text style={estilos.total}>Total</Text>
          <Text style={estilos.total}>{pesos(total)}</Text>
        </View>
      </View>

      <Pressable style={estilos.botonPagar} onPress={pagar}>
        <Text style={estilos.textoBoton}>Pagar {pesos(total)}</Text>
      </Pressable>
    </ScrollView>
  );
}

// Botón de opción (tipo radio)
function Opcion({ texto, activa, onPress }: { texto: string; activa: boolean; onPress: () => void }) {
  return (
    <Pressable style={[estilos.opcion, activa && estilos.opcionActiva]} onPress={onPress}>
      <Text>{activa ? '🔘' : '⚪'} {texto}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f4f6f8' },
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 14, borderRadius: 10 },
  titulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  opcion: { padding: 10, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 8 },
  opcionActiva: { borderColor: '#1e6fd9', backgroundColor: '#eaf2fd' },
  input: { backgroundColor: 'white', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#ddd' },
  info: { color: '#444', marginBottom: 8 },
  aviso: { color: '#999', fontSize: 12, marginTop: 4 },
  total: { fontSize: 18, fontWeight: 'bold', color: '#1e6fd9' },
  botonPagar: { backgroundColor: '#22a050', margin: 10, marginTop: 16, padding: 16, borderRadius: 10, alignItems: 'center' },
  textoBoton: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
