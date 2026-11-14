// Seguimiento del pedido: mapa interactivo (OpenStreetMap) + etapas + hora de llegada
import { useLocalSearchParams } from 'expo-router';
import { ComponentType, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { API, Seguimiento, verSeguimiento } from '../db';

// (El tipo de WebView choca con React 19; así se usa sin problema)
const Mapa = WebView as unknown as ComponentType<any>;

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

export default function PantallaSeguimiento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [datos, setDatos] = useState<Seguimiento | null>(null);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(0); // hora de la última actualización
  const mapa = useRef<any>(null);

  // Carga el seguimiento y lo actualiza cada 10 segundos
  useEffect(() => {
    const cargar = () =>
      verSeguimiento(id)
        .then((d) => {
          setDatos(d);
          setAhora(Date.now());
          // Mueve la bicicleta en el mapa sin recargarlo
          mapa.current?.injectJavaScript(`mover(${d.actual.lat}, ${d.actual.lng}); true;`);
        })
        .catch((e) => setError(e.message));
    cargar();
    const intervalo = setInterval(cargar, 10000);
    return () => clearInterval(intervalo);
  }, [id]);

  if (error) return <Text style={{ padding: 20 }}>{error}</Text>;
  if (!datos) return <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#1e6fd9" />;

  const minutosFaltan = Math.max(0, Math.round((new Date(datos.llegada).getTime() - ahora) / 60000));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f4f6f8' }}>
      {/* ---------- Mapa ---------- */}
      <View style={estilos.mapa}>
        {Platform.OS === 'web' ? (
          <Text
            style={{ padding: 20, color: '#1e6fd9' }}
            onPress={() =>
              Linking.openURL(`https://www.openstreetmap.org/?mlat=${datos.actual.lat}&mlon=${datos.actual.lng}#map=15/${datos.actual.lat}/${datos.actual.lng}`)
            }>
            Ver ubicación en OpenStreetMap
          </Text>
        ) : (
          <Mapa
            ref={mapa}
            originWhitelist={['*']}
            // baseUrl hace que el mapa mande "Referer", que OpenStreetMap exige para mostrar el mapa
            source={{ html: htmlMapa(datos), baseUrl: API }}
          />
        )}
      </View>

      {/* ---------- Llegada ---------- */}
      <View style={estilos.tarjeta}>
        {datos.entregado ? (
          <Text style={estilos.grande}>{datos.domicilio ? '✅ ¡Pedido entregado!' : '✅ Listo para recoger'}</Text>
        ) : (
          <>
            <Text style={estilos.gris}>{datos.domicilio ? 'Llega aproximadamente a las' : 'Listo para recoger a las'}</Text>
            <Text style={estilos.grande}>{hora(datos.llegada)}</Text>
            <Text style={estilos.gris}>en {minutosFaltan} min</Text>
          </>
        )}
        {datos.domicilio && (
          <>
            <Text style={{ marginTop: 8 }}>📍 {datos.direccion}</Text>
            <Text style={estilos.gris}>Distancia desde la tienda: {datos.distancia_km} km</Text>
            {datos.aproximado && (
              <Text style={estilos.aviso}>No encontramos la dirección exacta en el mapa; se muestra un punto aproximado.</Text>
            )}
            {/* Barra de avance */}
            <View style={estilos.barra}>
              <View style={[estilos.relleno, { width: `${Math.round(datos.progreso * 100)}%` }]} />
            </View>
          </>
        )}
      </View>

      {/* ---------- Etapas ---------- */}
      <View style={estilos.tarjeta}>
        {datos.etapas.map((e) => (
          <View key={e.nombre} style={estilos.etapa}>
            <Text style={{ fontSize: 18 }}>{e.hecho ? '✅' : '⚪'}</Text>
            <Text style={[{ flex: 1, marginLeft: 8 }, !e.hecho && { color: '#999' }]}>{e.nombre}</Text>
            <Text style={estilos.gris}>{hora(e.hora)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// Página web con el mapa (Leaflet + OpenStreetMap). mover(lat, lng) cambia la posición de la bicicleta.
function htmlMapa(d: Seguimiento) {
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#mapa{margin:0;height:100%}.icono{font-size:26px;line-height:26px}</style>
</head><body><div id="mapa"></div><script>
  var mapa = L.map('mapa');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);
  function icono(emoji) { return L.divIcon({ html: emoji, className: 'icono', iconSize: [26, 26] }); }
  var tienda = [${d.tienda.lat}, ${d.tienda.lng}];
  var destino = [${d.destino.lat}, ${d.destino.lng}];
  L.marker(tienda, { icon: icono('🏪') }).addTo(mapa).bindPopup('Tienda');
  ${d.domicilio ? `
  L.marker(destino, { icon: icono('🏠') }).addTo(mapa).bindPopup('Tu dirección');
  L.polyline([tienda, destino], { color: '#1e6fd9', dashArray: '6 8' }).addTo(mapa);
  function encuadrar() { mapa.invalidateSize(); mapa.fitBounds([tienda, destino], { padding: [40, 40] }); }
  encuadrar();
  setTimeout(encuadrar, 400); // cuando la pantalla ya tiene su tamaño final` : `
  mapa.setView(tienda, 16);`}
  var bici = L.marker([${d.actual.lat}, ${d.actual.lng}], { icon: icono('🚴') }).addTo(mapa).bindPopup('Tu pedido');
  function mover(lat, lng) { bici.setLatLng([lat, lng]); }
</script></body></html>`;
}

const estilos = StyleSheet.create({
  mapa: { height: 320, backgroundColor: '#ddd' },
  tarjeta: { backgroundColor: 'white', margin: 10, marginBottom: 0, padding: 14, borderRadius: 10 },
  grande: { fontSize: 26, fontWeight: 'bold', color: '#1e6fd9' },
  gris: { color: '#666' },
  aviso: { color: '#b07a00', fontSize: 12, marginTop: 4 },
  barra: { height: 8, backgroundColor: '#eee', borderRadius: 4, marginTop: 10, overflow: 'hidden' },
  relleno: { height: 8, backgroundColor: '#22a050' },
  etapa: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
});
