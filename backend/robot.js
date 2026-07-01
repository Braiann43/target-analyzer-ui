// Importamos la librería de parseo rápido para estructurar el HTML estático en memoria
const cheerio = require('cheerio');
// Importamos el motor de automatización para controlar el navegador en segundo plano
const puppeteer = require('puppeteer');

// Definimos la función principal asincrónica que recibe la URL a escanear.
// El segundo parámetro (timeoutMs) le pone un techo duro a cuánto puede tardar
// Puppeteer navegando: si el sitio objetivo es muy lento (o directamente no
// contesta), Chrome tira su propio error de timeout ANTES de quedarse colgado
// para siempre, y el catch de acá abajo se encarga de cerrarlo prolijamente.
async function ejecutarExtraccion(urlObjetivo, timeoutMs = 20000) {
    // Inicializamos la variable del navegador fuera del try para poder cerrarla en el catch
    let navegador;
    try {
        // Lanzamos el binario aislado de Chrome sin la interfaz gráfica por rendimiento
        navegador = await puppeteer.launch({ headless: 'shell' });
        // Abrimos una pestaña limpia en el motor de renderizado
        const pagina = await navegador.newPage();
        // Le aplicamos el mismo techo de tiempo a CUALQUIER navegación que hagamos
        // en esta pestaña (goto, waitForNavigation, etc.), no solo a la primera
        pagina.setDefaultNavigationTimeout(timeoutMs);
        // Registramos la marca de tiempo inicial para calcular la latencia posterior
        const tiempoInicio = Date.now();

        // Navegamos esperando a que el tráfico de red se estabilice
        const respuestaRed = await pagina.goto(urlObjetivo, { waitUntil: 'networkidle2' });
        // Extraemos la fotografía estática del DOM ya renderizado por el motor V8
        const codigoHtml = await pagina.content();

        // Calculamos el tiempo total del proceso de carga en milisegundos METRICAS
        const tiempoRespuestaMs = Date.now() - tiempoInicio;
        // Verificamos si la conexión HTTPS es válida interceptando la respuesta de red
        const certSslVigente = respuestaRed.securityDetails() !== null;
        // Medimos el peso del documento HTML capturado en kilobytes
        const pesoDocumentoKb = (Buffer.byteLength(codigoHtml, 'utf8') / 1024).toFixed(2);

        // Cheerio carga el HTML en memoria para buscar tecnologías
        const $ = cheerio.load(codigoHtml);
        // Rastreamos y limpiamos la etiqueta de título de la cabecera
        const tituloPagina = $('title').text().trim() || 'Sin título';
        // Aislamos el atributo content del metadato de descripción
        const descripcionPagina = $('meta[name="description"]').attr('content') || 'Sin descripción';

        // Detección de framework por la existencia estructural de nodos característicos
        let frameworkFront = 'Desconocido';
        if ($('[data-reactroot], #root').length > 0) frameworkFront = 'React';
        else if ($('[data-v-app], #app').length > 0) frameworkFront = 'Vue';
        else if ($('[ng-version], ng-app').length > 0) frameworkFront = 'Angular';

        // Detección de CMS/lenguaje vía el metadato generator (normalizado a minúsculas)
        let lenguaje = 'HTML Estático / Desconocido';
        if ($('meta[name="generator"]').attr('content')?.toLowerCase().includes('wordpress')) {
            lenguaje = 'PHP (WordPress)';
        }

        // Interceptamos las cabeceras de red para identificar el servidor que aloja el sitio
        const servidor = respuestaRed.headers()['server'] || 'Oculto';

        // Apagamos la instancia de Chrome para liberar la memoria RAM del equipo
        await navegador.close();

        // Ensamblamos y retornamos el objeto JSON con las tres capas de datos tácticos
        return {
            identidad: {
                titulo: tituloPagina,
                descripcion: descripcionPagina
            },
            tecnologias: {
                servidor: servidor,
                lenguaje: lenguaje,
                frameworkFront: frameworkFront
            },
            metricas: {
                tiempoRespuestaMs: tiempoRespuestaMs,
                pesoDocumentoKb: pesoDocumentoKb,
                certSslVigente: certSslVigente
            }
        };
    } catch (error) {
        // Garantizamos que el proceso de Chrome no quede huérfano consumiendo RAM
        if (navegador) {
            await navegador.close();
        }
        // Si el error viene del techo de tiempo que le pusimos arriba (setDefaultNavigationTimeout),
        // Puppeteer lo marca con name === 'TimeoutError'. Lo distinguimos para que server.js
        // pueda devolverle al frontend un 504 (tiempo agotado) en vez de un 502 genérico.
        if (error.name === 'TimeoutError') {
            throw new Error('TIEMPO_DE_ESPERA_AGOTADO');
        }
        // Cualquier otro fallo (DNS que no resuelve, certificado roto, sitio caído, etc.)
        // Disparamos la alerta de fallo hacia el servidor receptor deteniendo la ejecución
        throw new Error('Falla en la intercepción de datos. Objetivo inalcanzable.');
    }
}

// Exponemos la función de forma modular para que server.js pueda requerirla
module.exports = ejecutarExtraccion;