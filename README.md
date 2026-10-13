# Microservicio de Inventario

Repositorio compartido para desarrollar el microservicio de inventario.

## Requisitos

- Git
- Acceso al proyecto compartido de MongoDB Atlas
- El entorno de ejecución correspondiente al microservicio

## Configuración local

1. Clonar el repositorio.
2. Copiar `.env.example` como `.env`.
3. Reemplazar el valor de `MONGODB_URI` por la cadena de conexión asignada.
4. Mantener `.env` únicamente en el equipo local: Git lo ignora para no publicar credenciales.

```bash
cp .env.example .env
```

## Trabajo en equipo

- `main` contiene código estable.
- Cada cambio se desarrolla en una rama (`feature/nombre-del-cambio`).
- Los cambios se integran mediante pull requests.
- No se deben subir contraseñas, cadenas de conexión reales ni archivos `.env`.

## MongoDB Atlas

Ambos integrantes deben tener acceso al mismo proyecto de Atlas. Cada persona debe usar su propio usuario de base de datos y registrar su dirección IP en **Network Access**. La cadena de conexión real se comparte por un medio seguro, nunca mediante Git.
