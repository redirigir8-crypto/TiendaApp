// Perfil del usuario: datos de entrega (dirección y teléfono), devoluciones y cerrar sesión
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { actualizarPerfil, cerrarSesion, usuarioGuardado } from '@/db';
import * as estado from '@/estado';

export default function Perfil() {
  const usuario = usuarioGuardado();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [direccion, setDireccion] = useState(usuario?.direccion ?? '');
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '');
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!usuario) return;
    setGuardando(true);
    try {
      await actualizarPerfil(usuario, { nombre, direccion, telefono });
      Alert.alert('Perfil guardado', 'Usaremos esta dirección para tus envíos.');
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e.message || 'Revisa tu conexión a internet');
    }
    setGuardando(false);
  };

  const salir = () => {
    cerrarSesion();
    estado.setCarrito([]);
    router.replace('/');
  };

  return (
    <ScrollView style={estilos.pantalla} contentContainerStyle={{ paddingBottom: 30 }}>
      <View style={estilos.tarjeta}>
        <Text style={{ fontSize: 60, textAlign: 'center' }}>👤</Text>
        <Text style={estilos.nombre}>{usuario?.nombre}</Text>
        <Text style={{ color: '#666', textAlign: 'center' }}>{usuario?.email}</Text>
      </View>

      {/* ---------- Datos de entrega ---------- */}
      <View style={estilos.tarjeta}>
        <Text style={estilos.titulo}>📍 Datos de entrega</Text>
        <Text style={estilos.ayuda}>Esta dirección se usa para tus envíos y el seguimiento en el mapa.</Text>

        <Text style={estilos.etiqueta}>Nombre</Text>
        <TextInput style={estilos.input} value={nombre} onChangeText={setNombre} />

        <Text style={estilos.etiqueta}>Dirección</Text>
        <TextInput
          style={estilos.input}
          value={direccion}
          onChangeText={setDireccion}
          placeholder="Calle 72 # 10-07, Bogotá"
        />

        <Text style={estilos.etiqueta}>Teléfono</Text>
        <TextInput
          style={estilos.input}
          value={telefono}
          onChangeText={setTelefono}
          placeholder="300 123 4567"
          keyboardType="phone-pad"
        />

        <Pressable style={estilos.botonGuardar} onPress={guardar} disabled={guardando}>
          {guardando ? <ActivityIndicator color="white" /> : <Text style={estilos.textoBlanco}>Guardar</Text>}
        </Pressable>
      </View>

      <Pressable style={estilos.boton} onPress={() => router.push('/solicitudes')}>
        <Text style={{ color: '#1e6fd9', fontWeight: 'bold' }}>📋 Devoluciones y garantías</Text>
      </Pressable>

      <Pressable style={estilos.botonSalir} onPress={salir}>
        <Text style={estilos.textoBlanco}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: '#f4f6f8', padding: 10 },
  tarjeta: { backgroundColor: 'white', padding: 18, borderRadius: 10, marginBottom: 10 },
  nombre: { fontSize: 20, fontWeight: 'bold', marginTop: 8, textAlign: 'center' },
  titulo: { fontSize: 16, fontWeight: 'bold' },
  ayuda: { color: '#666', marginTop: 4, marginBottom: 6 },
  etiqueta: { color: '#555', marginTop: 10, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fafafa' },
  botonGuardar: { backgroundColor: '#1e6fd9', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  textoBlanco: { color: 'white', fontWeight: 'bold' },
  boton: { backgroundColor: 'white', borderWidth: 1, borderColor: '#1e6fd9', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  botonSalir: { backgroundColor: '#d93a3a', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
});
