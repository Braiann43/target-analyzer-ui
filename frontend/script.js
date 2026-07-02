const inputObjetivo = document.getElementById('target-url');
const botonEscaneo = document.getElementById('btn-scan');
const botonAbortar = document.getElementById('btn-abortar');
const panelesDOM = [
    document.querySelector('#panel-vista .contenido-panel'),
    document.querySelector('#panel-tech .contenido-panel'),
    document.querySelector('#panel-enlaces .contenido-panel'),
    document.querySelector('#panel-metricas .contenido-panel')
];
const [panelVista, panelTech, panelEnlaces, panelMetricas] = panelesDOM;
let controladorPeticion;

// --- MOTOR DE AUDIO OPTIMIZADO ---
let audioCtx;
const getCtx = () => audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
const playTone = (type, f1, f2, dur, vol = 0.15, delay = 0) => {
    const ctx = getCtx(), t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), v = ctx.createGain();
    osc.type = type; 
    osc.frequency.setValueAtTime(f1, t);
    if(f1 !== f2) osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(v).connect(ctx.destination);
    osc.start(t); osc.stop(t + dur);
};

const repVictoria = () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone('square', f, f, 0.18, 0.15, i * 0.09));
const repDerrota = () => playTone('sawtooth', 220, 80, 0.4);
const repInicio = () => playTone('square', 660, 880, 0.1, 0.12);
const repAbortar = () => playTone('triangle', 500, 120, 0.22, 0.14);

// --- UTILIDADES UI ---
const toggleEsperando = (estado) => panelesDOM.forEach(p => p.classList.toggle('esperando', estado));
const limpiarPaneles = () => { panelTech.innerHTML = panelEnlaces.innerHTML = panelMetricas.innerHTML = ''; };

let detenerSpinnerActual = null;
const iniciarSpinnerAscii = (el) => {
    const frames = ['|', '/', '-', '\\'];
    let i = 0;
    const int = setInterval(() => el.textContent = frames[i++ % frames.length], 120);
    return () => clearInterval(int);
};

const CARACTERES_CIFRADO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+=-/\\<>[]{}';
const desencriptarPanel = (panel, vel = 25) => {
    panel.querySelectorAll('.dato-cifrado').forEach(nodo => {
        const texto = nodo.textContent;
        let rev = 0;
        const int = setInterval(() => {
            nodo.textContent = texto.split('').map((c, i) => i < rev ? c : (c === ' ' ? ' ' : CARACTERES_CIFRADO[Math.floor(Math.random() * CARACTERES_CIFRADO.length)])).join('');
            if (++rev > texto.length) { clearInterval(int); nodo.textContent = texto; }
        }, vel);
    });
};

const recortarTexto = (txt, max) => (!txt ? '' : txt.length > max ? txt.substring(0, max - 3) + '...' : txt);

// --- RENDERIZADO DE PANELES ---
const armarHtmlVista = (d) => {
    const capturas = d.vista?.capturas || [];
    const htmlGaleria = capturas.length 
        ? `<div class="galeria-capturas">${capturas.map((c, i) => `<a href="${c}" target="_blank" class="captura-item"><img src="${c}"><span class="captura-numero">${String(i+1).padStart(2,'0')}</span></a>`).join('')}</div>`
        : `<p style="color: var(--color-alerta);">[CAPTURAS NO DISPONIBLES OFFLINE]</p>`;
    return `<div class="vista-header">TÍTULO: <span class="dato-cifrado">${recortarTexto(d.identidad?.titulo, 70)}</span></div>${htmlGaleria}`;
};

const armarHtmlTecnologias = (d) => {
    const t = d.tecnologias || {};
    return `<ul style="list-style:none;padding:0;">
        ${['servidor', 'lenguaje', 'frameworkFront', 'cms'].map(k => `<li>${k.toUpperCase()}: <span class="dato-cifrado" style="color:var(--color-terminal)">${t[k] ?? 'Desconocido'}</span></li>`).join('')}
        <li>LIBRERÍAS: <span class="dato-cifrado" style="color:var(--color-terminal)">${t.librerias?.join(', ') || 'Ninguna'}</span></li>
    </ul>`;
};

const armarHtmlEnlaces = (d, url) => {
    const e = d.enlaces;
    if (!e?.lista) return `<ul><li>RUTA: <span class="dato-cifrado">${url}</span></li></ul>`;
    const filas = e.lista.map(l => `<li class="item-enlace"><a href="${l}" target="_blank">${recortarTexto(l, 65)}</a></li>`).join('');
    return `<div class="enlaces-resumen">TOTAL: <b class="dato-cifrado">${e.total}</b> | INT: <b class="dato-cifrado">${e.internos}</b> | EXT: <b class="dato-cifrado">${e.externos}</b></div><ul class="lista-enlaces">${filas}${e.truncado ? `<li class="nota-truncado">[TRUNCADO A ${e.lista.length}]</li>` : ''}</ul>`;
};

