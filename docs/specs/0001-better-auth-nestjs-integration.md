# 0001. Autenticación con Better Auth en NestJS

**Date**: 2026-11-11
**Status**: Accepted

## Summary

Vamos a usar Better Auth (una librería de autenticación que corre dentro de tu propio backend) para el registro e inicio de sesión con email y contraseña y con Google. Se conecta a NestJS con la librería comunitaria `@thallesp/nestjs-better-auth`, y guarda sus datos en tu misma base Postgres usando su propia conexión `pg`, porque tu ORM (Prisma 8) no tiene adaptador oficial. Hay dos roles, `user` y `admin`, y todas las rutas quedan protegidas por defecto. Para construirlo: sigues esta spec de arriba a abajo, y el primer admin se marca a mano con SQL.

## Context

> ⚠️ Premise note: "Autenticación completa" abarca varias decisiones (login, OAuth, roles, correo, frontend). Esta spec cubre solo la integración del backend con email y contraseña, Google y los roles user y admin. Recomiendo specs aparte para: verificación de email y recuperación de contraseña (necesita un MailModule que hoy no existe), el cliente de autenticación del frontend Next.js, y la política de cookies en producción (dominios distintos entre frontend y backend).

El proyecto es una API NestJS 11 con Express, sin ninguna autenticación hoy. Ya existen `PrismaModule`, `ArcjetModule` (con un guard global de Shield y 60 solicitudes por minuto por IP) y `ConfigModule` global. El consumidor es un frontend web separado en `http://localhost:3001` (Next.js), así que la sesión viaja en una cookie entre orígenes distintos.

La base de datos usa Prisma 8 (`@prisma/orm-postgres`, `contract.prisma`, `db.orm`). Hasta donde sé, el adaptador de Prisma de Better Auth apunta al `@prisma/client` clásico (Prisma ORM 7 o anterior), no a Prisma 8. Esto hay que revalidar al construir, porque este espacio cambia rápido.

Tres restricciones de integración afectan el diseño. Primero, la librería comunitaria exige desactivar el body parser de NestJS, y eso toca a todo el backend. Segundo, la CLI de Better Auth necesita cargar un archivo `auth.ts` que exporte una instancia ya creada, lo que choca con la regla del proyecto de no instanciar servicios a mano. Tercero, `main.ts` carga `dotenv` después de importar `AppModule`, así que cualquier archivo que lea variables de entorno al importarse las vería vacías.

## Requirements

**User stories**:
- Como visitante, quiero crear una cuenta con email y contraseña o con Google para poder usar la aplicación.
- Como usuario, quiero iniciar y cerrar sesión, y que mi sesión se mantenga una semana mientras la use.
- Como admin, quiero rutas y acciones solo para administradores, para gestionar usuarios.
- Como desarrollador del frontend, quiero llamar a la API con cookies desde `http://localhost:3001` sin errores de origen.

**Acceptance criteria** (el contrato, cada criterio se puede comprobar solo):
- **AC-1**: `POST /api/auth/sign-up/email` con `name`, `email` y `password` válidos crea un usuario con rol `PARTICIPANT`, devuelve la sesión y deja una cookie de sesión.
- **AC-2**: `POST /api/auth/sign-in/email` con credenciales correctas crea una sesión. Con email o contraseña incorrectos devuelve 401 con el mismo mensaje genérico en ambos casos (no revela si el email existe).
- **AC-3**: Entrar con Google crea la cuenta si no existe. Si ya existe un usuario con el mismo email, vincula la cuenta de Google a esa misma persona sin crear un duplicado.
- **AC-4**: Toda ruta sin `@AllowAnonymous()` devuelve 401 sin sesión. `GET /` sigue respondiendo sin iniciar sesión.
- **AC-5**: `GET /users/me` con sesión devuelve el usuario autenticado. Después de `POST /api/auth/sign-out`, la misma cookie ya no funciona (401).
- **AC-6**: Un usuario con rol `PARTICIPANT` recibe 403 en `GET /admin/ping` y en los endpoints `/api/auth/admin/*`. Un `ADMIN` recibe 200.
- **AC-7**: La sesión dura 7 días y se renueva con el uso. Una sesión vencida devuelve 401.
- **AC-8**: La contraseña exige entre 8 y 128 caracteres. Una más corta o más larga devuelve error de validación y no crea usuario.
- **AC-9**: Los intentos de `sign-in/email` y `sign-up/email` tienen un límite propio de Arcjet. Al pasarlo, la respuesta es 429.
- **AC-10**: Solo el origen `FRONTEND_URL` puede usar la API con cookies (CORS con credenciales y `trustedOrigins`). Otro origen es rechazado.
- **AC-11**: Con el body parser de NestJS desactivado, un endpoint propio que recibe JSON sigue recibiendo su body ya procesado.
- **AC-12**: Las tablas de Better Auth se crean con un script npm que usa la CLI, la app arranca sin errores y cierra su pool de `pg` al apagarse.

