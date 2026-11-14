// =============================================
//  Factura en PDF
//  - Compras que ya están en el servidor: se DESCARGA el PDF (con código QR) desde el backend.
//    El navegador del celular lo guarda en "Descargas".
//  - Compras hechas sin internet: se crea aquí con expo-print y se comparte.
// =============================================
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { API, type Usuario, type Venta } from './db';

export const pesos = (n: number) => '$' + Number(n).toLocaleString('es-CO');

export async function descargarFactura(venta: Venta, usuario: Usuario) {
  // Descarga directa desde el servidor
  if (venta.codigo && !venta.pendiente) {
    await Linking.openURL(`${API}/factura/${venta.codigo}`);
    return;
  }

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

  // Compra sin internet (todavía no está en el servidor): se crea aquí y se comparte
  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  const archivo = new File(Paths.cache, `factura-${venta.id}.pdf`);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(base64 ?? '', { encoding: 'base64' });
  await Sharing.shareAsync(archivo.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
