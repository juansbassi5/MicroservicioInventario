# Integración de la API de Juan Bassi

La API de Bassi ya fue integrada en `main`. Esta rama incorpora esa implementación
y agrega la infraestructura de Ibarra. El documento describe la interfaz común
para futuras modificaciones.

## Punto de entrada

`src/app.js` conserva la exportación:

```js
export function createApp({ inventoryRepository, config }) {
  // Crear aplicación Express, agregar rutas, CORS y errores; devolver app.
}
```

El arranque ya entrega una conexión comprobada. No abrir otro MongoClient ni
llamar a `listen()` desde la aplicación. La función recibe configuración con
claves en mayúsculas; usar `config.SERVICE_NAME` y `config.CORS_ORIGIN`.
No devolver ni imprimir `config`, porque contiene la URI.

## Repositorio disponible

- `list({ productoId, sucursalId, limit, offset })` devuelve `{ items, total }`.
- `getById(id)` devuelve el documento o `null`.
- `checkHealth()` resuelve si la colección es accesible; lanza error si falla.
- Los tres métodos son asíncronos. Los errores MongoDB tienen
  `error.code === 'DATABASE_UNAVAILABLE'` para responder 503.
- Las consultas ya ordenan, paginan y excluyen `_id`. Validar y normalizar filtros
  a mayúsculas en la API antes de pasar los argumentos.

## Contrato a completar

Las tres rutas del archivo `inventario.yaml` ya están implementadas:

1. `/health`: llamar `checkHealth()` y responder 200 con estado `ok`, nombre de
   servicio configurado, colección `inventario` y versión `1.0.0`.
2. `/items`: limit 1–100 (20), offset >= 0 (0), filtros opcionales producto/sucursal
   con igualdad sin distinguir mayúsculas y AND. Responder `{ items, total, limit,
   offset }`. Parámetros inválidos: 400.
3. `/items/{id}`: búsqueda exacta por identificador público; null implica 404.

Todos los errores deben devolver `{ error, message }`. Códigos: `bad_request`
(400), `not_found` (404), `service_unavailable` (503) e `internal_error` (500).
No exponer trazas internas. Configurar CORS para el dashboard y aceptar solicitudes
sin Origin. No agregar endpoints de escritura.

## Pruebas y deploy

Las pruebas HTTP de Bassi están en `test/app.test.js`; los tests de infraestructura
están en `test/unit/`. `npm test` ejecuta ambos grupos sin Atlas.
`npm run test:integration` verifica la semilla y la API contra Atlas y necesita
configuración local y datos cargados. El `render.yaml` ya apunta a `/health`;
verificarlo antes de desplegar y registrar la URL pública.
