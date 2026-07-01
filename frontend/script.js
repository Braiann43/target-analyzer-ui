// 1 CAPTURA DEL MAPA DEL NAVEGADOR (DOM)

// Captura el input donde el usuario escribe la URL.
const inputObjetivo = document.getElementById('target-url');

// Captura el botón verde para iniciar el ataque/escaneo.
const botonEscaneo = document.getElementById('btn-scan');

// Captura el nuevoo botón rojo para abortar la misión en pleno escaneo.
const botonAbortar = document.getElementById('btn-abortar');

// Captura las cajas de contenido de los 4 paneles.
const panelVista = document.querySelector('#panel-vista .contenido-panel');
const panelTech = document.querySelector('#panel-tech .contenido-panel');
const panelEnlaces = document.querySelector('#panel-enlaces .contenido-panel');
const panelMetricas = document.querySelector('#panel-metricas .contenido-panel');

// 2 VARIABLE DE ESTADO Y CONTROLADORA

// Esta variable nace vacía (undefined). Su trabajo será guardar el "control remoto" 
// que nos permitirá cancelar el Fetch a mitad de camino si el servidor tarda mucho.
let controladorPeticion;


// 2.1 MOTOR DE SONIDOS (Web Audio API)
// Generamos los sonidos con código en vez de usar archivos de audio externos:
// así no dependemos de internet ni de pesar la carpeta con .mp3, y podemos
// darles ese toque "retro/8-bit" que pega justo con la estética hacker.

// El AudioContext es el "motor de sonido" del navegador. Los navegadores 
// exigen que se cree recién DESPUÉS de un clic del usuario (por eso nace 
// vacío acá, y se arma la primera vez que hace falta, dentro de un evento de clic).
let audioCtx;

function obtenerAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// Sonido de VICTORIA: un arpegio corto y ascendente (como una "fanfarria" chiptune).
function reproducirSonidoVictoria() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;
    const notas = [523.25, 659.25, 783.99, 1046.50]; // Notas musicales Do5, Mi5, Sol5, Do6 (un acorde mayor, suena "alegre")

    notas.forEach((frecuencia, indice) => {
        const oscilador = ctx.createOscillator(); // El "generador" de la onda de sonido
        const volumen = ctx.createGain(); // El "control de volumen" de esa nota

        oscilador.type = 'square'; // Onda cuadrada = sonido tipo 8-bit/retro
        oscilador.frequency.value = frecuencia;

        const inicio = ahora + indice * 0.09; // Cada nota arranca un poquito después de la anterior
        // Fade-in y fade-out rápidos para que no suene como un "clic" seco
        volumen.gain.setValueAtTime(0.0001, inicio);
        volumen.gain.exponentialRampToValueAtTime(0.15, inicio + 0.02);
        volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.18);

        oscilador.connect(volumen).connect(ctx.destination); // Conecta: oscilador -> volumen -> parlantes
        oscilador.start(inicio);
        oscilador.stop(inicio + 0.18);
    });
}

// Sonido de DERROTA: un tono grave, tipo "buzzer", que cae de agudo a grave.
function reproducirSonidoDerrota() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'sawtooth'; // Onda "sierra" = sonido más áspero, de alarma
    oscilador.frequency.setValueAtTime(220, ahora); // Arranca en un tono medio
    oscilador.frequency.exponentialRampToValueAtTime(80, ahora + 0.4); // Y cae a un tono grave, como un "error"

    volumen.gain.setValueAtTime(0.15, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.4);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.4);
}

// Sonido de INICIO DE ESCANEO: un "blip" cortito y agudo, tipo confirmación de radar/sonar.
// Es breve a propósito, para no pisar el sonido de victoria/derrota que suena más adelante.
function reproducirSonidoInicioEscaneo() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'square'; // Mismo timbre que la victoria, pero acá es una sola nota cortita
    oscilador.frequency.setValueAtTime(660, ahora); // Nota aguda, tipo "beep" de confirmación
    oscilador.frequency.exponentialRampToValueAtTime(880, ahora + 0.08); // Sube un poquito, da sensación de "activando"

    volumen.gain.setValueAtTime(0.0001, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.12, ahora + 0.01);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.1);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.1);
}

// Sonido de ABORTAR: un "apagado" descendente con onda triangular, distinto tanto
// del beep de inicio como del buzzer de derrota (ese es más áspero/largo, este es 
// más suave y corto, como "cortando la conexión" en vez de "fallando").
function reproducirSonidoAbortar() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'triangle'; // Onda triangular = sonido más suave y "hueco", distinto a los otros 3
    oscilador.frequency.setValueAtTime(500, ahora);
    oscilador.frequency.exponentialRampToValueAtTime(120, ahora + 0.22); // Cae rápido, como "apagando motores"

    volumen.gain.setValueAtTime(0.14, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.22);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.22);
}


