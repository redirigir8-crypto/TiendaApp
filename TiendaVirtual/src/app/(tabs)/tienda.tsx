// Catálogo de bicicletas
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { cargarProductos, fotosDe, Producto } from '@/db';
import * as estado from '@/estado';
import { pesos } from '@/factura';

export default function Tienda() {
  const carrito = estado.useCarrito();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(false);

  // Cada vez que se abre la pestaña recarga los productos (el stock cambia)
  useFocusEffect(
    useCallback(() => {
      cargarProductos().then(setProductos);
    }, [])
  );

  const recargar = async () => {
    setCargando(true);
    setProductos(await cargarProductos());
    setCargando(false);
  };

  const agregar = (p: Producto) => {
    if (!estado.agregarAlCarrito(p)) Alert.alert('Sin stock', `Solo hay ${p.stock} unidades de ${p.nombre}`);
  };

  const abrirDetalle = (p: Producto) => {
    estado.verProducto(p);
    router.push('/producto');
  };

  return (
    <FlatList
      style={estilos.pantalla}
      contentContainerStyle={{ paddingBottom: 10 }}
      data={productos}
      keyExtractor={(p) => String(p.id)}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
      ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No hay productos</Text>}
      renderItem={({ item }) => {
        const enCarrito = carrito.find((i) => i.id === item.id)?.cantidad ?? 0;
        const agotado = item.stock <= 0;
        const fotos = fotosDe(item);
        return (
          <View style={[estilos.tarjeta, agotado && { opacity: 0.5 }]}>
            {/* Al tocar la foto o el nombre se abre el detalle con todas las fotos */}
            <Pressable onPress={() => abrirDetalle(item)}>
              {fotos.length > 0 ? (
                <Image source={{ uri: fotos[0] }} style={estilos.imagen} />
              ) : (
                <Text style={estilos.sinImagen}>🚲</Text>
              )}
              {fotos.length > 1 && <Text style={estilos.masFotos}>📷 {fotos.length} fotos</Text>}
              <Text style={estilos.nombre}>{item.nombre}</Text>
            </Pressable>
            {!!item.descripcion && (
              <Text style={estilos.descripcion} numberOfLines={2}>
                {item.descripcion}
              </Text>
            )}
            <Text style={{ color: agotado ? '#d93a3a' : '#22a050' }}>
              {agotado ? 'Agotado' : `En stock: ${item.stock}`}
            </Text>
            <View style={estilos.fila}>
              <Text style={estilos.precio}>{pesos(item.precio)}</Text>
              {!agotado && (
                <View style={estilos.fila}>
                  {enCarrito > 0 && (
                    <>
                      <Pressable
                        style={[estilos.botonChico, { backgroundColor: '#777' }]}
                        onPress={() => estado.quitarDelCarrito(item.id)}>
                        <Text style={estilos.textoBoton}>−</Text>
                      </Pressable>
                      <Text style={{ marginHorizontal: 10 }}>{enCarrito}</Text>
                    </>
                  )}
                  <Pressable style={estilos.botonChico} onPress={() => agregar(item)}>
                    <Text style={estilos.textoBoton}>{enCarrito > 0 ? '+' : 'Agregar'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        );
      }}
    />
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f4f6f8' },
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 12, borderRadius: 10 },
  imagen: { width: '100%', height: 160, borderRadius: 8, marginBottom: 8 },
  sinImagen: { fontSize: 60, textAlign: 'center' },
  masFotos: {
    position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)',
    color: 'white', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  nombre: { fontSize: 18, fontWeight: 'bold' },
  descripcion: { color: '#666', marginVertical: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  precio: { fontSize: 16, color: '#1e6fd9', fontWeight: 'bold' },
  botonChico: { backgroundColor: '#1e6fd9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  textoBoton: { color: 'white', fontWeight: 'bold' },
});
