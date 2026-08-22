# CoCool

App de gestión comercial (Panel Estratégico, POS, Catálogo, Compras, Caja/Cuentas y Reportes) en React + Tailwind CSS, con **sincronización automática entre dispositivos** vía Firebase Firestore.

## 1. Crear tu proyecto de Firebase (gratis, 5 minutos)

1. Entrá a [console.firebase.google.com](https://console.firebase.google.com) e iniciá sesión con una cuenta de Google.
2. "Agregar proyecto" → ponele un nombre (ej. `cocool`) → seguí los pasos (podés desactivar Google Analytics, no hace falta).
3. Dentro del proyecto, en el menú izquierdo: **Compilación → Firestore Database → Crear base de datos**.
   - Ubicación recomendada: `southamerica-east1` (São Paulo, la más cercana a Paraguay).
   - Modo: "Iniciar en modo de prueba" (lo ajustamos en el paso 4).
4. Andá a **Reglas** (dentro de Firestore) y reemplazá el contenido por esto, para que solo tu app pueda leer/escribir:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /cocool_data/{document} {
         allow read, write: if true;
       }
     }
   }
   ```
   > Esto permite que cualquiera con el link de tu app pueda leer/escribir los datos (no hay usuarios/contraseña). Para un negocio chico manejado por vos es un punto de partida razonable, pero **no compartas la URL de tu app públicamente**. Si más adelante querés algo más seguro (login con usuario y contraseña), avisá y lo agregamos.
5. Volvé a la página principal del proyecto → ícono **`</>`  (Web)** → registrá una app (nombre: `cocool-web`) → **no** actives Firebase Hosting.
6. Te va a mostrar un bloque `firebaseConfig = {...}`. Copiá esos valores.

## 2. Pegar tus credenciales en el proyecto

Abrí `src/firebase.js` y reemplazá los valores de `firebaseConfig` por los que copiaste en el paso anterior.

## 3. Instalar dependencias

Necesitás [Node.js](https://nodejs.org) instalado (versión 18 o superior). En esta carpeta:

```bash
npm install
```

## 4. Correr en tu compu (modo desarrollo)

```bash
npm run dev
```

Abrí la URL que te muestra la terminal (normalmente `http://localhost:5173`). Los datos ahora viven en Firestore: si abrís la misma URL en otro dispositivo, van a estar sincronizados en tiempo real.

## 5. Publicarlo gratis en internet

1. Subí esta carpeta a un repositorio de GitHub (podés subir `src/firebase.js` con tus credenciales reales sin problema, ver nota de seguridad arriba).
2. Entrá a [vercel.com](https://vercel.com) o [netlify.com](https://netlify.com), creá una cuenta gratis y conectá el repositorio.
3. Detectan Vite automáticamente (build command: `npm run build`, output: `dist`). Le das "Deploy" y en un par de minutos te dan una URL pública, por ejemplo `cocool.vercel.app`.

## 6. "Instalar" en el celular y la PC

- **Celular (Chrome/Safari):** abrí la URL publicada → menú del navegador → "Agregar a pantalla de inicio".
- **PC (Chrome/Edge):** abrí la URL → ícono de instalar en la barra de direcciones (o menú → "Instalar app").

Ambos van a mostrar y guardar los mismos datos automáticamente, sin que tengas que exportar/importar nada.

## Notas

- **Sincronización automática:** cualquier venta, compra, o cambio en el catálogo que cargues desde un dispositivo aparece solo en los demás, en segundos.
- **Conflictos:** si dos personas editan lo mismo al mismo tiempo desde dispositivos distintos, gana el último cambio guardado (no se combinan automáticamente). Para un negocio chico esto casi nunca es un problema.
- **Respaldo manual:** los botones Exportar/Importar Copia de Seguridad (JSON) en Ajustes siguen funcionando, como respaldo adicional además de Firestore.
- **Costo:** el plan gratuito de Firestore (Spark) alcanza sobradamente para este volumen de uso — no deberías pagar nada.