## Options considered

### Option 1: Better Auth con conexión `pg` propia y la librería `@thallesp/nestjs-better-auth`

Better Auth usa un `pg.Pool` hacia la misma base Postgres y crea sus propias tablas con su CLI. La librería comunitaria aporta el `AuthGuard` global, `@Session()`, `@AllowAnonymous()` y el montaje de las rutas.

**Pros**:
- No depende de que Prisma 8 tenga adaptador.
- Muy poco código propio para guard, decoradores y rutas.
- La CLI de migración ya soporta este camino.

**Cons**:
- Dos fuentes de esquema en la misma base (Prisma 8 y la CLI de Better Auth).
- La librería es comunitaria, no oficial.
- `auth.ts` crea el pool al importarse, fuera de la inyección de dependencias.

### Option 2: Better Auth con un adaptador personalizado sobre `db.orm` de Prisma 8

Se escribe un adaptador propio con la fábrica de adaptadores de Better Auth, apoyado en el cliente de Prisma 8.

**Pros**:
- Un solo ORM y una sola fuente de esquema.

**Cons**:
- Hay que escribir y mantener un adaptador contra una API de Prisma 8 todavía en candidata a lanzamiento.
- Es el camino con más riesgo de fallos sutiles en un componente de seguridad.

### Option 3: Better Auth montado a mano, sin la librería comunitaria

Un controller propio reenvía las solicitudes a `auth.handler` y un guard propio lee la sesión.

**Pros**:
- Sin dependencia comunitaria y control total.

**Cons**:
- Escribes y mantienes el guard, el decorador y el manejo del body parser.
- Más superficie para errores de seguridad sin ganar nada visible.

### Option 4: Passport y JWT propios

Autenticación hecha con `@nestjs/passport`, JWT y tablas propias.

**Pros**:
- Patrón muy conocido en NestJS.

**Cons**:
- Es reinventar autenticación: rotación de tokens, almacenamiento seguro, OAuth, vinculación de cuentas y sesiones los escribes tú.
- Mucho más trabajo para un resultado igual o peor.

## Decision

**Chosen option**: Option 1: Better Auth con conexión `pg` propia y la librería `@thallesp/nestjs-better-auth`

Better Auth gestiona usuarios, sesiones y cuentas en tu Postgres con su propia conexión, integrado a NestJS con la librería comunitaria, con el plugin `admin` para roles y Arcjet para limitar intentos.

**Implementation skills**: `better-auth-best-practices` (`better-auth/skills`, `.claude/skills/better-auth-best-practices/`) · `create-auth` (`better-auth/skills`, `.claude/skills/create-auth/`)

## Rationale

Tu ORM es Prisma 8, y la ruta con adaptador oficial de Prisma obligaría a bajar a Prisma ORM 7 o escribir un adaptador propio sobre una API aún en candidata a lanzamiento. Una conexión `pg` directa evita ambas cosas y es una de las rutas documentadas de Better Auth. El costo es tener dos fuentes de esquema, que se controla porque Prisma 8 no gestiona ninguna tabla de auth y la CLI de Better Auth solo toca las suyas.

Se elige la librería comunitaria porque el equipo es pequeño y un hackathon premia poco código propio. Su riesgo (es comunitaria) se acota: cubre guard, decoradores y montaje, y el día que deje de mantenerse el reemplazo es la Option 3, con el mismo `auth.ts`.

El plugin `admin` da roles, bloqueo de usuarios y endpoints de administración ya hechos. Arcjet ya está en el proyecto, así que el límite de intentos reutiliza esa herramienta en vez de sumar otra.

