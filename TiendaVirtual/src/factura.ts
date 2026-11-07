// =============================================
//  Factura en PDF (expo-print crea el PDF, expo-sharing lo guarda/comparte)
// =============================================
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { Alert, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { guardarConfig, leerConfig, type Usuario, type Venta } from './db';

export const pesos = (n: number) => '$' + Number(n).toLocaleString('es-CO');

export async function descargarFactura(venta: Venta, usuario: Usuario) {
  const filas = venta.items
    .map(
      (i) => `<tr>
        <td>${i.nombre}</td>
        <td>${i.cantidad}</td>
        <td>${pesos(i.precio)}</td>
        <td>${pesos(i.precio * i.cantidad)}</td>
      </tr>`
    )
    .join('');

  const html = `
  <html>
    <body style="font-family: Arial; padding: 30px;">
      <h1 style="color:#1e6fd9;">🚲 Tienda de Bicicletas</h1>
      <h2>Factura N° ${venta.id}</h2>
      <p><b>Cliente:</b> ${usuario.nombre} (${usuario.email})</p>
      <p><b>Fecha:</b> ${new Date(venta.fecha).toLocaleString('es-CO')}</p>
      ${venta.pendiente ? '<p style="color:#d93a3a;">Compra hecha sin internet (pendiente de sincronizar)</p>' : ''}
      <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
        <tr style="background:#eee;">
          <th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th>
        </tr>
        ${filas}
      </table>
      <p><b>Medio de pago:</b> ${venta.metodo_pago}</p>
      <p><b>Entrega:</b> ${venta.direccion ? 'Domicilio: ' + venta.direccion : 'Recoger en tienda'}</p>
      <table cellpadding="6" style="margin-left:auto; margin-top: 16px;">
        <tr><td>Subtotal:</td><td align="right">${pesos(venta.subtotal)}</td></tr>
        <tr><td>IVA (19%):</td><td align="right">${pesos(venta.iva)}</td></tr>
        <tr><td>Envío:</td><td align="right">${venta.envio ? pesos(venta.envio) : 'Gratis'}</td></tr>
        <tr><td><h2>Total:</h2></td><td align="right"><h2>${pesos(venta.total)}</h2></td></tr>
      </table>
      <p>¡Gracias por su compra!</p>
    </body>
  </html>`;

  // En el navegador: abre la ventana de imprimir (elegir "Guardar como PDF")
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  const nombre = `factura-${venta.id}`;

  // Android: guarda el PDF directo en una carpeta (se elige solo la primera vez)
  if (Platform.OS === 'android') {
    try {
      await guardarEnCarpeta(nombre, base64 ?? '');
      Alert.alert('Factura descargada', `Se guardó "${nombre}.pdf" en tu carpeta de facturas.`);
      return;
    } catch {
      // si el usuario cancela o falla, se usa la opción de compartir de abajo
    }
  }

  // iPhone (o si falló lo anterior): abre el menú para guardar/compartir
  const archivo = new File(Paths.cache, `${nombre}.pdf`);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(base64 ?? '', { encoding: 'base64' });
  await Sharing.shareAsync(archivo.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}

// Carpeta "Descargas" de Android, para que el selector abra ahí
const DESCARGAS = 'content://com.android.externalstorage.documents/tree/primary%3ADownload';

async function guardarEnCarpeta(nombre: string, base64: string) {
  const guardada = leerConfig('carpetaFacturas');
  try {
    if (!guardada) throw new Error('sin carpeta');
    escribirPdf(new Directory(guardada), nombre, base64);
  } catch {
    // Primera vez (o se perdió el permiso): pedir la carpeta y recordarla
    guardarConfig('carpetaFacturas', null);
    const carpeta = await Directory.pickDirectoryAsync(DESCARGAS);
    guardarConfig('carpetaFacturas', carpeta.uri);
    escribirPdf(carpeta, nombre, base64);
  }
}

function escribirPdf(carpeta: Directory, nombre: string, base64: string) {
  const archivo = carpeta.createFile(nombre, 'application/pdf');
  archivo.write(base64, { encoding: 'base64' });
}
