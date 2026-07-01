// acá agarramos los botones y las cosas de la página para darles vida

// atrapamos donde el chabón escribe la página
const inputObjetivo = document.getElementById('target-url');

// el botón verde que arranca todo
const botonEscaneo = document.getElementById('btn-scan');

// el botón rojo de pánico por si queremos cancelar
const botonAbortar = document.getElementById('btn-abortar');

// atrapamos las cajitas donde vamos a escupir la info de cada panel
const panelVista = document.querySelector('#panel-vista .contenido-panel');
const panelTech = document.querySelector('#panel-tech .contenido-panel');
const panelEnlaces = document.querySelector('#panel-enlaces .contenido-panel');
const panelMetricas = document.querySelector('#panel-metricas .contenido-panel');

// esta variable la armamos vacía, pero nos va a servir después como un control remoto para cortar la búsqueda si tarda mil años
let controladorPeticion;

// Armamos un mini motor de sonidos nosotros mismos sin usar MP3s de internet, re retro tipo family game

let audioCtx; // el motorcito de sonido apagado

// lo prendemos recién cuando le hacen clic a algo (los navegadores te obligan a hacer esto)
function obtenerAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// ruidito alegre de que salió todo bien
function reproducirSonidoVictoria() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;
    const notas = [523.25, 659.25, 783.99, 1046.50]; // un par de notas musicales piolas

    notas.forEach((frecuencia, indice) => {
        const oscilador = ctx.createOscillator(); // el bicho que hace el ruido
        const volumen = ctx.createGain(); // la perilla del volumen

        oscilador.type = 'square'; // tipo de ruido de 8-bits
        oscilador.frequency.value = frecuencia;

        const inicio = ahora + indice * 0.09; // para que suenen una después de la otra
        // le subimos y bajamos el volumen rápido para que no suene a golpe seco
        volumen.gain.setValueAtTime(0.0001, inicio);
        volumen.gain.exponentialRampToValueAtTime(0.15, inicio + 0.02);
        volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.18);

        oscilador.connect(volumen).connect(ctx.destination); 
        oscilador.start(inicio);
        oscilador.stop(inicio + 0.18);
    });
}

// ruidito feo grave para cuando tira error
function reproducirSonidoDerrota() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'sawtooth'; // ruido más aspero
    oscilador.frequency.setValueAtTime(220, ahora); 
    oscilador.frequency.exponentialRampToValueAtTime(80, ahora + 0.4); // cae para abajo como deprimiéndose

    volumen.gain.setValueAtTime(0.15, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.4);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.4);
}

// ruidito corto tipo radar de que arrancó a escanear
function reproducirSonidoInicioEscaneo() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'square'; 
    oscilador.frequency.setValueAtTime(660, ahora); 
    oscilador.frequency.exponentialRampToValueAtTime(880, ahora + 0.08); 

    volumen.gain.setValueAtTime(0.0001, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.12, ahora + 0.01);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.1);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.1);
}

// ruidito como apagando un motor si tocamos el botón de abortar
function reproducirSonidoAbortar() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'triangle'; // este es más suave
    oscilador.frequency.setValueAtTime(500, ahora);
    oscilador.frequency.exponentialRampToValueAtTime(120, ahora + 0.22); // baja rápido

    volumen.gain.setValueAtTime(0.14, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.22);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.22);
}

// Un chiche de terminal vieja para que parezca que está cargando con palitos dando vueltas

let detenerSpinnerActual = null; // guardamos el botón de apagado del cosito que da vueltas

function iniciarSpinnerAscii(elementoSpinner) {
    const framesSpinner = ['|', '/', '-', '\\']; // los cuatro palitos
    let indiceFrame = 0;

    const intervaloSpinner = setInterval(() => {
        elementoSpinner.textContent = framesSpinner[indiceFrame % framesSpinner.length];
        indiceFrame++;
    }, 120); // da vueltas re rápido pero se deja ver

    // devolvemos la forma de pararlo así no queda girando para siempre
    return function apagarSpinner() {
        clearInterval(intervaloSpinner);
    };
}

// Un efecto fachero tipo peli de hackers para cuando llega la info real

