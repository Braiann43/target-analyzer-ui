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


// 3 ESCUCHADORES DE EVENTOS (LOS GATILLOS)

// Cuando se hace clic en el botón de escaneo, dispara la función 'iniciarOperacion'.
botonEscaneo.addEventListener('click', iniciarOperacion);

// Cuando se hace clic en el botón de abortar...
botonAbortar.addEventListener('click', () => {
    // Verifica si hay una petición viva viajando por la red en este momento.
    if (controladorPeticion) {
        controladorPeticion.abort(); // Si la hay, presiona el "botón de autodestrucción" del Fetch.
    }
});


// 4 EL NÚCLEO DE LA OPERACIÓN (FUNCIÓN PRINCIPAL)

// 'async' avisa que esta función tendrá pausas internas esperando a la red.
async function iniciarOperacion() {
    
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
        panelMetricas.innerHTML = '';

        // Sensor para limpiar al hacer clic sobre el mensaje de error y volver a enfocar el input.
        panelVista.querySelector('span').addEventListener('click', () => {
            panelVista.innerHTML = '';
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

    
    // 8 GESTIÓN DE EXCEPCIONES Y ABORTOS
    
    } catch (error) {
        // Si el error ocurrió porque nosotros tocamos el botón "Abortar"...
        if (error.name === 'AbortError') {
            panelVista.innerHTML = `<span style="color: var(--color-alerta)">[OPERACIÓN CANCELADA POR EL OPERADOR]</span>`;
        } else {
            // Si el error es real (ej: el backend está apagado o no hay internet).
            panelVista.innerHTML = `<span style="color: var(--color-alerta)">[FALLO DE CONEXIÓN CON BÚNKER CENTRAL]</span>`;
            console.error(error); // Guarda el error feo en la consola oculta para el programador.
        }
        // Ante un fallo, asegura que los demás paneles queden limpios.
        panelTech.innerHTML = '';
        panelMetricas.innerHTML = '';
    }
}


// 9 MODO FOCO (estilo llamada de Discord)
// Al hacer clic en un panel, ese se agranda y los otros 3 se minimizan abajo.

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
