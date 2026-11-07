// Barra de navegación de abajo (pestañas)
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useCarrito } from '@/estado';

// Ícono con emoji (fácil de cambiar)
const icono = (emoji: string) =>
  function Icono({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
  };

export default function LayoutPestanas() {
  const carrito = useCarrito();
  const unidades = carrito.reduce((s, i) => s + i.cantidad, 0);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#1e6fd9' },
        headerTintColor: 'white',
        tabBarActiveTintColor: '#1e6fd9',
      }}>
      <Tabs.Screen name="tienda" options={{ title: 'Tienda', tabBarIcon: icono('🚲') }} />
      <Tabs.Screen
        name="carrito"
        options={{
          title: 'Carrito',
          tabBarIcon: icono('🛒'),
          tabBarBadge: unidades > 0 ? unidades : undefined, // numerito rojo
        }}
      />
      <Tabs.Screen name="compras" options={{ title: 'Mis compras', tabBarIcon: icono('🧾') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icono('👤') }} />
    </Tabs>
  );
}
