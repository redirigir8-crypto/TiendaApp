// =============================================
//  Estilo del panel de administrador: colores y piezas reutilizables
//  (cambia los colores aquí y se cambian en todo el panel)
// =============================================
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

export const C = {
  fondo: '#f1f5f9',
  tarjeta: '#ffffff',
  oscuro: '#0f172a', // encabezados
  texto: '#1e293b',
  gris: '#64748b',
  borde: '#e2e8f0',
  primario: '#4f46e5', // índigo
  primarioSuave: '#eef2ff',
  verde: '#16a34a',
  verdeSuave: '#dcfce7',
  rojo: '#dc2626',
  rojoSuave: '#fee2e2',
  ambar: '#d97706',
  ambarSuave: '#fef3c7',
};

export const pesos = (n: number) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO');

// Tarjeta blanca con sombra suave
export function Tarjeta({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.tarjeta, style]}>{children}</View>;
}

// Etiqueta de color (estado, stock, etc.)
type Tono = 'verde' | 'rojo' | 'ambar' | 'primario' | 'gris';
const TONOS: Record<Tono, [string, string]> = {
  verde: [C.verde, C.verdeSuave],
  rojo: [C.rojo, C.rojoSuave],
  ambar: [C.ambar, C.ambarSuave],
  primario: [C.primario, C.primarioSuave],
  gris: [C.gris, C.borde],
};
export function Etiqueta({ texto, tono = 'gris' }: { texto: string; tono?: Tono }) {
  const [color, fondo] = TONOS[tono];
  return (
    <View style={[s.etiqueta, { backgroundColor: fondo }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

// Botón (relleno o con borde)
export function Boton({
  texto, onPress, tono = 'primario', borde = false, style,
}: { texto: string; onPress: () => void; tono?: 'primario' | 'verde' | 'rojo'; borde?: boolean; style?: ViewStyle }) {
  const color = C[tono];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.boton,
        borde ? { borderWidth: 1.5, borderColor: color } : { backgroundColor: color },
        pressed && { opacity: 0.7 },
        style,
      ]}>
      <Text style={{ color: borde ? color : 'white', fontWeight: '700' }}>{texto}</Text>
    </Pressable>
  );
}

// Campo de texto con título
export function Campo({ titulo, ...props }: TextInputProps & { titulo: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.tituloCampo}>{titulo}</Text>
      <TextInput placeholderTextColor="#94a3b8" style={[s.campo, props.multiline && { minHeight: 80 }]} {...props} />
    </View>
  );
}

// Fila de chips para filtrar
export function Filtros<T extends string>({
  opciones, valor, onChange,
}: { opciones: { valor: T; texto: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <View style={s.filtros}>
      {opciones.map((o) => (
        <Pressable key={o.valor} onPress={() => onChange(o.valor)} style={[s.chip, valor === o.valor && s.chipActivo]}>
          <Text style={{ color: valor === o.valor ? 'white' : C.texto, fontWeight: '600', fontSize: 13 }}>{o.texto}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// Círculo con iniciales (usuarios)
export function Avatar({ nombre }: { nombre: string }) {
  const iniciales = nombre.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={s.avatar}>
      <Text style={{ color: C.primario, fontWeight: '800' }}>{iniciales}</Text>
    </View>
  );
}

// Mensaje cuando una lista está vacía
export function Vacio({ texto }: { texto: string }) {
  return <Text style={{ textAlign: 'center', color: C.gris, marginTop: 40 }}>{texto}</Text>;
}

export const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.fondo },
  tarjeta: {
    backgroundColor: C.tarjeta,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 14,
    marginTop: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  titulo: { fontSize: 17, fontWeight: '800', color: C.texto },
  subtitulo: { color: C.gris, fontSize: 13 },
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  etiqueta: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  boton: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center' },
  tituloCampo: { color: C.gris, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  campo: {
    backgroundColor: C.fondo, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.borde,
    color: C.texto, textAlignVertical: 'top',
  },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: C.tarjeta, borderWidth: 1, borderColor: C.borde },
  chipActivo: { backgroundColor: C.primario, borderColor: C.primario },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarioSuave,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
});
