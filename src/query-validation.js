import { badRequest } from "./errors.js";

const DEFAULT_LIMIT = 20;
const DEFAULT_OFFSET = 0;
const MAX_LIMIT = 100;
const SAFE_INTEGER_PATTERN = /^\d+$/;
const PRODUCT_ID_PATTERN = /^PRD\d+$/i;
const BRANCH_ID_PATTERN = /^SUC\d+$/i;

function queryParamsFrom(originalUrl) {
  const queryStart = originalUrl.indexOf("?");
  return new URLSearchParams(queryStart === -1 ? "" : originalUrl.slice(queryStart + 1));
}

function singleValue(params, name) {
  const hasStructuredValue = [...params.keys()].some((key) => key.startsWith(`${name}[`));
  const values = params.getAll(name);

  if (hasStructuredValue || values.length > 1) {
    throw badRequest(`El parámetro ${name} debe enviarse una sola vez.`);
  }

  if (values.length === 0) {
    return undefined;
  }

  if (values[0] === "") {
    throw badRequest(`El parámetro ${name} no puede estar vacío.`);
  }

  return values[0];
}

function integerParam(rawValue, { name, defaultValue, minimum, maximum }) {
  if (rawValue === undefined) {
    return defaultValue;
  }

  if (!SAFE_INTEGER_PATTERN.test(rawValue)) {
    throw badRequest(`El parámetro ${name} debe ser un número entero.`);
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < minimum || (maximum !== undefined && value > maximum)) {
    const range = maximum === undefined ? `mayor o igual a ${minimum}` : `entre ${minimum} y ${maximum}`;
    throw badRequest(`El parámetro ${name} debe estar ${range}.`);
  }

  return value;
}

function identifierParam(rawValue, { name, pattern, prefix }) {
  if (rawValue === undefined) {
    return undefined;
  }

  if (!pattern.test(rawValue)) {
    throw badRequest(`El parámetro ${name} debe tener el formato ${prefix} seguido de dígitos.`);
  }

  return rawValue.toUpperCase();
}

export function parseListQuery(originalUrl) {
  const params = queryParamsFrom(originalUrl);
  const limit = integerParam(singleValue(params, "limit"), {
    name: "limit",
    defaultValue: DEFAULT_LIMIT,
    minimum: 1,
    maximum: MAX_LIMIT,
  });
  const offset = integerParam(singleValue(params, "offset"), {
    name: "offset",
    defaultValue: DEFAULT_OFFSET,
    minimum: 0,
  });
  const productoId = identifierParam(singleValue(params, "productoId"), {
    name: "productoId",
    pattern: PRODUCT_ID_PATTERN,
    prefix: "PRD",
  });
  const sucursalId = identifierParam(singleValue(params, "sucursalId"), {
    name: "sucursalId",
    pattern: BRANCH_ID_PATTERN,
    prefix: "SUC",
  });

  return {
    limit,
    offset,
    ...(productoId === undefined ? {} : { productoId }),
    ...(sucursalId === undefined ? {} : { sucursalId }),
  };
}
