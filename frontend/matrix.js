// hace que caigan letritas verdes como en la peli

const canvas = document.getElementById('matrix-rain'); // llamo al canvas del html
const ctx = canvas.getContext('2d'); // el coso 2d para poder pintar

// funcion para que ocupe toda la pantalla
function ajustarTamano() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
ajustarTamano(); // lo arranco de una
window.addEventListener('resize', ajustarTamano); // por si agrandan o achican la ventana

// letras chinas y numeros mezclados para que quede bien
const caracteres = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const tamanoFuente = 16; // el tamaño de la letra
const columnas = Math.floor(canvas.width / tamanoFuente); // calculo cuantas columnas entran

// esto hace que caigan desde arriba, un array lleno de unos y magia de matematicas xd
const gotas = Array(columnas).fill(1).map(() => Math.random() * -100);

// saco el color del css para que quede con el mismo tono de verde
// uso let porque si el usuario le cambia el color en el menu, este tiene que cambiar tambien
let colorTerminal = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-terminal').trim();

// esto lo vi en stackoverflow para refrescar el color en vivo
function actualizarColorMatrix() {
    colorTerminal = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-terminal').trim();
}
window.actualizarColorMatrix = actualizarColorMatrix;

function dibujar() {
    // pinta un cuadrado negro medio transparente arriba de todo para hacer el efecto de estela
    ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colorTerminal; // pinta con mi color verde hacker
    ctx.font = tamanoFuente + 'px monospace'; // la misma fuente fea de terminal

    // un bucle que va dibujando letra por letra
    for (let i = 0; i < gotas.length; i++) {
        const caracter = caracteres[Math.floor(Math.random() * caracteres.length)]; // saca letra al azar
        const x = i * tamanoFuente; // donde lo pone a lo ancho
        const y = gotas[i] * tamanoFuente; // donde lo pone a lo alto

        ctx.fillText(caracter, x, y); // lo imprime en la pantalla

        // si ya se paso del limite de abajo de la pantalla, lo vuelve a mandar para arriba
        if (y > canvas.height && Math.random() > 0.975) {
            gotas[i] = 0;
        }

        gotas[i]++; // le suma 1 para que vaya cayendo despacito
    }
}

setInterval(dibujar, 33); // lo repite cada 33 milisegundos para que quede fluido