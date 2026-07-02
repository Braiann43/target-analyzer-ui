// REFERENCIAS AL DOM
// Acá guardamos en variables los elementos que vamos a usar todo el tiempo,
// así no tenemos que estar buscándolos de nuevo cada vez que los necesitamos
const inputObjetivo = document.getElementById('target-url');
const botonEscaneo = document.getElementById('btn-scan');
const botonAbortar = document.getElementById('btn-abortar');

// Guardamos los 4 paneles en un array para poder recorrerlos todos juntos
// con un forEach en vez de repetir código para cada uno
const panelesDOM = [
    document.querySelector('#panel-vista .contenido-panel'),
    document.querySelector('#panel-tech .contenido-panel'),
    document.querySelector('#panel-enlaces .contenido-panel'),
    document.querySelector('#panel-metricas .contenido-panel')
];

// Y acá los desestructuramos para tener también una variable individual
// por panel, para cuando necesitamos tocar uno solo puntualmente
const [panelVista, panelTech, panelEnlaces, panelMetricas] = panelesDOM;

// Guarda la referencia al AbortController de la petición actual, para poder
// cancelarla si el usuario aprieta "abortar" o si arranca un escaneo nuevo
let controladorPeticion;


// --- MOTOR DE AUDIO OPTIMIZADO ---
// Estos son los efectos de sonido tipo "retro" que suenan cuando el escaneo
// arranca, termina bien, termina mal, o se cancela

let audioCtx;

// Creamos el contexto de audio recién la primera vez que se necesita
// (si lo creáramos de entrada, algunos navegadores lo bloquean)
const getCtx = () => audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());

// Función genérica para armar un "beep": recibe el tipo de onda, la
// frecuencia inicial y final, la duración, el volumen y un delay opcional
const playTone = (type, f1, f2, dur, vol = 0.15, delay = 0) => {
    const ctx = getCtx(), t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), v = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(f1, t);

    // Si la frecuencia final es distinta a la inicial, hacemos que el tono
    // "deslice" de una a la otra en vez de sonar plano
    if (f1 !== f2) osc.frequency.exponentialRampToValueAtTime(f2, t + dur);

    // Esto arma el efecto de que el sonido entra y sale suave, sin un click
    // feo al principio ni al final
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    v.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(v).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
};

// Cada una de estas arma un sonido distinto combinando playTone de una forma
// particular, para que el usuario identifique el evento solo por el oído
const repVictoria = () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => playTone('square', f, f, 0.18, 0.15, i * 0.09)); // acordecito ascendente cuando el escaneo sale bien
const repDerrota = () => playTone('sawtooth', 220, 80, 0.4); // sonido grave y descendente para cuando algo falla
const repInicio = () => playTone('square', 660, 880, 0.1, 0.12); // beep cortito al arrancar un escaneo
const repAbortar = () => playTone('triangle', 500, 120, 0.22, 0.14); // sonido cuando el usuario cancela a mano


// --- UTILIDADES UI ---

// Le agrega o saca a todos los paneles la clase "esperando", que es la que
// hace aparecer el textito animado de "Esperando objetivo..." (ver el CSS)
const toggleEsperando = (estado) => panelesDOM.forEach(p => p.classList.toggle('esperando', estado));

// Vacía el contenido de los 3 paneles que no son el de "vista" (ese se pisa
// aparte porque muestra el estado de carga)
const limpiarPaneles = () => { panelTech.innerHTML = panelEnlaces.innerHTML = panelMetricas.innerHTML = ''; };

// Guarda la función para frenar el spinner que está corriendo en este
// momento, así después podemos pararlo desde cualquier lado (éxito o error)
let detenerSpinnerActual = null;

// Arma el típico spinner de terminal que gira con los caracteres | / - \
// Devuelve una función para poder detenerlo cuando ya no lo necesitamos más
const iniciarSpinnerAscii = (el) => {
    const frames = ['|', '/', '-', '\\'];
    let i = 0;
    const int = setInterval(() => el.textContent = frames[i++ % frames.length], 120);
    return () => clearInterval(int);
};

// Estos son los caracteres random que usamos para el efecto "hackeo" de
// desencriptado de texto (tipo película de hackers)
const CARACTERES_CIFRADO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+=-/\\<>[]{}';

