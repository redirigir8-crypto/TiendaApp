// Postventa: aprobar o rechazar devoluciones y garantías
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, Text, TextInput, View,
} from 'react-native';
import * as api from '@/admin/api';
import { Boton, C, Etiqueta, Filtros, s, Tarjeta, Vacio } from '@/admin/ui';

type Filtro = 'pendiente' | 'todas';
type Respuesta = { solicitud: api.SolicitudAdmin; estado: 'aprobada' | 'rechazada' } | null;

const ESTADO = {
  pendiente: { texto: 'Pendiente', tono: 'ambar' as const },
  aprobada: { texto: 'Aprobada', tono: 'verde' as const },
  rechazada: { texto: 'Rechazada', tono: 'rojo' as const },
};

export default function Solicitudes() {
  const [lista, setLista] = useState<api.SolicitudAdmin[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [cargando, setCargando] = useState(false);
  const [respondiendo, setRespondiendo] = useState<Respuesta>(null);
  const [mensaje, setMensaje] = useState('');

  const cargar = useCallback(() => {
    setCargando(true);
    api.solicitudes().then(setLista).catch((e) => Alert.alert('Error', e.message)).finally(() => setCargando(false));
  }, []);
  useFocusEffect(cargar);

  const abrir = (solicitud: api.SolicitudAdmin, estado: 'aprobada' | 'rechazada') => {
    setMensaje(
      estado === 'aprobada'
        ? solicitud.tipo === 'devolucion'
          ? 'Aprobada. Pasaremos a recoger el producto y te reembolsamos el valor.'
          : 'Aprobada. Lleva la bicicleta a la tienda y la revisamos sin costo.'
        : ''
    );
    setRespondiendo({ solicitud, estado });
  };

  const enviar = async () => {
    if (!respondiendo) return;
    if (respondiendo.estado === 'rechazada' && !mensaje.trim()) {
      return Alert.alert('Falta el motivo', 'Escribe por qué se rechaza');
    }
    try {
      await api.responderSolicitud(respondiendo.solicitud.id, respondiendo.estado, mensaje.trim());
      setRespondiendo(null);
      cargar();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const visibles = filtro === 'todas' ? lista : lista.filter((x) => x.estado === 'pendiente');

  return (
    <View style={s.pantalla}>
      <Filtros
        valor={filtro}
        onChange={setFiltro}
        opciones={[
          { valor: 'pendiente', texto: `Pendientes (${lista.filter((x) => x.estado === 'pendiente').length})` },
          { valor: 'todas', texto: 'Todas' },
        ]}
      />
      <FlatList
        data={visibles}
        keyExtractor={(x) => String(x.id)}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}
        ListEmptyComponent={<Vacio texto={filtro === 'pendiente' ? '🎉 No hay solicitudes pendientes' : 'No hay solicitudes'} />}
        renderItem={({ item }) => (
          <Tarjeta>
            <View style={s.fila}>
              <Text style={s.titulo}>{item.tipo === 'devolucion' ? '↩ Devolución' : '🛠 Garantía'}</Text>
              <Etiqueta texto={ESTADO[item.estado].texto} tono={ESTADO[item.estado].tono} />
            </View>
            <Text style={[s.subtitulo, { marginTop: 2 }]}>
              Venta #{item.venta_id} · {item.cliente} · {new Date(item.fecha).toLocaleDateString('es-CO')}
            </Text>
            {!!item.email && <Text style={s.subtitulo}>{item.email}</Text>}

            <View style={{ marginVertical: 10 }}>
              {item.items.map((i) => (
                <Text key={i.id} style={{ color: C.texto }}>
                  {i.cantidad} × {i.nombre}
                </Text>
              ))}
            </View>
            <View style={{ backgroundColor: C.fondo, borderRadius: 12, padding: 12 }}>
              <Text style={{ color: C.texto }}>“{item.motivo}”</Text>
            </View>

            {!!item.respuesta && <Text style={[s.subtitulo, { marginTop: 10 }]}>Respuesta: {item.respuesta}</Text>}

            {item.estado === 'pendiente' && (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Boton texto="Rechazar" tono="rojo" borde onPress={() => abrir(item, 'rechazada')} style={{ flex: 1 }} />
                <Boton texto="Aprobar" tono="verde" onPress={() => abrir(item, 'aprobada')} style={{ flex: 1 }} />
              </View>
            )}
          </Tarjeta>
        )}
      />

      {/* ---------- Ventana para escribir la respuesta ---------- */}
      <Modal visible={!!respondiendo} transparent animationType="fade" onRequestClose={() => setRespondiendo(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15,23,42,0.55)' }}>
          <View style={{ backgroundColor: C.tarjeta, borderRadius: 20, padding: 20 }}>
            <Text style={[s.titulo, { marginBottom: 4 }]}>
              {respondiendo?.estado === 'aprobada' ? '✅ Aprobar solicitud' : '❌ Rechazar solicitud'}
            </Text>
            <Text style={[s.subtitulo, { marginBottom: 12 }]}>Este mensaje lo verá el cliente en la app.</Text>
            <TextInput
              value={mensaje}
              onChangeText={setMensaje}
              multiline
              placeholder={respondiendo?.estado === 'rechazada' ? 'Motivo del rechazo' : 'Mensaje para el cliente'}
              placeholderTextColor="#94a3b8"
              style={{
                backgroundColor: C.fondo, borderRadius: 12, padding: 12, minHeight: 90,
                textAlignVertical: 'top', borderWidth: 1, borderColor: C.borde, color: C.texto,
              }}
            />
            {respondiendo?.solicitud.tipo === 'devolucion' && respondiendo.estado === 'aprobada' && (
              <Text style={[s.subtitulo, { marginTop: 8 }]}>Los productos vuelven al inventario.</Text>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Boton texto="Cancelar" borde onPress={() => setRespondiendo(null)} style={{ flex: 1 }} />
              <Boton
                texto="Enviar"
                tono={respondiendo?.estado === 'aprobada' ? 'verde' : 'rojo'}
                onPress={enviar}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