// 2.2 SPINNER ASCII (indicador de actividad mientras esperamos al backend)
// En vez de un gif o una imagen de "cargando", usamos el recurso mas viejo y
// mas hacker que existe: un caracter que gira sobre si mismo tipo terminal de
// los 90 ('|', '/', '-', '\'). Es cero peso, cero dependencias, y pega
// perfecto con la estetica de consola de toda la web.

// Guarda la funcion que apaga el spinner que esta activo en este momento.
// La dejamos "colgada" a nivel de archivo para que cualquier rama del codigo
// (exito, error del backend, o corte de conexion) pueda apagarla sin
// importar en que parte de iniciarOperacion() estemos.
let detenerSpinnerActual = null;

// Prende el spinner sobre un elemento del DOM y devuelve una funcion para
// apagarlo. Si no se llama a esa funcion, el intervalo queda vivo para
// siempre "girando en el vacio" (fuga de memoria), asi que SIEMPRE hay que
// guardarse y ejecutar lo que esta funcion devuelve.
function iniciarSpinnerAscii(elementoSpinner) {
    const framesSpinner = ['|', '/', '-', '\\']; // Los 4 cuadros clasicos del spinner de terminal
    let indiceFrame = 0;

    const intervaloSpinner = setInterval(() => {
        elementoSpinner.textContent = framesSpinner[indiceFrame % framesSpinner.length];
        indiceFrame++;
    }, 120); // Gira cada 120ms: rapido, pero sin marear al ojo humano

    // Devolvemos la "llave" para apagarlo desde afuera
    return function apagarSpinner() {
        clearInterval(intervaloSpinner);
    };
}


// 2.3 EFECTO DE DESENCRIPTACIÓN (revelado tipo "hackeo" de los datos entrantes)
// Cuando el backend contesta, en vez de tirar el texto posta de una sola vez,
// lo hacemos "decodificar" en pantalla: arranca como sopa de caracteres random
// y, de izquierda a derecha, se va fijando letra por letra hasta mostrar el
// dato real. El clasico efecto "descifrando transmision" de las peliculas de
// hackers, pero armado a mano con setInterval.

const CARACTERES_CIFRADO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*+=-/\\<>[]{}'; // Sopa de caracteres para el "ruido" inicial

// Recibe un elemento del DOM y el texto final que tiene que terminar mostrando.
// Va revelando de a una letra (de izquierda a derecha), y mientras tanto rellena
// el resto con caracteres random que cambian en cada cuadro, como una señal
// que se va sintonizando.
function efectoDesencriptado(elementoDestino, textoFinal, velocidadMs = 25) {
    let letrasReveladas = 0;

    const intervaloDescifrado = setInterval(() => {
        let textoEnPantalla = '';

        for (let i = 0; i < textoFinal.length; i++) {
            if (i < letrasReveladas) {
                // Esta posicion ya esta "descifrada": mostramos la letra real
                textoEnPantalla += textoFinal[i];
            } else if (textoFinal[i] === ' ') {
                // Los espacios los respetamos siempre, si no, el ruido no deja leer las palabras
                textoEnPantalla += ' ';
            } else {
                // Todavia no se descifro: ponemos un caracter random de la sopa
                textoEnPantalla += CARACTERES_CIFRADO[Math.floor(Math.random() * CARACTERES_CIFRADO.length)];
            }
        }

        elementoDestino.textContent = textoEnPantalla;
        letrasReveladas++;

        // Cuando ya revelamos todas las letras, frenamos el intervalo y dejamos el texto final limpio
        if (letrasReveladas > textoFinal.length) {
            clearInterval(intervaloDescifrado);
            elementoDestino.textContent = textoFinal;
        }
    }, velocidadMs);
}

// Barre un panel entero buscando todos los elementos marcados con la clase
// "dato-cifrado" (los datos que vinieron posta del servidor) y les aplica el
// efecto de desencriptado a cada uno. El texto final que van a mostrar es el
// mismo que ya quedo cargado en el HTML: lo leemos, y lo usamos como "meta"
// del descifrado.
function desencriptarPanel(panel, velocidadMs = 25) {
    const nodosCifrados = panel.querySelectorAll('.dato-cifrado');
    nodosCifrados.forEach((nodo) => {
        const textoFinal = nodo.textContent;
        efectoDesencriptado(nodo, textoFinal, velocidadMs);
    });
}


// 3 ESCUCHADORES DE EVENTOS (LOS GATILLOS)

// Cuando se hace clic en el botón de escaneo, dispara la función 'iniciarOperacion'.
botonEscaneo.addEventListener('click', iniciarOperacion);

// Cuando se hace clic en el botón de abortar...
botonAbortar.addEventListener('click', () => {
    // Verifica si hay una petición viva viajando por la red en este momento.
    if (controladorPeticion) {
        reproducirSonidoAbortar(); // Sonido distinto: "cortando la conexión", no es un error, es una decisión
        controladorPeticion.abort(); // Si la hay, presiona el "botón de autodestrucción" del Fetch.
    }
});


