// Carrito: ver lo que se va a comprar, cambiar cantidades e ir a pagar
import { router } from 'expo-router';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { fotosDe } from '@/db';
import * as estado from '@/estado';
import { pesos } from '@/factura';

export default function Carrito() {
  const carrito = estado.useCarrito();
  const subtotal = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  if (carrito.length === 0) {
    return (
      <View style={[estilos.pantalla, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 60 }}>🛒</Text>
        <Text style={{ marginVertical: 10 }}>Tu carrito está vacío</Text>
        <Pressable style={estilos.boton} onPress={() => router.navigate('/tienda')}>
          <Text style={estilos.textoBoton}>Ver bicicletas</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={estilos.pantalla}>
      <FlatList
        data={carrito}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) => {
          const foto = fotosDe(item)[0];
          return (
            <View style={estilos.tarjeta}>
              {foto ? <Image source={{ uri: foto }} style={estilos.foto} /> : <Text style={{ fontSize: 36 }}>🚲</Text>}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontWeight: 'bold' }}>{item.nombre}</Text>
                <Text style={{ color: '#666' }}>{pesos(item.precio)} c/u</Text>
                <View style={estilos.fila}>
                  <Pressable style={[estilos.botonChico, { backgroundColor: '#777' }]} onPress={() => estado.quitarDelCarrito(item.id)}>
                    <Text style={estilos.textoBoton}>−</Text>
                  </Pressable>
                  <Text style={{ marginHorizontal: 12 }}>{item.cantidad}</Text>
                  <Pressable style={estilos.botonChico} onPress={() => estado.agregarAlCarrito(item)}>
                    <Text style={estilos.textoBoton}>+</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={{ fontWeight: 'bold' }}>{pesos(item.precio * item.cantidad)}</Text>
            </View>
          );
        }}
      />

      <View style={estilos.pie}>
        <View>
          <Text style={{ color: '#666' }}>Subtotal (sin IVA)</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{pesos(subtotal)}</Text>
        </View>
        <Pressable style={[estilos.boton, { backgroundColor: '#22a050' }]} onPress={() => router.push('/pagar')}>
          <Text style={estilos.textoBoton}>Ir a pagar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f4f6f8' },
  tarjeta: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    margin: 10, marginBottom: 0, padding: 10, borderRadius: 10,
  },
  foto: { width: 70, height: 55, borderRadius: 6 },
  fila: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  botonChico: { backgroundColor: '#1e6fd9', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 6 },
  boton: { backgroundColor: '#1e6fd9', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 8 },
  textoBoton: { color: 'white', fontWeight: 'bold' },
  pie: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#ddd',
  },
});
