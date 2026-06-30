// ==========================================================================
// LLUVIA MATRIX
// Dibuja caracteres random cayendo en columnas, efecto clasico de Matrix
// ==========================================================================

const canvas = document.getElementById('matrix-rain'); // Agarra el canvas del HTML
const ctx = canvas.getContext('2d'); // Pide el "pincel" 2D para poder dibujar

// Hace que el canvas mida exactamente lo mismo que la ventana del navegador
function ajustarTamano() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
ajustarTamano(); // Lo ejecuta una vez al cargar
window.addEventListener('resize', ajustarTamano); // Y cada vez que cambia el tamaño de la ventana

// Caracteres que van a caer (mezcla de katakana, numeros y letras, como el Matrix original)
const caracteres = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const tamanoFuente = 16; // Tamaño de cada caracter en pixeles
const columnas = Math.floor(canvas.width / tamanoFuente); // Cuantas columnas entran en el ancho de pantalla

// Guarda en que "altura" (fila) va cada columna. Arrancan todas en una posicion random arriba
const gotas = Array(columnas).fill(1).map(() => Math.random() * -100);

// Lee el color verde directo de tus variables CSS, para que siempre haga juego
const colorTerminal = getComputedStyle(document.documentElement)
    .getPropertyValue('--color-terminal').trim();

function dibujar() {
    // Dibuja un rectangulo negro semi-transparente encima de todo el canvas
    // Esto es lo que crea el efecto de "estela" que se va desvaneciendo
    ctx.fillStyle = 'rgba(5, 5, 5, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colorTerminal; // Pinta los caracteres del verde neon de la web
    ctx.font = tamanoFuente + 'px monospace'; // Usa fuente monoespaciada, como el resto del sitio

    // Recorre cada columna y dibuja un caracter
    for (let i = 0; i < gotas.length; i++) {
        const caracter = caracteres[Math.floor(Math.random() * caracteres.length)]; // Elige un caracter random
        const x = i * tamanoFuente; // Posicion horizontal segun la columna
        const y = gotas[i] * tamanoFuente; // Posicion vertical segun cuanto cayo esa gota

        ctx.fillText(caracter, x, y); // Dibuja el caracter en pantalla

        // Si la gota ya paso el fondo de la pantalla, la manda de nuevo arriba (con random para que no caigan todas juntas)
        if (y > canvas.height && Math.random() > 0.975) {
            gotas[i] = 0;
        }

        gotas[i]++; // Hace que la gota baje un poco mas en el proximo cuadro
    }
}

setInterval(dibujar, 33); // Ejecuta dibujar() unas 30 veces por segundo (efecto fluido)