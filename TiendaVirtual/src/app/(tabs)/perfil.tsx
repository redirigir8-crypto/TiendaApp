// Perfil del usuario y cerrar sesión
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cerrarSesion, usuarioGuardado } from '@/db';
import * as estado from '@/estado';

export default function Perfil() {
  const usuario = usuarioGuardado();

  const salir = () => {
    cerrarSesion();
    estado.setCarrito([]);
    router.replace('/');
  };

  return (
    <View style={estilos.pantalla}>
      <View style={estilos.tarjeta}>
        <Text style={{ fontSize: 60 }}>👤</Text>
        <Text style={estilos.nombre}>{usuario?.nombre}</Text>
        <Text style={{ color: '#666' }}>{usuario?.email}</Text>
      </View>

      <Pressable style={estilos.boton} onPress={() => router.push('/solicitudes')}>
        <Text style={{ color: '#1e6fd9', fontWeight: 'bold' }}>📋 Devoluciones y garantías</Text>
      </Pressable>

      <Pressable style={estilos.botonSalir} onPress={salir}>
        <Text style={{ color: 'white', fontWeight: 'bold' }}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f4f6f8', padding: 10 },
  tarjeta: { backgroundColor: 'white', padding: 24, borderRadius: 10, alignItems: 'center' },
  nombre: { fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  boton: { backgroundColor: 'white', borderWidth: 1, borderColor: '#1e6fd9', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  botonSalir: { backgroundColor: '#d93a3a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 20 },
});
