// Catálogo de bicicletas + carrito
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { cargarProductos, cerrarSesion, comprar, ItemCarrito, Producto, usuarioGuardado } from '../db';
import { descargarFactura, pesos } from '../factura';

export default function Tienda() {
  const usuario = usuarioGuardado();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [cargando, setCargando] = useState(false);

  const recargar = async () => {
    setCargando(true);
    setProductos(await cargarProductos());
    setCargando(false);
  };

  // Al abrir la pantalla carga los productos
  useEffect(() => {
    cargarProductos().then(setProductos);
  }, []);

  const agregar = (p: Producto) => {
    const existe = carrito.find((i) => i.id === p.id);
    if (existe) setCarrito(carrito.map((i) => (i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)));
    else setCarrito([...carrito, { ...p, cantidad: 1 }]);
  };

  const quitar = (id: number) => {
    setCarrito(
      carrito.map((i) => (i.id === id ? { ...i, cantidad: i.cantidad - 1 } : i)).filter((i) => i.cantidad > 0)
    );
  };

  const total = carrito.reduce((suma, i) => suma + i.precio * i.cantidad, 0);

  const finalizarCompra = async () => {
    if (!usuario || carrito.length === 0) return;
    const venta = await comprar(usuario, carrito, total);
    setCarrito([]);
    Alert.alert(
      venta.pendiente ? 'Compra guardada sin internet' : '¡Compra exitosa!',
      venta.pendiente ? 'Se enviará cuando vuelvas a tener internet.' : `Factura N° ${venta.id}`,
      [
        { text: 'Cerrar' },
        { text: 'Descargar factura PDF', onPress: () => descargarFactura(venta, usuario) },
      ]
    );
  };

  const salir = () => {
    cerrarSesion();
    router.replace('/');
  };

  return (
    <View style={estilos.pantalla}>
      <View style={estilos.barra}>
        <Text>Hola, {usuario?.nombre}</Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Pressable onPress={() => router.push('/compras')}>
            <Text style={estilos.enlace}>Mis compras</Text>
          </Pressable>
          <Pressable onPress={salir}>
            <Text style={[estilos.enlace, { color: '#d93a3a' }]}>Salir</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={productos}
        keyExtractor={(p) => String(p.id)}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={recargar} />}
        ListEmptyComponent={<Text style={{ textAlign: 'center' }}>No hay productos</Text>}
        renderItem={({ item }) => {
          const enCarrito = carrito.find((i) => i.id === item.id)?.cantidad ?? 0;
          return (
            <View style={estilos.tarjeta}>
              {item.imagen ? (
                <Image source={{ uri: item.imagen }} style={estilos.imagen} />
              ) : (
                <Text style={estilos.sinImagen}>🚲</Text>
              )}
              <Text style={estilos.nombre}>{item.nombre}</Text>
              {!!item.descripcion && <Text style={estilos.descripcion}>{item.descripcion}</Text>}
              <View style={estilos.fila}>
                <Text style={estilos.precio}>{pesos(item.precio)}</Text>
                <View style={estilos.fila}>
                  {enCarrito > 0 && (
                    <>
                      <Pressable style={[estilos.botonChico, { backgroundColor: '#777' }]} onPress={() => quitar(item.id)}>
                        <Text style={estilos.textoBoton}>−</Text>
                      </Pressable>
                      <Text style={{ marginHorizontal: 10 }}>{enCarrito}</Text>
                    </>
                  )}
                  <Pressable style={estilos.botonChico} onPress={() => agregar(item)}>
                    <Text style={estilos.textoBoton}>{enCarrito > 0 ? '+' : 'Agregar'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />

      {carrito.length > 0 && (
        <View style={estilos.carrito}>
          <Text style={{ fontSize: 16 }}>
            {carrito.reduce((s, i) => s + i.cantidad, 0)} productos · <Text style={{ fontWeight: 'bold' }}>{pesos(total)}</Text>
          </Text>
          <Pressable style={estilos.botonComprar} onPress={finalizarCompra}>
            <Text style={estilos.textoBoton}>Comprar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f4f6f8' },
  barra: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: 'white' },
  enlace: { color: '#1e6fd9', fontWeight: 'bold' },
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 12, borderRadius: 10 },
  imagen: { width: '100%', height: 160, borderRadius: 8, marginBottom: 8 },
  sinImagen: { fontSize: 60, textAlign: 'center' },
  nombre: { fontSize: 18, fontWeight: 'bold' },
  descripcion: { color: '#666', marginVertical: 4 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  precio: { fontSize: 16, color: '#1e6fd9', fontWeight: 'bold' },
  botonChico: { backgroundColor: '#1e6fd9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
  textoBoton: { color: 'white', fontWeight: 'bold' },
  carrito: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingBottom: 30, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#ddd',
  },
  botonComprar: { backgroundColor: '#22a050', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
});
