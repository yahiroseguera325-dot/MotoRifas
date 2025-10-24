// Frontend boleto logic with server integration
document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('boletos');
  if (!container) return;

  let totalBoletos = 100;
  let ticketPrice = 5;
  const seleccionados = new Set();

  async function loadState() {
    let data;
    try {
      const res = await fetch('/api/state');
      data = await res.json();
    } catch (e) {
      console.warn('No se pudo conectar al servidor, usando datos locales', e);
      data = { ocupados: [], totalBoletos: 100, ticketPrice: 5 };
    }

    totalBoletos = data.totalBoletos;
    ticketPrice = data.ticketPrice;
    buildGrid(data.ocupados || []);

    // mostrar precio
    const priceEl = document.getElementById('priceInfo');
    if (priceEl) priceEl.textContent = `Precio por boleto: $${ticketPrice}`;
  }

  function buildGrid(ocupados) {
    container.innerHTML = '';
    for (let i = 1; i <= totalBoletos; i++) {
      const num = String(i).padStart(3, '0');
      const el = document.createElement('div');
      el.className = 'boleto';
      el.textContent = num;

      if (ocupados.includes(num)) {
        el.classList.add('ocupado');
      } else {
        el.addEventListener('click', () => toggle(el, num));
      }

      container.appendChild(el);
    }
    updateCounter();
  }

  function updateCounter() {
    const ocup = container.querySelectorAll('.boleto.ocupado').length;
    const disponibles = totalBoletos - ocup;
    document.getElementById('stats').textContent = `Boletos disponibles: ${disponibles} de ${totalBoletos}`;
    const total = seleccionados.size * ticketPrice;
    const totEl = document.getElementById('totalPay');
    if (totEl) totEl.textContent = `Total a pagar: $${total}`;
  }

  function toggle(el, num) {
    if (el.classList.contains('ocupado')) return;
    if (el.classList.contains('seleccionado')) {
      el.classList.remove('seleccionado');
      seleccionados.delete(num);
    } else {
      el.classList.add('seleccionado');
      seleccionados.add(num);
    }
    document.getElementById('seleccionados').value = Array.from(seleccionados).join(', ');
    updateCounter();
  }

  document.getElementById('limpiar').addEventListener('click', () => {
    seleccionados.clear();
    document.querySelectorAll('.boleto.seleccionado').forEach(b => b.classList.remove('seleccionado'));
    document.getElementById('seleccionados').value = '';
    updateCounter();
  });

  document.getElementById('comprar').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre').value.trim();
    const correo = document.getElementById('correo').value.trim();
    const telefono = document.getElementById('telefono').value.trim();

    if (seleccionados.size === 0) {
      alert('Selecciona al menos un boleto');
      return;
    }
    if (!nombre || !correo || !telefono) {
      alert('Completa tus datos');
      return;
    }

    const boletos = Array.from(seleccionados);

    try {
      const res = await fetch('/api/comprar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, correo, telefono, boletos })
      });

      if (res.ok) {
        const data = await res.json();
        seleccionados.clear();
        document.getElementById('seleccionados').value = '';
        window.location.href = '/pagos.html?id=' + encodeURIComponent(data.id);
      } else {
        const err = await res.json();
        alert('Error: ' + (err.error || 'No se pudo completar la compra'));
        await loadState();
      }
    } catch (error) {
      console.error('Error en la solicitud de compra:', error);
      alert('No se pudo conectar al servidor.');
    }
  });

  // Exponer función para refrescar boletos desde admin
  window.refreshBoletos = async function() {
    await loadState();
  };

  // Cargar estado inicial
  loadState();
});
