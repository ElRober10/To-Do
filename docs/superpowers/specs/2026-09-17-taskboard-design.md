# Taskboard (Kanban) — Proyecto de prueba técnica Inveert

Fecha: 2026-09-17

## Contexto y objetivo

Proyecto de prueba técnica para el proceso de selección de Full Stack Developer
en Inveert. Debe demostrar: PHP puro (8.4) con arquitectura MVC/en capas,
JavaScript puro con Web Components, MySQL, drag&drop entre columnas de estado,
animaciones, diseño responsive, tests unitarios (PHPUnit + Vitest), Docker, y
documentación clara. Prioridad: transmitir mentalidad de ingeniería estructurada
por encima de dominio de una tecnología concreta (según la propia oferta).

## Alcance

- Multi-tablero: cada usuario autenticado crea y gestiona sus propios tableros.
- Cada tablero tiene 5 columnas de estado fijas (no configurables en esta v1).
- Tarjetas (tareas) con: título, descripción, prioridad, fecha límite, color.
- Drag&drop de tarjetas entre columnas, con persistencia de orden.
- Autenticación con sesiones PHP (registro/login/logout).
- API REST JSON como única vía de comunicación front-back.
- Dockerizado (nginx + php-fpm + mysql).

Fuera de alcance v1: columnas configurables por el usuario, colaboración
multi-usuario sobre el mismo tablero, notificaciones, adjuntos.

## Arquitectura

### Estructura de carpetas

```
ToDo/
├── app/                    (PSR-4 App\)
│   ├── Controllers/Api/    (BoardController, TaskController, AuthController)
│   ├── Models/              (Board, Task, User)
│   ├── Repositories/        (BoardRepository, TaskRepository, UserRepository)
│   ├── Services/            (TaskService, AuthService, BoardService)
│   ├── Core/                (Router, Request, Response, Database, Session)
│   └── Middleware/          (AuthMiddleware)
├── public/                  (document root: index.php front controller)
├── frontend/                 (JS puro, Web Components)
│   ├── components/
│   ├── services/             (api.js)
│   └── styles/
├── database/                 (schema.sql, seeds.sql)
├── tests/
│   ├── Unit/                 (PHPUnit)
│   ├── Integration/           (PHPUnit contra MySQL de test)
│   └── frontend/               (Vitest + jsdom)
├── docker/                   (Dockerfile, nginx.conf)
├── docker-compose.yml
├── docs/
└── composer.json
```

### Capas backend

Controller (HTTP in/out, valida input, delega) → Service (reglas de negocio) →
Repository (SQL vía PDO, prepared statements, sin ORM) → Model (entidad simple,
sin lógica de persistencia). Repository Pattern aísla el SQL detrás de
interfaces para poder testear Services con mocks/fakes en tests unitarios.

### Routing

Front controller único (`public/index.php`) + `Router` propio (sin librería
externa): mapea método HTTP + patrón de URL a `Controller::method`. Todas las
rutas API bajo `/api/*` devuelven JSON con código HTTP correcto
(200/201/400/401/404/422).

`AuthMiddleware` protege todas las rutas `/api/*` excepto las de auth,
comprobando sesión PHP activa antes de invocar el Controller.

### Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/boards`
- `POST /api/boards`
- `GET /api/boards/{id}`
- `GET /api/boards/{id}/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/{id}` (editar campos)
- `PATCH /api/tasks/{id}/status` (mover de columna — endpoint específico
  para el drag&drop, recibe `status` y `position`)
- `DELETE /api/tasks/{id}`

### Autenticación

Sesiones PHP clásicas (`session_start`) con cookie `httpOnly` + `SameSite=Lax`.
Contraseñas con `password_hash`/`password_verify` (bcrypt/argon2 según
disponibilidad). Sin JWT: se prioriza simplicidad y seguridad por defecto
frente a un token gestionado a mano en PHP puro.

## Modelo de datos (MySQL)

Estados de tarea con nombre técnico interno y nombre visible:

| Valor interno (`status`) | Nombre visible |
|---|---|
| `backlog`      | Idea |
| `planning`     | Planificación |
| `in_progress`  | Ejecución |
| `testing`      | Pruebas |
| `done`         | Producción |

### Tablas