const armarHtmlMetricas = (d) => {
    const m = d.metricas || {};
    return `<ul style="list-style:none;padding:0;">
        <li>LATENCIA: <span class="dato-cifrado">${m.tiempoRespuestaMs ?? '?'}ms</span></li>
        <li>PESO: <span class="dato-cifrado">${m.pesoDocumentoKb ?? '?'} KB</span></li>
        <li>SSL: <span class="dato-cifrado">${m.certSslVigente ? 'Seguro' : 'Vulnerable'}</span></li>
        <li>IMÁGENES/SCRIPTS/CSS: <span class="dato-cifrado">${m.cantidadImagenes ?? '?'} / ${m.cantidadScripts ?? '?'} / ${m.cantidadHojasEstilo ?? '?'}</span></li>
        <li>RESPONSIVE: <span class="dato-cifrado">${m.esResponsive ? 'Sí' : 'No'}</span></li>
    </ul>`;
};

// --- NÚCLEO DE OPERACIÓN ---
botonEscaneo.addEventListener('click', async () => {
    repInicio();
    botonAbortar.style.display = 'block';
    toggleEsperando(false);
    if (controladorPeticion) controladorPeticion.abort();

    let url = inputObjetivo.value.trim();
    if (!url.startsWith('http')) url = 'https://' + url;

    try { new URL(url); } catch {
        return manejarError('[ERROR: FORMATO DE URL INVÁLIDO]');
    }

    panelVista.innerHTML = '<span style="color:var(--color-terminal)">[CONECTANDO...] <span id="spinner-carga"></span></span>';
    detenerSpinnerActual = iniciarSpinnerAscii(document.getElementById('spinner-carga'));
    limpiarPaneles();
    inputObjetivo.value = '';
    controladorPeticion = new AbortController();

    try {
        await new Promise(r => setTimeout(r, 400));
        const res = await fetch('http://localhost:3000/api/escanear', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }), signal: controladorPeticion.signal
        });
        const datos = await res.json();
        
        if (!res.ok) throw new Error(datos.error);

        if (detenerSpinnerActual) detenerSpinnerActual();
        
        const renderSteps = [
            { p: panelVista, html: armarHtmlVista(datos) },
            { p: panelTech, html: armarHtmlTecnologias(datos) },
            { p: panelEnlaces, html: armarHtmlEnlaces(datos, url) },
            { p: panelMetricas, html: armarHtmlMetricas(datos) }
        ];

        for (const step of renderSteps) {
            step.p.innerHTML = step.html;
            desencriptarPanel(step.p);
            await new Promise(r => setTimeout(r, 300));
        }

        registrarEnHistorial(url, datos);
        repVictoria();
        botonAbortar.style.display = 'none';

    } catch (e) {
        manejarError(e.name === 'AbortError' ? '[CANCELADO POR OPERADOR]' : `[ERROR: ${e.message}]`);
    }
});

const manejarError = (msg) => {
    if (detenerSpinnerActual) detenerSpinnerActual();
    panelVista.innerHTML = `<span style="color:var(--color-alerta);cursor:pointer;">${msg}</span>`;
    limpiarPaneles();
    toggleEsperando(true);
    botonAbortar.style.display = 'none';
    repDerrota();
    pararProgresoPorError();
    panelVista.querySelector('span').onclick = () => { panelVista.innerHTML = ''; panelVista.classList.add('esperando'); };
};

botonAbortar.addEventListener('click', () => {
    if (controladorPeticion) { repAbortar(); controladorPeticion.abort(); }
});

// --- LÓGICA DE UI (Grilla, Menú, Historial, Exportación) ---
document.querySelectorAll('.panel-bunker').forEach(panel => {
    panel.addEventListener('click', () => {
        const grilla = document.querySelector('.paneles-grid');
        if (panel.classList.contains('panel-expandido')) {
            grilla.classList.remove('modo-foco');
            document.querySelectorAll('.panel-bunker').forEach(p => p.classList.remove('panel-expandido', 'panel-minimizado'));
        } else {
            grilla.classList.add('modo-foco');
            document.querySelectorAll('.panel-bunker').forEach(p => {
                p.classList.toggle('panel-expandido', p === panel);
                p.classList.toggle('panel-minimizado', p !== panel);
            });
        }
    });
});

const aplicarVariable = (clave, valor, propCss) => {
    document.documentElement.style.setProperty(propCss, valor);
    localStorage.setItem(clave, valor);
    if(clave === 'colorTema') document.documentElement.style.setProperty('--color-terminal-rgb', `${parseInt(valor.slice(1, 3), 16)}, ${parseInt(valor.slice(3, 5), 16)}, ${parseInt(valor.slice(5, 7), 16)}`);
};