// Recorre todos los elementos con la clase "dato-cifrado" dentro de un panel
// y les hace el efecto de ir "revelando" el texto real letra por letra,
// mientras el resto todavía muestra caracteres random
const desencriptarPanel = (panel, vel = 25) => {
    panel.querySelectorAll('.dato-cifrado').forEach(nodo => {
        const texto = nodo.textContent;
        let rev = 0; // cuántas letras ya "revelamos" del texto real

        const int = setInterval(() => {
            nodo.textContent = texto
                .split('')
                .map((c, i) => i < rev ? c : (c === ' ' ? ' ' : CARACTERES_CIFRADO[Math.floor(Math.random() * CARACTERES_CIFRADO.length)]))
                .join('');

            // Cuando ya revelamos todas las letras, frenamos el intervalo y
            // dejamos el texto final prolijo (sin restos de random)
            if (++rev > texto.length) {
                clearInterval(int);
                nodo.textContent = texto;
            }
        }, vel);
    });
};

// Corta un texto si es muy largo y le agrega puntos suspensivos, así no nos
// desborda el ancho del panel con títulos o links kilométricos
const recortarTexto = (txt, max) => (!txt ? '' : txt.length > max ? txt.substring(0, max - 3) + '...' : txt);


// --- RENDERIZADO DE PANELES ---
// Cada una de estas funciones arma el HTML de un panel a partir de los
// datos que nos manda el backend. Las separamos así queda más ordenado y
// más fácil de tocar cada panel por separado

// Panel de "vista": muestra el título de la página y la galería de capturas
// de pantalla que sacó el robot (si no hay capturas, avisamos que no hay)
const armarHtmlVista = (d) => {
    const capturas = d.vista?.capturas || [];

    const htmlGaleria = capturas.length
        ? `<div class="galeria-capturas">${capturas.map((c, i) => `<a href="${c}" target="_blank" class="captura-item"><img src="${c}"><span class="captura-numero">${String(i + 1).padStart(2, '0')}</span></a>`).join('')}</div>`
        : `<p style="color: var(--color-alerta);">[CAPTURAS NO DISPONIBLES OFFLINE]</p>`;

    return `<div class="vista-header">TÍTULO: <span class="dato-cifrado">${recortarTexto(d.identidad?.titulo, 70)}</span></div>${htmlGaleria}`;
};

// Panel de "tecnologías": arma una lista con el servidor, lenguaje, framework
// de frontend, cms y las librerías detectadas
const armarHtmlTecnologias = (d) => {
    const t = d.tecnologias || {};
    return `<ul style="list-style:none;padding:0;">
        ${['servidor', 'lenguaje', 'frameworkFront', 'cms'].map(k => `<li>${k.toUpperCase()}: <span class="dato-cifrado" style="color:var(--color-terminal)">${t[k] ?? 'Desconocido'}</span></li>`).join('')}
        <li>LIBRERÍAS: <span class="dato-cifrado" style="color:var(--color-terminal)">${t.librerias?.join(', ') || 'Ninguna'}</span></li>
    </ul>`;
};

// Panel de "enlaces": muestra el resumen (total, internos, externos) y
// después la lista completa de links encontrados en la página escaneada
const armarHtmlEnlaces = (d, url) => {
    const e = d.enlaces;

    // Si por algún motivo no llegó el objeto de enlaces, mostramos al menos
    // la URL que se escaneó como para no dejar el panel vacío
    if (!e?.lista) return `<ul><li>RUTA: <span class="dato-cifrado">${url}</span></li></ul>`;

    const filas = e.lista.map(l => `<li class="item-enlace"><a href="${l}" target="_blank">${recortarTexto(l, 65)}</a></li>`).join('');

    return `<div class="enlaces-resumen">TOTAL: <b class="dato-cifrado">${e.total}</b> | INT: <b class="dato-cifrado">${e.internos}</b> | EXT: <b class="dato-cifrado">${e.externos}</b></div><ul class="lista-enlaces">${filas}${e.truncado ? `<li class="nota-truncado">[TRUNCADO A ${e.lista.length}]</li>` : ''}</ul>`;
};

// Panel de "métricas": latencia, peso de la página, si tiene SSL válido,
// cantidad de imágenes/scripts/hojas de estilo, y si es responsive
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
// Acá está toda la lógica principal: cuando el usuario aprieta "escanear",
// se valida la URL, se llama al backend, y se van pintando los paneles

