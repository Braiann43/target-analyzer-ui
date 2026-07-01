// Dibuja la lluvia de letritas tipo Matrix para que quede facherito

const canvas = document.getElementById('matrix-rain'); // buscamos el lugar donde dibujar en la página
const ctx = canvas.getContext('2d'); // le decimos que vamos a dibujar en 2D

// esta función hace que la lluvia ocupe toda la pantalla, no importa si la achicás
function ajustarTamano() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
ajustarTamano(); // la corremos apenas abre
window.addEventListener('resize', ajustarTamano); // y le decimos que la vuelva a correr si cambian el tamaño de la ventana

// las letras raras que van cayendo, mezclamos números y letras chinas para que sea igual a la peli
const caracteres = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const tamanoFuente = 16; // el tamaño de las letras
const columnas = Math.floor(canvas.width / tamanoFuente); // calculamos cuántas filas de letras entran en la pantalla

// acá guardamos por dónde va cayendo cada filita de letras, empiezan todas arriba a distintas alturas
const gotas = Array(columnas).fill(1).map(() => Math.random() * -100);

// nos robamos el color verde que pusimos en el CSS así todo combina
let colorTerminal = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-terminal').trim();

// por si cambiamos el color desde el menú, hacemos que la lluvia también cambie de color al toque
function actualizarColorMatrix() {
    colorTerminal = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-terminal').trim();
}
window.actualizarColorMatrix = actualizarColorMatrix;

function dibujar() {
    // ponemos un cuadradito negro medio transparente encima de todo para que las letras dejen como un fantasmita cuando caen
    ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colorTerminal; // pintamos las letras
    ctx.font = tamanoFuente + 'px monospace'; // les ponemos letra de máquina de escribir

    // pasamos por cada columna dibujando una letrita
    for (let i = 0; i < gotas.length; i++) {
        const caracter = caracteres[Math.floor(Math.random() * caracteres.length)]; // agarramos una letra cualquiera
        const x = i * tamanoFuente; // nos fijamos en qué posición va de izquierda a derecha
        const y = gotas[i] * tamanoFuente; // nos fijamos qué tan abajo cayó

        ctx.fillText(caracter, x, y); // la dibujamos!

        // si la letra ya se cayó de la pantalla, la volvemos a mandar para arriba para que siga lloviendo
        if (y > canvas.height && Math.random() > 0.975) {
            gotas[i] = 0;
        }

        gotas[i]++; // le sumamos uno para que baje un poquito más en la próxima vuelta
    }
}

setInterval(dibujar, 33); // hacemos que la función corra rapidísimo (unas 30 veces por segundo) para que se mueva fluido