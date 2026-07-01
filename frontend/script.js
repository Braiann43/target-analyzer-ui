// agarro donde se pone el link
const inputObjetivo = document.getElementById('target-url');

// el boton verde de play
const botonEscaneo = document.getElementById('btn-scan');

// el boton rojo para cancelar
const botonAbortar = document.getElementById('btn-abortar');

// agarro las cajas de adentro de los 4 paneles para meterles texto despues
const panelVista = document.querySelector('#panel-vista .contenido-panel');
const panelTech = document.querySelector('#panel-tech .contenido-panel');
const panelEnlaces = document.querySelector('#panel-enlaces .contenido-panel');
const panelMetricas = document.querySelector('#panel-metricas .contenido-panel');

// 2 VARIABLES IMPORTANTES

// esta variable arranca vacia. sirve para guardar un control y cancelar si tarda mucho
let controladorPeticion;


// 2.1 SONIDOS (busqué en google cómo hacer que suene sin poner un archivo mp3 pesado)
// esto usa puro codigo para hacer pitidos onda family game

// el coso de los sonidos. google chrome pide que hagas click antes de que suene algo por que si no tira error rojo
let audioCtx;

function obtenerAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
}

// ruidito alegre de cuando carga bien
function reproducirSonidoVictoria() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;
    const notas = [523.25, 659.25, 783.99, 1046.50]; // las notas de musica en numeros raro

    notas.forEach((frecuencia, indice) => {
        const oscilador = ctx.createOscillator(); // hace la onda de sonido
        const volumen = ctx.createGain(); // esto seria como la perilla del volumen

        oscilador.type = 'square'; // cuadrado para que suene retro
        oscilador.frequency.value = frecuencia;

        const inicio = ahora + indice * 0.09; // para que no suenen todas de golpe al mismo tiempo
        // le sube y baja el volumen re rapido para que no sature ni haga un click feo
        volumen.gain.setValueAtTime(0.0001, inicio);
        volumen.gain.exponentialRampToValueAtTime(0.15, inicio + 0.02);
        volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.18);

        oscilador.connect(volumen).connect(ctx.destination); // lo manda al parlante
        oscilador.start(inicio);
        oscilador.stop(inicio + 0.18);
    });
}

// ruido feo de cuando algo sale mal y tira error
function reproducirSonidoDerrota() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'sawtooth'; // suena mas aspero, como una alarma chota
    oscilador.frequency.setValueAtTime(220, ahora); // arranca normal
    oscilador.frequency.exponentialRampToValueAtTime(80, ahora + 0.4); // y baja de golpe

    volumen.gain.setValueAtTime(0.15, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.4);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.4);
}

// pitido chiquito de que arranco a escanear
function reproducirSonidoInicioEscaneo() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'square'; 
    oscilador.frequency.setValueAtTime(660, ahora); // agudo
    oscilador.frequency.exponentialRampToValueAtTime(880, ahora + 0.08); // sube apenitas

    volumen.gain.setValueAtTime(0.0001, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.12, ahora + 0.01);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.1);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.1);
}

// ruidito tipo apagando la luz, para cuando cancelas con el boton rojo
function reproducirSonidoAbortar() {
    const ctx = obtenerAudioCtx();
    const ahora = ctx.currentTime;

    const oscilador = ctx.createOscillator();
    const volumen = ctx.createGain();

    oscilador.type = 'triangle'; // triangulo suena mas suavecito
    oscilador.frequency.setValueAtTime(500, ahora);
    oscilador.frequency.exponentialRampToValueAtTime(120, ahora + 0.22); // baja re rapido 

    volumen.gain.setValueAtTime(0.14, ahora);
    volumen.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.22);

    oscilador.connect(volumen).connect(ctx.destination);
    oscilador.start(ahora);
    oscilador.stop(ahora + 0.22);
}


// 3 ESTOS SON LOS EVENTOS (cuando haces click en las cosas)

