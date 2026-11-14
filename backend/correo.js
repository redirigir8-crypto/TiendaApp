// =============================================
//  Factura PDF (con código QR) y envío por correo
//
//  OPCIÓN A - GMAIL (recomendada en Render): usa la API de Gmail por HTTPS.
//    Render gratis bloquea los puertos SMTP (25, 465, 587), pero HTTPS no.
//    Variables en Render:
//      GMAIL_USER           tu correo de Gmail (el que envía)
//      GMAIL_CLIENT_ID      de Google Cloud (credencial OAuth)
//      GMAIL_CLIENT_SECRET  de Google Cloud
//      GMAIL_REFRESH_TOKEN  sacado del OAuth Playground (permiso gmail.send)
//
//  OPCIÓN B - SMTP (sirve en tu PC; en Render gratis solo con el puerto 2525):
//      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CORREO_TIENDA
//      Gmail en tu PC: smtp.gmail.com, 587, tu correo, "contraseña de aplicación"
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
    doc.moveDown(0.5).fontSize(16).fillColor('black').text(`Compra N° ${venta.numero ?? venta.id}`);
    doc.fontSize(9).fillColor('#666').text(`Referencia de la tienda: #${venta.id}`).fillColor('black');
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
    const puerto = Number(process.env.SMTP_PORT || 587);
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      secure: puerto === 465, // 465 usa SSL directo; 587 usa STARTTLS (Gmail)
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporte;
}

// ---------- Gmail por HTTPS ----------
const usarGmail = () =>
  process.env.GMAIL_USER && process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN;

// Pide a Google un permiso temporal (access token) usando el refresh token
async function tokenGmail() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Google: ' + (data.error_description || data.error));
  return data.access_token;
}

// Envía un correo ya armado (formato MIME) con la API de Gmail
async function enviarConGmail(correo) {
  // nodemailer arma el correo completo (con el PDF adjunto) sin enviarlo
  const armado = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(correo);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + (await tokenGmail()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: armado.message.toString('base64url') }),
  });
  if (!res.ok) throw new Error('Gmail: ' + (await res.text()));
}

// Envía la factura al correo del cliente. Si no hay correo configurado, solo avisa en el log.
async function enviarFactura(venta, cliente, urlFactura) {
  const gmail = usarGmail();
  const conexion = gmail ? null : smtp();
  if (!gmail && !conexion) {
    console.log('Correo no configurado (faltan las variables GMAIL_* o SMTP_*)');
    return;
  }
  const remitente = gmail ? process.env.GMAIL_USER : process.env.CORREO_TIENDA || process.env.SMTP_USER;
  const pdf = await crearPdf(venta, cliente, urlFactura);
  const correo = {
    from: `"Tienda de Bicicletas" <${remitente}>`,
    to: `"${cliente.nombre}" <${cliente.email}>`,
    subject: `Tu factura de la compra N° ${venta.numero ?? venta.id} - Tienda de Bicicletas`,
    html: `
      <h2 style="color:#1e6fd9;">¡Gracias por tu compra, ${cliente.nombre}!</h2>
      <p>Tu pago fue aprobado. Total: <b>${pesos(venta.total)}</b></p>
      <p>Medio de pago: ${venta.metodo_pago}</p>
      <p>Adjuntamos tu factura en PDF. También puedes verla aquí:
        <a href="${urlFactura}">${urlFactura}</a></p>`,
    attachments: [{ filename: `factura-${venta.numero ?? venta.id}.pdf`, content: pdf }],
  };
  if (gmail) await enviarConGmail(correo);
  else await conexion.sendMail(correo);
  console.log(`Factura ${venta.id} enviada a ${cliente.email}`);
}

module.exports = { enviarFactura, crearPdf };
