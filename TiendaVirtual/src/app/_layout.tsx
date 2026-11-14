import { Stack } from 'expo-router';

// Pantallas de la app:
//  index        -> iniciar sesión / registrarse
//  (tabs)       -> barra de abajo: Tienda, Carrito, Mis compras, Perfil  (ver (tabs)/_layout.tsx)
//  producto     -> detalle de una bicicleta con todas sus fotos
//  pagar        -> envío, IVA y medio de pago
//  comprobante  -> resultado de la compra (y botón para el PDF)
//  seguimiento  -> mapa con dónde va el pedido y a qué hora llega
export default function Layout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#1e6fd9' }, headerTintColor: 'white' }}>
      <Stack.Screen name="index" options={{ title: 'Iniciar sesión' }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="producto" options={{ title: 'Detalle' }} />
      <Stack.Screen name="pagar" options={{ title: 'Pagar' }} />
      <Stack.Screen name="comprobante" options={{ title: 'Comprobante' }} />
      <Stack.Screen name="seguimiento" options={{ title: 'Seguimiento del pedido' }} />
    </Stack>
  );
}