// cuando le dan click al boton verde, llama a la funcion asyncrona de abajo de todo
botonEscaneo.addEventListener('click', iniciarOperacion);

// si tocan el rojo...
botonAbortar.addEventListener('click', () => {
    // me fijo si la compu esta cargando algo
    if (controladorPeticion) {
        reproducirSonidoAbortar(); // ruidito de cancelar
        controladorPeticion.abort(); // esto corta el fetch de cuajo segun stackoverflow
    }
});


// 4 DONDE PASA TODO

// le pongo async para usar await y no usar los .then()
async function iniciarOperacion() {
    
    reproducirSonidoInicioEscaneo(); // pip de arranque

    // muestro el boton rojo escondido
    botonAbortar.style.display = 'block';

    // 2. BORRO EL TEXTO ESE DE "ESPERANDO OBJETIVO"
    panelVista.classList.remove('esperando');
    panelTech.classList.remove('esperando');
    panelEnlaces.classList.remove('esperando');
    panelMetricas.classList.remove('esperando');

    // si usuario spamea el click verde, mato la busqueda anterior para no romper la compu
    if (controladorPeticion) {
        controladorPeticion.abort();
    }

    // saco el link y le borro los espacios de adelante y atras por las dudas
    let urlIngresada = inputObjetivo.value.trim();

    // le meto el https para que no llore el backend si se olvidaron de ponerlo
    if (!urlIngresada.startsWith('http://') && !urlIngresada.startsWith('https://')) {
        urlIngresada = 'https://' + urlIngresada;
    }

    // PRUEBA DE FUEGO DEL LINK
    try {
        // me fijo si es un link de verdad. si no, el try explota y se va llorando al catch
        new URL(urlIngresada);
    } catch (error) {
        // si pone cualquier pavada, tiro un error naranja
        panelVista.innerHTML = `<span style="color: var(--color-alerta)">[ERROR: QUE PUSISTE MAESTRO?]</span>`;
        panelTech.innerHTML = '';
        panelMetricas.innerHTML = '';
        panelEnlaces.innerHTML = '';

        panelTech.classList.add('esperando');
        panelEnlaces.classList.add('esperando');
        panelMetricas.classList.add('esperando');
        
        botonAbortar.style.display = 'none'; // escondo el boton rojo de nuevo
        reproducirSonidoDerrota(); // ruidito de derrota

        // un truquito: si toca el error naranja con el mouse, se limpia y vuelve todo a la normalidad
        panelVista.querySelector('span').addEventListener('click', () => {
            panelVista.innerHTML = '';
            panelVista.classList.add('esperando'); 
            inputObjetivo.value = '';
            inputObjetivo.focus();
        });
        return; // corto aca para que no siga cargando al pedo
    
    }

    // 4 PREPARANDO LA INTERFAZ
    panelVista.innerHTML = '<span style="color: var(--color-terminal)">[CONECTANDO SONDAS...]</span>';
    panelTech.innerHTML = '';
    panelEnlaces.innerHTML = '';
    panelMetricas.innerHTML = '';
    inputObjetivo.value = '';

    // armo el control remoto para poder cancelar este fetch nuevo
    controladorPeticion = new AbortController();

    
    // 5 CONECTANDO CON EL BACKEND 
    
    try {
        await new Promise(resolve => setTimeout(resolve, 400)); // freno un toque para que se vea el [CONECTANDO...]
        const respuesta = await fetch('http://localhost:3000/api/escanear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: urlIngresada }),
            // le ato el control remoto a este envio asi puedo cancelarlo
            signal: controladorPeticion.signal 
        });

        // paso lo que me devuelve de texto a un objeto que yo pueda leer
        const datos = await respuesta.json();

        // CONTROL DE ERRORES DEL SERVIDOR
        // si sale algo mal (onda si el servidor explota con error 400 o 500)
        if (!respuesta.ok) {
            // muestro en el primer panel lo que me devolvio mal y corto la cosa
            panelVista.innerHTML = `<span style="color: var(--color-alerta)">[ERROR: ${datos.error}]</span>`;
            panelTech.innerHTML = '';
            panelMetricas.innerHTML = '';
            panelEnlaces.innerHTML = '';

            // vuelvo a poner la clase esperando a los otros paneles
            panelTech.classList.add('esperando');
            panelEnlaces.classList.add('esperando');
            panelMetricas.classList.add('esperando');
            
            botonAbortar.style.display = 'none';
            reproducirSonidoDerrota();  // sonido de derrota
            return;
        }
        
        // 6 METIENDO LOS DATOS EN LOS PANELES
        panelVista.innerHTML = `<span style="color: var(--color-terminal)">${datos.mensaje}</span>`;
        panelTech.innerHTML = `<span style="color: var(--color-terminal)">Objetivo en servidor: ${datos.objetivo}</span>`;

        // lo freno 0.6 segundos para que parezca que esta tardando para darle suspenso
        await new Promise(resolve => setTimeout(resolve, 600));

        // PANEL 1: CUIDADO CON LOS TEXTOS LARGOS QUE ROMPEN TODO
        // si el titulo tiene mas de 50 letras lo corto con "..." porque si no se rompe la cajita
        const tituloRecortado = datos.identidad.titulo.length > 50 ? datos.identidad.titulo.substring(0, 47) + '...' : datos.identidad.titulo;
        // lo mismo pero con 80 letras para la descripcion
        const descripcionRecortada = datos.identidad.descripcion.length > 80 ? datos.identidad.descripcion.substring(0, 77) + '...' : datos.identidad.descripcion;
        
        // meto los datos
        panelVista.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>TÍTULO: <span style="color: var(--color-terminal)">${tituloRecortado}</span></li><li style="margin-top: 5px;">DESCRIPCIÓN: <span style="color: var(--color-terminal)">${descripcionRecortada}</span></li></ul>`;
        
        // freno 300ms de vuelta para mas placer visual
        await new Promise(resolve => setTimeout(resolve, 300));

        // PANEL 2: Cosas del nodejs
        panelTech.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>SERVIDOR: <span style="color: var(--color-terminal)">${datos.tecnologias.servidor}</span></li><li>LENGUAJE: <span style="color: var(--color-terminal)">${datos.tecnologias.lenguaje}</span></li><li>FRONTEND: <span style="color: var(--color-terminal)">${datos.tecnologias.frameworkFront}</span></li></ul>`;
        
        // ultima pausa
        await new Promise(resolve => setTimeout(resolve, 300));

        // PANEL 3: LOS LINKS QUE TODAVIA NO ANDAN
        // aca iban los links pero todavia tenemos, asi que dejo un texto de alerta falso xd
        panelEnlaces.innerHTML = `
        <ul style="list-style: none; padding: 0; margin: 0;">
            <li>RUTAS BASE: <span style="color: var(--color-terminal)">${urlIngresada}</span></li>
            <li style="margin-top: 10px; color: var(--color-alerta)">[MÓDULO DE MAPEO ITERATIVO: OFFLINE]</li>
            <li style="color: var(--color-alerta)">[ESPERANDO ACTUALIZACIÓN DEL ROBOT...]</li>
        </ul>`;

        // PANEL 4: METRICAS Y COSAS RARAS
        // un if abreviado. si es true pongo seguro, si es false vulnerable
        const estadoSsl = datos.metricas.certSslVigente ? "Seguro (Activo)" : "Vulnerable (Caído)";
        
        // meto todo al panel
        panelMetricas.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>LATENCIA: <span style="color: var(--color-terminal)">${datos.metricas.tiempoRespuestaMs}ms</span></li><li>PESO TOTAL: <span style="color: var(--color-terminal)">${datos.metricas.pesoDocumentoKb} KB</span></li><li>ESTADO SSL: <span style="color: var(--color-terminal)">${estadoSsl}</span></li></ul>`;

        registrarEnHistorial(urlIngresada, datos);

        reproducirSonidoVictoria(); // ganamos
        botonAbortar.style.display = 'none'; // escondo el boton rojo porque ya termino

    
    // 8 SI EXPLOTA TODO POR EL CAMINO O CANCELAMOS
    
    } catch (error) {
        if (error.name === 'AbortError') {
            // aca si cancelaste a proposito. le meti cursor: pointer para que le aparezca la manito y sepan que se puede clickear
            panelVista.innerHTML = `<span style="color: var(--color-alerta); cursor: pointer; display: block; padding: 10px;" title="Clic para limpiar">[CANCELADO POR EL USUARIO]</span>`;
        } else {
            // aca si fallo el servidor local o se cayo internet
            panelVista.innerHTML = `<span style="color: var(--color-alerta); cursor: pointer;" title="Clic para limpiar">[ERROR RARO: FIJATE LA CONSOLA (F12)]</span>`;
            console.error(error); 
            reproducirSonidoDerrota(); 
        }
        
        // limpio la mugre de los otros paneles por las dudas
        panelTech.innerHTML = '';
        panelEnlaces.innerHTML = '';
        panelMetricas.innerHTML = '';
        
        // les vuelvo a poner la barrita titilante
        panelTech.classList.add('esperando');
        panelEnlaces.classList.add('esperando');
        panelMetricas.classList.add('esperando');
        
        botonAbortar.style.display = 'none'; // escondo el rojo

        // esto es igual al de arriba, si tocas el error se limpia magicamente
        panelVista.querySelector('span').addEventListener('click', () => {
            panelVista.innerHTML = '';
            panelVista.classList.add('esperando'); 
            inputObjetivo.value = '';
            inputObjetivo.focus();
        });
    }
} // <-- aca termina la funcion gigante


// 9 ESTO SON LOS PANELES QUE SE HACEN GRANDES Y CHICOS
// si tocas un panel, se hace gigante y manda a los demas abajo chiquitos

// busco todos los paneles juntos en el html
const paneles = document.querySelectorAll('.panel-bunker');
const grilla = document.querySelector('.paneles-grid');

paneles.forEach(panel => {
    panel.addEventListener('click', () => {
        
        // si el panel al que le diste click ya era grandote, rompo la ilusion y vuelvo al principio
        if (panel.classList.contains('panel-expandido')) {
            grilla.classList.remove('modo-foco');
            paneles.forEach(p => p.classList.remove('panel-expandido', 'panel-minimizado'));
            return; // corto aca nomas
        }

        // si no, activo el css de modo foco para que pase la magia
        grilla.classList.add('modo-foco');

        paneles.forEach(p => {
            if (p === panel) {
                // al que le diste click lo hago gigante con esta clase
                p.classList.add('panel-expandido');
                p.classList.remove('panel-minimizado');
            } else {
                // a los otros infelices los achico y los mando al fondo
                p.classList.add('panel-minimizado');
                p.classList.remove('panel-expandido');
            }
        });
    });
});


// 10 CAMBIAR EL COLORCITO DEL TEMA
// agarro el input de colores que meti adentro del menu lateral
const selectorColor = document.getElementById('color-picker-menu');

// esta funcion pasa de modo #123456 a modo 12, 34, 56 para el rgb. me re costo entenderla pero funciona de diez
function hexARgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

// esto sobreescribe la variable del css a lo loco y cambia todo en vivo
function aplicarColorTema(hex) {
    document.documentElement.style.setProperty('--color-terminal', hex);
    document.documentElement.style.setProperty('--color-terminal-rgb', hexARgb(hex));

    if (window.actualizarColorMatrix) {
        window.actualizarColorMatrix(); // actualizo las letritas del matrix tambien
    }
    localStorage.setItem('colorTema', hex); // lo guardo en la compu para que no se borre si recargas la pagina
}

// me fijo si ya tenias un color guardado de antes cuando entraste la ultima vez
const colorGuardado = localStorage.getItem('colorTema');
if (colorGuardado) {
    aplicarColorTema(colorGuardado);
    // meto un if por las dudas que no encuentre el selector y crashee todo
    if (selectorColor) {
        selectorColor.value = colorGuardado; 
    }
}

// aca escucho si andas cambiando el color moviendo el mouse
if (selectorColor) {
    selectorColor.addEventListener('input', (evento) => {
        aplicarColorTema(evento.target.value);
    });
}

// 11 MENU Y GUARDADO DE HISTORIAL (LA MEMORIA PERMANENTE)

const menuLateral = document.getElementById('menu-lateral');
const btnMenu = document.getElementById('btn-menu');
const btnCerrarMenu = document.getElementById('btn-cerrar-menu');
const listaHistorial = document.getElementById('lista-historial');

// saco el historial del localstorage. si esta vacio o roto le clavo un array vacio
let historialEscaneos = JSON.parse(localStorage.getItem('historialBunker')) || []; 

// botones para abrir y cerrar el menu lateral
btnMenu.addEventListener('click', () => {
    menuLateral.classList.add('abierto');
});
btnCerrarMenu.addEventListener('click', () => {
    menuLateral.classList.remove('abierto');
});

// funcion para guardar algo que salio bien y que no se pierda
function registrarEnHistorial(url, datos) {
    // me fijo si ya esta en la lista para no duplicar boludeces
    const yaExiste = historialEscaneos.some(item => item.url === url);
    if (!yaExiste) {
        historialEscaneos.unshift({ url, datos }); 
        // le encajo el historial actualizado al disco duro del navegador
        localStorage.setItem('historialBunker', JSON.stringify(historialEscaneos));
        actualizarVisorHistorial(); // actualizo la lista visual de la izquierda
    }
}

// esto dibuja la lista en el menu
function actualizarVisorHistorial() {
    listaHistorial.innerHTML = ''; // limpio la basura vieja

    // si no escaneaste nada te tiro este texto triste
    if (historialEscaneos.length === 0) {
        listaHistorial.innerHTML = '<li style="color: var(--color-terminal); opacity: 0.5;">[NADAAA TODAVIA]</li>';
        return;
    }

    historialEscaneos.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'item-historial';
        li.innerHTML = `> ${item.url}`;
        
        // si tocas uno del historial, te lo vuelve a cargar como por arte de magia
        li.addEventListener('click', () => {
            menuLateral.classList.remove('abierto'); // escondo menu para q no estorbe
            cargarDatosDesdeMemoria(item.url, item.datos); // llamo a la funcion de inyectar sin gastar internet
        });
        
        listaHistorial.appendChild(li);
    });
}

// pinto el historial ni bien abro la pagina a ver si habia algo
actualizarVisorHistorial();

// esto es como la funcion gigante de arriba de todo pero re facil porque ya tiene los datos en memoria y no le pega a la api
async function cargarDatosDesdeMemoria(urlIngresada, datos) {
    reproducirSonidoInicioEscaneo();
    panelVista.classList.remove('esperando');
    panelTech.classList.remove('esperando');
    panelEnlaces.classList.remove('esperando');
    panelMetricas.classList.remove('esperando');

    panelVista.innerHTML = `<span style="color: var(--color-terminal)">[CARGANDO DATOS VIEJOS...]</span>`;
    panelTech.innerHTML = '';
    panelEnlaces.innerHTML = '';
    panelMetricas.innerHTML = '';
    inputObjetivo.value = urlIngresada; 

    await new Promise(resolve => setTimeout(resolve, 300)); 

    const tituloRecortado = datos.identidad.titulo.length > 50 ? datos.identidad.titulo.substring(0, 47) + '...' : datos.identidad.titulo;
    const descripcionRecortada = datos.identidad.descripcion.length > 80 ? datos.identidad.descripcion.substring(0, 77) + '...' : datos.identidad.descripcion;
    
    panelVista.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>TÍTULO: <span style="color: var(--color-terminal)">${tituloRecortado}</span></li><li style="margin-top: 5px;">DESCRIPCIÓN: <span style="color: var(--color-terminal)">${descripcionRecortada}</span></li></ul>`;
    panelTech.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>SERVIDOR: <span style="color: var(--color-terminal)">${datos.tecnologias.servidor}</span></li><li>LENGUAJE: <span style="color: var(--color-terminal)">${datos.tecnologias.lenguaje}</span></li><li>FRONTEND: <span style="color: var(--color-terminal)">${datos.tecnologias.frameworkFront}</span></li></ul>`;
    panelEnlaces.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>RUTAS BASE: <span style="color: var(--color-terminal)">${urlIngresada}</span></li><li style="margin-top: 10px; color: var(--color-alerta)">[MÓDULO DE MAPEO ITERATIVO: OFFLINE]</li><li style="color: var(--color-alerta)">[ESPERANDO ACTUALIZACIÓN DEL ROBOT...]</li></ul>`;
    
    const estadoSsl = datos.metricas.certSslVigente ? "Seguro (Activo)" : "Vulnerable (Caído)";
    panelMetricas.innerHTML = `<ul style="list-style: none; padding: 0; margin: 0;"><li>LATENCIA: <span style="color: var(--color-terminal)">${datos.metricas.tiempoRespuestaMs}ms</span></li><li>PESO TOTAL: <span style="color: var(--color-terminal)">${datos.metricas.pesoDocumentoKb} KB</span></li><li>ESTADO SSL: <span style="color: var(--color-terminal)">${estadoSsl}</span></li></ul>`;

    reproducirSonidoVictoria();
}

