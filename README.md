# MS Inventario — Ibarra/Bassi

Microservicio de inventario de solo lectura desarrollado con Node.js 24, Express 5 y módulos ES. Usa la colección `inventario` de MongoDB Atlas y cumple el contrato de [`inventario.yaml`](./inventario.yaml).

## Contrato HTTP

| Método y ruta | Descripción |
|---|---|
| `GET /health` | Comprueba la conexión con MongoDB y devuelve el estado del servicio. |
| `GET /items` | Lista inventario con filtros y paginación. |
| `GET /items/{id}` | Devuelve un registro por su identificador público. |

`GET /items` acepta:

- `limit`: entero de 1 a 100; valor predeterminado `20`.
- `offset`: entero mayor o igual a 0; valor predeterminado `0`.
- `productoId`: identificador `PRD` seguido de dígitos.
- `sucursalId`: identificador `SUC` seguido de dígitos.

Los filtros no distinguen mayúsculas al ingresar y se combinan con AND. Las respuestas de error siempre tienen la forma:

```json
{
  "error": "bad_request",
  "message": "El parámetro limit debe estar entre 1 y 100."
}
```

## Configuración local

Requisitos:

- Node.js 24.x.
- Acceso al proyecto compartido de MongoDB Atlas.
- IP pública autorizada en Atlas.

Instalar las dependencias reproducibles:

```bash
npm ci
```

Copiar la plantilla de entorno y completar la URI del usuario propio:

```bash
cp .env.example .env
```

Variables:

| Variable | Uso |
|---|---|
| `MONGODB_URI` | Cadena de conexión del usuario individual de Atlas. |
| `MONGODB_DB` | Base `clase7_inventario`. |
| `PORT` | Puerto HTTP local; normalmente `3000`. |
| `SERVICE_NAME` | Nombre público `ms-inventario-ibarra-bassi`. |
| `CORS_ORIGIN` | Origen autorizado del dashboard. |

Nunca se deben versionar `.env`, `atlas-credentials.env`, contraseñas ni cadenas de conexión reales.

## Desarrollo y pruebas

La aplicación HTTP se exporta sin abrir puertos ni conectarse directamente a Atlas:

```js
import { createApp } from "./src/app.js";

const app = createApp({ inventoryRepository, config });
```

El arranque integrado debe inyectar un repositorio con esta interfaz:

```js
inventoryRepository.list({ productoId, sucursalId, limit, offset });
inventoryRepository.getById(id);
inventoryRepository.checkHealth();
```

Ejecutar las pruebas HTTP, que usan un repositorio simulado y no requieren credenciales:

```bash
npm test
```

Ejemplos para comprobar el servicio una vez integrado:

```text
GET /health
GET /items
GET /items?limit=5&offset=5
GET /items?productoId=prd001&sucursalId=suc02
GET /items/INV001
```

## Trabajo en equipo

- `main` contiene código integrado y estable.
- Cada integrante trabaja en su propia rama y abre un pull request.
- Bassi mantiene la aplicación HTTP, validaciones, errores, CORS y pruebas de la API.
- Ibarra mantiene configuración, MongoDB, consultas, semilla, arranque y despliegue.
- La semilla se carga manualmente una sola vez mediante el proceso coordinado por Ibarra.
