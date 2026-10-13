import assert from "node:assert/strict";
import { describe, test } from "node:test";

import request from "supertest";

import { createApp } from "../src/app.js";

const CONFIG = {
  SERVICE_NAME: "ms-inventario-ibarra-bassi",
  CORS_ORIGIN: "https://ms-ecommerce-dashboard.onrender.com",
};

const SAMPLE_ITEM = {
  id: "INV001",
  productoId: "PRD001",
  sucursalId: "SUC01",
  stock: 3,
  stockMinimo: 5,
  actualizado: "2026-10-10T06:00:00Z",
};

function repositoryDouble(handlers = {}) {
  const calls = { checkHealth: 0, list: [], getById: [] };
  const repository = {
    async checkHealth() {
      calls.checkHealth += 1;
      return handlers.checkHealth?.();
    },
    async list(query) {
      calls.list.push(query);
      return handlers.list?.(query) ?? { items: [SAMPLE_ITEM], total: 1 };
    },
    async getById(id) {
      calls.getById.push(id);
      return handlers.getById?.(id) ?? (id === SAMPLE_ITEM.id ? SAMPLE_ITEM : null);
    },
  };

  return { repository, calls };
}

function testApp(handlers) {
  const double = repositoryDouble(handlers);
  return { app: createApp({ inventoryRepository: double.repository, config: CONFIG }), ...double };
}

function databaseUnavailable() {
  return Object.assign(new Error("La URI secreta no debe exponerse."), {
    code: "DATABASE_UNAVAILABLE",
  });
}

describe("GET /health", () => {
  test("comprueba el repositorio y devuelve la identidad del servicio", async () => {
    const { app, calls } = testApp();

    const response = await request(app).get("/health").expect(200);

    assert.equal(calls.checkHealth, 1);
    assert.deepEqual(response.body, {
      status: "ok",
      service: "ms-inventario-ibarra-bassi",
      collection: "inventario",
      version: "1.0.0",
    });
  });

  test("traduce un fallo de base a 503 sin filtrar detalles", async () => {
    const { app } = testApp({
      checkHealth() {
        throw databaseUnavailable();
      },
    });

    const response = await request(app).get("/health").expect(503);

    assert.deepEqual(response.body, {
      error: "service_unavailable",
      message: "El servicio de inventario no está disponible temporalmente.",
    });
    assert.doesNotMatch(response.text, /URI secreta/);
  });
});

describe("GET /items", () => {
  test("usa la paginación predeterminada y devuelve el total", async () => {
    const { app, calls } = testApp();

    const response = await request(app).get("/items").expect(200);

    assert.deepEqual(calls.list, [{ limit: 20, offset: 0 }]);
    assert.deepEqual(response.body, {
      items: [SAMPLE_ITEM],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  test("acepta paginación válida y conserva listas vacías con su total", async () => {
    const { app, calls } = testApp({
      list: async () => ({ items: [], total: 97 }),
    });

    const response = await request(app).get("/items?limit=5&offset=1000").expect(200);

    assert.deepEqual(calls.list, [{ limit: 5, offset: 1000 }]);
    assert.deepEqual(response.body, { items: [], total: 97, limit: 5, offset: 1000 });
  });

  test("normaliza los filtros y pasa únicamente parámetros permitidos", async () => {
    const { app, calls } = testApp();

    await request(app)
      .get("/items?productoId=prd001&sucursalId=suc01&desconocido=ignorar")
      .expect(200);

    assert.deepEqual(calls.list, [
      { limit: 20, offset: 0, productoId: "PRD001", sucursalId: "SUC01" },
    ]);
  });

  const invalidQueries = [
    "limit=",
    "limit=0",
    "limit=101",
    "limit=abc",
    "limit=1.5",
    "limit=20abc",
    "limit=9007199254740992",
    "limit=1&limit=2",
    "limit%5B%5D=1",
    "offset=",
    "offset=-1",
    "offset=abc",
    "offset=1.5",
    "productoId=",
    "productoId=PROD001",
    "productoId=PRD",
    "productoId=PRD1&productoId=PRD2",
    "sucursalId=",
    "sucursalId=SUC-01",
    "sucursalId%5Bvalor%5D=SUC01",
  ];

  for (const query of invalidQueries) {
    test(`rechaza ${query} sin consultar el repositorio`, async () => {
      const { app, calls } = testApp();

      const response = await request(app).get(`/items?${query}`).expect(400);

      assert.equal(response.body.error, "bad_request");
      assert.equal(typeof response.body.message, "string");
      assert.equal(calls.list.length, 0);
    });
  }

  test("traduce fallos de base e inesperados", async (context) => {
    await context.test("fallo de base", async () => {
      const { app } = testApp({
        list() {
          throw databaseUnavailable();
        },
      });
      const response = await request(app).get("/items").expect(503);
      assert.equal(response.body.error, "service_unavailable");
    });

    await context.test("fallo inesperado", async () => {
      const { app } = testApp({
        list() {
          throw new Error("detalle interno");
        },
      });
      const response = await request(app).get("/items").expect(500);
      assert.deepEqual(response.body, {
        error: "internal_error",
        message: "Ocurrió un error interno.",
      });
      assert.doesNotMatch(response.text, /detalle interno/);
    });
  });
});

describe("GET /items/:id", () => {
  test("devuelve el documento encontrado", async () => {
    const { app, calls } = testApp();

    const response = await request(app).get("/items/INV001").expect(200);

    assert.deepEqual(calls.getById, ["INV001"]);
    assert.deepEqual(response.body, SAMPLE_ITEM);
  });

  test("no normaliza el identificador y devuelve 404 si no existe", async () => {
    const { app, calls } = testApp();

    const response = await request(app).get("/items/inv001").expect(404);

    assert.deepEqual(calls.getById, ["inv001"]);
    assert.deepEqual(response.body, {
      error: "not_found",
      message: "No existe inv001.",
    });
  });
});

describe("errores de rutas y CORS", () => {
  test("responde JSON para rutas inexistentes", async () => {
    const { app } = testApp();
    const response = await request(app).get("/ruta-inexistente").expect(404);
    assert.deepEqual(response.body, {
      error: "not_found",
      message: "No existe la ruta GET /ruta-inexistente.",
    });
  });

  test("habilita el origen del dashboard y solicitudes OPTIONS", async () => {
    const { app } = testApp();
    const response = await request(app)
      .options("/items")
      .set("Origin", CONFIG.CORS_ORIGIN)
      .set("Access-Control-Request-Method", "GET")
      .expect(204);

    assert.equal(response.headers["access-control-allow-origin"], CONFIG.CORS_ORIGIN);
    assert.match(response.headers["access-control-allow-methods"], /GET/);
  });

  test("permite llamadas sin Origin y no habilita otros orígenes", async () => {
    const { app } = testApp();
    await request(app).get("/health").expect(200);

    const response = await request(app)
      .get("/health")
      .set("Origin", "https://example.invalid")
      .expect(200);
    assert.equal(response.headers["access-control-allow-origin"], undefined);
  });
});