const CARACTERES_CIFRADO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+=-/\\<>[]{}'; // letras a lo pavote para hacer ruido

// esto agarra un texto y te lo va revelando letra por letra mientras el resto es cualquier verdura
function efectoDesencriptado(elementoDestino, textoFinal, velocidadMs = 25) {
    let letrasReveladas = 0;

    const intervaloDescifrado = setInterval(() => {
        let textoEnPantalla = '';

        for (let i = 0; i < textoFinal.length; i++) {
            if (i < letrasReveladas) {
                // si ya adivinamos la letra, la mostramos
                textoEnPantalla += textoFinal[i];
            } else if (textoFinal[i] === ' ') {
                // los espacios los respetamos porque si no no se entiende un pomo
                textoEnPantalla += ' ';
            } else {
                // si falta, le metemos una de la sopa de letras random
                textoEnPantalla += CARACTERES_CIFRADO[Math.floor(Math.random() * CARACTERES_CIFRADO.length)];
            }
        }

        elementoDestino.textContent = textoEnPantalla;
        letrasReveladas++;

        // cuando terminamos, cortamos el show y dejamos el texto bien
        if (letrasReveladas > textoFinal.length) {
            clearInterval(intervaloDescifrado);
            elementoDestino.textContent = textoFinal;
        }
    }, velocidadMs);
}

// esto busca en un panel todas las cosas que queremos hackear y les manda el efecto a la vez
function desencriptarPanel(panel, velocidadMs = 25) {
    const nodosCifrados = panel.querySelectorAll('.dato-cifrado');
    nodosCifrados.forEach((nodo) => {
        const textoFinal = nodo.textContent;
        efectoDesencriptado(nodo, textoFinal, velocidadMs);
    });
}

// le avisamos a los botones qué tienen que hacer cuando les dan clic

botonEscaneo.addEventListener('click', iniciarOperacion);

botonAbortar.addEventListener('click', () => {
    // nos fijamos si hay algo andando y si sí, lo liquidamos
    if (controladorPeticion) {
        reproducirSonidoAbortar(); 
        controladorPeticion.abort(); 
    }
});

