// Productos: ver inventario, crear, editar y borrar bicicletas
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View,
} from 'react-native';
import * as api from '@/admin/api';
import { Boton, C, Campo, Etiqueta, pesos, s, Tarjeta, Vacio } from '@/admin/ui';

const formVacio = { nombre: '', precio: '', stock: '', descripcion: '', imagenes: '', direccion: '' };
const fotosDe = (p: api.ProductoAdmin) => (p.imagenes?.length ? p.imagenes : p.imagen ? [p.imagen] : []);

export default function Productos() {
  const [lista, setLista] = useState<api.ProductoAdmin[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false); // formulario visible
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [form, setForm] = useState(formVacio);

  const cargar = useCallback(() => {
    setCargando(true);
    api.productos().then(setLista).catch((e) => Alert.alert('Error', e.message)).finally(() => setCargando(false));
  }, []);
  useFocusEffect(cargar);

  const nuevo = () => {
    setEditandoId(null);
    setForm(formVacio);
    setAbierto(true);
  };

  const editar = (p: api.ProductoAdmin) => {
    setEditandoId(p.id);
    setForm({
      nombre: p.nombre,
      precio: String(p.precio),
      stock: String(p.stock),
      descripcion: p.descripcion ?? '',
      imagenes: fotosDe(p).join('\n'),
      direccion: p.direccion ?? '',
    });
    setAbierto(true);
  };

  const guardar = async () => {
    if (!form.nombre.trim() || !form.precio) return Alert.alert('Falta información', 'Escribe al menos nombre y precio');
    try {
      await api.guardarProducto(
        {
          nombre: form.nombre.trim(),
          precio: Number(form.precio),
          stock: Number(form.stock || 0),
          descripcion: form.descripcion,
          imagenes: form.imagenes.split('\n').map((u) => u.trim()).filter(Boolean),
          direccion: form.direccion.trim(),
        },
        editandoId ?? undefined
      );
      setAbierto(false);
      cargar();
    } catch (e: any) {
      Alert.alert('No se pudo guardar', e.message);
    }
  };

  const borrar = (p: api.ProductoAdmin) => {
    Alert.alert('¿Eliminar producto?', p.nombre, [
      { text: 'Cancelar' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => api.borrarProducto(p.id).then(cargar).catch((e) => Alert.alert('Error', e.message)),
      },
    ]);
  };

  const cambiar = (campo: keyof typeof formVacio) => (texto: string) => setForm({ ...form, [campo]: texto });
  const fotosForm = form.imagenes.split('\n').map((u) => u.trim()).filter(Boolean);

  return (
    <View style={s.pantalla}>
      <FlatList
        data={lista}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListEmptyComponent={<Vacio texto="No hay productos. Toca + para crear uno." />}
        renderItem={({ item }) => {
          const foto = fotosDe(item)[0];
          return (
            <Tarjeta style={{ flexDirection: 'row', alignItems: 'center' }}>
              {foto ? (
                <Image source={{ uri: foto }} style={{ width: 72, height: 72, borderRadius: 12 }} />
              ) : (
                <View style={{ width: 72, height: 72, borderRadius: 12, backgroundColor: C.fondo, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 32 }}>🚲</Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontWeight: '800', color: C.texto }} numberOfLines={1}>{item.nombre}</Text>
                <Text style={{ color: C.primario, fontWeight: '700', marginVertical: 4 }}>{pesos(item.precio)}</Text>
                {!!item.direccion && (
                  <Text style={[s.subtitulo, { marginBottom: 4 }]} numberOfLines={1}>📦 {item.direccion}</Text>
                )}
                <Etiqueta
                  texto={item.stock <= 0 ? 'Agotado' : `${item.stock} en stock`}
                  tono={item.stock <= 0 ? 'rojo' : item.stock <= 2 ? 'ambar' : 'verde'}
                />
              </View>
              <View style={{ gap: 8 }}>
                <Pressable onPress={() => editar(item)} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 18 }}>✏️</Text>
                </Pressable>
                <Pressable onPress={() => borrar(item)} style={{ padding: 6 }}>
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
                </Pressable>
              </View>
            </Tarjeta>
          );
        }}
      />

      {/* Botón flotante para crear */}
      <Pressable
        onPress={nuevo}
        style={({ pressed }) => [
          {
            position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30,
            backgroundColor: C.primario, alignItems: 'center', justifyContent: 'center', elevation: 6,
            shadowColor: C.primario, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
          },
          pressed && { opacity: 0.8 },
        ]}>
        <Text style={{ color: 'white', fontSize: 30, marginTop: -2 }}>+</Text>
      </Pressable>

      {/* ---------- Formulario (ventana que sube desde abajo) ---------- */}
      <Modal visible={abierto} animationType="slide" transparent onRequestClose={() => setAbierto(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.5)' }}>
          <View style={{ backgroundColor: C.tarjeta, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' }}>
            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={[s.titulo, { fontSize: 20, marginBottom: 16 }]}>
                {editandoId ? 'Editar bicicleta' : 'Nueva bicicleta'}
              </Text>
              <Campo titulo="Nombre" value={form.nombre} onChangeText={cambiar('nombre')} placeholder="Bicicleta MTB Rin 29" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Campo titulo="Precio (sin IVA)" value={form.precio} onChangeText={cambiar('precio')} keyboardType="number-pad" placeholder="1500000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Campo titulo="Stock" value={form.stock} onChangeText={cambiar('stock')} keyboardType="number-pad" placeholder="10" />
                </View>
              </View>
              <Campo
                titulo="Dirección de despacho (desde dónde sale)"
                value={form.direccion}
                onChangeText={cambiar('direccion')}
                placeholder="Calle 13 # 68-10, Bogotá"
              />
              <Campo titulo="Descripción" value={form.descripcion} onChangeText={cambiar('descripcion')} multiline placeholder="21 cambios, frenos de disco..." />
              <Campo
                titulo="Fotos (una URL por línea, la primera es la portada)"
                value={form.imagenes}
                onChangeText={cambiar('imagenes')}
                multiline
                autoCapitalize="none"
                placeholder="https://..."
              />
              {fotosForm.length > 0 && (
                <ScrollView horizontal style={{ marginBottom: 12 }}>
                  {fotosForm.map((u) => (
                    <Image key={u} source={{ uri: u }} style={{ width: 70, height: 54, borderRadius: 8, marginRight: 8 }} />
                  ))}
                </ScrollView>
              )}
              <Boton texto={editandoId ? 'Guardar cambios' : 'Publicar'} onPress={guardar} />
              <Boton texto="Cancelar" onPress={() => setAbierto(false)} borde style={{ marginTop: 10 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
