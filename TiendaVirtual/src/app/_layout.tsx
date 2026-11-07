import { Stack } from 'expo-router';

// Pantallas de la app:
//  index   -> iniciar sesión / registrarse
//  tienda  -> catálogo de bicicletas + carrito
//  compras -> mis compras y facturas
export default function Layout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#1e6fd9' }, headerTintColor: 'white' }}>
      <Stack.Screen name="index" options={{ title: 'Iniciar sesión' }} />
      <Stack.Screen name="tienda" options={{ title: 'Tienda de Bicicletas', headerBackVisible: false }} />
      <Stack.Screen name="compras" options={{ title: 'Mis compras' }} />
    </Stack>
  );
}