// Esta es la función groso que hace todo el laburo cuando ponemos la página (le pusimos async para que sepa esperar a internet)
async function iniciarOperacion() {
    
    reproducirSonidoInicioEscaneo(); // pim, sonidito de que arrancó

    // hacemos aparecer el botón rojo de cortar
    botonAbortar.style.display = 'block';

    // le sacamos a los 4 paneles la cosita que decía esperando
    panelVista.classList.remove('esperando');
    panelTech.classList.remove('esperando');
    panelEnlaces.classList.remove('esperando');
    panelMetricas.classList.remove('esperando');

    // si alguien es medio bestia y toca escanear dos veces juntas, cortamos la primera para no romper nada
    if (controladorPeticion) {
        controladorPeticion.abort();
    }

    // sacamos la url que escribió y le volamos los espacios vacíos por las dudas
    let urlIngresada = inputObjetivo.value.trim();

    // si se olvidó de ponerle el https:// se lo enchufamos nosotros
    if (!urlIngresada.startsWith('http://') && !urlIngresada.startsWith('https://')) {
        urlIngresada = 'https://' + urlIngresada;
    }

    // nos fijamos si lo que puso parece una página de verdad
    try {
        new URL(urlIngresada);
    } catch (error) {
        // si mandó cualquiera, tiramos cartel rojo
        panelVista.innerHTML = `<span style="color: var(--color-alerta)">[ERROR: FORMATO DE URL INVÁLIDO]</span>`;
        panelTech.innerHTML = '';
        panelMetricas.innerHTML = '';
        panelEnlaces.innerHTML = '';

        panelTech.classList.add('esperando');
        panelEnlaces.classList.add('esperando');
        panelMetricas.classList.add('esperando');
        
        botonAbortar.style.display = 'none'; 
        reproducirSonidoDerrota(); 
        pararProgresoPorError(); 

        // si hace clic en el error limpiamos y lo dejamos probar de nuevo
        panelVista.querySelector('span').addEventListener('click', () => {
            panelVista.innerHTML = '';
            panelVista.classList.add('esperando'); 
            inputObjetivo.value = '';
            inputObjetivo.focus();
        });
        return; // chau, nos vimos, no seguimos
    }

    // preparamos las pantallas con el palito girando para que no piense que se colgó
    panelVista.innerHTML = '<span style="color: var(--color-terminal)">[CONECTANDO SONDAS...] <span id="spinner-carga"></span></span>';
    const nodoSpinnerCarga = document.getElementById('spinner-carga');
    detenerSpinnerActual = iniciarSpinnerAscii(nodoSpinnerCarga);
    panelTech.innerHTML = '';
    panelEnlaces.innerHTML = '';
    panelMetricas.innerHTML = '';
    inputObjetivo.value = '';

    // armamos el control remoto nuevo
    controladorPeticion = new AbortController();
    
    // nos mandamos a pedir la info
    try {
        await new Promise(resolve => setTimeout(resolve, 400)); // frenamos un toque para que se vea el "conectando"
        const respuesta = await fetch('http://localhost:3000/api/escanear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlIngresada }),
            signal: controladorPeticion.signal // acá le atamos el control remoto
        });

        // pasamos la data a algo que podamos leer
        const datos = await respuesta.json();

        // si el servidor nos patea y dice que hubo quilombo
        if (!respuesta.ok) {
            if (detenerSpinnerActual) { detenerSpinnerActual(); detenerSpinnerActual = null; } // apagamos el palito

            // escupimos el error
            panelVista.innerHTML = `<span style="color: var(--color-alerta)">[ERROR: ${datos.error}]</span>`;
            panelTech.innerHTML = '';
            panelMetricas.innerHTML = '';
            panelEnlaces.innerHTML = '';

            panelTech.classList.add('esperando');
            panelEnlaces.classList.add('esperando');
            panelMetricas.classList.add('esperando');
            
            botonAbortar.style.display = 'none';
            reproducirSonidoDerrota(); 
            pararProgresoPorError(); 
            return;
        }
        
        // ¡Salió todo joya!
        if (detenerSpinnerActual) { detenerSpinnerActual(); detenerSpinnerActual = null; } // apagamos el palito otra vez

        // inyectamos la data en los paneles y le mandamos el efecto hacker a las cosas de verdad (las que traen .dato-cifrado)
        panelVista.innerHTML = `<span class="dato-cifrado" style="color: var(--color-terminal)">${datos.mensaje}</span>`;
        desencriptarPanel(panelVista);
        panelTech.innerHTML = `<span class="dato-cifrado" style="color: var(--color-terminal)">Objetivo en servidor: ${datos.objetivo}</span>`;
        desencriptarPanel(panelTech);

        // hacemos una pausa cortita para darle más suspenso
        await new Promise(resolve => setTimeout(resolve, 600));

        // si el título o la descripción son larguísimos, los cortamos para que no desarmen todo
        const tituloRecortado = datos.identidad.titulo.length > 50 ? datos.identidad.titulo.substring(0, 47) + '...' : datos.identidad.titulo;
        const descripcionRecortada = datos.identidad.descripcion.length > 80 ? datos.identidad.descripcion.substring(0, 77) + '...' : datos.identidad.descripcion;
        
        panelVista.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>TÍTULO: <span class="dato-cifrado" style="color: var(--color-terminal)">${tituloRecortado}</span></li><li style="margin-top: 5px;">DESCRIPCIÓN: <span class="dato-cifrado" style="color: var(--color-terminal)">${descripcionRecortada}</span></li></ul>`;
        desencriptarPanel(panelVista);
        
        await new Promise(resolve => setTimeout(resolve, 300));

        panelTech.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>SERVIDOR: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.servidor}</span></li><li>LENGUAJE: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.lenguaje}</span></li><li>FRONTEND: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.frameworkFront}</span></li></ul>`;
        desencriptarPanel(panelTech);
        
        await new Promise(resolve => setTimeout(resolve, 300));

        // acá como todavía no hicimos lo de los links, clavamos un chamuyo por ahora
        panelEnlaces.innerHTML = `
        <ul style="list-style: none; padding: 0; margin: 0;">
            <li>RUTAS BASE: <span class="dato-cifrado" style="color: var(--color-terminal)">${urlIngresada}</span></li>
            <li style="margin-top: 10px; color: var(--color-alerta)">[MÓDULO DE MAPEO ITERATIVO: OFFLINE]</li>
            <li style="color: var(--color-alerta)">[ESPERANDO ACTUALIZACIÓN DEL ROBOT...]</li>
        </ul>`;
        desencriptarPanel(panelEnlaces);

        // nos fijamos si la página es segura o no para cambiar la palabrita
        const estadoSsl = datos.metricas.certSslVigente ? "Seguro (Activo)" : "Vulnerable (Caído)";
        
        panelMetricas.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>LATENCIA: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.metricas.tiempoRespuestaMs}ms</span></li><li>PESO TOTAL: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.metricas.pesoDocumentoKb} KB</span></li><li>ESTADO SSL: <span class="dato-cifrado" style="color: var(--color-terminal)">${estadoSsl}</span></li></ul>`;
        desencriptarPanel(panelMetricas);

        registrarEnHistorial(urlIngresada, datos); // guardamos en la memoria para después

        reproducirSonidoVictoria(); // ¡ganamos!
        botonAbortar.style.display = 'none'; // escondemos el botón rojo

    } catch (error) {
        // si saltó por los aires o cortamos a mano...
        if (detenerSpinnerActual) { detenerSpinnerActual(); detenerSpinnerActual = null; }

        if (error.name === 'AbortError') {
            // si tocamos abortar
            panelVista.innerHTML = `<span style="color: var(--color-alerta); cursor: pointer; display: block; padding: 10px;" title="Clic para limpiar">[OPERACIÓN CANCELADA POR EL OPERADOR]</span>`;
        } else {
            // si se nos cortó internet o algo así
            panelVista.innerHTML = `<span style="color: var(--color-alerta); cursor: pointer;" title="Clic para limpiar">[FALLO DE CONEXIÓN CON BÚNKER CENTRAL]</span>`;
            console.error(error); 
            reproducirSonidoDerrota(); 
            pararProgresoPorError(); 
        }
        
        // limpiamos todo
        panelTech.innerHTML = '';
        panelEnlaces.innerHTML = '';
        panelMetricas.innerHTML = '';
        
        // y volvemos a poner el cartelito de esperando
        panelTech.classList.add('esperando');
        panelEnlaces.classList.add('esperando');
        panelMetricas.classList.add('esperando');
        
        botonAbortar.style.display = 'none'; 

        // otra vez dejamos hacer clic para limpiar y seguir jugando
        panelVista.querySelector('span').addEventListener('click', () => {
            panelVista.innerHTML = '';
            panelVista.classList.add('esperando'); 
            inputObjetivo.value = '';
            inputObjetivo.focus();
        });
    }
}

// Un efecto para que cuando le das clic a un cuadrito se haga el protagonista de la pantalla

const paneles = document.querySelectorAll('.panel-bunker'); // agarramos los 4 paneles
const grilla = document.querySelector('.paneles-grid'); // agarramos el contenedor grande

paneles.forEach(panel => {
    panel.addEventListener('click', () => {
        
        // si ya lo habías agrandado, achicamos todo a la normalidad
        if (panel.classList.contains('panel-expandido')) {
            grilla.classList.remove('modo-foco');
            paneles.forEach(p => p.classList.remove('panel-expandido', 'panel-minimizado'));
            return; 
        }

        // si no, prendemos el modo foco
        grilla.classList.add('modo-foco');

        paneles.forEach(p => {
            if (p === panel) {
                // al que tocaste le damos protagonismo
                p.classList.add('panel-expandido');
                p.classList.remove('panel-minimizado');
            } else {
                // a los demás los mandamos chiquitos para abajo
                p.classList.add('panel-minimizado');
                p.classList.remove('panel-expandido');
            }
        });
    });
});

// El chiche para cambiar el color de toda la página

const selectorColor = document.getElementById('color-picker-menu');

// un truquito matemático para sacar los 3 números del color
function hexARgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

// cambiamos las variables globales de css para que toda la página mute
function aplicarColorTema(hex) {
    document.documentElement.style.setProperty('--color-terminal', hex);
    document.documentElement.style.setProperty('--color-terminal-rgb', hexARgb(hex));

    if (window.actualizarColorMatrix) {
        window.actualizarColorMatrix(); // le avisamos a la lluvia también
    }
    localStorage.setItem('colorTema', hex); // nos guardamos el color en el navegador para que no se pierda si actualizamos
}

// nos fijamos si ya había elegido un color antes de entrar
const colorGuardado = localStorage.getItem('colorTema');
if (colorGuardado) {
    aplicarColorTema(colorGuardado);
    if (selectorColor) {
        selectorColor.value = colorGuardado; 
    }
}

// escuchamos si mueve la perilla de color y lo actualizamos en vivo
if (selectorColor) {
    selectorColor.addEventListener('input', (evento) => {
        aplicarColorTema(evento.target.value);
    });
}

// Selector de tamaño de letra de los cuadritos

const botonesFuente = document.querySelectorAll('.btn-fuente'); // agarramos los botoncitos S, M, L, XL

// esta función cambia el tamaño y pinta el botoncito que elegiste
function aplicarTamanoFuente(valor) {
    document.documentElement.style.setProperty('--tamano-fuente-panel', valor);
    localStorage.setItem('tamanoFuentePanel', valor); // lo guardamos

    botonesFuente.forEach(boton => {
        boton.classList.toggle('activo', boton.dataset.tamano === valor); // pinta solo el que toca
    });
}

botonesFuente.forEach(boton => {
    boton.addEventListener('click', () => {
        aplicarTamanoFuente(boton.dataset.tamano);
    });
});

// usamos el que quedó guardado o le mandamos M por defecto
const tamanoFuenteGuardado = localStorage.getItem('tamanoFuentePanel') || '1rem';
aplicarTamanoFuente(tamanoFuenteGuardado);

// Lo mismo para el tipo de letra

const botonesTipografia = document.querySelectorAll('.btn-tipografia'); // agarramos MONO, CONSOLA, etc.

function aplicarTipografia(valor) {
    document.documentElement.style.setProperty('--fuente-panel', valor);
    localStorage.setItem('tipografiaPanel', valor); 

    botonesTipografia.forEach(boton => {
        boton.classList.toggle('activo', boton.dataset.fuente === valor);
    });
}

botonesTipografia.forEach(boton => {
    boton.addEventListener('click', () => {
        aplicarTipografia(boton.dataset.fuente);
    });
});

// agarramos el guardado o lo clavamos en letra de compu vieja
const tipografiaGuardada = localStorage.getItem('tipografiaPanel') || "'Courier New', Courier, monospace";
aplicarTipografia(tipografiaGuardada);

// El menú lateral para guardar el historial

const menuLateral = document.getElementById('menu-lateral');
const btnMenu = document.getElementById('btn-menu');
const btnCerrarMenu = document.getElementById('btn-cerrar-menu');
const listaHistorial = document.getElementById('lista-historial');

// traemos lo que quedó guardado o arrancamos de cero
let historialEscaneos = JSON.parse(localStorage.getItem('historialBunker')) || []; 

// para que el menú salga y entre
btnMenu.addEventListener('click', () => {
    menuLateral.classList.add('abierto');
});
btnCerrarMenu.addEventListener('click', () => {
    menuLateral.classList.remove('abierto');
});

// metemos un historial nuevo pero solo si no estaba ya
function registrarEnHistorial(url, datos) {
    const yaExiste = historialEscaneos.some(item => item.url === url);
    if (!yaExiste) {
        historialEscaneos.unshift({ url, datos }); 
        localStorage.setItem('historialBunker', JSON.stringify(historialEscaneos)); // lo clavamos en la memoria
        actualizarVisorHistorial();
    }
}

// esto actualiza la listita en el menú
function actualizarVisorHistorial() {
    listaHistorial.innerHTML = ''; 

    if (historialEscaneos.length === 0) {
        listaHistorial.innerHTML = '<li style="color: var(--color-terminal); opacity: 0.5;">[HISTORIAL VACÍO]</li>';
        return;
    }

    historialEscaneos.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'item-historial';
        li.innerHTML = `> ${item.url}`;
        
        // si tocan algo del historial lo mandamos a revivir los datos
        li.addEventListener('click', () => {
            menuLateral.classList.remove('abierto'); 
            cargarDatosDesdeMemoria(item.url, item.datos); 
        });
        
        listaHistorial.appendChild(li);
    });
}

actualizarVisorHistorial(); // pintamos el historial apenas arranca

// revivir la magia desde la memoria sin gastar internet
async function cargarDatosDesdeMemoria(urlIngresada, datos) {
    reproducirSonidoInicioEscaneo();
    panelVista.classList.remove('esperando');
    panelTech.classList.remove('esperando');
    panelEnlaces.classList.remove('esperando');
    panelMetricas.classList.remove('esperando');

    panelVista.innerHTML = `<span style="color: var(--color-terminal)">[RESTAURANDO DATOS DESDE ARCHIVO LOCAL...] <span id="spinner-carga"></span></span>`;
    const nodoSpinnerCarga = document.getElementById('spinner-carga');
    detenerSpinnerActual = iniciarSpinnerAscii(nodoSpinnerCarga);
    panelTech.innerHTML = '';
    panelEnlaces.innerHTML = '';
    panelMetricas.innerHTML = '';
    inputObjetivo.value = urlIngresada; 

    await new Promise(resolve => setTimeout(resolve, 300)); 

    if (detenerSpinnerActual) { detenerSpinnerActual(); detenerSpinnerActual = null; }

    const tituloRecortado = datos.identidad.titulo.length > 50 ? datos.identidad.titulo.substring(0, 47) + '...' : datos.identidad.titulo;
    const descripcionRecortada = datos.identidad.descripcion.length > 80 ? datos.identidad.descripcion.substring(0, 77) + '...' : datos.identidad.descripcion;
    
    panelVista.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>TÍTULO: <span class="dato-cifrado" style="color: var(--color-terminal)">${tituloRecortado}</span></li><li style="margin-top: 5px;">DESCRIPCIÓN: <span class="dato-cifrado" style="color: var(--color-terminal)">${descripcionRecortada}</span></li></ul>`;
    panelTech.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>SERVIDOR: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.servidor}</span></li><li>LENGUAJE: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.lenguaje}</span></li><li>FRONTEND: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.frameworkFront}</span></li></ul>`;
    panelEnlaces.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>RUTAS BASE: <span class="dato-cifrado" style="color: var(--color-terminal)">${urlIngresada}</span></li><li style="margin-top: 10px; color: var(--color-alerta)">[MÓDULO DE MAPEO ITERATIVO: OFFLINE]</li><li style="color: var(--color-alerta)">[ESPERANDO ACTUALIZACIÓN DEL ROBOT...]</li></ul>`;
    
    const estadoSsl = datos.metricas.certSslVigente ? "Seguro (Activo)" : "Vulnerable (Caído)";
    panelMetricas.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>LATENCIA: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.metricas.tiempoRespuestaMs}ms</span></li><li>PESO TOTAL: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.metricas.pesoDocumentoKb} KB</span></li><li>ESTADO SSL: <span class="dato-cifrado" style="color: var(--color-terminal)">${estadoSsl}</span></li></ul>`;

    // acá los mandamos a todos juntos a revelar
    desencriptarPanel(panelVista);
    desencriptarPanel(panelTech);
    desencriptarPanel(panelEnlaces);
    desencriptarPanel(panelMetricas);

    reproducirSonidoVictoria();
}

// Simulador de que algo está pasando en la barra de progreso mientras no tenemos el cerebro (backend)

const btnScan = document.getElementById('btn-scan');
const btnAbortar = document.getElementById('btn-abortar');
const progressBar = document.getElementById('scan-progress');
const progresoTexto = document.querySelector('.progreso-porcentaje');

let intervaloEscaneo; // la maquinita que cuenta el tiempo

function pararProgresoPorError() {
    clearInterval(intervaloEscaneo); // paramos la maquinita
    progressBar.value = 0;
    progresoTexto.textContent = '[ESCANEO_FALLIDO]';
    progresoTexto.style.color = '#ff3b3b'; // tiramos un rojo peligro
}

btnScan.addEventListener('click', () => {
    clearInterval(intervaloEscaneo); // limpiamos si quedó prendido por error
    
    let progresoActual = 0; // arrancamos limpios
    progressBar.value = progresoActual;
    progresoTexto.textContent = '0%';
    progresoTexto.style.color = 'var(--color-terminal)'; // color normal

    intervaloEscaneo = setInterval(() => {
        // sumamos pasitos al azar para que parezca que posta está procesando
        let avanceAleatorio = Math.floor(Math.random() * 10) + 2;
        progresoActual += avanceAleatorio;

        // si llega al mango, cortamos
        if (progresoActual >= 100) {
            progresoActual = 100;
            clearInterval(intervaloEscaneo);
            progresoTexto.textContent = '100% [COMPLETADO]';
        } else {
            progresoTexto.textContent = progresoActual + '%';
        }

        progressBar.value = progresoActual;

    }, 400); // actualiza casi cada medio segundo
});

btnAbortar.addEventListener('click', () => {
    clearInterval(intervaloEscaneo); // frenamos de una
    progresoTexto.textContent = '[ESCANEO_ABORTADO]';
    progresoTexto.style.color = '#ff3b3b'; // se puso feo, en rojo
});

// Cómo bajarnos los archivos a la compu onda hackers

const btnExportTxt = document.getElementById('btn-export-txt');
const btnExportHtml = document.getElementById('btn-export-html');

// este truco crea un link invisible para poder bajarnos archivos que armamos nosotros
function descargarArchivo(nombre, contenido, tipoMime) {
    const enlace = document.createElement('a'); 
    const archivo = new Blob([contenido], { type: tipoMime }); // el paquete con la data
    enlace.href = URL.createObjectURL(archivo); 
    enlace.download = nombre; 
    enlace.click(); // nos hacemos pasar por un usuario que le dio clic
}

if (btnExportTxt) {
    btnExportTxt.addEventListener('click', () => {
        const url = inputObjetivo.value || "Objetivo_Desconocido";
        const vista = panelVista.innerText || "Sin datos";
        const tech = panelTech.innerText || "Sin datos";
        const metricas = panelMetricas.innerText || "Sin datos";
        
        // armamos un mensajito todo pegado
        const textoFinal = `=== REPORTE TARGET ANALYZER ===\nURL: ${url}\n\n[VISTA]\n${vista}\n\n[TECNOLOGIAS]\n${tech}\n\n[METRICAS]\n${metricas}`;
        
        descargarArchivo('reporte_ataque.txt', textoFinal, 'text/plain'); // y adentro para el bloc de notas
    });
}

if (btnExportHtml) {
    btnExportHtml.addEventListener('click', () => {
        const contenidoHTML = document.querySelector('.paneles-grid').innerHTML; // le robamos la grilla
        
        // y acá armamos una web trucha con lo que sacamos, bien al estilo terminal
        const paginaHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Reporte Target Analyzer</title>
            <style>
                body { background: #050505; color: #00ff41; font-family: monospace; padding: 20px; }
                .panel-bunker { border: 1px solid #00ff41; padding: 15px; margin-bottom: 20px; box-shadow: 0 0 10px rgba(0,255,65,0.2); }
                .panel-titulo { border-bottom: 1px dashed #00ff41; padding-bottom: 5px; }
                ul { list-style: none; padding: 0; }
                li { margin-bottom: 8px; }
            </style>
        </head>
        <body>
            <h1>[REPORTE TARGET ANALYZER]</h1>
            <p><strong>OBJETIVO:</strong> ${inputObjetivo.value || "No especificado"}</p>
            <hr style="border-color: #00ff41; margin-bottom: 20px;">
            ${contenidoHTML}
        </body>
        </html>
        `;
        
        descargarArchivo('reporte_ataque.html', paginaHTML, 'text/html'); // lo bajamos como html
    });
}