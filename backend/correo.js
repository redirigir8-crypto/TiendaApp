// =============================================
//  Factura PDF (con código QR) y envío por correo SMTP (nodemailer)
//
//  Variables en Render:
//    SMTP_HOST   ej: smtp-relay.brevo.com
//    SMTP_PORT   ej: 2525   (Render gratis BLOQUEA 25, 465 y 587; el 2525 sí funciona)
//    SMTP_USER   usuario SMTP (en Brevo: "SMTP & API" > pestaña SMTP > Login)
//    SMTP_PASS   clave SMTP  (en Brevo: "Generate a new SMTP key")
//    CORREO_TIENDA  correo remitente (verificado en Brevo)
// =============================================
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-CO');

// Crea la factura en PDF. "urlFactura" va dentro del código QR.
// Devuelve un Buffer con el PDF.
async function crearPdf(venta, cliente, urlFactura) {
  const qr = await QRCode.toBuffer(urlFactura, { width: 220, margin: 1 });

  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const partes = [];
    doc.on('data', (p) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));

    // Código QR arriba a la derecha
    doc.image(qr, 430, 45, { width: 120 });
    doc.fontSize(8).fillColor('#666').text('Escanea para ver la factura', 430, 168, { width: 120, align: 'center' });

    doc.fontSize(22).fillColor('#1e6fd9').text('Tienda de Bicicletas', 50, 50);
    doc.moveDown(0.5).fontSize(16).fillColor('black').text(`Factura N° ${venta.id}`);
    doc.fontSize(11).moveDown(0.5);
    doc.text(`Cliente: ${cliente.nombre} (${cliente.email})`);
    doc.text(`Fecha: ${new Date(venta.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
    doc.text(`Medio de pago: ${venta.metodo_pago}`);
    doc.text(`Entrega: ${venta.direccion ? 'Domicilio: ' + venta.direccion : 'Recoger en tienda'}`);

    doc.moveDown(2).fontSize(12).text('Productos', 50, doc.y, { underline: true }).moveDown(0.3);
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

// Conexión SMTP (se crea una sola vez)
let transporte = null;
function smtp() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporte) {
    const puerto = Number(process.env.SMTP_PORT || 2525);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      secure: puerto === 465, // 465 usa SSL directo; 2525 y 587 usan STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporte;
}

// Envía la factura al correo del cliente. Si el SMTP no está configurado, solo avisa en el log.
async function enviarFactura(venta, cliente, urlFactura) {
  const conexion = smtp();
  if (!conexion) {
    console.log('Correo no configurado (faltan SMTP_HOST, SMTP_USER o SMTP_PASS)');
    return;
  }
  const pdf = await crearPdf(venta, cliente, urlFactura);
  await conexion.sendMail({
    from: `"Tienda de Bicicletas" <${process.env.CORREO_TIENDA || process.env.SMTP_USER}>`,
    to: `"${cliente.nombre}" <${cliente.email}>`,
    subject: `Tu factura N° ${venta.id} - Tienda de Bicicletas`,
    html: `
      <h2 style="color:#1e6fd9;">¡Gracias por tu compra, ${cliente.nombre}!</h2>
      <p>Tu pago fue aprobado. Total: <b>${pesos(venta.total)}</b></p>
      <p>Medio de pago: ${venta.metodo_pago}</p>
      <p>Adjuntamos tu factura en PDF. También puedes verla aquí:
        <a href="${urlFactura}">${urlFactura}</a></p>`,
    attachments: [{ filename: `factura-${venta.id}.pdf`, content: pdf }],
  });
  console.log(`Factura ${venta.id} enviada a ${cliente.email}`);
}

module.exports = { enviarFactura, crearPdf };