Decisiones que tomé yo (RECOMMEND), cada una con su alternativa:
- **`auth.ts` estático con `import 'dotenv/config'` arriba**: la CLI y la librería exigen una instancia lista, y `main.ts` carga el entorno tarde. Es una excepción documentada a la regla de no instanciar a mano. Alternativa: `forRootAsync` de la librería con `ConfigService`, solo si existe y la CLI sigue funcionando.
- **Módulo en `src/lib/auth/`** como infraestructura `@Global()`, importado una vez en `AppModule`, igual que Arcjet y Prisma.
- **`@Roles([ROLE.ADMIN])` de la librería** para proteger rutas propias (revisa `session.user.role`). No hace falta un `RolesGuard` propio.
- **Límite de Arcjet con un middleware de Nest** solo para `sign-in/email` y `sign-up/email`: 5 solicitudes por 60 segundos por IP, con el mismo `ARCJET_MODE` del proyecto. Alternativa: un guard global que mire la ruta.
- **IDs de texto** por defecto de Better Auth, sin tocar la generación de IDs.
- **`GET /users/me` y `GET /admin/ping`** como rutas de verificación, para poder probar AC-5 y AC-6 sin depender del frontend.
- **Enfoque de construcción**: no hay uno registrado, así que usé Tracer Bullet (una ruta delgada completa primero, luego se engrosa).

## Feature design

**Data model sketch**:

Better Auth crea y mantiene estas tablas en el esquema `public` con su CLI. Prisma 8 no las gestiona.

| Tabla | Campos clave | Notas |
|---|---|---|
| `user` | `id` (texto, PK), `name` (req), `email` (req, único), `emailVerified` (bool), `image` (opc), `createdAt`, `updatedAt`, `role` (texto, por defecto `PARTICIPANT`), `banned` (bool), `banReason` (opc), `banExpires` (opc) | Los cuatro últimos vienen del plugin `admin` |
| `session` | `id` (PK), `userId` (FK a `user`), `token` (único), `expiresAt`, `ipAddress` (opc), `userAgent` (opc), `createdAt`, `updatedAt`, `impersonatedBy` (opc) | Relación 1:N con `user` |
| `account` | `id` (PK), `userId` (FK a `user`), `providerId`, `accountId`, `password` (hash, opc), tokens de OAuth (opc), `createdAt`, `updatedAt` | 1:N con `user`. Una cuenta por método (credential, google) |
| `verification` | `id` (PK), `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt` | Se crea aunque no se use el correo todavía |

Los nombres exactos de columnas los fija la CLI de la versión instalada. Si difieren de esta tabla, manda la CLI.

Los modelos de ejemplo `User` y `Post` de `contract.prisma` se eliminan (confirmado por el equipo, son de ejemplo).

**State transitions** (si aplica):
- Usuario: activo → bloqueado (`banned = true`, por un admin) → activo.
- Sesión: creada → renovada con el uso → vencida o revocada (`sign-out`).

