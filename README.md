# ✚ Control Carro de Paro · CIMA

Aplicación web para llevar el control del **carro de paro** y las **3 cajas de emergencia** de CIMA:

- **Control diario** de fajas (integridad y número) y chequeo de equipos del carro (monitor/desfibrilador, aspirador, descartador).
- **Apertura y reposición**: motivo, conteo contra el listado fijo, carga de vencimientos y número de faja nueva.
- **Vencimientos**: alerta de lo vencido o lo que vence en los próximos 60 días.
- **Historial** filtrable por unidad, con exportación a CSV.
- **Contenido**: listado de cantidades fijas de cada unidad (editable).
- **Códigos QR**: etiquetas imprimibles para cada unidad. Al escanearlas se abre el control diario de esa unidad o, si ya se hizo, la confirmación con hora y responsable. Para confirmar hay que escribir el número de faja que se ve, y si no coincide con el registrado queda marcada como problema.
- **Control mensual**: aviso cuando una unidad pasa más de 31 días sin abrirse.

## Estructura

```
index.html          Página principal
css/styles.css      Estilos (tema claro y oscuro automático)
js/app.js           Lógica de la app: inventario, estados, vistas y formularios
js/storage.js       Almacenamiento local para usar fuera de claude.ai
js/vendor/qrcode.js Generador de QR (qrcode-generator, licencia MIT)
.github/workflows/  Publicación automática en GitHub Pages
```

No requiere compilación ni dependencias: es HTML, CSS y JavaScript puro.

## Dónde se guardan los datos

| Dónde se abre | Almacenamiento |
| --- | --- |
| Como Artifact en claude.ai | Registro **compartido** entre todos los que tienen acceso |
| GitHub Pages o archivo local | **Solo en ese navegador** (`localStorage`) |

En modo local, la pestaña **Historial** tiene **Exportar respaldo** e **Importar respaldo** (archivo `.json`) para no perder datos o pasarlos a otro equipo. Si se borran los datos de navegación, se pierde lo que no se haya respaldado.

## Publicar en GitHub Pages

1. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Cada push a `main` publica la app en `https://<usuario>.github.io/<repositorio>/`.

## Usar localmente

Abrir `index.html` en el navegador, o servir la carpeta:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Modificar el inventario

El listado por defecto está al comienzo de `js/app.js` (`CAJA` para las cajas 1–3 y `DEFAULT_INV.carro` para el carro). Los ítems marcados con `it(nombre, cantidad, 1)` aparecen como **A CONFIRMAR**. También se puede editar desde la pestaña **Contenido → Editar listado**.

> ⚠️ Herramienta de apoyo administrativo. No reemplaza los protocolos institucionales de control del carro de paro.