botonEscaneo.addEventListener('click', async () => {
    repInicio();
    botonAbortar.style.display = 'block';
    toggleEsperando(false);

    // Si ya había una petición corriendo (el usuario apretó escanear de
    // vuelta sin esperar), la cancelamos antes de arrancar una nueva
    if (controladorPeticion) controladorPeticion.abort();

    let url = inputObjetivo.value.trim();

    // Si el usuario no puso el protocolo, se lo agregamos nosotros para que
    // el fetch no explote y para que new URL() no tire error de entrada
    if (!url.startsWith('http')) url = 'https://' + url;

    // Validamos que lo que escribió sea una URL válida antes de gastar
    // tiempo mandando la petición al backend
    try {
        new URL(url);
    } catch {
        return manejarError('[ERROR: FORMATO DE URL INVÁLIDO]');
    }

    // Mostramos el estado de "conectando" con el spinner mientras esperamos
    // la respuesta del servidor
    panelVista.innerHTML = '<span style="color:var(--color-terminal)">[CONECTANDO...] <span id="spinner-carga"></span></span>';
    detenerSpinnerActual = iniciarSpinnerAscii(document.getElementById('spinner-carga'));

    limpiarPaneles();
    inputObjetivo.value = '';
    controladorPeticion = new AbortController();

    try {
        // Este delay chiquito es nada más para que se alcance a ver la
        // animación de "conectando" un instante, aunque el backend responda
        // re rápido (si no, parpadea y queda feo)
        await new Promise(r => setTimeout(r, 400));

        const res = await fetch('http://localhost:3000/api/escanear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
            signal: controladorPeticion.signal
        });

        const datos = await res.json();

        if (!res.ok) throw new Error(datos.error);

        if (detenerSpinnerActual) detenerSpinnerActual();

        // Armamos el HTML de cada panel de antemano, así después solo nos
        // dedicamos a inyectarlo panel por panel con su pausita
        const renderSteps = [
            { p: panelVista, html: armarHtmlVista(datos) },
            { p: panelTech, html: armarHtmlTecnologias(datos) },
            { p: panelEnlaces, html: armarHtmlEnlaces(datos, url) },
            { p: panelMetricas, html: armarHtmlMetricas(datos) }
        ];

        // Vamos mostrando panel por panel con un pequeño delay entre cada
        // uno, para que se note el efecto de "va llegando la información"
        // en vez de que aparezca todo junto de golpe
        for (const step of renderSteps) {
            step.p.innerHTML = step.html;
            desencriptarPanel(step.p);
            await new Promise(r => setTimeout(r, 300));
        }

        registrarEnHistorial(url, datos);
        repVictoria();
        botonAbortar.style.display = 'none';

    } catch (e) {
        // Si el error es porque nosotros mismos abortamos la petición,
        // mostramos un mensaje distinto al de un error real del servidor
        manejarError(e.name === 'AbortError' ? '[CANCELADO POR OPERADOR]' : `[ERROR: ${e.message}]`);
    }
});

// Función centralizada para mostrar cualquier error: frena el spinner,
// pinta el mensaje en rojo en el panel de vista, limpia el resto de los
// paneles y hace sonar el efecto de derrota
const manejarError = (msg) => {
    if (detenerSpinnerActual) detenerSpinnerActual();

    panelVista.innerHTML = `<span style="color:var(--color-alerta);cursor:pointer;">${msg}</span>`;
    limpiarPaneles();
    toggleEsperando(true);
    botonAbortar.style.display = 'none';
    repDerrota();
    pararProgresoPorError();

    // Le dejamos un click al mensaje de error para que el usuario lo pueda
    // "descartar" y vuelva a quedar el panel en estado de espera
    panelVista.querySelector('span').onclick = () => {
        panelVista.innerHTML = '';
        panelVista.classList.add('esperando');
    };
};

// Botón de abortar: si hay una petición en curso, la cancela y suena el
// efecto de sonido correspondiente
botonAbortar.addEventListener('click', () => {
    if (controladorPeticion) {
        repAbortar();
        controladorPeticion.abort();
    }
});


// --- LÓGICA DE UI (Grilla, Menú, Historial, Exportación) ---

