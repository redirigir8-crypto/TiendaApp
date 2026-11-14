// Detalle de una bicicleta: galería de fotos (deslizar o tocar miniaturas) + agregar al carrito
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert, Image, Modal, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { fotosDe } from '../db';
import * as estado from '../estado';
import { pesos } from '../factura';

export default function Producto() {
  const p = estado.productoVisto;
  const { width } = useWindowDimensions();
  const galeria = useRef<ScrollViewInstance>(null);
  const [actual, setActual] = useState(0); // foto que se está viendo
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  if (!p) return <Text style={{ padding: 20 }}>Producto no encontrado</Text>;
  const fotos = fotosDe(p);

  // Ir a una foto tocando su miniatura
  const irAFoto = (i: number) => {
    setActual(i);
    galeria.current?.scrollTo({ x: i * width, animated: true });
  };

  const agregar = () => {
    if (!estado.agregarAlCarrito(p)) return Alert.alert('Sin stock', `Solo hay ${p.stock} unidades`);
    Alert.alert('Agregado', `${p.nombre} está en tu carrito`, [
      { text: 'Seguir viendo' },
      { text: 'Ver carrito', onPress: () => router.navigate('/carrito') },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f4f6f8' }}>
      {/* ---------- Galería: se desliza de lado ---------- */}
      {fotos.length > 0 ? (
        <ScrollView
          ref={galeria}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setActual(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {fotos.map((url) => (
            <Pressable key={url} onPress={() => setPantallaCompleta(true)}>
              <Image source={{ uri: url }} style={{ width, height: 280 }} resizeMode="cover" />
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={{ fontSize: 100, textAlign: 'center', padding: 30 }}>🚲</Text>
      )}

      {/* ---------- Miniaturas ---------- */}
      {fotos.length > 1 && (
        <ScrollView horizontal style={{ padding: 8 }}>
          {fotos.map((url, i) => (
            <Pressable key={url} onPress={() => irAFoto(i)}>
              <Image source={{ uri: url }} style={[estilos.miniatura, i === actual && estilos.miniaturaActiva]} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={estilos.tarjeta}>
        <Text style={estilos.nombre}>{p.nombre}</Text>
        <Text style={estilos.precio}>{pesos(p.precio)}</Text>
        <Text style={{ color: p.stock > 0 ? '#22a050' : '#d93a3a', marginVertical: 4 }}>
          {p.stock > 0 ? `En stock: ${p.stock}` : 'Agotado'}
        </Text>
        {!!p.descripcion && <Text style={{ color: '#444', marginTop: 6 }}>{p.descripcion}</Text>}
        <Text style={{ color: '#666', marginTop: 10 }}>📦 Se despacha desde: {p.direccion || 'Tienda principal'}</Text>
      </View>

      {p.stock > 0 && (
        <Pressable style={estilos.boton} onPress={agregar}>
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Agregar al carrito</Text>
        </Pressable>
      )}

      {/* ---------- Foto en pantalla completa ---------- */}
      <Modal visible={pantallaCompleta} transparent animationType="fade">
        <Pressable style={estilos.fondoNegro} onPress={() => setPantallaCompleta(false)}>
          {fotos[actual] && <Image source={{ uri: fotos[actual] }} style={{ width, height: '80%' }} resizeMode="contain" />}
          <Text style={{ color: 'white', marginTop: 10 }}>Toca para cerrar</Text>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  miniatura: { width: 70, height: 50, borderRadius: 6, marginRight: 8, opacity: 0.6 },
  miniaturaActiva: { opacity: 1, borderWidth: 2, borderColor: '#1e6fd9' },
  tarjeta: { backgroundColor: 'white', margin: 10, padding: 14, borderRadius: 10 },
  nombre: { fontSize: 22, fontWeight: 'bold' },
  precio: { fontSize: 20, color: '#1e6fd9', fontWeight: 'bold', marginTop: 4 },
  boton: { backgroundColor: '#22a050', margin: 10, padding: 16, borderRadius: 10, alignItems: 'center' },
  fondoNegro: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
});
