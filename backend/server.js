// ==========================================================================
// TARGET ANALYZER - BACKEND DE PRUEBA
// Implementa exactamente el contrato que espera script.js:
//   POST /api/escanear   body: { url: "https://..." }
//   200 -> { mensaje, objetivo, identidad, tecnologias, metricas }
//   4xx/5xx -> { error: "..." }
// ==========================================================================

const express = require('express');
const cors = require('cors');
const cheerio = require('cheerio');

const app = express();
const PUERTO = process.env.PORT || 3000;

app.use(cors());          // El frontend corre en otro origen (file:// o Live Server), así que habilitamos CORS
app.use(express.json());  // Para poder leer el JSON que manda el fetch del frontend

// Tiempo máximo que le damos al sitio objetivo antes de rendirnos (en ms)
const TIMEOUT_MS = 10000;

// --------------------------------------------------------------------------
// Helper: hace fetch al sitio objetivo con timeout propio (AbortController)
// --------------------------------------------------------------------------
async function fetchConTimeout(url, opciones = {}) {
    const controlador = new AbortController();
    const idTimeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { ...opciones, signal: controlador.signal });
    } finally {
        clearTimeout(idTimeout);
    }
}

// --------------------------------------------------------------------------
// Helper: intenta adivinar el lenguaje de backend a partir de headers típicos
// --------------------------------------------------------------------------
function detectarLenguaje(headers) {
    const poweredBy = (headers.get('x-powered-by') || '').toLowerCase();
    if (poweredBy.includes('php')) return 'PHP';
    if (poweredBy.includes('asp.net')) return 'ASP.NET (C#)';
    if (poweredBy.includes('express')) return 'Node.js (Express)';
    if (poweredBy.includes('next.js')) return 'Node.js (Next.js)';

    const servidor = (headers.get('server') || '').toLowerCase();
    if (servidor.includes('gunicorn') || servidor.includes('uvicorn')) return 'Python';
    if (servidor.includes('phusion') || servidor.includes('puma')) return 'Ruby';
    if (servidor.includes('kestrel')) return 'ASP.NET (C#)';

    return 'No identificado';
}

// --------------------------------------------------------------------------
// Helper: detecta frameworks de frontend / CMS a partir del HTML
// --------------------------------------------------------------------------
function detectarFrameworkFront($, html) {
    const firmas = [
        { nombre: 'WordPress', test: () => /wp-content|wp-includes/i.test(html) },
        { nombre: 'Next.js', test: () => !!$('#__next').length || /_next\/static/i.test(html) },
        { nombre: 'React', test: () => /react(-dom)?[.-]/i.test(html) || !!$('[data-reactroot]').length },
        { nombre: 'Vue.js', test: () => /vue(\.global)?\.js/i.test(html) || !!$('[data-v-app]').length },
        { nombre: 'Angular', test: () => !!$('[ng-version]').length || /ng-version/i.test(html) },
        { nombre: 'Shopify', test: () => /cdn\.shopify\.com/i.test(html) },
        { nombre: 'Bootstrap', test: () => /bootstrap(\.min)?\.css/i.test(html) },
        { nombre: 'Tailwind CSS', test: () => /tailwind/i.test(html) },
    ];

    const encontrados = firmas.filter(f => f.test()).map(f => f.nombre);
    return encontrados.length ? encontrados.join(', ') : 'No identificado';
}

// --------------------------------------------------------------------------
// ENDPOINT PRINCIPAL
// --------------------------------------------------------------------------
app.post('/api/escanear', async (req, res) => {
    const { url } = req.body || {};

    // 1) Validación básica de entrada
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'FALTA_URL_O_FORMATO_INVALIDO' });
    }

    let urlObjetivo;
    try {
        urlObjetivo = new URL(url);
        if (!['http:', 'https:'].includes(urlObjetivo.protocol)) {
            throw new Error('protocolo no soportado');
        }
    } catch (err) {
        return res.status(400).json({ error: 'URL_INVALIDA' });
    }

    // 2) Disparamos la petición al objetivo real, cronometrando la latencia
    const inicio = Date.now();
    let respuestaObjetivo;
    let html = '';

    try {
        respuestaObjetivo = await fetchConTimeout(urlObjetivo.toString(), {
            redirect: 'follow',
            headers: { 'User-Agent': 'TargetAnalyzer/1.0 (+pruebas-locales)' },
        });
        html = await respuestaObjetivo.text();
    } catch (err) {
        if (err.name === 'AbortError') {
            return res.status(504).json({ error: 'TIEMPO_DE_ESPERA_AGOTADO' });
        }
        return res.status(502).json({ error: 'NO_SE_PUDO_CONECTAR_AL_OBJETIVO' });
    }

    const tiempoRespuestaMs = Date.now() - inicio;

    if (!respuestaObjetivo.ok) {
        return res.status(502).json({ error: `OBJETIVO_RESPONDIO_${respuestaObjetivo.status}` });
    }

    // 3) Parseamos el HTML devuelto
    const $ = cheerio.load(html);

    const titulo = $('title').first().text().trim() || 'Sin título';
    const descripcion =
        $('meta[name="description"]').attr('content')?.trim() ||
        $('meta[property="og:description"]').attr('content')?.trim() ||
        'Sin descripción disponible';

    // 4) Métricas
    const pesoDocumentoKb = Number((Buffer.byteLength(html, 'utf8') / 1024).toFixed(2));
    const certSslVigente = urlObjetivo.protocol === 'https:'; // simplificado: si respondió por https, se considera vigente

    // 5) Tecnologías
    const servidor = respuestaObjetivo.headers.get('server') || 'Oculto/No identificado';
    const lenguaje = detectarLenguaje(respuestaObjetivo.headers);
    const frameworkFront = detectarFrameworkFront($, html);

    // 6) Armamos la respuesta EXACTA que espera script.js
    return res.status(200).json({
        mensaje: '[OBJETIVO LOCALIZADO Y ANALIZADO CON ÉXITO]',
        objetivo: urlObjetivo.hostname,
        identidad: {
            titulo,
            descripcion,
        },
        tecnologias: {
            servidor,
            lenguaje,
            frameworkFront,
        },
        metricas: {
            tiempoRespuestaMs,
            pesoDocumentoKb,
            certSslVigente,
        },
    });
});

// --------------------------------------------------------------------------
// Ruta de salud, útil para chequear que el backend está arriba
// --------------------------------------------------------------------------
app.get('/api/salud', (req, res) => {
    res.json({ estado: 'OK', hora: new Date().toISOString() });
});

app.listen(PUERTO, () => {
    console.log(`[TARGET ANALYZER BACKEND] escuchando en http://localhost:${PUERTO}`);
    console.log(`Endpoint principal: POST http://localhost:${PUERTO}/api/escanear`);
});
