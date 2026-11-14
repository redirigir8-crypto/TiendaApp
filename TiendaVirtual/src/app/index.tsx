// Pantalla de inicio de sesión / registro
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { login, registro, usuarioGuardado } from '../db';

export default function Login() {
  const [modoRegistro, setModoRegistro] = useState(false);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);

  // Si ya inició sesión antes, entra directo (funciona sin internet)
  useEffect(() => {
    if (usuarioGuardado()) router.replace('/tienda');
  }, []);

  const enviar = async () => {
    setCargando(true);
    try {
      if (modoRegistro) await registro(nombre, email, password);
      else await login(email, password);
      router.replace('/tienda');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Revisa tu conexión a internet');
    }
    setCargando(false);
  };

  return (
    <View style={estilos.pantalla}>
      <Text style={estilos.titulo}>🚲 Tienda de Bicicletas</Text>

      {modoRegistro && (
        <TextInput style={estilos.input} placeholder="Nombre" value={nombre} onChangeText={setNombre} />
      )}
      <TextInput
        style={estilos.input}
        placeholder="Correo"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={estilos.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={estilos.boton} onPress={enviar} disabled={cargando}>
        {cargando ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={estilos.textoBoton}>{modoRegistro ? 'Registrarme' : 'Entrar'}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setModoRegistro(!modoRegistro)}>
        <Text style={estilos.enlace}>
          {modoRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </Text>
      </Pressable>

      <Pressable onPress={() => router.push('/admin-entrar')}>
        <Text style={estilos.admin}>🔐 Soy administrador</Text>
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  pantalla: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f4f6f8' },
  titulo: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 30, color: '#1e6fd9' },
  input: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#ddd' },
  boton: { backgroundColor: '#1e6fd9', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  textoBoton: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  enlace: { color: '#1e6fd9', textAlign: 'center', marginTop: 18 },
  admin: { color: '#64748b', textAlign: 'center', marginTop: 36, fontSize: 13 },
});
