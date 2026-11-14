// Usuarios: clientes registrados, cuánto compran y buscador
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TextInput, View } from 'react-native';
import * as api from '@/admin/api';
import { Avatar, C, Etiqueta, pesos, s, Tarjeta, Vacio } from '@/admin/ui';

export default function Usuarios() {
  const [lista, setLista] = useState<api.UsuarioAdmin[]>([]);
  const [buscar, setBuscar] = useState('');
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(() => {
    setCargando(true);
    api.usuarios().then(setLista).catch((e) => Alert.alert('Error', e.message)).finally(() => setCargando(false));
  }, []);
  useFocusEffect(cargar);

  const texto = buscar.trim().toLowerCase();
  const visibles = lista.filter((u) => !texto || u.nombre.toLowerCase().includes(texto) || u.email.includes(texto));
  const mejor = Math.max(0, ...lista.map((u) => u.total_gastado));

  return (
    <View style={s.pantalla}>
      <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
        <TextInput
          value={buscar}
          onChangeText={setBuscar}
          placeholder="🔍  Buscar por nombre o correo"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          style={{
            backgroundColor: C.tarjeta, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.borde, color: C.texto,
          }}
        />
        <Text style={[s.subtitulo, { marginTop: 10 }]}>{visibles.length} usuarios</Text>
      </View>
      <FlatList
        data={visibles}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListEmptyComponent={<Vacio texto="No se encontraron usuarios" />}
        renderItem={({ item }) => (
          <Tarjeta style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar nombre={item.nombre} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: C.texto }}>{item.nombre}</Text>
              <Text style={s.subtitulo} numberOfLines={1}>{item.email}</Text>
              <Text style={[s.subtitulo, { marginTop: 2 }]}>
                {item.ultima_compra
                  ? 'Última compra: ' + new Date(item.ultima_compra).toLocaleDateString('es-CO')
                  : 'Sin compras todavía'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ fontWeight: '800', color: C.texto }}>{pesos(item.total_gastado)}</Text>
              <Text style={s.subtitulo}>{item.compras} compras</Text>
              {item.total_gastado > 0 && item.total_gastado === mejor && <Etiqueta texto="⭐ Mejor cliente" tono="primario" />}
            </View>
          </Tarjeta>
        )}
      />
    </View>
  );
}