//   BARRITA DE CARGA

// 1. agarro la barrita y los textos de porcentaje en el html
const btnScan = document.getElementById('btn-scan');
const btnAbortar = document.getElementById('btn-abortar');
const progressBar = document.getElementById('scan-progress');
const progresoTexto = document.querySelector('.progreso-porcentaje');

// guardo aca el temporizador para poder matarlo despues si el chabon cancela
let intervaloEscaneo;

// 2. cuando le das play, arranco a subir los numeritos de mentira
btnScan.addEventListener('click', () => {
    // mato cualquier carga que haya quedado bugeada de antes
    clearInterval(intervaloEscaneo);
    
    // vuelvo la barrita a cero limpio
    let progresoActual = 0;
    progressBar.value = progresoActual;
    progresoTexto.textContent = '0%';
    progresoTexto.style.color = 'var(--color-terminal)'; // me aseguro que vuelva a ser verde

    // armo el relojito que se ejecuta cada medio segundo casi
    intervaloEscaneo = setInterval(() => {
        // subo el porcentaje un numero random entre 2 y 12 para que parezca que carga de verdad
        let avanceAleatorio = Math.floor(Math.random() * 10) + 2;
        progresoActual += avanceAleatorio;

        // si se pasa de largo lo clavo en 100 y mato el timer
        if (progresoActual >= 100) {
            progresoActual = 100;
            clearInterval(intervaloEscaneo);
            progresoTexto.textContent = '100% [PIOLA]';
            
            // aca le diria a los paneles que muestren todo, pero eso lo puse en la otra funcion gigante arriba
        } else {
            progresoTexto.textContent = progresoActual + '%';
        }

        // pinto la barra de html
        progressBar.value = progresoActual;

    }, 400); 
});

// 3. si te arrepentis, tocas el boton rojo y lo freno en seco
btnAbortar.addEventListener('click', () => {
    // corto el reloj
    clearInterval(intervaloEscaneo);
    
    // le meto un texto boton cancelaron
    progresoTexto.textContent = '[CANCELASTE]';
    progresoTexto.style.color = '#ff3b3b'; // lo pongo en rojito pa que se note
});