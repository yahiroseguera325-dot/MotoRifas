document.addEventListener('DOMContentLoaded', function() {
  const container = document.getElementById('boletos');
  if (!container) return;

  let totalBoletos = 100;
  let ticketPrice = 5;
  const seleccionados = new Set();
  let ocupadosGlobal = [];

  // === CARGAR ESTADO INICIAL ===
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
    ocupadosGlobal = data.ocupados || [];
    buildGrid(ocupadosGlobal);
  }

  // === CREAR GRILLA DE BOLETOS ===
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

  // === ACTUALIZAR CONTADOR ===
  function updateCounter() {
    const ocup = container.querySelectorAll('.boleto.ocupado').length;
    const disponibles = totalBoletos - ocup;
    document.getElementById('stats').textContent = `Boletos disponibles: ${disponibles} de ${totalBoletos}`;
    const total = seleccionados.size * ticketPrice;
    const totEl = document.getElementById('totalPay');
    if (totEl) totEl.textContent = `Total a pagar: $${total}`;
  }

  // === SELECCIONAR O QUITAR BOLETO ===
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

  // === LIMPIAR SELECCIÓN ===
  document.getElementById('limpiar').addEventListener('click', () => {
    seleccionados.clear();
    document.querySelectorAll('.boleto.seleccionado').forEach(b => b.classList.remove('seleccionado'));
    document.getElementById('seleccionados').value = '';
    updateCounter();
  });

  // === SCROLL AUTOMÁTICO AL FORMULARIO ===
  document.getElementById('comprar').addEventListener('click', () => {
    const form = document.getElementById('compraForm');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth' });
      const primerCampo = form.querySelector('input');
      if (primerCampo) primerCampo.focus();
    }
  });

  // === CONFIRMAR COMPRA ===
  document.getElementById('confirmarCompra').addEventListener('click', async () => {
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

  // === FUNCIÓN DE BOLETOS AL AZAR ===
  const azarBtn = document.getElementById('azarBtn');
  const azarModal = document.getElementById('azarModal');
  const buscarAzar = document.getElementById('buscarAzar');
  const cerrarAzar = document.getElementById('cerrarAzar');
  const listaAzar = document.getElementById('listaAzar');

  azarBtn.addEventListener('click', () => {
    azarModal.style.display = 'flex';
    listaAzar.innerHTML = '';
  });

  cerrarAzar.addEventListener('click', () => {
    azarModal.style.display = 'none';
  });

  buscarAzar.addEventListener('click', () => {
    listaAzar.innerHTML = '';

    const selectVal = parseInt(document.getElementById('cantidadSelect').value);
    const inputVal = parseInt(document.getElementById('cantidadInput').value);
    const cantidad = inputVal > 0 ? inputVal : selectVal;

    if (isNaN(cantidad) || cantidad <= 0) {
      alert('Ingresa una cantidad válida');
      return;
    }

    const disponibles = [];
    document.querySelectorAll('.boleto').forEach(b => {
      if (!b.classList.contains('ocupado')) disponibles.push(b.textContent);
    });

    if (disponibles.length === 0) {
      alert('No hay boletos disponibles');
      return;
    }

    // Elegir boletos aleatorios
    const elegidos = [];
    while (elegidos.length < cantidad && disponibles.length > 0) {
      const idx = Math.floor(Math.random() * disponibles.length);
      elegidos.push(disponibles.splice(idx, 1)[0]);
    }

    // Limpiar selección anterior
    seleccionados.clear();
    document.querySelectorAll('.boleto.seleccionado').forEach(b => b.classList.remove('seleccionado'));

    // Marcar seleccionados
    elegidos.forEach(num => {
      const el = Array.from(document.querySelectorAll('.boleto')).find(b => b.textContent === num);
      if (el) {
        el.classList.add('seleccionado', 'brillo');
        seleccionados.add(num);
        setTimeout(() => el.classList.remove('brillo'), 2000);
      }
    });

    document.getElementById('seleccionados').value = elegidos.join(', ');
    listaAzar.innerHTML = `
      <p>Boletos elegidos al azar:</p>
      <strong>${elegidos.join(', ')}</strong>
      <br><br>
      <button class="btn" id="usarAzar">Elegir estos boletos</button>
    `;

    // Confirmar selección al azar
    document.getElementById('usarAzar').addEventListener('click', () => {
      azarModal.style.display = 'none';
      const form = document.getElementById('compraForm');
      form.scrollIntoView({ behavior: 'smooth' });
    });

    updateCounter();
  });

  // === 🔍 BUSCADOR DE BOLETOS ===
  const buscarBtn = document.getElementById('buscarBtn');
  const buscarInput = document.getElementById('buscarNumero');

  buscarBtn.addEventListener('click', () => {
    const numero = buscarInput.value.trim();
    if (!numero) return alert('Ingresa un número de boleto');
    const numStr = String(parseInt(numero)).padStart(3, '0');
    const boleto = Array.from(document.querySelectorAll('.boleto')).find(b => b.textContent === numStr);
    if (!boleto) return alert('No se encontró ese número de boleto');

    boleto.scrollIntoView({ behavior: 'smooth', block: 'center' });
    boleto.classList.add('brillo');
    setTimeout(() => boleto.classList.remove('brillo'), 2000);
  });

  // === CARGAR ESTADO ===
  window.refreshBoletos = async function() {
    await loadState();
  };

  loadState();
});