// 4 EL NÚCLEO DE LA OPERACIÓN (FUNCIÓN PRINCIPAL)

// 'async' avisa que esta función tendrá pausas internas esperando a la red.
async function iniciarOperacion() {
    
    reproducirSonidoInicioEscaneo(); // Blip de confirmación: "escaneo activado"

    // Mostrar el botón de abortar al arrancar la operación
    botonAbortar.style.display = 'block';

    // 2. APAGAMOS EL "ESPERANDO OBJETIVO" AL INSTANTE EN LOS 4 PANELES
    panelVista.classList.remove('esperando');
    panelTech.classList.remove('esperando');
    panelEnlaces.classList.remove('esperando');
    panelMetricas.classList.remove('esperando');

    // SEGURIDAD: Si el usuario aprieta "Escanear" 2 veces rápido, cancelamos 
    // las peticiones anteriores para no saturar nuestro propio servidor.
    if (controladorPeticion) {
        controladorPeticion.abort();
    }

    // Extraemos la URL y le quitamos los espacios en blanco .trim().
    let urlIngresada = inputObjetivo.value.trim();

    // NORMALIZACIÓN DE DATOS
    // Agregamos "https://" al inicio de la URL si el usuario no lo puso, para evitar que el backend falle.
    if (!urlIngresada.startsWith('http://') && !urlIngresada.startsWith('https://')) {
        urlIngresada = 'https://' + urlIngresada;
    }

    // VALIDACION DE FORMATO DE URL
    try {
        // Usamos el constructor nativo de JavaScript para URLs. 
        // Si 'urlIngresada' no tiene forma de web real, esto hace colapsar el try y salta al catch.
        new URL(urlIngresada);
    } catch (error) {
        // Si el formato es inválido, inyecta un cartel rojo interactivo en el Panel 1.
        panelVista.innerHTML = `<span style="color: var(--color-alerta)">[ERROR: FORMATO DE URL INVÁLIDO]</span>`;
        panelTech.innerHTML = '';
        panelMetricas.innerHTML = '';
        panelEnlaces.innerHTML = '';

        panelTech.classList.add('esperando');
        panelEnlaces.classList.add('esperando');
        panelMetricas.classList.add('esperando');
        
        botonAbortar.style.display = 'none'; // Ocultamos el botón abortar
        reproducirSonidoDerrota(); // Sonido de error: la URL ni siquiera tiene forma válida
        pararProgresoPorError(); // Frenamos la barra de progreso: ni siquiera llegó a arrancar el escaneo

        // Sensor para limpiar al hacer clic sobre el mensaje de error y volver a enfocar el input. Y vuelve a aparecer el mensaje de "esperando objetivo" en los otros paneles.
        panelVista.querySelector('span').addEventListener('click', () => {
            panelVista.innerHTML = '';
            panelVista.classList.add('esperando'); 
            inputObjetivo.value = '';
            inputObjetivo.focus();
        });
        return; // Sale de la función sin hacer nada más.
    
    }

    // 4 INYECCIÓN DINÁMICA (Preparacion visual de los paneles para el escaneo)
    // El texto "[CONECTANDO SONDAS...]" ahora viene acompañado de un spinner ASCII
    // (el clasico '|/-\' de terminal) para que el operador vea que la maquina
    // sigue viva mientras esperamos respuesta del backend, y no crea que se colgó.
    panelVista.innerHTML = '<span style="color: var(--color-terminal)">[CONECTANDO SONDAS...] <span id="spinner-carga"></span></span>';
    const nodoSpinnerCarga = document.getElementById('spinner-carga');
    detenerSpinnerActual = iniciarSpinnerAscii(nodoSpinnerCarga);
    panelTech.innerHTML = '';
    panelEnlaces.innerHTML = '';
    panelMetricas.innerHTML = '';
    inputObjetivo.value = '';

    // Creamos un nuevo "control remoto" para esta petición específica que está por salir.
    controladorPeticion = new AbortController();

    
    // 5 EL DISPARO A LA RED (EL FETCH)
    
    try {
        await new Promise(resolve => setTimeout(resolve, 400)); // Para darle tiempo a la UI de mostrar "[CONECTANDO SONDAS...]"
        const respuesta = await fetch('http://localhost:3000/api/escanear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlIngresada }),
            // Atamos el "control remoto" a este envío. Si llamamos a .abort(), este fetch muere.
            signal: controladorPeticion.signal 
        });

        // Convertimos la respuesta del backend de texto a un objeto JavaScript.
        const datos = await respuesta.json();

        // CONTROL DE ERRORES DEL SERVIDOR
        // respuesta.ok verifica si el código HTTP es 200 (éxito). Si el backend manda un código 400 o 500...
        if (!respuesta.ok) {
            // Frenamos el spinner: la respuesta ya llegó (aunque sea con error), no tiene sentido que siga girando.
            if (detenerSpinnerActual) { detenerSpinnerActual(); detenerSpinnerActual = null; }

            // Muestra el error que mandó el backend y frena la ejecución.
            panelVista.innerHTML = `<span style="color: var(--color-alerta)">[ERROR: ${datos.error}]</span>`;
            panelTech.innerHTML = '';
            panelMetricas.innerHTML = '';
            panelEnlaces.innerHTML = '';

            // Si el servidor falla, vuelven a "Esperando..."
            panelTech.classList.add('esperando');
            panelEnlaces.classList.add('esperando');
            panelMetricas.classList.add('esperando');
            
            botonAbortar.style.display = 'none';
            reproducirSonidoDerrota();  // Sonido de error: el backend rechazó la operación
            pararProgresoPorError(); // Frenamos la barra: el backend contestó, pero con error
            return;
        }
        
        // 6 IMPACTO EN EL TABLERO (Resultados exitosos)
        // La respuesta ya llegó posta: apagamos el spinner de conexión antes de mostrar nada.
        if (detenerSpinnerActual) { detenerSpinnerActual(); detenerSpinnerActual = null; }

        // La clase "dato-cifrado" marca cada dato REAL que viene del servidor. A cada
        // uno de esos spans, apenas se inyectan en el panel, se le aplica el efecto
        // de desencriptado (arranca en sopa de letras random y se va "sintonizando"
        // hasta mostrar el valor posta). Las etiquetas fijas (TÍTULO:, SERVIDOR:, etc.)
        // quedan afuera de esa clase: esas no vienen del backend, no hace falta cifrarlas.
        panelVista.innerHTML = `<span class="dato-cifrado" style="color: var(--color-terminal)">${datos.mensaje}</span>`;
        desencriptarPanel(panelVista);
        panelTech.innerHTML = `<span class="dato-cifrado" style="color: var(--color-terminal)">Objetivo en servidor: ${datos.objetivo}</span>`;
        desencriptarPanel(panelTech);

        // PAUSA TÁCTICA: Congela el código 600 milisegundos (0.6 seg) para dar sensación de procesamiento.
        await new Promise(resolve => setTimeout(resolve, 600));

        // PANEL 1 (VISTA): PROTECCIÓN DE DESBORDAMIENTO (OVERFLOW VISUAL)
        // Si el título tiene más de 50 letras, lo corta en la letra 47 y le pone "...". Si no, lo deja igual.
        const tituloRecortado = datos.identidad.titulo.length > 50 ? datos.identidad.titulo.substring(0, 47) + '...' : datos.identidad.titulo;
        // Hace lo mismo con la descripción, pero el límite son 80 letras.
        const descripcionRecortada = datos.identidad.descripcion.length > 80 ? datos.identidad.descripcion.substring(0, 77) + '...' : datos.identidad.descripcion;
        
        // Inyecta el título y descripción formateados en HTML, y los desencripta apenas entran.
        panelVista.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>TÍTULO: <span class="dato-cifrado" style="color: var(--color-terminal)">${tituloRecortado}</span></li><li style="margin-top: 5px;">DESCRIPCIÓN: <span class="dato-cifrado" style="color: var(--color-terminal)">${descripcionRecortada}</span></li></ul>`;
        desencriptarPanel(panelVista);
        
        // Otra pausa de 300ms antes de mostrar el siguiente panel.
        await new Promise(resolve => setTimeout(resolve, 300));

        // PANEL 2 (TECH): Muestra los datos de tecnología que enviará el nuevo backend, desencriptados letra por letra.
        panelTech.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>SERVIDOR: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.servidor}</span></li><li>LENGUAJE: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.lenguaje}</span></li><li>FRONTEND: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.frameworkFront}</span></li></ul>`;
        desencriptarPanel(panelTech);
        
        // Última pausa de 300ms.
        await new Promise(resolve => setTimeout(resolve, 300));

        // PANEL 3 (ENLACES) (Inyección temporal táctica)
        // Como el Robot 1.1 aún no extrae el arreglo de enlaces internos, 
        // dejamos la URL anclada y un aviso visual. Los avisos fijos no se cifran,
        // solo la URL (que es el único dato real que tenemos por ahora).
        panelEnlaces.innerHTML = `
        <ul style="list-style: none; padding: 0; margin: 0;">
            <li>RUTAS BASE: <span class="dato-cifrado" style="color: var(--color-terminal)">${urlIngresada}</span></li>
            <li style="margin-top: 10px; color: var(--color-alerta)">[MÓDULO DE MAPEO ITERATIVO: OFFLINE]</li>
            <li style="color: var(--color-alerta)">[ESPERANDO ACTUALIZACIÓN DEL ROBOT...]</li>
        </ul>`;
        desencriptarPanel(panelEnlaces);

        // PANEL 4 (METRICAS) EVALUACIÓN LÓGICA EN CLIENTE
        // Si el booleano 'certSslVigente' es true, guarda el texto verde. Si es false, texto de alerta.
        const estadoSsl = datos.metricas.certSslVigente ? "Seguro (Activo)" : "Vulnerable (Caído)";
        
        // Inyecta las métricas finales, tambien con el efecto de descifrado.
        panelMetricas.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>LATENCIA: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.metricas.tiempoRespuestaMs}ms</span></li><li>PESO TOTAL: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.metricas.pesoDocumentoKb} KB</span></li><li>ESTADO SSL: <span class="dato-cifrado" style="color: var(--color-terminal)">${estadoSsl}</span></li></ul>`;
        desencriptarPanel(panelMetricas);

        registrarEnHistorial(urlIngresada, datos);

        reproducirSonidoVictoria(); // Sonido de éxito: los 4 paneles ya se llenaron con datos reales
        botonAbortar.style.display = 'none'; // Oculta el botón tras el éxito

    
    // 8 GESTIÓN DE EXCEPCIONES Y ABORTOS
    
    } catch (error) {
        // Se cortó la operación (aborto manual o falla de red): el spinner ya no tiene nada que esperar.
        if (detenerSpinnerActual) { detenerSpinnerActual(); detenerSpinnerActual = null; }

        if (error.name === 'AbortError') {
            // Le agregué "cursor: pointer;" para que el mouse se ponga con la manito y el usuario sepa que puede clickearlo
            panelVista.innerHTML = `<span style="color: var(--color-alerta); cursor: pointer; display: block; padding: 10px;" title="Clic para limpiar">[OPERACIÓN CANCELADA POR EL OPERADOR]</span>`;
        } else {
            panelVista.innerHTML = `<span style="color: var(--color-alerta); cursor: pointer;" title="Clic para limpiar">[FALLO DE CONEXIÓN CON BÚNKER CENTRAL]</span>`;
            console.error(error); 
            reproducirSonidoDerrota(); 
            pararProgresoPorError(); // Frenamos la barra: se cortó la conexión, no tiene sentido que siga subiendo
        }
        
        // Si hay error o abortamos, limpiamos los demás paneles
        panelTech.innerHTML = '';
        panelEnlaces.innerHTML = '';
        panelMetricas.innerHTML = '';
        
        // Y los volvemos al estado de espera
        panelTech.classList.add('esperando');
        panelEnlaces.classList.add('esperando');
        panelMetricas.classList.add('esperando');
        
        // EL ESCANEO FALLÓ O SE CANCELÓ: Ocultamos el botón abortar
        botonAbortar.style.display = 'none'; 

        // NUEVO: Agregamos el sensor para que si hacen clic en el error, el panel se limpie y vuelva a "Esperando..."
        panelVista.querySelector('span').addEventListener('click', () => {
            panelVista.innerHTML = '';
            panelVista.classList.add('esperando'); 
            inputObjetivo.value = '';
            inputObjetivo.focus();
        });
    }
} // <-- Fin de la función iniciarOperacion()


// 9 MODO FOCO (estilo llamada de Discord)
// Al hacer clic en un panel, ese se agranda y los otros 3 se minimizan  abajo.

// Agarramos TODOS los paneles de una sola vez
const paneles = document.querySelectorAll('.panel-bunker');
const grilla = document.querySelector('.paneles-grid');

paneles.forEach(panel => {
    panel.addEventListener('click', () => {
        
        // Si el panel en el que clickeaste YA estaba expandido, volvemos todo a la normalidad
        if (panel.classList.contains('panel-expandido')) {
            grilla.classList.remove('modo-foco');
            paneles.forEach(p => p.classList.remove('panel-expandido', 'panel-minimizado'));
            return; // Cortamos la función acá, no hace falta seguir
        }

        // Si clickeaste un panel distinto, activamos el modo foco
        grilla.classList.add('modo-foco');

        paneles.forEach(p => {
            if (p === panel) {
                // Al que clickeaste le ponemos la clase de "grande"
                p.classList.add('panel-expandido');
                p.classList.remove('panel-minimizado');
            } else {
                // A los demás los mandamos a la fila de abajo, chiquitos
                p.classList.add('panel-minimizado');
                p.classList.remove('panel-expandido');
            }
        });
    });
});


// 10 SELECTOR DE COLOR (personalización del tema)
// Ahora apuntamos al nuevo ID que está adentro del menú lateral oculto
const selectorColor = document.getElementById('color-picker-menu');

function hexARgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

function aplicarColorTema(hex) {
    document.documentElement.style.setProperty('--color-terminal', hex);
    document.documentElement.style.setProperty('--color-terminal-rgb', hexARgb(hex));

    if (window.actualizarColorMatrix) {
        window.actualizarColorMatrix();
    }
    localStorage.setItem('colorTema', hex);
}

// Recupera el color si el usuario ya había elegido uno antes
const colorGuardado = localStorage.getItem('colorTema');
if (colorGuardado) {
    aplicarColorTema(colorGuardado);
    // Verificamos que el selector exista antes de asignarle el valor para evitar errores
    if (selectorColor) {
        selectorColor.value = colorGuardado; 
    }
}

// Escucha los cambios en vivo del nuevo selector de color del menú
if (selectorColor) {
    selectorColor.addEventListener('input', (evento) => {
        aplicarColorTema(evento.target.value);
    });
}

// ==========================================================================
// 10.1 SELECTOR DE TAMAÑO DE FUENTE (para el contenido de los 4 paneles)
// ==========================================================================

// Agarramos los 4 botones (S, M, L, XL) de una sola vez
const botonesFuente = document.querySelectorAll('.btn-fuente');

// Aplica el tamaño elegido, lo guarda en el navegador y marca el botón activo
function aplicarTamanoFuente(valor) {
    document.documentElement.style.setProperty('--tamano-fuente-panel', valor);
    localStorage.setItem('tamanoFuentePanel', valor);

    // Recorremos los 4 botones: al que coincide con el valor elegido le sumamos
    // la clase "activo" (queda pintado), a los demás se la sacamos
    botonesFuente.forEach(boton => {
        boton.classList.toggle('activo', boton.dataset.tamano === valor);
    });
}

// Escucha el clic de cada botón individual
botonesFuente.forEach(boton => {
    boton.addEventListener('click', () => {
        aplicarTamanoFuente(boton.dataset.tamano);
    });
});

// Recupera el tamaño guardado de una visita anterior. Si es la primera vez
// que entra (no hay nada guardado), usa 'M' (1rem) como valor por defecto.
const tamanoFuenteGuardado = localStorage.getItem('tamanoFuentePanel') || '1rem';
aplicarTamanoFuente(tamanoFuenteGuardado);


// ==========================================================================
// 10.2 SELECTOR DE ESTILO DE FUENTE (para el contenido de los 4 paneles)
// ==========================================================================

// Agarramos los 4 botones (MONO, CONSOLA, SERIF, SANS) de una sola vez
const botonesTipografia = document.querySelectorAll('.btn-tipografia');

// Aplica la tipografía elegida, la guarda en el navegador y marca el botón activo
function aplicarTipografia(valor) {
    document.documentElement.style.setProperty('--fuente-panel', valor);
    localStorage.setItem('tipografiaPanel', valor);

    // Recorremos los 4 botones: al que coincide con el valor elegido le sumamos
    // la clase "activo" (queda pintado), a los demás se la sacamos
    botonesTipografia.forEach(boton => {
        boton.classList.toggle('activo', boton.dataset.fuente === valor);
    });
}

// Escucha el clic de cada botón individual
botonesTipografia.forEach(boton => {
    boton.addEventListener('click', () => {
        aplicarTipografia(boton.dataset.fuente);
    });
});

// Recupera la tipografía guardada de una visita anterior. Si es la primera vez
// que entra (no hay nada guardado), usa la fuente "MONO" (Courier New) como valor por defecto,
// que es la misma que ya venía usando la web.
const tipografiaGuardada = localStorage.getItem('tipografiaPanel') || "'Courier New', Courier, monospace";
aplicarTipografia(tipografiaGuardada);


// ==========================================================================
// 11 MENÚ LATERAL Y SISTEMA DE HISTORIAL (CON MEMORIA PERMANENTE)
// ==========================================================================

const menuLateral = document.getElementById('menu-lateral');
const btnMenu = document.getElementById('btn-menu');
const btnCerrarMenu = document.getElementById('btn-cerrar-menu');
const listaHistorial = document.getElementById('lista-historial');

// Recuperamos el historial guardado en el navegador. Si no hay nada, arranca vacío.
let historialEscaneos = JSON.parse(localStorage.getItem('historialBunker')) || []; 

// Abrir y cerrar menú
btnMenu.addEventListener('click', () => {
    menuLateral.classList.add('abierto');
});
btnCerrarMenu.addEventListener('click', () => {
    menuLateral.classList.remove('abierto');
});

// Función para guardar un escaneo exitoso y persistirlo
function registrarEnHistorial(url, datos) {
    // Verificamos que la URL no esté ya en el historial
    const yaExiste = historialEscaneos.some(item => item.url === url);
    if (!yaExiste) {
        historialEscaneos.unshift({ url, datos }); 
        // Guardamos la lista actualizada en el disco duro del navegador
        localStorage.setItem('historialBunker', JSON.stringify(historialEscaneos));
        actualizarVisorHistorial();
    }
}

// Renderiza los botones en el menú lateral
function actualizarVisorHistorial() {
    listaHistorial.innerHTML = ''; // Limpia la lista actual

    // Si el historial está vacío, mostramos el mensaje por defecto
    if (historialEscaneos.length === 0) {
        listaHistorial.innerHTML = '<li style="color: var(--color-terminal); opacity: 0.5;">[HISTORIAL VACÍO]</li>';
        return;
    }

    historialEscaneos.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'item-historial';
        li.innerHTML = `> ${item.url}`;
        
        // Al hacer clic en un registro viejo, lo carga de los datos guardados
        li.addEventListener('click', () => {
            menuLateral.classList.remove('abierto'); // Cierra el menú
            cargarDatosDesdeMemoria(item.url, item.datos); // Dispara la inyección
        });
        
        listaHistorial.appendChild(li);
    });
}

// Cargamos y pintamos el historial apenas se abre la página
actualizarVisorHistorial();

// Esta función recicla tu lógica visual, pero extrae los datos de la memoria en lugar de un Fetch
async function cargarDatosDesdeMemoria(urlIngresada, datos) {
    reproducirSonidoInicioEscaneo();
    panelVista.classList.remove('esperando');
    panelTech.classList.remove('esperando');
    panelEnlaces.classList.remove('esperando');
    panelMetricas.classList.remove('esperando');

    // Mismo spinner ASCII que usa la operación en vivo, para mantener una sola
    // "identidad visual" de carga en toda la web (venga el dato de un fetch real
    // o de la memoria local del navegador).
    panelVista.innerHTML = `<span style="color: var(--color-terminal)">[RESTAURANDO DATOS DESDE ARCHIVO LOCAL...] <span id="spinner-carga"></span></span>`;
    const nodoSpinnerCarga = document.getElementById('spinner-carga');
    detenerSpinnerActual = iniciarSpinnerAscii(nodoSpinnerCarga);
    panelTech.innerHTML = '';
    panelEnlaces.innerHTML = '';
    panelMetricas.innerHTML = '';
    inputObjetivo.value = urlIngresada; 

    await new Promise(resolve => setTimeout(resolve, 300)); 

    // Los datos ya están listos para mostrarse: apagamos el spinner antes de inyectarlos.
    if (detenerSpinnerActual) { detenerSpinnerActual(); detenerSpinnerActual = null; }

    const tituloRecortado = datos.identidad.titulo.length > 50 ? datos.identidad.titulo.substring(0, 47) + '...' : datos.identidad.titulo;
    const descripcionRecortada = datos.identidad.descripcion.length > 80 ? datos.identidad.descripcion.substring(0, 77) + '...' : datos.identidad.descripcion;
    
    // Igual que en el escaneo en vivo, cada dato real lleva la clase "dato-cifrado"
    // para que se desencripte en pantalla en vez de aparecer de golpe.
    panelVista.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>TÍTULO: <span class="dato-cifrado" style="color: var(--color-terminal)">${tituloRecortado}</span></li><li style="margin-top: 5px;">DESCRIPCIÓN: <span class="dato-cifrado" style="color: var(--color-terminal)">${descripcionRecortada}</span></li></ul>`;
    panelTech.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>SERVIDOR: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.servidor}</span></li><li>LENGUAJE: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.lenguaje}</span></li><li>FRONTEND: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.tecnologias.frameworkFront}</span></li></ul>`;
    panelEnlaces.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>RUTAS BASE: <span class="dato-cifrado" style="color: var(--color-terminal)">${urlIngresada}</span></li><li style="margin-top: 10px; color: var(--color-alerta)">[MÓDULO DE MAPEO ITERATIVO: OFFLINE]</li><li style="color: var(--color-alerta)">[ESPERANDO ACTUALIZACIÓN DEL ROBOT...]</li></ul>`;
    
    const estadoSsl = datos.metricas.certSslVigente ? "Seguro (Activo)" : "Vulnerable (Caído)";
    panelMetricas.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>LATENCIA: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.metricas.tiempoRespuestaMs}ms</span></li><li>PESO TOTAL: <span class="dato-cifrado" style="color: var(--color-terminal)">${datos.metricas.pesoDocumentoKb} KB</span></li><li>ESTADO SSL: <span class="dato-cifrado" style="color: var(--color-terminal)">${estadoSsl}</span></li></ul>`;

    // Un solo barrido de desencriptado que cubre los 4 paneles a la vez, ya que
    // acá no hay pausas escalonadas entre panel y panel como en el fetch real.
    desencriptarPanel(panelVista);
    desencriptarPanel(panelTech);
    desencriptarPanel(panelEnlaces);
    desencriptarPanel(panelMetricas);

    reproducirSonidoVictoria();
}
// ==========================================================================
//   CONTROL DE LA BARRA DE PROGRESO (SIMULACIÓN MIENTRAS NO HAY BACKEND)
// ==========================================================================

// 1. Capturamos los elementos del DOM (HTML) que vamos a manipular
const btnScan = document.getElementById('btn-scan');
const btnAbortar = document.getElementById('btn-abortar');
const progressBar = document.getElementById('scan-progress');
const progresoTexto = document.querySelector('.progreso-porcentaje');

// Variable para guardar el temporizador y poder frenarlo si el usuario aborta
let intervaloEscaneo;

// Función global para frenar la barra de progreso cuando el escaneo falla
// (URL inválida, error del backend, o corte de conexión). La dejamos como
// función normal (no arrow) y declarada arriba de todo para poder llamarla
// desde iniciarOperacion() aunque esa función esté definida más arriba en el archivo.
function pararProgresoPorError() {
    clearInterval(intervaloEscaneo);
    progressBar.value = 0;
    progresoTexto.textContent = '[ESCANEO_FALLIDO]';
    progresoTexto.style.color = '#ff3b3b'; // Rojo, mismo tono que usa el abortar
}

// 2. Función que arranca la simulación al hacer clic en [INICIAR_ESCANEO]
btnScan.addEventListener('click', () => {
    // Nos aseguramos de limpiar cualquier escaneo anterior que haya quedado a medias
    clearInterval(intervaloEscaneo);
    
    // Reseteamos la barra a cero
    let progresoActual = 0;
    progressBar.value = progresoActual;
    progresoTexto.textContent = '0%';
    progresoTexto.style.color = 'var(--color-terminal)'; // Aseguramos que vuelva a ser verde

    // Creamos un intervalo que se ejecuta cada 400 milisegundos (0.4 segundos)
    intervaloEscaneo = setInterval(() => {
        // Hacemos que avance de forma aleatoria entre 2% y 12% para que parezca real
        let avanceAleatorio = Math.floor(Math.random() * 10) + 2;
        progresoActual += avanceAleatorio;

        // Si se pasa de 100, lo clavamos en 100 y frenamos el temporizador
        if (progresoActual >= 100) {
            progresoActual = 100;
            clearInterval(intervaloEscaneo);
            progresoTexto.textContent = '100% [COMPLETADO]';
            
            // Acá a futuro es donde le dirías a tus paneles: "¡Ey, saquense la clase .esperando y muestren los datos!"
        } else {
            progresoTexto.textContent = progresoActual + '%';
        }

        // Actualizamos visualmente la barra HTML5
        progressBar.value = progresoActual;

    }, 400); 
});

// 3. Función para frenar todo si el usuario entra en pánico y hace clic en [ABORTAR]
btnAbortar.addEventListener('click', () => {
    // Frenamos el contador en seco
    clearInterval(intervaloEscaneo);
    
    // Le avisamos visualmente al usuario
    progresoTexto.textContent = '[ESCANEO_ABORTADO]';
    progresoTexto.style.color = '#ff3b3b'; // Lo ponemos en rojo
});
// ==========================================================================
// 12 EXPORTAR REPORTES (TXT Y HTML) - [LO NUEVO DE LA FUSIÓN]
// Con esta magia descargamos archivos directamente desde el navegador 
// ==========================================================================

const btnExportTxt = document.getElementById('btn-export-txt');
const btnExportHtml = document.getElementById('btn-export-html');

// Función que crea un archivo fantasma y simula un click para descargarlo
function descargarArchivo(nombre, contenido, tipoMime) {
    const enlace = document.createElement('a'); // Creamos un link invisible en el HTML
    const archivo = new Blob([contenido], { type: tipoMime }); // Armamos el paquete de datos puros (Blob)
    enlace.href = URL.createObjectURL(archivo); // Le inventamos una ruta temporal
    enlace.download = nombre; // Le decimos cómo se va a llamar el archivo
    enlace.click(); // Simulamos que el usuario le hace click para que se baje a la PC
}

if (btnExportTxt) {
    btnExportTxt.addEventListener('click', () => {
        // Juntamos todo el texto crudo de los paneles para el bloc de notas
        const url = inputObjetivo.value || "Objetivo_Desconocido";
        const vista = panelVista.innerText || "Sin datos";
        const tech = panelTech.innerText || "Sin datos";
        const metricas = panelMetricas.innerText || "Sin datos";
        
        // Armamos el texto lindo con saltos de línea (\n)
        const textoFinal = `=== REPORTE TARGET ANALYZER ===\nURL: ${url}\n\n[VISTA]\n${vista}\n\n[TECNOLOGIAS]\n${tech}\n\n[METRICAS]\n${metricas}`;
        
        // Llamamos a la función mágica de arriba mandándole formato de texto plano
        descargarArchivo('reporte_ataque.txt', textoFinal, 'text/plain');
    });
}

if (btnExportHtml) {
    btnExportHtml.addEventListener('click', () => {
        // Para el HTML, directamente le robamos el código visual a la grilla de la web
        const contenidoHTML = document.querySelector('.paneles-grid').innerHTML;
        
        // Le armamos un esqueleto básico para que se vea verde y negro al abrirlo
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
        
        // Lo bajamos como archivo HTML
        descargarArchivo('reporte_ataque.html', paginaHTML, 'text/html');
    });
}