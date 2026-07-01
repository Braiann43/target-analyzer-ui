# Target Analyzer - Backend de prueba

Backend genérico en Node.js + Express que implementa exactamente el contrato
que espera tu `script.js`.

## Instalación

```bash
cd backend
npm install
npm start
```

Por defecto levanta en `http://localhost:3000`, que es la URL que ya tenés
hardcodeada en el fetch de `script.js`.

## Endpoint

### `POST /api/escanear`

**Body:**
```json
{ "url": "https://ejemplo.com" }
```

**Respuesta exitosa (200):**
```json
{
  "mensaje": "[OBJETIVO LOCALIZADO Y ANALIZADO CON ÉXITO]",
  "objetivo": "ejemplo.com",
  "identidad": {
    "titulo": "...",
    "descripcion": "..."
  },
  "tecnologias": {
    "servidor": "...",
    "lenguaje": "...",
    "frameworkFront": "..."
  },
  "metricas": {
    "tiempoRespuestaMs": 123,
    "pesoDocumentoKb": 45.67,
    "certSslVigente": true
  }
}
```

**Respuesta de error (400/502/504):**
```json
{ "error": "URL_INVALIDA" }
```

### `GET /api/salud`
Chequeo rápido de que el server está vivo.

## Qué hace realmente

1. Valida la URL recibida.
2. Hace un `fetch` real al sitio objetivo (con timeout de 10s) y cronometra
   la latencia.
3. Parsea el HTML devuelto con `cheerio` para sacar `<title>` y meta
   `description`.
4. Calcula el peso del documento en KB.
5. Lee headers (`Server`, `X-Powered-By`) para inferir servidor/lenguaje.
6. Busca firmas típicas en el HTML (WordPress, React, Vue, Angular, Next.js,
   Shopify, Bootstrap, Tailwind) para el panel de tecnologías.

## Notas / próximos pasos

- El panel de ENLACES en `script.js` todavía muestra el mensaje
  "MÓDULO DE MAPEO ITERATIVO: OFFLINE" — si querés, agrego un endpoint o
  campo `enlaces: []` extrayendo los `<a href>` del HTML con cheerio.
- `certSslVigente` hoy es un check simplificado (si respondió por https se
  considera válido). Si querés un chequeo real de vigencia/expiración del
  certificado, se puede hacer con el módulo `tls` de Node.
- CORS está abierto (`cors()`) para que puedas servir el frontend desde
  cualquier origen (Live Server, `file://`, etc.) durante las pruebas.
