import cors from "cors";
import express from "express";

import { HttpError } from "./errors.js";
import { parseListQuery } from "./query-validation.js";

const SERVICE_VERSION = "1.0.0";
const COLLECTION_NAME = "inventario";

function corsOptions(allowedOrigin) {
  return {
    origin(origin, callback) {
      callback(null, !origin || origin === allowedOrigin);
    },
    methods: ["GET", "HEAD", "OPTIONS"],
    optionsSuccessStatus: 204,
  };
}

function notFoundMessage(request) {
  return `No existe la ruta ${request.method} ${request.path}.`;
}

export function createApp({ inventoryRepository, config }) {
  if (!inventoryRepository) {
    throw new TypeError("inventoryRepository es obligatorio.");
  }

  if (!config) {
    throw new TypeError("config es obligatorio.");
  }

  const app = express();
  app.disable("x-powered-by");
  app.use(cors(corsOptions(config.CORS_ORIGIN)));
  app.use(express.json());

  app.get("/health", async (_request, response) => {
    await inventoryRepository.checkHealth();
    response.status(200).json({
      status: "ok",
      service: config.SERVICE_NAME,
      collection: COLLECTION_NAME,
      version: SERVICE_VERSION,
    });
  });

  app.get("/items", async (request, response) => {
    const query = parseListQuery(request.originalUrl);
    const { items, total } = await inventoryRepository.list(query);

    response.status(200).json({
      items,
      total,
      limit: query.limit,
      offset: query.offset,
    });
  });

  app.get("/items/:id", async (request, response) => {
    const item = await inventoryRepository.getById(request.params.id);

    if (!item) {
      throw new HttpError(404, "not_found", `No existe ${request.params.id}.`);
    }

    response.status(200).json(item);
  });

  app.use((request, _response, next) => {
    next(new HttpError(404, "not_found", notFoundMessage(request)));
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.code, message: error.message });
      return;
    }

    if (error?.code === "DATABASE_UNAVAILABLE") {
      response.status(503).json({
        error: "service_unavailable",
        message: "El servicio de inventario no está disponible temporalmente.",
      });
      return;
    }

    if (error?.status === 400) {
      response.status(400).json({
        error: "bad_request",
        message: "La solicitud no es válida.",
      });
      return;
    }

    response.status(500).json({
      error: "internal_error",
      message: "Ocurrió un error interno.",
    });
  });

  return app;
}
