// =============================================
//  Factura en PDF (expo-print crea el PDF, expo-sharing lo guarda/comparte)
// =============================================
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Usuario, Venta } from './db';

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
      <h2 style="text-align:right;">Total: ${pesos(venta.total)}</h2>
      <p>¡Gracias por su compra!</p>
    </body>
  </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
}