**users**
- `id` PK
- `name`
- `email` UNIQUE
- `password_hash`
- `created_at`

**boards**
- `id` PK
- `user_id` FK → users, `ON DELETE CASCADE`
- `name`
- `created_at`

**tasks**
- `id` PK
- `board_id` FK → boards, `ON DELETE CASCADE`
- `title`
- `description` (nullable)
- `status` ENUM(`backlog`,`planning`,`in_progress`,`testing`,`done`) DEFAULT `backlog`
- `priority` ENUM(`low`,`medium`,`high`) DEFAULT `medium`
- `color` VARCHAR(7) (hex, ej. `#4f46e5`), nullable
- `due_date` DATE, nullable
- `position` INT — orden dentro de la columna, para persistir el drag&drop
- `created_at`, `updated_at`

Índices: `tasks(board_id, status)`, `boards(user_id)`.

## Frontend: Web Components

Custom Elements nativos, sin librerías ni frameworks, Shadow DOM para
encapsular estilos por componente.

- `<app-board>` — contenedor raíz, carga el tablero vía `api.js`, pinta columnas.
- `<board-column>` — una columna/estado, zona `dragover`/`drop`.
- `<task-card>` — tarjeta individual, `draggable="true"`, dispara `CustomEvent`
  `task-move` al soltar.
- `<task-modal>` — formulario crear/editar tarea.
- `<login-form>` / `<register-form>` — autenticación.

Comunicación entre componentes vía `CustomEvent` (burbujeo hacia el padre), sin
gestor de estado externo.

### Drag&drop

HTML5 Drag and Drop API nativa (`dragstart`, `dragover`, `drop`), sin
dependencias. Al soltar: actualización optimista en UI + `PATCH
/api/tasks/{id}/status` en segundo plano; si la petición falla, se revierte el
cambio visualmente con una animación.

### Animaciones (CSS puro)

- Tarjeta se eleva (`transform`, `box-shadow`) al iniciar el arrastre.
- Columna resalta al recibir `dragover`.
- Tarjeta nueva entra con fade + slide.
- Reordenación con técnica FLIP (`transform`) para transición suave sin salto
  brusco.

### Responsive

Mobile-first, CSS Grid/Flexbox puro. Desktop: columnas en fila (scroll
horizontal si no caben). Móvil: columnas apiladas verticalmente, tarjetas a
ancho completo. Breakpoints: `480px`, `768px`, `1024px`.

## Testing

### Backend (PHPUnit)

- `tests/Unit/`: Services y Models aislados, Repository mockeado vía
  interfaces.
- `tests/Integration/`: Repository contra MySQL real de test (BD
  `todo_test`), se limpia entre tests.

### Frontend (Vitest + jsdom)

- Lógica pura extraída de los componentes (cálculo de posición, validación de
  formulario) testeada directamente.
- Comportamiento de Custom Elements (render, eventos) testeado con jsdom.

## Docker

`docker-compose.yml` con 3 servicios:

- `php`: PHP 8.4-FPM + extensiones necesarias (pdo_mysql, mbstring, etc.),
  Dockerfile propio.
- `nginx`: sirve `public/`, proxy a php-fpm.
- `mysql`: volumen persistente, `database/schema.sql` importado
  automáticamente al primer arranque.

`docker-compose up` deja el proyecto completo funcionando, BD incluida.

## Entorno local (sin Docker)

Alternativa con Laragon: PHP 8.4.25 (NTS, Win32 VS17 x64) instalado en
`C:\laragon\bin\php\php-8.4.25-nts-Win32-vs17-x64` con extensiones pdo_mysql,
mysqli, mbstring, openssl, curl, fileinfo habilitadas. La versión de sistema
(PATH `Machine`) sigue en PHP 8.3.30 salvo que el usuario haya aplicado el
cambio de PATH indicado durante el brainstorming; los scripts del proyecto no
deben asumir una versión de `php` en PATH y deben poder apuntar a la ruta
explícita si es necesario.

## Documentación del proyecto

El usuario documentará el proyecto por su cuenta (README, decisiones de
arquitectura) como parte del ejercicio — no se cubre como tarea de
implementación en este plan, pero la estructura de carpetas y nombres deben
quedar autoexplicativos para facilitarlo.