// Esto es lo que hacemos para que al clickear un panel se agrande y ocupe
// más lugar en la pantalla, y los otros tres se achiquen abajo (modo foco)
document.querySelectorAll('.panel-bunker').forEach(panel => {
    panel.addEventListener('click', () => {
        const grilla = document.querySelector('.paneles-grid');

        // Si el panel clickeado ya estaba expandido, volvemos todo a la
        // grilla normal (2x2)
        if (panel.classList.contains('panel-expandido')) {
            grilla.classList.remove('modo-foco');
            document.querySelectorAll('.panel-bunker').forEach(p => p.classList.remove('panel-expandido', 'panel-minimizado'));
        } else {
            // Si no, entramos en modo foco: el panel clickeado se expande y
            // los demás se minimizan
            grilla.classList.add('modo-foco');
            document.querySelectorAll('.panel-bunker').forEach(p => {
                p.classList.toggle('panel-expandido', p === panel);
                p.classList.toggle('panel-minimizado', p !== panel);
            });
        }
    });
});

// Función genérica para guardar una preferencia de personalización (color,
// tamaño de fuente, tipografía) tanto en el CSS en vivo como en localStorage
// para que quede guardada aunque el usuario cierre la página
const aplicarVariable = (clave, valor, propCss) => {
    document.documentElement.style.setProperty(propCss, valor);
    localStorage.setItem(clave, valor);

    // Si estamos cambiando el color principal, también recalculamos la
    // versión en formato "r, g, b" que se usa en el CSS para las sombras
    // con transparencia (rgba)
    if (clave === 'colorTema') {
        document.documentElement.style.setProperty('--color-terminal-rgb', `${parseInt(valor.slice(1, 3), 16)}, ${parseInt(valor.slice(3, 5), 16)}, ${parseInt(valor.slice(5, 7), 16)}`);
    }
};

// Escuchamos el input del selector de color del menú lateral
document.getElementById('color-picker-menu')?.addEventListener('input', e => aplicarVariable('colorTema', e.target.value, '--color-terminal'));

// Botones para elegir el tamaño de fuente de los paneles: además de aplicar
// la variable, le sacamos y ponemos la clase "activo" para marcar cuál está
// seleccionado en este momento
document.querySelectorAll('.btn-fuente').forEach(b => b.addEventListener('click', () => {
    aplicarVariable('tamanoFuentePanel', b.dataset.tamano, '--tamano-fuente-panel');
    document.querySelectorAll('.btn-fuente').forEach(btn => btn.classList.toggle('activo', btn === b));
}));

// Mismo criterio pero para elegir la tipografía de los paneles
document.querySelectorAll('.btn-tipografia').forEach(b => b.addEventListener('click', () => {
    aplicarVariable('tipografiaPanel', b.dataset.fuente, '--fuente-panel');
    document.querySelectorAll('.btn-tipografia').forEach(btn => btn.classList.toggle('activo', btn === b));
}));

// Traemos el historial guardado en localStorage, o arrancamos con un array
// vacío si es la primera vez que se usa
let historialEscaneos = JSON.parse(localStorage.getItem('historialBunker')) || [];

// Vuelve a dibujar la lista del historial en el menú lateral. La llamamos
// cada vez que se agrega un escaneo nuevo, así queda siempre actualizada
const actualizarVisorHistorial = () => {
    const lista = document.getElementById('lista-historial');

    // Si no hay nada guardado todavía, mostramos un aviso en vez de dejar
    // la lista vacía y que quede raro
    lista.innerHTML = historialEscaneos.length ? '' : '<li style="color:var(--color-terminal);opacity:0.5;">[HISTORIAL VACÍO]</li>';

    historialEscaneos.forEach(i => {
        const li = document.createElement('li');
        li.className = 'item-historial';
        li.textContent = `> ${i.url}`;

        // Al clickear un item del historial, cargamos esos datos de nuevo
        // en los paneles sin tener que pegarle otra vez al backend
        li.onclick = () => cargarDatosDesdeMemoria(i.url, i.datos);
        lista.appendChild(li);
    });
};

// Guarda un escaneo nuevo en el historial (si esa URL no estaba ya
// guardada), lo persiste en localStorage y refresca la lista del menú
const registrarEnHistorial = (url, datos) => {
    if (!historialEscaneos.some(i => i.url === url)) {
        // Ojo: guardamos los datos pero SIN las capturas de pantalla, porque
        // en base64 pesan bastante y nos podríamos quedar sin espacio en el
        // localStorage del navegador
        historialEscaneos.unshift({ url, datos: { ...datos, vista: { ...datos.vista, capturas: [] } } });

        // Limitamos el historial a los últimos 15 para que no crezca para
        // siempre y termine ocupando toda la memoria del navegador
        historialEscaneos = historialEscaneos.slice(0, 15);

        localStorage.setItem('historialBunker', JSON.stringify(historialEscaneos));
        actualizarVisorHistorial();
    }
};