**API surface**:
| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/auth/sign-up/email` | POST | `name`, `email`, `password` (todos req) | usuario, sesión, cookie | pública | 422 email ya existe, 400 contraseña inválida, 429 |
| `/api/auth/sign-in/email` | POST | `email`, `password` (req) | usuario, sesión, cookie | pública | 401 credenciales inválidas, 403 usuario bloqueado, 429 |
| `/api/auth/sign-in/social` | POST | `provider: "google"`, `callbackURL` | URL de redirección a Google | pública | 400 proveedor inválido |
| `/api/auth/callback/google` | GET | `code`, `state` (de Google) | redirección al frontend con cookie | pública | redirección con `error` si el usuario cancela |
| `/api/auth/sign-out` | POST | cookie de sesión | `{ success: true }` | sesión | 401 |
| `/api/auth/get-session` | GET | cookie de sesión | sesión y usuario, o `null` | pública | ninguno |
| `/api/auth/ok` | GET | ninguno | `{ status: "ok" }` | pública | ninguno |
| `/api/auth/admin/*` (plugin) | varios | según endpoint | según endpoint | rol `ADMIN` | 401, 403 |
| `/users/me` | GET | cookie de sesión | usuario autenticado | sesión | 401 |
| `/admin/ping` | GET | cookie de sesión | `{ ok: true }` | rol `ADMIN` | 401, 403 |
| `/` | GET | ninguno | texto de `getHello()` | pública (`@AllowAnonymous()`) | ninguno |

**Value sourcing** (de dónde sale cada valor):
| Action | Value produced / displayed | Source |
|---|---|---|
| Registro con email | `role` inicial | `defaultRole: PARTICIPANT` del plugin `admin`, y un DEFAULT en la columna `user.role` |
| Registro con email | hash de la contraseña | calculado por Better Auth, guardado en `account.password` |
| Registro con email | `name` | parámetro de entrada obligatorio (Better Auth lo exige) |
| Cualquier sesión | duración de 7 días | configuración `session.expiresIn` en `auth.ts` |
| Callback de Google | email y nombre del usuario | perfil que devuelve Google |
| Callback de Google | URL final de redirección | parámetro `callbackURL` del cliente, validado contra `trustedOrigins` |
| `GET /users/me` | usuario | `@Session()` de la librería, a partir de la cookie |
| `GET /admin/ping` | rol del usuario | `session.user.role` leído por el decorador `@Roles` de la librería |
| Cookies y CSRF | orígenes permitidos | variable `FRONTEND_URL` |
| Callback de Google | URL que se registra en Google | `BETTER_AUTH_URL` más `/api/auth/callback/google` |
| Límite de Arcjet | modo (LIVE o DRY_RUN) | variable `ARCJET_MODE` existente |
| Límite de Arcjet | identificador de quien intenta | `ip.src`, igual que el resto del proyecto |

**Key invariants**:
- El email es único en `user` (restricción de base de datos).
- Toda ruta es privada salvo que lleve `@AllowAnonymous()`.
- Todo usuario nuevo nace con rol `PARTICIPANT`. Nadie se vuelve admin por la API pública.
- Las contraseñas nunca se guardan ni se registran en claro.
- El secreto y las credenciales de Google solo viven en variables de entorno.
- Si la base de datos falla, la autenticación falla cerrada (no deja pasar a nadie).

**Security model**:
- Públicas: `GET /`, las rutas de entrada de `/api/auth/*` y `/api/auth/ok`.
- Con sesión: `GET /users/me`, `sign-out` y cualquier ruta nueva por defecto.
- Solo `ADMIN`: `/admin/*` y `/api/auth/admin/*`.
- CORS: solo `FRONTEND_URL`, con `credentials: true`. `trustedOrigins` con el mismo valor.
- Cookies: `localhost` en puertos distintos cuenta como el mismo sitio, así que `SameSite=Lax` sirve en desarrollo. En producción con dominios distintos hay que decidirlo aparte (ver Follow-up).
- Vinculación de cuentas: activada solo para `google` en `trustedProviders`, porque Google verifica el email.
- Arcjet: el guard global existente (Shield y 60 por minuto) sigue aplicando. El middleware de auth añade el límite estricto.
- No aplica una norma de cumplimiento específica (no hay pagos, salud ni datos regulados), pero el email es un dato personal.

**Configuration required**:
- `BETTER_AUTH_SECRET`: secreto de cifrado, mínimo 32 caracteres (`openssl rand -base64 32`).
- `BETTER_AUTH_URL`: URL pública del backend, `http://localhost:3000` en desarrollo.
- `FRONTEND_URL`: `http://localhost:3001`, para CORS y `trustedOrigins`.
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: credenciales OAuth de Google.
- `DATABASE_URL`: ya existe, la usa también el pool de `pg`.
- Prerrequisito (aún no hecho): crear las credenciales en Google Cloud Console. Crear un proyecto, configurar la pantalla de consentimiento OAuth, crear un cliente tipo "Aplicación web" y registrar `http://localhost:3000/api/auth/callback/google` como URI de redirección autorizada y `http://localhost:3001` como origen autorizado. Sin esto no se puede probar AC-3.

**Critical test scenarios**:
- Happy path: registrarse con email, ver `GET /users/me`, cerrar sesión y confirmar 401, verifica **AC-1**, **AC-5**.
- Happy path: entrar con email y contraseña, verifica **AC-2**.
- Happy path: entrar con Google con un email ya registrado y comprobar que no se duplica el usuario, verifica **AC-3**.
- Failure case: contraseña incorrecta y email inexistente devuelven la misma respuesta 401, verifica **AC-2**.
- Failure case: contraseña de 7 y de 129 caracteres rechazada, verifica **AC-8**.
- Failure case: seis intentos seguidos de `sign-in/email` desde la misma IP en modo LIVE, el sexto da 429, verifica **AC-9**.
- Failure case: registro simultáneo con el mismo email, uno falla por la restricción única, verifica **AC-1**.
- Failure case: Google cancelado por la persona, el frontend recibe el error y no se crea sesión, verifica **AC-3**.
- Auth/permission: sin cookie, `GET /users/me` da 401 y `GET /` da 200, verifica **AC-4**.
- Auth/permission: usuario `PARTICIPANT` en `/admin/ping` da 403, `ADMIN` da 200, verifica **AC-6**.
- Auth/permission: solicitud con `Origin` distinto de `FRONTEND_URL` es rechazada, verifica **AC-10**.
- Integración: un endpoint propio con body JSON sigue recibiéndolo, verifica **AC-11**.
- Ciclo de vida: sesión con `expiresAt` en el pasado da 401, verifica **AC-7**.
- Arranque: la app inicia y se apaga cerrando el pool, verifica **AC-12**.

## Build plan

Orden Tracer Bullet: primero una ruta delgada de punta a punta (registro con email y `GET /users/me`), luego se agregan Google, roles y límites.

1. Instalar `better-auth`, `@thallesp/nestjs-better-auth`, `pg` y `@types/pg`. Agregar las variables nuevas a `.env.example`, satisfies **AC-12**.
2. Crear `src/lib/auth/auth.ts` con `import 'dotenv/config'` arriba, el `pg.Pool` desde `DATABASE_URL`, `emailAndPassword` activado y el secreto. Crear `src/lib/auth/auth.module.ts` (`@Global()`, envuelve `AuthModule.forRoot({ auth })` de la librería) y un proveedor que cierra el pool en `onApplicationShutdown`. Importarlo una vez en `AppModule`, satisfies **AC-12**.
3. En `main.ts`, crear la app con `bodyParser: false` y activar CORS con `FRONTEND_URL` y credenciales. Verificar que la librería vuelve a registrar el parser JSON para las rutas propias, y si no, registrarlo, satisfies **AC-10**, **AC-11**.
4. Agregar el script npm de migración de la CLI de Better Auth, ejecutarlo y comprobar que las tablas se crean, satisfies **AC-12**.
5. Poner `@AllowAnonymous()` en `AppController.getHello` y crear `GET /users/me` con `@Session()` en `src/module/user/` (con `nest g module`, `controller`). Comprobar registro, `me` y cierre de sesión de punta a punta, satisfies **AC-1**, **AC-4**, **AC-5**.
6. Eliminar `User` y `Post` de `contract.prisma`, ejecutar `contract:emit` y planear la migración de Prisma 8 que retira esas tablas. Verificar con la skill `prisma-8` que un contrato sin modelos es válido. Si no lo es, dejar un modelo mínimo y anotarlo en Follow-up, satisfies **AC-12**.
7. Configurar `session.expiresIn` de 7 días y las reglas de contraseña (8 a 128), y agregar un test del login con credenciales malas, satisfies **AC-2**, **AC-7**, **AC-8**.
8. Agregar Google en `socialProviders` y `accountLinking` con `trustedProviders: ['google']`, satisfies **AC-3**.
9. Configurar `trustedOrigins` con `FRONTEND_URL` y probar un origen no permitido, satisfies **AC-10**.
10. Agregar el plugin `admin` con roles `PARTICIPANT` y `ADMIN`, volver a ejecutar la migración (la CLI debe re ejecutarse tras cambiar plugins), y la ruta `GET /admin/ping` con `@Roles`, satisfies **AC-6**.
11. Crear el middleware de Arcjet para `sign-in/email` y `sign-up/email` (5 por 60 segundos por IP), registrado en el módulo de auth, satisfies **AC-9**.
12. Escribir las pruebas e2e de los escenarios críticos y correr `npm run lint` y `npm test`, satisfies **AC-1** a **AC-12**.

## Consequences

**Positive**:
- Autenticación probada sin escribir criptografía ni manejo de sesiones propios.
- Sin dependencia de que Prisma 8 tenga adaptador.
- Roles y administración de usuarios listos con el plugin `admin`.
- Reutiliza Arcjet en vez de sumar otra herramienta.

**Negative / tradeoffs**:
- Dos fuentes de esquema en una misma base: Prisma 8 para tu dominio y la CLI de Better Auth para auth. Hay que acordarse de correr la CLI tras cambiar plugins.
- `auth.ts` crea el pool fuera de la inyección de dependencias, una excepción a la regla del proyecto.
- La librería de integración es comunitaria y puede quedar atrás de Nest o de Better Auth.
- Desactivar el body parser global es un cambio que afecta a todo el backend y debe vigilarse en cada endpoint nuevo.
- Tus futuras tablas de dominio que quieran apuntar a un usuario necesitarán una clave foránea a `user.id` (texto) escrita a mano, sin las relaciones tipadas de Prisma.

**Neutral**:
- El primer admin se crea a mano con SQL (`UPDATE "user" SET role = 'ADMIN' WHERE email = '...'`).
- Sin verificación de email por ahora, el flag `emailVerified` queda en falso para el registro con email.
- Las dependencias y versiones exactas se confirman al instalar.

## Follow-up

- [ ] Crear las credenciales de Google en Google Cloud Console antes del paso 8 (ver Configuration required).
- [ ] Spec aparte para verificación de email y recuperación de contraseña, que necesita crear `mail.module.ts` y `mail.service.ts` en `src/lib/mail/`.
- [ ] Spec aparte para la política de cookies en producción (`SameSite`, dominio de la cookie, `useSecureCookies`) cuando frontend y backend estén en dominios distintos.
- [x] Revalidado: la librería sí tiene `forRootAsync`, pero no se usa porque la CLI de Better Auth necesita `auth.ts` estático. Pendiente: revisar si el adaptador de Prisma de Better Auth ya soporta Prisma 8, y si lo soporta evaluar una spec que supere esta.
- [ ] Revalidar que el guard global de Arcjet y el `AuthGuard` global conviven bien en el orden de ejecución, y que el guard de Arcjet no consume el body de las rutas de auth.
- [ ] Las skills `better-auth-best-practices` y `create-auth` no están referenciadas en ningún `AGENTS.md` (no existe ninguno). Sus convenciones deberían vivir en `src/lib/auth/AGENTS.md` antes de construir, y no en el `AGENTS.md` raíz.
- [ ] Revisar la rama `develop`: `src/main.ts` ya tiene cambios sin guardar que hay que integrar con el paso 3.

## Notas de implementación (2026-11-11)

Lo que cambió al construir, respecto a lo planeado arriba:

- **Roles**: los nombres finales son `PARTICIPANT` (por defecto) y `ADMIN`, no `user` y `admin`. Están definidos en `ROLE` dentro de `src/lib/auth/auth.ts`.
- **El rol no se puede enviar al registrarse**: el plugin `admin` declara `role` con `input: false`. Un `sign-up` con `role` responde 400 `FIELD_NOT_ALLOWED`. Solo un `ADMIN` puede cambiarlo desde `/api/auth/admin/set-role`, y un `PARTICIPANT` recibe 403.
- **Sin código propio para CORS, body parser ni roles**: la librería ya activa CORS para `trustedOrigins`, reactiva el parser JSON para las rutas propias y trae `@Roles`. Por eso no hay `RolesGuard` ni `enableCors` en el proyecto.
- **El rol tiene DEFAULT en la base**: `ALTER TABLE "user" ALTER COLUMN role SET DEFAULT 'PARTICIPANT'`, aplicado a mano, porque la CLI de Better Auth no lo crea. Si recreas la base, hay que repetirlo.
- **Google queda desactivado hasta que existan `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`** en el `.env` (se activa solo cuando ambos tienen valor).
- **Contrato de Prisma 8 vacío**: un contrato sin modelos es válido. `User` y `Post` se borraron de la base con `db update` (estaban vacías). Después de crear las tablas de auth, `db update --dry-run` planea 0 operaciones, o sea que Prisma 8 no toca las tablas de Better Auth.
- **Instalación con `--legacy-peer-deps`**: Better Auth declara como peer opcional Prisma 7 o anterior, que choca con Prisma 8.
- **Jest**: `better-auth` es ESM puro, así que los tests unitarios que importan la librería necesitan simular `@thallesp/nestjs-better-auth`.
- **Pendiente de esta spec**: AC-9 (límite de Arcjet para sign in y sign up, paso 11) y la prueba de Google (AC-3, paso 8 sin credenciales) no están construidos ni probados.
