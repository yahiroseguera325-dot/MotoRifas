const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');

const nodemailer = require('nodemailer');
const app = express();

// Configuración correo
const EMAIL_USER = 'yahiroseguera325@gmail.com'; // tu correo
const EMAIL_PASS = 'TU_CONTRASEÑA_APP'; // contraseña de aplicación de Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: EMAIL_USER, pass: EMAIL_PASS }
});

const DATA_FILE = path.join(__dirname, 'ventas.json');
const ADMIN_PASS = 'Beli2003.'; // cambiar si es necesario

app.use(morgan('dev'));
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializar archivo de datos si no existe
function readData(){
  if(!fs.existsSync(DATA_FILE)){
    const initial = { ventas: [], ocupados: [], totalBoletos: 100, ticketPrice: 5 };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE));
}
function writeData(data){ fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

// API: estado general
app.get('/api/state', (req, res) => {
  const data = readData();
  res.json({ ocupados: data.ocupados, totalBoletos: data.totalBoletos, ticketPrice: data.ticketPrice });
});

// API: crear compra
app.post('/api/comprar', (req, res) => {
  const { nombre, correo, telefono, boletos } = req.body;
  if(!nombre || !correo || !telefono || !boletos || !Array.isArray(boletos) || boletos.length===0){
    return res.status(400).json({ error: 'Faltan datos' });
  }
  const data = readData();
  // check if any selected boleto already ocupados
  for(const b of boletos){
    if(data.ocupados.includes(b)){
      return res.status(409).json({ error: 'Uno o más boletos ya están ocupados', ocupado: b });
    }
  }
  const id = 'v' + Date.now();
  const compra = { id, nombre, correo, telefono, boletos, status: 'pendiente', fecha: new Date().toISOString() };
  data.ventas.push(compra);
  writeData(data);
  res.json({ ok: true, id });
});

// API: obtener compra por id
app.get('/api/venta/:id', (req, res) => {
  const data = readData();
  const venta = data.ventas.find(v => v.id === req.params.id);
  if(!venta) return res.status(404).json({ error: 'No encontrada' });
  res.json(venta);
});

// API: listar ventas (admin)
app.get('/api/ventas', (req, res) => {
  const { pass } = req.query;
  if(pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const data = readData();
  res.json(data.ventas);
});

// Admin: confirmar compra
app.post('/api/admin/confirmar', (req, res) => {
  const { id, pass } = req.body;
  if(pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const data = readData();
  const venta = data.ventas.find(v => v.id === id);
  if(!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  if(venta.status === 'confirmada') return res.json({ ok:true, message:'Ya confirmada' });
  // marcar boletos como ocupados
  for(const b of venta.boletos){
    if(!data.ocupados.includes(b)) data.ocupados.push(b);
  }
  // enviar correo al cliente
const total = venta.boletos.length * (data.ticketPrice || 5);
const mailOptions = {
  from: EMAIL_USER,
  to: venta.correo,
  subject: 'Confirmación de compra - Moto Rifas Universal',
  html: `<p>Hola <strong>${venta.nombre}</strong>,</p>
         <p>Tu compra ha sido confirmada. Detalles:</p>
         <ul>
           <li>Nombre: ${venta.nombre}</li>
           <li>Correo: ${venta.correo}</li>
           <li>Teléfono: ${venta.telefono}</li>
           <li>Boletos: ${venta.boletos.join(', ')}</li>
           <li>Total a pagar: $${total}</li>
         </ul>
         <p>Gracias por participar en Moto Rifas Universal.</p>`
};
transporter.sendMail(mailOptions, (err, info) => {
  if(err) console.error('Error enviando correo:', err);
  else console.log('Correo enviado:', info.response);
});

venta.status = 'confirmada';
  writeData(data);
  res.json({ ok:true });
});

// Admin: declinar compra (liberar boletos de esa compra)
app.post('/api/admin/declinar', (req, res) => {
  const { id, pass } = req.body;
  if(pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const data = readData();
  const venta = data.ventas.find(v => v.id === id);
  if(!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  // set status declined and ensure its boletos are NOT in ocupados (if were unconfirmed they won't be)
  venta.status = 'declinada';
  // remove boletos of venta from ocupados (in case admin had previously confirmed)
  data.ocupados = data.ocupados.filter(x => !venta.boletos.includes(x));
  writeData(data);
  res.json({ ok:true });
});

// Admin: bloquear un boleto manual
app.post('/api/admin/block', (req, res) => {
  const { boleto, pass } = req.body;
  if(pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const data = readData();
  if(!data.ocupados.includes(boleto)) data.ocupados.push(boleto);
  writeData(data);
  res.json({ ok:true });
});

// Admin: desbloquear
app.post('/api/admin/unblock', (req, res) => {
  const { boleto, pass } = req.body;
  if(pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const data = readData();
  data.ocupados = data.ocupados.filter(x => x !== boleto);
  writeData(data);
  res.json({ ok:true });
});

// Admin: reiniciar todo
app.post('/api/admin/reiniciar', (req, res) => {
  const { pass } = req.body;
  if(pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const data = readData();
  data.ventas = [];
  data.ocupados = [];
  writeData(data);
  res.json({ ok:true });
});

// Admin: set total and price
app.post('/api/admin/setconfig', (req, res) => {
  const { totalBoletos, ticketPrice, pass } = req.body;
  if(pass !== ADMIN_PASS) return res.status(401).json({ error: 'Unauthorized' });
  const data = readData();
  if(totalBoletos) data.totalBoletos = parseInt(totalBoletos);
  if(ticketPrice) data.ticketPrice = parseFloat(ticketPrice);
  writeData(data);
  res.json({ ok:true });
});

// Endpoint público para participantes confirmados
app.get('/api/participantes', (req, res) => {
  const data = readData();
  const confirmadas = data.ventas.filter(v => v.status === 'confirmada')
                                   .map(v => ({ nombre: v.nombre, boletos: v.boletos }));
  res.json(confirmadas);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('Server running on port', PORT));