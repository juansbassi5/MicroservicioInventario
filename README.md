# Microservicio de inventario

Ejercicio compartido de Juan Ignacio Ibarra y Juan Bassi. Node.js 24.x, Express 5,
JavaScript con módulos ES y driver oficial de MongoDB. Contrato: `inventario.yaml`.
Datos iniciales: `inventario.json` (97 documentos).

## Estado y responsabilidades

Esta entrega implementa la infraestructura de Ibarra: configuración, conexión,
consultas, carga repetible, arranque, pruebas y configuración de Render.
Las rutas HTTP, validaciones, CORS y manejo de errores de Bassi ya están integrados
desde `main`. `src/app.js` construye la API y recibe el repositorio MongoDB desde
el arranque de Ibarra. Las tres rutas están disponibles cuando Atlas es accesible
y la semilla está cargada.

La aplicación es de solo lectura. No hay endpoints para modificar stock.

## Servicio publicado

- URL base: [ms-inventario-ibarra-bassi](https://ms-inventario-ibarra-bassi.onrender.com).
- Salud: [GET /health](https://ms-inventario-ibarra-bassi.onrender.com/health).
- Listado: [GET /items](https://ms-inventario-ibarra-bassi.onrender.com/items).
- [PR #2 integrado a main](https://github.com/juansbassi5/MicroservicioInventario/pull/2).
- Registrado como **MS-inventario ONLINE** en el dashboard del ejercicio el 13/10/2026.

Validación de la entrega: 47 pruebas offline, 4 pruebas de integración con Atlas
(incluida la API HTTP), CI correcto y carga repetida conservando 97 documentos.
Para este ejercicio, el equipo eligió utilizar en Render la URI existente; el
procedimiento de usuario exclusivo de lectura se mantiene como configuración
recomendada para futuros despliegues.

## Instalación local

Requisitos: Git, Node.js **24.x**, npm y acceso al cluster compartido de Atlas.

```powershell
git clone https://github.com/juansbassi5/MicroservicioInventario.git
cd MicroservicioInventario
npm ci
Copy-Item .env.example .env
```

Si `.env` ya está configurado, conservarlo en lugar de ejecutar `Copy-Item`.
En macOS/Linux se puede copiar con `cp .env.example .env`. `.node-version` y
`engines` fijan la misma versión principal de Node que usan CI y Render.

Editar `.env` con la URI personal; nunca subirlo a Git:

| Variable | Valor predeterminado / significado |
|---|---|
| `MONGODB_URI` | Obligatoria; URI real del cluster |
| `MONGODB_DB` | `clase7_inventario`; base explícita, independiente de la ruta de la URI |
| `PORT` | `3000` local; Render proporciona su valor |
| `SERVICE_NAME` | `ms-inventario-ibarra-bassi` |
| `CORS_ORIGIN` | `https://ms-ecommerce-dashboard.onrender.com` |
| `MONGODB_DNS_SERVERS` | Opcional, IP separadas por comas; vacío usa el DNS del sistema |

Las variables ya presentes en el entorno tienen prioridad sobre `.env`. La
contraseña de la URI debe estar codificada si contiene caracteres especiales.
No es necesario configurar `MONGODB_USERNAME` y `MONGODB_PASSWORD` por separado:
la autenticación utiliza la URI. No imprimir configuración completa ni errores
que puedan contener credenciales.

## MongoDB Atlas y carga inicial

Ambos usan el mismo cluster, pero sus propias cuentas y usuarios de base de
datos. Base: `clase7_inventario`; colección: `inventario`.

1. Confirmar que el cluster está activo y agregar las IP públicas de ambos
   equipos en **Network Access → Add Current IP Address**.
2. Dar a los usuarios de desarrollo permiso `readWrite` sobre esta base.
3. Configurar la URI local y ejecutar:

```powershell
npm run seed
npm run test:integration
npm run dev
```

La carga valida toda la semilla antes de conectar, crea índices únicos sobre
`id` y `(productoId, sucursalId)` y ejecuta reemplazos con upsert por `id`.
Repetir `npm run seed` conserva los 97 documentos sin duplicarlos. No elimina
documentos adicionales ya existentes ni borra la colección. Puede restaurar los
valores de la semilla en documentos con el mismo `id`; coordinar su ejecución.
La carga es manual y nunca se ejecuta durante el arranque o deploy.

Si una red móvil devuelve `EBADRESP` al resolver Atlas, se puede configurar
`MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8` en `.env`. Solo cambia el resolver del proceso
Node, sin modificar Windows; no se necesita normalmente en Render. Si una red
bloquea el puerto de MongoDB, cambiar de conexión. Tras cambiar de red, agregar
la nueva IP pública a la lista de acceso de Atlas.

Se mantienen los seis campos originales, con `actualizado` como cadena ISO UTC
y sucursales como `SUC01`. `_id` es interno y se excluye de las consultas públicas.

## Interfaz para Bassi

`src/app.js` exporta `createApp({ inventoryRepository, config })` y devuelve una
aplicación Express. No conecta MongoDB ni escucha puertos. `config` contiene
`MONGODB_URI`, `MONGODB_DB`, `PORT`, `SERVICE_NAME` y `CORS_ORIGIN`; no serializarlo.

El arranque inyecta este repositorio:

```js
await inventoryRepository.list({ productoId, sucursalId, limit, offset });
// { items, total }; defaults internos: limit 20, offset 0

await inventoryRepository.getById('INV001');
// Documento con sus seis campos, o null

await inventoryRepository.checkHealth();
// Resuelve si se puede acceder a la colección; lanza error si falla
```

La API debe validar la entrada y normalizar filtros a mayúsculas antes de llamar
al repositorio. Los filtros se combinan por igualdad exacta con AND. El listado
se ordena por `id` ascendente y `total` se cuenta antes de paginar.
Los errores del driver se convierten en `error.code === 'DATABASE_UNAVAILABLE'`;
Bassi los traduce a 503. Los errores inesperados conservan su tipo para responder
500. El repositorio no realiza validaciones HTTP ni genera respuestas JSON.

Endpoints implementados por Bassi:

| Endpoint | Comportamiento |
|---|---|
| `GET /health` | Verificar repositorio y devolver `status`, `service`, `collection`, `version` |
| `GET /items` | Filtros opcionales, limit 1–100 (20), offset >= 0 (0) |
| `GET /items/{id}` | Detalle por `id`, 404 si no existe |

El health del repositorio hace ping, verifica existencia de la colección y su
permiso de lectura. El arranque conecta antes de aceptar tráfico, reutiliza un
cliente, escucha en `0.0.0.0` y cierra HTTP y MongoDB en SIGINT/SIGTERM.
Las consultas tienen un máximo de 2 segundos; la selección inicial de servidor,
5 segundos. Si falla la configuración o Atlas, el proceso finaliza con código 1.

## Pruebas

```powershell
npm test
npm run test:integration
```

`npm test` utiliza dobles de conexión y verifica configuración, consultas,
proyección, errores, validación de semilla y ciclo de arranque/cierre, además de
las pruebas HTTP de Bassi. No necesita Atlas y es el comando que ejecuta GitHub
Actions en los Pull Requests y `main`. Incluye `test/*.test.js` y `test/unit/*.test.js`.

`npm run test:integration` usa `.env`, solo lee Atlas y exige la semilla completa.
Comprueba 97 registros, detalle, filtros, orden, paginación y la API HTTP conectada
al repositorio real. No debe ejecutarse contra datos ajenos al ejercicio.

Consultas HTTP del contrato:

| Consulta | Resultado esperado |
|---|---|
| `/items` | 20 elementos, total 97 |
| `/items?limit=100` | 97 elementos ordenados |
| `/items?limit=5&offset=5` | `INV006` a `INV010`, total 97 |
| `/items?productoId=PRD001` | 3 elementos |
| `/items?productoId=PRD001&sucursalId=SUC02` | Solo `INV002` |
| `/items?productoId=PRD999` | Lista vacía y total 0 |
| `/items?offset=1000` | Lista vacía y total 97 |
| `/items/INV001` | Documento de la semilla |
| `/items/INV999` | 404 |

## Despliegue en Render

**Después de cargar la semilla y verificar `/health`:**

1. Conectar este repositorio desde **New → Blueprint** para utilizar `render.yaml`,
   o crear un Web Service con los mismos valores: Node, Free, Virginia, `main`,
   build `npm ci`, start `npm start`, health `/health`.
2. Cargar `MONGODB_URI` en Render con un usuario que tenga permiso `read` sobre
   `clase7_inventario`. Las demás variables están definidas en el Blueprint.
3. Agregar a Atlas todos los rangos desde **Connect → Outbound** del servicio.
4. No fijar `PORT=3000` en Render; el servidor usa el puerto del entorno.
5. El Blueprint despliega automáticamente cuando pasan los checks de CI.
6. Verificar las tres rutas en la URL pública y registrar la URL base en el
   [dashboard](https://ms-ecommerce-dashboard.onrender.com/), seleccionando
   `MS-inventario`, grupo `Ibarra-Bassi` y los dos estudiantes, uno por línea.

Render Free puede
suspenderse después de 15 minutos sin tráfico y tardar aproximadamente un minuto
en reactivarse: abrir `/health` antes de presentar.

Referencias: [Blueprints](https://render.com/docs/blueprint-spec),
[IPs de salida](https://render.com/docs/outbound-ip-addresses),
[conectar Atlas](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).

## Trabajo en equipo

`main` contiene código integrado. Usar ramas y Pull Requests con revisión del
compañero. Ibarra mantiene infraestructura, consultas y despliegue; Bassi mantiene
API, validaciones, CORS y pruebas HTTP. Coordinar cambios en dependencias y lockfile.
Las credenciales quedan locales y fuera de Git, incluidos archivos `*.env`.
