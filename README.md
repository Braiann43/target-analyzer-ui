# 🎯 Target Analyzer - CTU Búnker

## 📝 Descripción
**Target Analyzer** es una aplicación web Full Stack diseñada con una estética de terminal inmersiva (estilo CTU/Retro). Su objetivo principal es recibir una URL, establecer un puente de comunicación asincrónica con un servidor local y desplegar un robot de extracción para analizar la identidad, tecnologías subyacentes y métricas de red del sitio web objetivo.


## ✨ Características y Funcionalidades

### 🖥️ Frontend (Emisor Avanzado)
El cliente opera de manera asincrónica, actualizando el DOM en tiempo real sin necesidad de recargar la página:
- **Diseño Táctico Bidimensional:** Interfaz construida con CSS Grid y Flexbox, dividida en 4 cuadrantes analíticos y protegida contra desbordamientos visuales (overflow).
- **Motor de Audio Retro (Web Audio API):** Efectos de sonido estilo 8-bit (blips, alarmas y arpegios de victoria) generados matemáticamente mediante osciladores, sin depender de archivos `.mp3` externos.
- **Modo Foco Dinámico:** Interfaz responsiva que permite hacer clic en cualquier panel para maximizarlo, minimizando el resto de los módulos al estilo "llamada de Discord".
- **Memoria Persistente:** Menú lateral oculto que almacena el historial de escaneos utilizando `localStorage`, permitiendo recuperar reportes previos al instante.
- **Personalización en Vivo:** Selector de colores dinámico que altera las variables globales de CSS (tema de neón) y actualiza la animación del fondo (Efecto Matrix).
- **Control de Red:** Implementación de `AbortController` acoplado al botón "ABORTAR", permitiendo al operador cancelar la petición `fetch` en pleno vuelo si el servidor demora.

### ⚙️ Backend (Receptor y Robot de Extracción)
El servidor utiliza una arquitectura asincrónica y no bloqueante para procesar las operaciones:
- **Motor Central:** Construido sobre **Node.js** y **Express.js**, escuchando el puerto 3000 y gestionando la seguridad de las rutas con CORS.
- **Navegador Invisible (Puppeteer):** Despliega una instancia de Chrome Headless en modo `shell` para renderizar contenido dinámico (JavaScript), medir la latencia de red y verificar la vigencia de los certificados SSL.
- **Análisis Estático (Cheerio):** Procesa el árbol HTML extraído en memoria para rastrear metadatos e identificar frameworks del lado del cliente (React, Vue, Angular) y gestores de contenido (como WordPress).
- **Bitácora Física:** Utiliza el módulo nativo `fs` (File System) para registrar cada intento de escaneo exitoso en un archivo local llamado `historial.log`.


## 🛠️ Tecnologías Utilizadas
* **Frontend:** HTML5, CSS3 (Variables, Grid, Flexbox, Keyframes), JavaScript Vanilla (DOM, Fetch API, Promesas, Web Audio API).
* **Backend:** Node.js, Express.js.
* **Scraping / Automatización:** Puppeteer, Cheerio.


## 🚀 Instalación y Despliegue

Sigue estos pasos para correr el búnker central en tu máquina local:

**1. Clonar el repositorio**

git clone https://github.com/TU_USUARIO/target-analyzer.git
cd backend

2. Inicializar el entorno e instalar dependencias Asegúrate de tener Node.js instalado. Luego, ejecuta en la terminal de la carpeta raíz:

npm init -y
npm install express cors cheerio puppeteer

3. Encender el Servidor Receptor

node server.js

(Deberías ver el mensaje: [BÚNKER CENTRAL]: Escuchando comunicaciones en puerto 3000)
4. Iniciar la Interfaz Abre el archivo index.html en tu navegador web de preferencia (Chrome, Edge, Firefox), ingresa una URL válida (ej. google.com) y presiona [INICIAR_ESCANEO].

📂 Arquitectura del Proyecto

    index.html: Esqueleto semántico de la aplicación.
    style.css: Hojas de estilo, variables globales y reglas de adaptabilidad (Mobile First/Grid).
    script.js (Emisor): Lógica del cliente, captura de sensores del DOM, sonidos, localStorage y envío asincrónico vía Fetch.
    matrix.js: Animación en Canvas del fondo estilo lluvia de caracteres.
    server.js (Receptor): Configuración del middleware de Express, enrutamiento POST /api/escanear y guardado en disco duro.
    robot.js (Motor): Módulo aislado de extracción y escaneo inteligente operado por Puppeteer y Cheerio.

👥 Equipo de Desarrollo

    [Braian Videla / Ivan Araujo / Benjamin Severini / Julio Cristaldo / Adolfo Ramirez / Lucas Gonzales / Franco Alvarez Florentin / Matthew Crisafio] - Desarrollo Front-End (HTML/CSS)
