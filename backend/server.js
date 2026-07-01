// ==========================================================================
// TARGET ANALYZER - BACKEND
// Implementa exactamente el contrato que espera script.js:
//   POST /api/escanear   body: { url: "https://..." }
//   200 -> { mensaje, objetivo, identidad, tecnologias, metricas }
//   4xx/5xx -> { error: "..." }
//
// A partir de ahora este servidor NO escanea nada por su cuenta: le delega
// todo el trabajo pesado al Robot 1.1 (robot.js), que abre un Chrome real
// con Puppeteer, renderiza el JavaScript de la página objetivo y recién ahí
// lee el DOM ya armado. Esto es lo que hace que sitios en React/Vue/Angular
// devuelvan título, descripción y tecnologías reales, en vez de un
// <div id="root"></div> vacío como pasaría con un fetch liviano.
// ==========================================================================

const express = require('express');
const cors = require('cors');
const ejecutarExtraccion = require('./robot.js'); // El Robot 1.1: abre Chrome, renderiza y extrae los datos

const app = express();
const PUERTO = process.env.PORT || 3000;

app.use(cors());          // El frontend corre en otro origen (file:// o Live Server), así que habilitamos CORS
app.use(express.json());  // Para poder leer el JSON que manda el fetch del frontend

// Tiempo máximo que le damos al Robot antes de rendirnos (en ms). Se lo pasamos
// tal cual a robot.js, que lo usa como techo de navegación de Puppeteer: así el
// timeout se dispara DENTRO de Chrome (que se cierra solo y prolijo), en vez de
// que nosotros cortemos la espera desde afuera y dejemos el Chrome huérfano.
const TIMEOUT_MS = 20000;

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

    // 2) Le pasamos la URL al Robot: él abre Chrome, navega, espera a que la
    // red se estabilice, lee el DOM renderizado y devuelve identidad,
    // tecnologías y métricas ya armadas en el mismo formato que espera el frontend.
    try {
        const datosExtraidos = await ejecutarExtraccion(urlObjetivo.toString(), TIMEOUT_MS);

        // 3) Armamos la respuesta EXACTA que espera script.js, envolviendo lo
        // que devolvió el Robot con el mensaje de éxito y el hostname del objetivo.
        return res.status(200).json({
            mensaje: '[OBJETIVO LOCALIZADO Y ANALIZADO CON ÉXITO]',
            objetivo: urlObjetivo.hostname,
            identidad: datosExtraidos.identidad,
            tecnologias: datosExtraidos.tecnologias,
            metricas: {
                ...datosExtraidos.metricas,
                // robot.js entrega el peso como string (toFixed), lo normalizamos a
                // número para que el frontend lo pueda mostrar/operar sin sorpresas
                pesoDocumentoKb: Number(datosExtraidos.metricas.pesoDocumentoKb),
            },
        });
    } catch (error) {
        // El Robot puede tirar dos tipos de error: el de timeout (cuando Chrome
        // tarda más de TIMEOUT_MS navegando) o el genérico de "objetivo
        // inalcanzable" (DNS caído, certificado roto, sitio que no responde, etc.)
        if (error.message === 'TIEMPO_DE_ESPERA_AGOTADO') {
            return res.status(504).json({ error: 'TIEMPO_DE_ESPERA_AGOTADO' });
        }
        console.error('[ROBOT] Error durante la extracción:', error.message);
        return res.status(502).json({ error: 'NO_SE_PUDO_CONECTAR_AL_OBJETIVO' });
    }
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