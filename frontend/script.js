// 1 CAPTURA DEL MAPA DEL NAVEGADOR (DOM)

// Captura el input donde el usuario escribe la URL.
const inputObjetivo = document.getElementById('target-url');

// Captura el botón verde para iniciar el ataque/escaneo.
const botonEscaneo = document.getElementById('btn-scan');

// Captura el nuevo botón rojo para abortar la misión en pleno escaneo.
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
    panelVista.innerHTML = '<span style="color: var(--color-terminal)">[CONECTANDO SONDAS...]</span>';
    panelTech.innerHTML = '';
    panelEnlaces.innerHTML = '';
    panelMetricas.innerHTML = '';
    inputObjetivo.value = '';

    // Creamos un nuevo "control remoto" para esta petición específica que está por salir.
    controladorPeticion = new AbortController();

    
    // 5 EL DISPARO A LA RED (EL FETCH)
    
    try {
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
            return;
        }
        
        // 6 IMPACTO EN EL TABLERO (Resultados exitosos)
        panelVista.innerHTML = `<span style="color: var(--color-terminal)">${datos.mensaje}</span>`;
        panelTech.innerHTML = `<span style="color: var(--color-terminal)">Objetivo en servidor: ${datos.objetivo}</span>`;

        // PAUSA TÁCTICA: Congela el código 600 milisegundos (0.6 seg) para dar sensación de procesamiento.
        await new Promise(resolve => setTimeout(resolve, 600));

        // PANEL 1 (VISTA): PROTECCIÓN DE DESBORDAMIENTO (OVERFLOW VISUAL)
        // Si el título tiene más de 50 letras, lo corta en la letra 47 y le pone "...". Si no, lo deja igual.
        const tituloRecortado = datos.identidad.titulo.length > 50 ? datos.identidad.titulo.substring(0, 47) + '...' : datos.identidad.titulo;
        // Hace lo mismo con la descripción, pero el límite son 80 letras.
        const descripcionRecortada = datos.identidad.descripcion.length > 80 ? datos.identidad.descripcion.substring(0, 77) + '...' : datos.identidad.descripcion;
        
        // Inyecta el título y descripción formateados en HTML.
        panelVista.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>TÍTULO: <span style="color: var(--color-terminal)">${tituloRecortado}</span></li><li style="margin-top: 5px;">DESCRIPCIÓN: <span style="color: var(--color-terminal)">${descripcionRecortada}</span></li></ul>`;
        
        // Otra pausa de 300ms antes de mostrar el siguiente panel.
        await new Promise(resolve => setTimeout(resolve, 300));

        // PANEL 2 (TECH): Muestra los datos de tecnología que enviará el nuevo backend.
        panelTech.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>SERVIDOR: <span style="color: var(--color-terminal)">${datos.tecnologias.servidor}</span></li><li>LENGUAJE: <span style="color: var(--color-terminal)">${datos.tecnologias.lenguaje}</span></li><li>FRONTEND: <span style="color: var(--color-terminal)">${datos.tecnologias.frameworkFront}</span></li></ul>`;
        
        // Última pausa de 300ms.
        await new Promise(resolve => setTimeout(resolve, 300));

        // PANEL 3 (ENLACES) (Inyección temporal táctica)
        // Como el Robot 1.1 aún no extrae el arreglo de enlaces internos, 
        // dejamos la URL anclada y un aviso visual.
        panelEnlaces.innerHTML = `
        <ul style="list-style: none; padding: 0; margin: 0;">
            <li>RUTAS BASE: <span style="color: var(--color-terminal)">${urlIngresada}</span></li>
            <li style="margin-top: 10px; color: var(--color-alerta)">[MÓDULO DE MAPEO ITERATIVO: OFFLINE]</li>
            <li style="color: var(--color-alerta)">[ESPERANDO ACTUALIZACIÓN DEL ROBOT...]</li>
        </ul>`;

        // PANEL 4 (METRICAS) EVALUACIÓN LÓGICA EN CLIENTE
        // Si el booleano 'certSslVigente' es true, guarda el texto verde. Si es false, texto de alerta.
        const estadoSsl = datos.metricas.certSslVigente ? "Seguro (Activo)" : "Vulnerable (Caído)";
        
        // Inyecta las métricas finales.
        panelMetricas.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>LATENCIA: <span style="color: var(--color-terminal)">${datos.metricas.tiempoRespuestaMs}ms</span></li><li>PESO TOTAL: <span style="color: var(--color-terminal)">${datos.metricas.pesoDocumentoKb} KB</span></li><li>ESTADO SSL: <span style="color: var(--color-terminal)">${estadoSsl}</span></li></ul>`;

        reproducirSonidoVictoria(); // Sonido de éxito: los 4 paneles ya se llenaron con datos reales
        botonAbortar.style.display = 'none'; // Oculta el botón tras el éxito

    
    // 8 GESTIÓN DE EXCEPCIONES Y ABORTOS
    
    } catch (error) {
        if (error.name === 'AbortError') {
            // Le agregué "cursor: pointer;" para que el mouse se ponga con la manito y el usuario sepa que puede clickearlo
            panelVista.innerHTML = `<span style="color: var(--color-alerta); cursor: pointer;" title="Clic para limpiar">[OPERACIÓN CANCELADA POR EL OPERADOR]</span>`;
        } else {
            panelVista.innerHTML = `<span style="color: var(--color-alerta); cursor: pointer;" title="Clic para limpiar">[FALLO DE CONEXIÓN CON BÚNKER CENTRAL]</span>`;
            console.error(error); 
            reproducirSonidoDerrota(); 
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
// Permite al usuario elegir el color de toda la interfaz a su gusto

const selectorColor = document.getElementById('color-picker');

// Convierte un color hexadecimal (ej: "#00ff41") en sus 3 componentes
// numéricos R, G, B separados por comas (ej: "0, 255, 65").
// Esto es lo que necesitan las sombras en rgba() para poder agregarles transparencia.
function hexARgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

// Aplica un color nuevo a toda la web, actualizando las variables CSS globales.
function aplicarColorTema(hex) {
    // Cambia el color base. Como el resto del CSS (bordes, texto, sombras) 
    // está armado con var(--color-terminal), todo se actualiza solo, en vivo.
    document.documentElement.style.setProperty('--color-terminal', hex);
    
    // Cambia también la version "RGB suelta", que es la que usan las sombras con transparencia.
    document.documentElement.style.setProperty('--color-terminal-rgb', hexARgb(hex));

    // Avisa a la lluvia Matrix de fondo que tiene que repintarse con el color nuevo.
    if (window.actualizarColorMatrix) {
        window.actualizarColorMatrix();
    }

    // Guarda la elección en el navegador, para que la próxima vez que el 
    // usuario entre a la página, se mantenga el color que eligió.
    localStorage.setItem('colorTema', hex);
}

// Si el usuario ya había elegido un color en una visita anterior, lo recuperamos al cargar la página.
const colorGuardado = localStorage.getItem('colorTema');
if (colorGuardado) {
    aplicarColorTema(colorGuardado);
    selectorColor.value = colorGuardado; // Sincroniza el cuadradito de color con el valor guardado
}

// Cada vez que el usuario mueve el selector y elige un color nuevo, lo aplicamos al instante.
selectorColor.addEventListener('input', (evento) => {
    aplicarColorTema(evento.target.value);
});
