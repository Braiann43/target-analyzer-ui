// Importamos la librería de parseo rápido para estructurar el HTML estático en memoria
const cheerio = require('cheerio');
// Importamos el motor de automatización para controlar el navegador en segundo plano
const puppeteer = require('puppeteer');

// Tamaño fijo de la "ventana" virtual del Chrome headless. Lo dejamos constante
// así las capturas de pantalla salen siempre parejas, no importa qué máquina corra esto.
const VIEWPORT = { width: 1280, height: 800 };

// Techo de cuántas capturas sacamos como máximo por sitio. Si nos vamos a un
// sitio con scroll infinito (tipo un feed de noticias) esto evita que nos
// quedemos sacando fotos para siempre y reventemos el JSON de respuesta.
const MAX_CAPTURAS = 6;

// Techo de cuántos enlaces devolvemos en la lista final. El conteo TOTAL real
// (internos + externos) siempre es preciso, esto es solo para no mandarle al
// frontend un JSON con 5000 links adentro.
const MAX_ENLACES_DEVUELTOS = 300;

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
        // Le clavamos un tamaño de pantalla fijo ANTES de navegar, así el sitio
        // renderiza responsive desde el arranque y las capturas salen todas parejas
        await pagina.setViewport(VIEWPORT);
        // Le aplicamos el mismo techo de tiempo a CUALQUIER navegación que hagamos
        // en esta pestaña (goto, waitForNavigation, etc.), no solo a la primera
        pagina.setDefaultNavigationTimeout(timeoutMs);
        // Registramos la marca de tiempo inicial para calcular la latencia posterior
        const tiempoInicio = Date.now();

        // Navegamos esperando a que el tráfico de red se estabilice
        const respuestaRed = await pagina.goto(urlObjetivo, { waitUntil: 'networkidle2' });
        // Extraemos la fotografía estática del DOM ya renderizado por el motor V8
        const codigoHtml = await pagina.content();

        // Calculamos el tiempo total del proceso de carga en milisegundos
        const tiempoRespuestaMs = Date.now() - tiempoInicio;
        // Verificamos si la conexión HTTPS es válida interceptando la respuesta de red
        const certSslVigente = respuestaRed.securityDetails() !== null;
        // Medimos el peso del documento HTML capturado en kilobytes
        const pesoDocumentoKb = (Buffer.byteLength(codigoHtml, 'utf8') / 1024).toFixed(2);
        // Interceptamos las cabeceras de red: nos sirven para identificar servidor y backend
        const cabeceras = respuestaRed.headers();

        // ------------------------------------------------------------------
        // PANEL 1 [VISTA]: en vez de mandar título/descripción como antes,
        // ahora vamos bajando de a "pantallazos" (del alto del viewport) y
        // sacamos una captura JPEG por cada uno, hasta cubrir toda la altura
        // real de la página o hasta pegar en el techo de MAX_CAPTURAS.
        // ------------------------------------------------------------------
        const alturaTotalPx = await pagina.evaluate(() => document.documentElement.scrollHeight);
        const capturasNecesarias = Math.max(1, Math.ceil(alturaTotalPx / VIEWPORT.height));
        const capturasATomar = Math.min(capturasNecesarias, MAX_CAPTURAS);

        const capturas = [];
        for (let i = 0; i < capturasATomar; i++) {
            const posicionScroll = i * VIEWPORT.height;
            // Bajamos la página a pura fuerza bruta con JS hasta la franja exacta que queremos fotografiar
            await pagina.evaluate((y) => window.scrollTo(0, y), posicionScroll);
            // Le damos un respiro cortito para que terminen animaciones o imágenes con lazy-load antes de la foto
            await new Promise((resolve) => setTimeout(resolve, 350));
            // Sacamos la captura en JPEG (mucho más liviano que PNG) y la pedimos directo en base64
            const capturaBase64 = await pagina.screenshot({ type: 'jpeg', quality: 65, encoding: 'base64' });
            capturas.push(`data:image/jpeg;base64,${capturaBase64}`);
        }

        // Cheerio carga el HTML ya renderizado en memoria para buscar título, enlaces y pistas de tecnologías
        const $ = cheerio.load(codigoHtml);
        // Rastreamos y limpiamos la etiqueta de título de la cabecera
        const tituloPagina = $('title').text().trim() || 'Sin título';
        // Aislamos el atributo content del metadato de descripción
        const descripcionPagina = $('meta[name="description"]').attr('content') || 'Sin descripción';

        // ------------------------------------------------------------------
        // PANEL 3 [ENLACES]: recorremos TODOS los <a href> del HTML ya
        // renderizado, los normalizamos a URL absoluta (por si venían
        // relativos tipo "/contacto" o "../precios") y los separamos en
        // internos (mismo dominio) vs externos.
        // ------------------------------------------------------------------
        const hostnameObjetivo = new URL(urlObjetivo).hostname;
        const enlacesUnicos = new Set();

        $('a[href]').each((_, elemento) => {
            const hrefCrudo = ($(elemento).attr('href') || '').trim();
            // Descartamos anclas internas (#seccion) y links que no llevan a ningún lado navegable
            if (!hrefCrudo || hrefCrudo.startsWith('#')) return;
            const hrefMinuscula = hrefCrudo.toLowerCase();
            if (hrefMinuscula.startsWith('javascript:') || hrefMinuscula.startsWith('mailto:') || hrefMinuscula.startsWith('tel:')) return;

            try {
                // El segundo parámetro de URL() resuelve rutas relativas usando la URL objetivo como base
                const absoluta = new URL(hrefCrudo, urlObjetivo).toString();
                enlacesUnicos.add(absoluta);
            } catch (errorUrl) {
                // Si vino un href roto o malformado, lo salteamos sin cortar todo el escaneo
            }
        });

        const listaCompleta = [...enlacesUnicos];
        let contadorInternos = 0;
        let contadorExternos = 0;
        listaCompleta.forEach((enlace) => {
            try {
                if (new URL(enlace).hostname === hostnameObjetivo) contadorInternos++;
                else contadorExternos++;
            } catch (errorUrl) {
                contadorExternos++;
            }
        });

        const enlaces = {
            total: listaCompleta.length,
            internos: contadorInternos,
            externos: contadorExternos,
            lista: listaCompleta.slice(0, MAX_ENLACES_DEVUELTOS),
            truncado: listaCompleta.length > MAX_ENLACES_DEVUELTOS,
        };

        // ------------------------------------------------------------------
        // PANEL 2 [TECNOLOGÍAS]: la versión vieja solo miraba el HTML
        // estático con Cheerio y por eso se perdía frameworks modernos
        // (React 18 ya no deja la marca "data-reactroot", Next.js no
        // siempre usa "#root", etc). Ahora corremos la detección DENTRO
        // del navegador con page.evaluate(), mirando variables globales
        // de verdad (window.React, window.Vue...) que solo existen si esa
        // librería efectivamente se ejecutó en la página.
        // ------------------------------------------------------------------
        const deteccion = await pagina.evaluate(() => {
            const existe = (selector) => document.querySelector(selector) !== null;
            const htmlCompleto = document.documentElement.outerHTML;

            return {
                next: !!(window.__NEXT_DATA__ || existe('#__next')),
                react: !!(window.React || existe('[data-reactroot]') || existe('#root') || htmlCompleto.includes('react-dom')),
                nuxt: !!window.__NUXT__,
                vue: !!(window.Vue || existe('[data-v-app]') || htmlCompleto.includes('data-v-')),
                angular: !!(window.ng || window.getAllAngularRootElements || existe('[ng-version]')),
                svelte: existe('[class*="svelte-"]'),
                gatsby: !!window.___gatsby,
                webflow: existe('html[data-wf-page]'),
                jquery: !!window.jQuery,
                bootstrap: !!(window.bootstrap || existe('link[href*="bootstrap"]')),
                shopify: !!window.Shopify,
                wix: htmlCompleto.includes('wix.com') || !!window.wixBiSession,
            };
        });

        // Detección de framework de frontend, ordenada de lo más específico a lo más genérico
        let frameworkFront = 'Desconocido';
        if (deteccion.next) frameworkFront = 'Next.js (React)';
        else if (deteccion.gatsby) frameworkFront = 'Gatsby (React)';
        else if (deteccion.react) frameworkFront = 'React';
        else if (deteccion.nuxt) frameworkFront = 'Nuxt (Vue)';
        else if (deteccion.vue) frameworkFront = 'Vue';
        else if (deteccion.angular) frameworkFront = 'Angular';
        else if (deteccion.svelte) frameworkFront = 'Svelte';
        else if (deteccion.webflow) frameworkFront = 'Webflow';

        // Librerías/UI kits que pueden convivir arriba de cualquier framework de frontend
        const librerias = [];
        if (deteccion.jquery) librerias.push('jQuery');
        if (deteccion.bootstrap) librerias.push('Bootstrap');

        // Detección de CMS: primero miramos el metadato <meta name="generator">
        // (lo pone la mayoría de los CMS solitos) y si no aparece, recurrimos
        // a pistas de JS que dejan algunas plataformas tipo Shopify o Wix
        const generador = ($('meta[name="generator"]').attr('content') || '').toLowerCase();
        let cms = 'No detectado';
        if (generador.includes('wordpress')) cms = 'WordPress';
        else if (generador.includes('joomla')) cms = 'Joomla';
        else if (generador.includes('drupal')) cms = 'Drupal';
        else if (generador.includes('wix')) cms = 'Wix';
        else if (generador.includes('squarespace')) cms = 'Squarespace';
        else if (generador.includes('shopify')) cms = 'Shopify';
        else if (deteccion.shopify) cms = 'Shopify';
        else if (deteccion.wix) cms = 'Wix';

        // Detección de lenguaje/backend: la cabecera "x-powered-by" es la pista
        // más confiable cuando el servidor la manda (PHP, Express, ASP.NET...).
        // Si no está, inferimos por el CMS detectado o por el framework de front.
        let lenguaje = 'HTML Estático / Desconocido';
        if (cabeceras['x-powered-by']) {
            lenguaje = cabeceras['x-powered-by'];
        } else if (cms === 'WordPress') {
            lenguaje = 'PHP (WordPress)';
        } else if (cms === 'Shopify') {
            lenguaje = 'Ruby (Shopify)';
        } else if (cms === 'Drupal' || cms === 'Joomla') {
            lenguaje = `PHP (${cms})`;
        } else if (deteccion.next || deteccion.gatsby || deteccion.nuxt) {
            lenguaje = 'JavaScript / Node.js (probable)';
        }

        // El servidor que aloja el sitio sale directo de la cabecera de red
        const servidor = cabeceras['server'] || 'Oculto';

        // ------------------------------------------------------------------
        // PANEL 4 [MÉTRICAS]: sumamos conteos reales del HTML (imágenes,
        // scripts, hojas de estilo, palabras, si tiene meta viewport) además
        // de lo que ya teníamos antes (latencia, peso, SSL).
        // ------------------------------------------------------------------
        const cantidadImagenes = $('img').length;
        const cantidadScripts = $('script[src]').length;
        const cantidadHojasEstilo = $('link[rel="stylesheet"]').length;
        const cantidadPalabras = $('body').text().trim().split(/\s+/).filter(Boolean).length;
        const esResponsive = $('meta[name="viewport"]').length > 0;

        // Apagamos la instancia de Chrome para liberar la memoria RAM del equipo
        await navegador.close();

        // Ensamblamos y retornamos el objeto JSON con las cuatro capas de datos tácticos
        return {
            identidad: {
                titulo: tituloPagina,
                descripcion: descripcionPagina,
            },
            vista: {
                capturas,
                alturaTotalPx,
                anchoViewport: VIEWPORT.width,
                altoViewport: VIEWPORT.height,
            },
            tecnologias: {
                servidor,
                lenguaje,
                frameworkFront,
                cms,
                librerias,
            },
            enlaces,
            metricas: {
                tiempoRespuestaMs,
                pesoDocumentoKb,
                certSslVigente,
                cantidadImagenes,
                cantidadScripts,
                cantidadHojasEstilo,
                cantidadPalabras,
                esResponsive,
            },
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
