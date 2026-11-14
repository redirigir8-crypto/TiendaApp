// Panel de administrador: pestañas de abajo
import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { cerrarAdmin, claveAdmin } from '@/admin/api';
import { C } from '@/admin/ui';

const icono = (emoji: string) =>
  function Icono({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
  };

export default function LayoutAdmin() {
  // Sin clave guardada, primero hay que entrar
  if (!claveAdmin()) return <Redirect href="/admin-entrar" />;

  const salir = () => {
    cerrarAdmin();
    router.replace('/');
  };

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C.oscuro },
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: '800' },
        headerRight: () => (
          <Pressable onPress={salir} style={{ marginRight: 16 }}>
            <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Salir</Text>
          </Pressable>
        ),
        tabBarActiveTintColor: C.primario,
        tabBarInactiveTintColor: C.gris,
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Resumen', tabBarIcon: icono('📊') }} />
      <Tabs.Screen name="productos" options={{ title: 'Productos', tabBarIcon: icono('🚲') }} />
      <Tabs.Screen name="ventas" options={{ title: 'Ventas', tabBarIcon: icono('🧾') }} />
      <Tabs.Screen name="solicitudes" options={{ title: 'Postventa', tabBarIcon: icono('🛠') }} />
      <Tabs.Screen name="usuarios" options={{ title: 'Usuarios', tabBarIcon: icono('👥') }} />
    </Tabs>
  );
}