// Vuelve a pintar los paneles con datos que ya teníamos guardados (del
// historial), sin necesidad de hacer una petición nueva al servidor
const cargarDatosDesdeMemoria = async (url, datos) => {
    repInicio();
    toggleEsperando(false);
    limpiarPaneles();
    inputObjetivo.value = url;

    panelVista.innerHTML = armarHtmlVista(datos);
    panelTech.innerHTML = armarHtmlTecnologias(datos);
    panelEnlaces.innerHTML = armarHtmlEnlaces(datos, url);
    panelMetricas.innerHTML = armarHtmlMetricas(datos);

    [panelVista, panelTech, panelEnlaces, panelMetricas].forEach(p => desencriptarPanel(p));
    repVictoria();
};

// Botones para abrir y cerrar el menú lateral de configuración e historial
document.getElementById('btn-menu').onclick = () => document.getElementById('menu-lateral').classList.add('abierto');
document.getElementById('btn-cerrar-menu').onclick = () => document.getElementById('menu-lateral').classList.remove('abierto');

// Pintamos el historial apenas carga la página, por si ya había algo
// guardado de una sesión anterior
actualizarVisorHistorial();


// --- BARRA DE PROGRESO SIMULADA ---
// Ojo: esta barra es solo visual/decorativa, no está atada al progreso real
// del fetch (eso sería más complicado de trackear), simplemente sube de a
// pasitos random para dar sensación de que "algo está pasando"

let intervaloEscaneo;
const progressBar = document.getElementById('scan-progress'), progresoTexto = document.querySelector('.progreso-porcentaje');

// La usamos cuando el escaneo falla, para frenar la barra en seco y dejarla
// marcada en rojo con la palabra [FALLO]
const pararProgresoPorError = () => {
    clearInterval(intervaloEscaneo);
    progressBar.value = 0;
    progresoTexto.textContent = '[FALLO]';
    progresoTexto.style.color = '#ff3b3b';
};

// Nota: este es OTRO listener de click en el mismo botón de escanear (además
// del de arriba), separado nada más para que la lógica de la barra de
// progreso no se mezcle con la lógica de la petición al backend
botonEscaneo.addEventListener('click', () => {
    clearInterval(intervaloEscaneo);

    let p = 0;
    progressBar.value = p;
    progresoTexto.textContent = '0%';
    progresoTexto.style.color = 'var(--color-terminal)';

    intervaloEscaneo = setInterval(() => {
        // Subimos la barra de a saltos random (entre 2 y 11) para que no se
        // vea un avance robótico y prolijo, sino más "orgánico"
        p = Math.min(100, p + Math.floor(Math.random() * 10) + 2);
        progressBar.value = p;
        progresoTexto.textContent = p === 100 ? '100% [COMPLETADO]' : `${p}%`;

        if (p === 100) clearInterval(intervaloEscaneo);
    }, 400);
});


// --- EXPORTACIÓN ---

// Función genérica para armar un archivo en el momento (blob) y disparar
// la descarga, sin necesidad de tener el archivo guardado en ningún lado
const descargarArchivo = (nombre, contenido, tipo) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    a.download = nombre;
    a.click();
};

// Exporta un resumen de todo lo escaneado en un .txt plano, tomando el
// texto que ya está pintado en cada panel (innerText, no el HTML)
document.getElementById('btn-export-txt')?.addEventListener('click', () => {
    const r = `=== REPORTE TARGET ===\nURL: ${inputObjetivo.value}\n\n[VISTA]\n${panelVista.innerText}\n\n[TECH]\n${panelTech.innerText}\n\n[ENLACES]\n${panelEnlaces.innerText}\n\n[MÉTRICAS]\n${panelMetricas.innerText}`;
    descargarArchivo('reporte.txt', r, 'text/plain');
});

// Exporta un .html con estilos mínimos propios, tomando directamente el
// HTML de la grilla de paneles tal cual está en pantalla en ese momento
document.getElementById('btn-export-html')?.addEventListener('click', () => {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>body{background:#050505;color:#00ff41;font-family:monospace;padding:20px;}.panel-bunker{border:1px solid #00ff41;padding:15px;margin-bottom:20px;}ul{list-style:none;padding:0;}</style></head><body><h1>[REPORTE] ${inputObjetivo.value}</h1>${document.querySelector('.paneles-grid').innerHTML}</body></html>`;
    descargarArchivo('reporte.html', html, 'text/html');
});