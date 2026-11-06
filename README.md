# NotaScribe Tablet - Notas, Stylus y Reconocimiento

Aplicación web avanzada optimizada para tablets con lápiz digital (Stylus), reconocimiento de escritura manuscrita en tiempo real, organizador de carpetas, lista de tareas, mapa conceptual interactivo y transcripción de voz.

---

## 🚀 Despliegue en Render (Render.com)

Si tu despliegue en Render se caía o mostraba error, suele deberse a dos razones habituales:
1. **Falta de compilación del frontend**: El servidor arrancaba sin que se hubiera generado la carpeta `/dist`.
2. **Comando de inicio y versión de Node**: Intentar ejecutar TypeScript con herramientas no instaladas en producción o en versiones anteriores de Node.

### Configuración en el Panel de Render (Web Service):

| Campo | Valor Requerido |
| :--- | :--- |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Node Version** | `22` (configurada automáticamente en `package.json` vía `engines`) |

### Variables de Entorno en Render (Opcional):
- `NODE_ENV`: `production` (configurada automáticamente por Render).
- `PORT`: Asignado automáticamente por Render (no necesitas definirlo).
- `GEMINI_API_KEY`: *(Opcional)* Tu clave de Google Gemini API para funciones avanzadas de OCR y transcripción asistida por IA. Si no se define, la aplicación funciona con reconocimiento local y transcripciones de prueba sin caerse.

> **Nota:** Este repositorio incluye un archivo `render.yaml`. Si creas un nuevo **Blueprint** en Render, la configuración anterior se aplicará automáticamente.

---

## 💻 Desarrollo Local

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev

# 3. Compilar para producción
npm run build

# 4. Probar build de producción localmente
npm start
```
