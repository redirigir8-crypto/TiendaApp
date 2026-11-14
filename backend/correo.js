// =============================================
//  Factura PDF por correo (pdfkit + Brevo)
//  - En Render configura BREVO_KEY y CORREO_TIENDA (correo verificado en Brevo)
// =============================================
const PDFDocument = require('pdfkit');

const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-CO');

// Crea la factura en PDF y la devuelve en base64
function crearPdf(venta, cliente) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes).toString('base64')));

    doc.fontSize(22).fillColor('#1e6fd9').text('Tienda de Bicicletas');
    doc.moveDown(0.5).fontSize(16).fillColor('black').text(`Factura N° ${venta.id}`);
    doc.fontSize(11).moveDown(0.5);
    doc.text(`Cliente: ${cliente.nombre} (${cliente.email})`);
    doc.text(`Fecha: ${new Date(venta.fecha).toLocaleString('es-CO')}`);
    doc.text(`Medio de pago: ${venta.metodo_pago}`);
    doc.text(`Entrega: ${venta.direccion ? 'Domicilio: ' + venta.direccion : 'Recoger en tienda'}`);
    doc.moveDown();

    doc.fontSize(12).text('Productos', { underline: true }).moveDown(0.3);
    for (const i of venta.items) {
      doc.fontSize(11).text(`${i.cantidad} x ${i.nombre}   ${pesos(i.precio * i.cantidad)}`);
    }
    doc.moveDown();
    doc.text(`Subtotal: ${pesos(venta.subtotal)}`, { align: 'right' });
    doc.text(`IVA (19%): ${pesos(venta.iva)}`, { align: 'right' });
    doc.text(`Envío: ${Number(venta.envio) ? pesos(venta.envio) : 'Gratis'}`, { align: 'right' });
    doc.fontSize(14).text(`Total: ${pesos(venta.total)}`, { align: 'right' });
    doc.moveDown(2).fontSize(11).text('¡Gracias por su compra!', { align: 'center' });
    doc.end();
  });
}

// Envía la factura al correo del cliente. Si no está configurado, solo avisa en el log.
async function enviarFactura(venta, cliente) {
  if (!process.env.BREVO_KEY || !process.env.CORREO_TIENDA) {
    console.log('Correo no configurado (falta BREVO_KEY o CORREO_TIENDA)');
    return;
  }
  const pdf = await crearPdf(venta, cliente);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Tienda de Bicicletas', email: process.env.CORREO_TIENDA },
      to: [{ email: cliente.email, name: cliente.nombre }],
      subject: `Tu factura N° ${venta.id} - Tienda de Bicicletas`,
      htmlContent: `
        <h2 style="color:#1e6fd9;">¡Gracias por tu compra, ${cliente.nombre}!</h2>
        <p>Tu pago fue aprobado. Total: <b>${pesos(venta.total)}</b></p>
        <p>Medio de pago: ${venta.metodo_pago}</p>
        <p>Adjuntamos tu factura en PDF.</p>`,
      attachment: [{ name: `factura-${venta.id}.pdf`, content: pdf }],
    }),
  });
  if (!res.ok) console.error('Error enviando correo:', await res.text());
  else console.log(`Factura ${venta.id} enviada a ${cliente.email}`);
}

module.exports = { enviarFactura, crearPdf };
