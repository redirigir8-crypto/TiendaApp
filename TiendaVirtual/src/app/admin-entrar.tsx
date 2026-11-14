// Entrada al panel de administrador (pide la clave de admin)
import { Href, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { entrarAdmin } from '@/admin/api';
import { C } from '@/admin/ui';

export default function AdminEntrar() {
  const [clave, setClave] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    setCargando(true);
    try {
      await entrarAdmin(clave);
      router.replace('/admin' as Href); // la pantalla principal del panel
    } catch (e: any) {
      Alert.alert('No se pudo entrar', e.message);
    }
    setCargando(false);
  };

  return (
    <KeyboardAvoidingView style={estilos.pantalla} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={estilos.icono}>
        <Text style={{ fontSize: 40 }}>🔐</Text>
      </View>
      <Text style={estilos.titulo}>Panel de administrador</Text>
      <Text style={estilos.subtitulo}>Tienda de Bicicletas</Text>

      <TextInput
        style={estilos.campo}
        placeholder="Clave de administrador"
        placeholderTextColor="#94a3b8"
        secureTextEntry
        value={clave}
        onChangeText={setClave}
        onSubmitEditing={entrar}
      />
      <Pressable style={({ pressed }) => [estilos.boton, pressed && { opacity: 0.8 }]} onPress={entrar} disabled={cargando}>
        {cargando ? <ActivityIndicator color="white" /> : <Text style={estilos.textoBoton}>Entrar</Text>}
      </Pressable>
      <Pressable onPress={() => router.back()}>
        <Text style={estilos.volver}>← Volver a la tienda</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.oscuro, justifyContent: 'center', padding: 28 },
  icono: {
    width: 84, height: 84, borderRadius: 24, backgroundColor: '#1e293b',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 20,
  },
  titulo: { color: 'white', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitulo: { color: '#94a3b8', textAlign: 'center', marginTop: 4, marginBottom: 32 },
  campo: {
    backgroundColor: '#1e293b', color: 'white', borderRadius: 14, padding: 16,
    fontSize: 16, borderWidth: 1, borderColor: '#334155',
  },
  boton: { backgroundColor: C.primario, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 14 },
  textoBoton: { color: 'white', fontWeight: '800', fontSize: 16 },
  volver: { color: '#94a3b8', textAlign: 'center', marginTop: 24 },
});