document.getElementById('color-picker-menu')?.addEventListener('input', e => aplicarVariable('colorTema', e.target.value, '--color-terminal'));
document.querySelectorAll('.btn-fuente').forEach(b => b.addEventListener('click', () => { aplicarVariable('tamanoFuentePanel', b.dataset.tamano, '--tamano-fuente-panel'); document.querySelectorAll('.btn-fuente').forEach(btn => btn.classList.toggle('activo', btn === b)); }));
document.querySelectorAll('.btn-tipografia').forEach(b => b.addEventListener('click', () => { aplicarVariable('tipografiaPanel', b.dataset.fuente, '--fuente-panel'); document.querySelectorAll('.btn-tipografia').forEach(btn => btn.classList.toggle('activo', btn === b)); }));

let historialEscaneos = JSON.parse(localStorage.getItem('historialBunker')) || [];
const actualizarVisorHistorial = () => {
    const lista = document.getElementById('lista-historial');
    lista.innerHTML = historialEscaneos.length ? '' : '<li style="color:var(--color-terminal);opacity:0.5;">[HISTORIAL VACÍO]</li>';
    historialEscaneos.forEach(i => {
        const li = document.createElement('li');
        li.className = 'item-historial'; li.textContent = `> ${i.url}`;
        li.onclick = () => cargarDatosDesdeMemoria(i.url, i.datos);
        lista.appendChild(li);
    });
};

const registrarEnHistorial = (url, datos) => {
    if (!historialEscaneos.some(i => i.url === url)) {
        historialEscaneos.unshift({ url, datos: { ...datos, vista: { ...datos.vista, capturas: [] } } });
        historialEscaneos = historialEscaneos.slice(0, 15);
        localStorage.setItem('historialBunker', JSON.stringify(historialEscaneos));
        actualizarVisorHistorial();
    }
};

const cargarDatosDesdeMemoria = async (url, datos) => {
    repInicio(); toggleEsperando(false);
    limpiarPaneles();
    inputObjetivo.value = url;
    panelVista.innerHTML = armarHtmlVista(datos);
    panelTech.innerHTML = armarHtmlTecnologias(datos);
    panelEnlaces.innerHTML = armarHtmlEnlaces(datos, url);
    panelMetricas.innerHTML = armarHtmlMetricas(datos);
    [panelVista, panelTech, panelEnlaces, panelMetricas].forEach(p => desencriptarPanel(p));
    repVictoria();
};

document.getElementById('btn-menu').onclick = () => document.getElementById('menu-lateral').classList.add('abierto');
document.getElementById('btn-cerrar-menu').onclick = () => document.getElementById('menu-lateral').classList.remove('abierto');
actualizarVisorHistorial();

// --- BARRA DE PROGRESO SIMULADA ---
let intervaloEscaneo;
const progressBar = document.getElementById('scan-progress'), progresoTexto = document.querySelector('.progreso-porcentaje');
const pararProgresoPorError = () => { clearInterval(intervaloEscaneo); progressBar.value = 0; progresoTexto.textContent = '[FALLO]'; progresoTexto.style.color = '#ff3b3b'; };

botonEscaneo.addEventListener('click', () => {
    clearInterval(intervaloEscaneo);
    let p = 0; progressBar.value = p; progresoTexto.textContent = '0%'; progresoTexto.style.color = 'var(--color-terminal)';
    intervaloEscaneo = setInterval(() => {
        p = Math.min(100, p + Math.floor(Math.random() * 10) + 2);
        progressBar.value = p; progresoTexto.textContent = p === 100 ? '100% [COMPLETADO]' : `${p}%`;
        if (p === 100) clearInterval(intervaloEscaneo);
    }, 400);
});

// --- EXPORTACIÓN ---
const descargarArchivo = (nombre, contenido, tipo) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    a.download = nombre; a.click();
};

document.getElementById('btn-export-txt')?.addEventListener('click', () => {
    const r = `=== REPORTE TARGET ===\nURL: ${inputObjetivo.value}\n\n[VISTA]\n${panelVista.innerText}\n\n[TECH]\n${panelTech.innerText}\n\n[ENLACES]\n${panelEnlaces.innerText}\n\n[MÉTRICAS]\n${panelMetricas.innerText}`;
    descargarArchivo('reporte.txt', r, 'text/plain');
});

document.getElementById('btn-export-html')?.addEventListener('click', () => {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>body{background:#050505;color:#00ff41;font-family:monospace;padding:20px;}.panel-bunker{border:1px solid #00ff41;padding:15px;margin-bottom:20px;}ul{list-style:none;padding:0;}</style></head><body><h1>[REPORTE] ${inputObjetivo.value}</h1>${document.querySelector('.paneles-grid').innerHTML}</body></html>`;
    descargarArchivo('reporte.html', html, 'text/html');
});