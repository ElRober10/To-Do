# Plan de implementación — Taskboard Kanban

> **Para agentes:** SUB-SKILL REQUERIDA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea a tarea. Los pasos usan checkboxes (`- [ ]`) para seguimiento.

**Objetivo:** Construir un tablero Kanban multi-tablero funcional, con backend PHP 8.4 en API REST (capas al estilo MVC, PDO/MySQL, auth por sesión) y frontend en JS puro con Web Components, drag&drop, animaciones, tests PHPUnit + Vitest, y Docker.

**Arquitectura:** Front controller (`public/index.php`) → `Router` despacha a `Controllers` → `Services` (reglas de negocio) → `Repositories` (PDO/SQL) → `Models` (objetos de valor simples). Frontend: Custom Elements nativos que consumen la API REST vía `fetch`, HTML5 Drag and Drop API, animaciones solo con CSS.

**Stack tecnológico:** PHP 8.4 (sin framework), PDO/MySQL, PHPUnit 11, JS puro (módulos ES, Web Components, Shadow DOM), Vitest + jsdom, Docker (nginx + php-fpm + mysql).

**Spec:** `docs/superpowers/specs/2026-09-17-taskboard-design.md`

## Restricciones globales

- Versión de PHP: 8.4 (el proyecto apunta a 8.4; el mínimo en composer.json es `>=8.1`, se deja así por portabilidad, pero se desarrolla/testea contra 8.4).
- Sin framework PHP, sin ORM — solo PDO con prepared statements.
- Sin framework/librería JS — solo Custom Elements nativos, Shadow DOM, `fetch` y HTML5 Drag and Drop API.
- Todas las respuestas de `/api/*` son JSON con el código HTTP correcto.
- Autenticación con sesiones PHP + cookie `httpOnly`, `password_hash`/`password_verify`.
- 5 estados fijos de tarea: `backlog`, `planning`, `in_progress`, `testing`, `done`.
- Todo acceso a BD pasa por un Repository — Controllers/Services nunca escriben SQL directo.
- CSS responsive mobile-first, breakpoints `480px`, `768px`, `1024px`.

---

## Estructura de archivos (objetivo)

```
app/
  Core/Database.php
  Core/Request.php
  Core/Response.php
  Core/Router.php
  Core/Session.php
  Core/ApiException.php
  Middleware/AuthMiddleware.php
  Models/User.php
  Models/Board.php
  Models/Task.php
  Repositories/UserRepository.php
  Repositories/BoardRepository.php
  Repositories/TaskRepository.php
  Services/AuthService.php
  Services/BoardService.php
  Services/TaskService.php
  Controllers/Api/AuthController.php
  Controllers/Api/BoardController.php
  Controllers/Api/TaskController.php
public/
  index.php
database/
  schema.sql
frontend/
  index.html
  services/api.js
  components/task-card.js
  components/board-column.js
  components/app-board.js
  components/task-modal.js
  components/login-form.js
  components/register-form.js
  styles/base.css
  styles/animations.css
tests/
  Unit/Services/AuthServiceTest.php
  Unit/Services/TaskServiceTest.php
  Integration/Repositories/UserRepositoryTest.php
  Integration/Repositories/TaskRepositoryTest.php
  bootstrap.php
  frontend/task-position.test.js
docker/
  Dockerfile
  nginx.conf
docker-compose.yml
phpunit.xml
package.json
vitest.config.js
```

---

## Tarea 1: Esqueleto del proyecto, configuración y conexión a BD

**Archivos:**
- Crear: `app/Core/Database.php`
- Crear: `config/config.php`
- Crear: `.env.example`
- Crear: `.gitignore`
- Crear: `database/schema.sql`
- Modificar: `composer.json` (add `App\` already present; no change needed if already correct — verify)

**Interfaces:**
- Produce: `App\Core\Database::connection(): PDO` — conexión PDO singleton perezosa, leída de las variables de entorno `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` (con valores por defecto razonables en local).

- [ ] **Paso 1: Crea `.gitignore`**

```
/vendor/
/node_modules/
.env
*.log
```

- [ ] **Paso 2: Crea `.env.example`**

```
DB_HOST=127.0.0.1
DB_NAME=todo
DB_USER=root
DB_PASS=
```

- [ ] **Paso 3: Crea `database/schema.sql`**

```sql
CREATE DATABASE IF NOT EXISTS todo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE todo;

CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE boards (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(120) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_boards_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_boards_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE tasks (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    board_id INT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    description TEXT NULL,
    status ENUM('backlog','planning','in_progress','testing','done') NOT NULL DEFAULT 'backlog',
    priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    color VARCHAR(7) NULL,
    due_date DATE NULL,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_tasks_board FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    INDEX idx_tasks_board_status (board_id, status)
) ENGINE=InnoDB;
```

- [ ] **Paso 4: Crea `config/config.php`**

```php
<?php

declare(strict_types=1);

return [
    'db' => [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'name' => getenv('DB_NAME') ?: 'todo',
        'user' => getenv('DB_USER') ?: 'root',
        'pass' => getenv('DB_PASS') ?: '',
    ],
];
```

- [ ] **Paso 5: Crea `app/Core/Database.php`**

```php
<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection === null) {
            $config = require dirname(__DIR__, 2) . '/config/config.php';
            $db = $config['db'];
            $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $db['host'], $db['name']);

            try {
                self::$connection = new PDO($dsn, $db['user'], $db['pass'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]);
            } catch (PDOException $e) {
                throw new PDOException('No se pudo conectar a la base de datos: ' . $e->getMessage(), (int) $e->getCode());
            }
        }

        return self::$connection;
    }
}
```

- [ ] **Paso 6: Verifica el autoload de composer e instala dependencias**

Ejecuta: `composer install`
Esperado: crea `vendor/`, sin errores.

- [ ] **Paso 7: Commit**

```bash
git add .gitignore .env.example database/schema.sql config/config.php app/Core/Database.php composer.lock
git commit -m "feat: add DB schema, config and PDO connection wrapper"
```

---

## Tarea 2: Primitivas HTTP del núcleo (Request, Response, Router, Session, ApiException)

**Archivos:**
- Crear: `app/Core/Request.php`
- Crear: `app/Core/Response.php`
- Crear: `app/Core/Router.php`
- Crear: `app/Core/Session.php`
- Crear: `app/Core/ApiException.php`
- Test: `tests/Unit/Core/RouterTest.php`
- Test: `tests/bootstrap.php`
- Modificar: `composer.json` (add `autoload-dev` psr-4 `Tests\\` → `tests/`, and phpunit config)
- Crear: `phpunit.xml`

**Interfaces:**
- Produce: `App\Core\Request` — `method(): string`, `path(): string`, `input(string $key, $default = null): mixed`, `all(): array`, `params(): array`, `setParams(array $params): void`, estático `fromGlobals(): self`.
- Produce: `App\Core\Response::json(array $data, int $status = 200): never` — fija cabecera + status, imprime JSON, termina la ejecución.
- Produce: `App\Core\Router::add(string $method, string $pattern, callable $handler): void`, `dispatch(Request $request): void`.
- Produce: `App\Core\Session::start(): void`, `set`, `get`, `has`, `remove`, `destroy`, `regenerate`.
- Produce: `App\Core\ApiException` extiende `\RuntimeException`, constructor `(string $message, int $status = 400)`, getter `getStatus(): int`.

- [ ] **Paso 1: Crea `phpunit.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit bootstrap="tests/bootstrap.php" colors="true">
    <testsuites>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
        <testsuite name="Integration">
            <directory>tests/Integration</directory>
        </testsuite>
    </testsuites>
</phpunit>
```

- [ ] **Paso 2: Crea `tests/bootstrap.php`**

```php
<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';
```

- [ ] **Paso 3: Crea `app/Core/ApiException.php`**

```php
<?php

declare(strict_types=1);

namespace App\Core;

class ApiException extends \RuntimeException
{
    public function __construct(string $message, private readonly int $status = 400)
    {
        parent::__construct($message);
    }

    public function getStatus(): int
    {
        return $this->status;
    }
}
```

- [ ] **Paso 4: Crea `app/Core/Request.php`**

```php
<?php

declare(strict_types=1);

namespace App\Core;

final class Request
{
    private array $params = [];

    private function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $query,
        private readonly array $body,
    ) {
    }

    public static function fromGlobals(): self
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = rtrim((string) parse_url($uri, PHP_URL_PATH), '/');
        $path = $path === '' ? '/' : $path;

        $rawBody = file_get_contents('php://input') ?: '';
        $decoded = [];
        if ($rawBody !== '') {
            $decoded = json_decode($rawBody, true) ?? [];
        }

        return new self($method, $path, $_GET, $decoded);
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    public function all(): array
    {
        return array_merge($this->query, $this->body);
    }

    public function params(): array
    {
        return $this->params;
    }

    public function setParams(array $params): void
    {
        $this->params = $params;
    }
}
```

- [ ] **Paso 5: Crea `app/Core/Response.php`**

```php
<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    public static function json(array $data, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }
}
```

- [ ] **Paso 6: Crea `app/Core/Router.php`**

```php
<?php

declare(strict_types=1);

namespace App\Core;

final class Router
{
    /** @var array<int, array{method: string, pattern: string, regex: string, handler: callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $regex = preg_replace('#\{([a-zA-Z_]+)\}#', '(?P<$1>[^/]+)', $pattern);
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'regex' => '#^' . $regex . '$#',
            'handler' => $handler,
        ];
    }

    public function dispatch(Request $request): void
    {
        $method = $request->method();
        $path = $request->path();

        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) {
                continue;
            }

            if (preg_match($route['regex'], $path, $matches)) {
                $params = array_filter(
                    $matches,
                    static fn ($key) => is_string($key),
                    ARRAY_FILTER_USE_KEY
                );
                $request->setParams($params);
                ($route['handler'])($request);
                return;
            }
        }

        Response::json(['error' => 'Ruta no encontrada'], 404);
    }
}
```

- [ ] **Paso 7: Crea `app/Core/Session.php`**

```php
<?php

declare(strict_types=1);

namespace App\Core;

final class Session
{
    public static function start(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_set_cookie_params([
                'httponly' => true,
                'samesite' => 'Lax',
            ]);
            session_start();
        }
    }

    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function has(string $key): bool
    {
        return isset($_SESSION[$key]);
    }

    public static function remove(string $key): void
    {
        unset($_SESSION[$key]);
    }

    public static function destroy(): void
    {
        $_SESSION = [];
        session_destroy();
    }

    public static function regenerate(): void
    {
        session_regenerate_id(true);
    }
}
```

- [ ] **Paso 8: Escribe el test que falla para Router**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Core;

use App\Core\Request;
use App\Core\Router;
use PHPUnit\Framework\TestCase;

final class RouterTest extends TestCase
{
    public function testDispatchesMatchingRouteWithParams(): void
    {
        $router = new Router();
        $captured = null;

        $router->add('GET', '/api/boards/{id}', function (Request $request) use (&$captured): void {
            $captured = $request->params();
        });

        $reflection = new \ReflectionClass(Request::class);
        $request = $reflection->newInstanceWithoutConstructor();
        $this->setPrivate($request, 'method', 'GET');
        $this->setPrivate($request, 'path', '/api/boards/42');
        $this->setPrivate($request, 'query', []);
        $this->setPrivate($request, 'body', []);

        $router->dispatch($request);

        $this->assertSame(['id' => '42'], $captured);
    }

    private function setPrivate(object $object, string $property, mixed $value): void
    {
        $ref = new \ReflectionProperty($object, $property);
        $ref->setAccessible(true);
        $ref->setValue($object, $value);
    }
}
```

- [ ] **Paso 9: Ejecuta el test para comprobar que falla**

Ejecuta: `vendor/bin/phpunit tests/Unit/Core/RouterTest.php`
Esperado: FAIL (clase `App\Core\Router` o errores de reflection) — como Router/Request ya se crearon arriba, ejecútalo primero para confirmar que PASA ahora (los archivos se crearon en los pasos 4-7). Si falla por un motivo distinto a "class not found", arregla la lógica del Router antes de continuar.

- [ ] **Paso 10: Ejecuta el test para comprobar que pasa**

Ejecuta: `vendor/bin/phpunit tests/Unit/Core/RouterTest.php`
Esperado: PASS (1 test, 1 assertion)

- [ ] **Paso 11: Commit**

```bash
git add app/Core/Request.php app/Core/Response.php app/Core/Router.php app/Core/Session.php app/Core/ApiException.php tests/Unit/Core/RouterTest.php tests/bootstrap.php phpunit.xml
git commit -m "feat: add core HTTP primitives (Request, Response, Router, Session)"
```

---

## Tarea 3: Modelo User, repositorio y AuthService (registro/login)

**Archivos:**
- Crear: `app/Models/User.php`
- Crear: `app/Repositories/UserRepository.php`
- Crear: `app/Services/AuthService.php`
- Test: `tests/Unit/Services/AuthServiceTest.php`

**Interfaces:**
- Consume: `App\Core\Database::connection(): PDO`, `App\Core\Session`, `App\Core\ApiException`.
- Produce: `App\Models\User::fromRow(array $row): self` con propiedades públicas readonly `id, name, email`; `toArray(): array`.
- Produce: `App\Repositories\UserRepository::findByEmail(string $email): ?array`, `findById(int $id): ?array`, `create(string $name, string $email, string $passwordHash): int`.
- Produce: `App\Services\AuthService::register(string $name, string $email, string $password): array` (devuelve array de usuario, lanza `ApiException` 422 si el email ya existe), `login(string $email, string $password): array` (lanza `ApiException` 401 si las credenciales son inválidas), `logout(): void`, `currentUser(): ?array`.

- [ ] **Paso 1: Crea `app/Models/User.php`**

```php
<?php

declare(strict_types=1);

namespace App\Models;

final class User
{
    public function __construct(
        public readonly int $id,
        public readonly string $name,
        public readonly string $email,
    ) {
    }

    public static function fromRow(array $row): self
    {
        return new self((int) $row['id'], (string) $row['name'], (string) $row['email']);
    }

    public function toArray(): array
    {
        return ['id' => $this->id, 'name' => $this->name, 'email' => $this->email];
    }
}
```

- [ ] **Paso 2: Crea `app/Repositories/UserRepository.php`**

```php
<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

final class UserRepository
{
    public function findByEmail(string $email): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function findById(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function create(string $name, string $email, string $passwordHash): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO users (name, email, password_hash) VALUES (:name, :email, :password_hash)'
        );
        $stmt->execute(['name' => $name, 'email' => $email, 'password_hash' => $passwordHash]);
        return (int) Database::connection()->lastInsertId();
    }
}
```

- [ ] **Paso 3: Crea `app/Services/AuthService.php`**

```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Core\Session;
use App\Models\User;
use App\Repositories\UserRepository;

final class AuthService
{
    public function __construct(private readonly UserRepository $users)
    {
    }

    public function register(string $name, string $email, string $password): array
    {
        if (trim($name) === '' || trim($email) === '' || strlen($password) < 6) {
            throw new ApiException('Nombre, email y contraseña (mínimo 6 caracteres) son obligatorios', 422);
        }

        if ($this->users->findByEmail($email) !== null) {
            throw new ApiException('Ese email ya está registrado', 422);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $id = $this->users->create($name, $email, $hash);

        $user = User::fromRow(['id' => $id, 'name' => $name, 'email' => $email]);
        $this->logIn($user);

        return $user->toArray();
    }

    public function login(string $email, string $password): array
    {
        $row = $this->users->findByEmail($email);

        if ($row === null || !password_verify($password, $row['password_hash'])) {
            throw new ApiException('Credenciales inválidas', 401);
        }

        $user = User::fromRow($row);
        $this->logIn($user);

        return $user->toArray();
    }

    public function logout(): void
    {
        Session::destroy();
    }

    public function currentUser(): ?array
    {
        $id = Session::get('user_id');
        if ($id === null) {
            return null;
        }

        $row = $this->users->findById((int) $id);
        return $row === null ? null : User::fromRow($row)->toArray();
    }

    private function logIn(User $user): void
    {
        Session::start();
        Session::regenerate();
        Session::set('user_id', $user->id);
    }
}
```

- [ ] **Paso 4: Escribe los tests que fallan para AuthService usando un repositorio falso**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Core\ApiException;
use App\Repositories\UserRepository;
use App\Services\AuthService;
use PHPUnit\Framework\TestCase;

final class AuthServiceTest extends TestCase
{
    protected function setUp(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }
        $_SESSION = [];
    }

    public function testRegisterRejectsShortPassword(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->expects($this->never())->method('create');

        $service = new AuthService($repo);

        $this->expectException(ApiException::class);
        $service->register('Rober', 'rober@example.com', '123');
    }

    public function testRegisterRejectsDuplicateEmail(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn(['id' => 1, 'email' => 'rober@example.com']);
        $repo->expects($this->never())->method('create');

        $service = new AuthService($repo);

        $this->expectException(ApiException::class);
        $service->register('Rober', 'rober@example.com', 'secret123');
    }

    public function testLoginRejectsInvalidCredentials(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn(null);

        $service = new AuthService($repo);

        $this->expectException(ApiException::class);
        $service->login('nobody@example.com', 'whatever');
    }

    public function testLoginReturnsUserOnValidCredentials(): void
    {
        $hash = password_hash('secret123', PASSWORD_DEFAULT);
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn([
            'id' => 7,
            'name' => 'Rober',
            'email' => 'rober@example.com',
            'password_hash' => $hash,
        ]);

        $service = new AuthService($repo);
        $result = $service->login('rober@example.com', 'secret123');

        $this->assertSame(7, $result['id']);
        $this->assertSame('rober@example.com', $result['email']);
    }
}
```

- [ ] **Paso 5: Ejecuta los tests para comprobar que fallan**

Ejecuta: `vendor/bin/phpunit tests/Unit/Services/AuthServiceTest.php`
Esperado: FAIL si `AuthService`/`UserRepository` no existen aún — como se crearon en los pasos 2-3, ejecútalo ahora y confirma que los 4 pasan; si alguno falla, corrige la implementación hasta que esté en verde.

- [ ] **Paso 6: Ejecuta los tests para comprobar que pasan**

Ejecuta: `vendor/bin/phpunit tests/Unit/Services/AuthServiceTest.php`
Esperado: PASS (4 tests)

- [ ] **Paso 7: Commit**

```bash
git add app/Models/User.php app/Repositories/UserRepository.php app/Services/AuthService.php tests/Unit/Services/AuthServiceTest.php
git commit -m "feat: add User model, UserRepository and AuthService with tests"
```

---

## Tarea 4: AuthMiddleware y AuthController, conectados al front controller

**Archivos:**
- Crear: `app/Middleware/AuthMiddleware.php`
- Crear: `app/Controllers/Api/AuthController.php`
- Crear: `public/index.php`

**Interfaces:**
- Consume: `App\Services\AuthService`, `App\Core\Session`, `App\Core\Response`, `App\Core\ApiException`.
- Produce: `App\Middleware\AuthMiddleware::requireUserId(): int` — lee `Session::get('user_id')`, lanza `ApiException('No autenticado', 401)` si no existe.
- Produce: `App\Controllers\Api\AuthController::register(Request $r)`, `login(Request $r)`, `logout(Request $r)`, `me(Request $r)` — cada uno responde vía `Response::json`.

- [ ] **Paso 1: Crea `app/Middleware/AuthMiddleware.php`**

```php
<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Session;

final class AuthMiddleware
{
    public function requireUserId(): int
    {
        Session::start();
        $id = Session::get('user_id');

        if ($id === null) {
            throw new ApiException('No autenticado', 401);
        }

        return (int) $id;
    }
}
```

- [ ] **Paso 2: Crea `app/Controllers/Api/AuthController.php`**

```php
<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Request;
use App\Core\Response;
use App\Repositories\UserRepository;
use App\Services\AuthService;

final class AuthController
{
    private AuthService $auth;

    public function __construct()
    {
        $this->auth = new AuthService(new UserRepository());
    }

    public function register(Request $request): void
    {
        $user = $this->auth->register(
            (string) $request->input('name', ''),
            (string) $request->input('email', ''),
            (string) $request->input('password', '')
        );

        Response::json(['user' => $user], 201);
    }

    public function login(Request $request): void
    {
        $user = $this->auth->login(
            (string) $request->input('email', ''),
            (string) $request->input('password', '')
        );

        Response::json(['user' => $user]);
    }

    public function logout(Request $request): void
    {
        $this->auth->logout();
        Response::json(['ok' => true]);
    }

    public function me(Request $request): void
    {
        $user = $this->auth->currentUser();

        if ($user === null) {
            Response::json(['user' => null], 200);
        }

        Response::json(['user' => $user]);
    }
}
```

- [ ] **Paso 3: Crea `public/index.php`**

```php
<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Core\Session;
use App\Controllers\Api\AuthController;

Session::start();

$router = new Router();
$auth = new AuthController();

$router->add('POST', '/api/auth/register', [$auth, 'register']);
$router->add('POST', '/api/auth/login', [$auth, 'login']);
$router->add('POST', '/api/auth/logout', [$auth, 'logout']);
$router->add('GET', '/api/auth/me', [$auth, 'me']);

$request = Request::fromGlobals();

try {
    $router->dispatch($request);
} catch (ApiException $e) {
    Response::json(['error' => $e->getMessage()], $e->getStatus());
} catch (\Throwable $e) {
    Response::json(['error' => 'Error interno del servidor'], 500);
}
```

- [ ] **Paso 4: Prueba manual con el servidor integrado de PHP**

Ejecuta: `php -S 127.0.0.1:8080 -t public`
Luego en otra terminal:
`curl -s -X POST http://127.0.0.1:8080/api/auth/register -H "Content-Type: application/json" -d "{\"name\":\"Rober\",\"email\":\"rober@test.com\",\"password\":\"secret123\"}"`
Esperado: JSON `{"user":{"id":1,"name":"Rober","email":"rober@test.com"}}` con HTTP 201 (requiere la BD `todo` con el schema importado y `.env`/variables de entorno configuradas — si no, se espera un error de conexión a BD, aceptable en este paso y resuelto cuando la BD esté disponible en local o vía Docker en la Tarea 9).

- [ ] **Paso 5: Commit**

```bash
git add app/Middleware/AuthMiddleware.php app/Controllers/Api/AuthController.php public/index.php
git commit -m "feat: add AuthMiddleware, AuthController and front controller wiring"
```

---

## Tarea 5: Modelo Board, repositorio, servicio y controlador

**Archivos:**
- Crear: `app/Models/Board.php`
- Crear: `app/Repositories/BoardRepository.php`
- Crear: `app/Services/BoardService.php`
- Crear: `app/Controllers/Api/BoardController.php`
- Modificar: `public/index.php` (register board routes)
- Test: `tests/Unit/Services/BoardServiceTest.php`

**Interfaces:**
- Consume: `App\Middleware\AuthMiddleware::requireUserId(): int`.
- Produce: `App\Models\Board::fromRow(array $row): self` con `id, userId, name`; `toArray(): array`.
- Produce: `App\Repositories\BoardRepository::allForUser(int $userId): array`, `find(int $id): ?array`, `create(int $userId, string $name): int`.
- Produce: `App\Services\BoardService::listForUser(int $userId): array`, `create(int $userId, string $name): array`, `getOwned(int $boardId, int $userId): array` (lanza `ApiException` 404 si no existe o no pertenece al usuario).

- [ ] **Paso 1: Crea `app/Models/Board.php`**

```php
<?php

declare(strict_types=1);

namespace App\Models;

final class Board
{
    public function __construct(
        public readonly int $id,
        public readonly int $userId,
        public readonly string $name,
    ) {
    }

    public static function fromRow(array $row): self
    {
        return new self((int) $row['id'], (int) $row['user_id'], (string) $row['name']);
    }

    public function toArray(): array
    {
        return ['id' => $this->id, 'name' => $this->name];
    }
}
```

- [ ] **Paso 2: Crea `app/Repositories/BoardRepository.php`**

```php
<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

final class BoardRepository
{
    public function allForUser(int $userId): array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM boards WHERE user_id = :user_id ORDER BY created_at DESC');
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM boards WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function create(int $userId, string $name): int
    {
        $stmt = Database::connection()->prepare('INSERT INTO boards (user_id, name) VALUES (:user_id, :name)');
        $stmt->execute(['user_id' => $userId, 'name' => $name]);
        return (int) Database::connection()->lastInsertId();
    }
}
```

- [ ] **Paso 3: Crea `app/Services/BoardService.php`**

```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Models\Board;
use App\Repositories\BoardRepository;

final class BoardService
{
    public function __construct(private readonly BoardRepository $boards)
    {
    }

    public function listForUser(int $userId): array
    {
        return array_map(
            static fn (array $row) => Board::fromRow($row)->toArray(),
            $this->boards->allForUser($userId)
        );
    }

    public function create(int $userId, string $name): array
    {
        if (trim($name) === '') {
            throw new ApiException('El nombre del tablero es obligatorio', 422);
        }

        $id = $this->boards->create($userId, $name);
        return Board::fromRow(['id' => $id, 'user_id' => $userId, 'name' => $name])->toArray();
    }

    public function getOwned(int $boardId, int $userId): array
    {
        $row = $this->boards->find($boardId);

        if ($row === null || (int) $row['user_id'] !== $userId) {
            throw new ApiException('Tablero no encontrado', 404);
        }

        return Board::fromRow($row)->toArray();
    }
}
```

- [ ] **Paso 4: Crea `app/Controllers/Api/BoardController.php`**

```php
<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\BoardRepository;
use App\Services\BoardService;

final class BoardController
{
    private BoardService $boards;
    private AuthMiddleware $auth;

    public function __construct()
    {
        $this->boards = new BoardService(new BoardRepository());
        $this->auth = new AuthMiddleware();
    }

    public function index(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        Response::json(['boards' => $this->boards->listForUser($userId)]);
    }

    public function store(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $board = $this->boards->create($userId, (string) $request->input('name', ''));
        Response::json(['board' => $board], 201);
    }

    public function show(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $board = $this->boards->getOwned((int) $request->params()['id'], $userId);
        Response::json(['board' => $board]);
    }
}
```

- [ ] **Paso 5: Registra las rutas en `public/index.php`**

Añade después de las rutas de auth:

```php
use App\Controllers\Api\BoardController;

$boards = new BoardController();
$router->add('GET', '/api/boards', [$boards, 'index']);
$router->add('POST', '/api/boards', [$boards, 'store']);
$router->add('GET', '/api/boards/{id}', [$boards, 'show']);
```

- [ ] **Paso 6: Escribe el test que falla para BoardService**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Core\ApiException;
use App\Repositories\BoardRepository;
use App\Services\BoardService;
use PHPUnit\Framework\TestCase;

final class BoardServiceTest extends TestCase
{
    public function testCreateRejectsEmptyName(): void
    {
        $repo = $this->createMock(BoardRepository::class);
        $repo->expects($this->never())->method('create');

        $service = new BoardService($repo);

        $this->expectException(ApiException::class);
        $service->create(1, '   ');
    }

    public function testGetOwnedThrowsWhenNotOwner(): void
    {
        $repo = $this->createMock(BoardRepository::class);
        $repo->method('find')->willReturn(['id' => 5, 'user_id' => 99, 'name' => 'Otro']);

        $service = new BoardService($repo);

        $this->expectException(ApiException::class);
        $service->getOwned(5, 1);
    }

    public function testGetOwnedReturnsBoardWhenOwner(): void
    {
        $repo = $this->createMock(BoardRepository::class);
        $repo->method('find')->willReturn(['id' => 5, 'user_id' => 1, 'name' => 'Mío']);

        $service = new BoardService($repo);
        $board = $service->getOwned(5, 1);

        $this->assertSame('Mío', $board['name']);
    }
}
```

- [ ] **Paso 7: Ejecuta los tests, comprueba que fallan y luego que pasan**

Ejecuta: `vendor/bin/phpunit tests/Unit/Services/BoardServiceTest.php`
Esperado: PASS (3 tests) una vez existan los archivos de los pasos 1-3.

- [ ] **Paso 8: Commit**

```bash
git add app/Models/Board.php app/Repositories/BoardRepository.php app/Services/BoardService.php app/Controllers/Api/BoardController.php public/index.php tests/Unit/Services/BoardServiceTest.php
git commit -m "feat: add Board model, repository, service, controller and routes"
```

---

## Tarea 6: Modelo Task, repositorio, servicio (con lógica de posición) y controlador

**Archivos:**
- Crear: `app/Models/Task.php`
- Crear: `app/Repositories/TaskRepository.php`
- Crear: `app/Services/TaskService.php`
- Crear: `app/Controllers/Api/TaskController.php`
- Modificar: `public/index.php` (register task routes)
- Test: `tests/Unit/Services/TaskServiceTest.php`

**Interfaces:**
- Consume: `App\Services\BoardService::getOwned(int, int): array` (comprobación de propiedad antes de tocar tareas), `App\Middleware\AuthMiddleware::requireUserId(): int`.
- Produce: `App\Models\Task::fromRow(array $row): self` con `id, boardId, title, description, status, priority, color, dueDate, position`; `toArray(): array`.
- Produce: `App\Repositories\TaskRepository::allForBoard(int $boardId): array`, `find(int $id): ?array`, `create(array $data): int`, `update(int $id, array $data): void`, `updateStatusAndPosition(int $id, string $status, int $position): void`, `delete(int $id): void`, `maxPositionForStatus(int $boardId, string $status): int`.
- Produce: `App\Services\TaskService::listForBoard(int $boardId, int $userId): array`, `create(int $boardId, int $userId, array $data): array`, `update(int $taskId, int $userId, array $data): array`, `moveStatus(int $taskId, int $userId, string $status, int $position): array`, `delete(int $taskId, int $userId): void`.

- [ ] **Paso 1: Crea `app/Models/Task.php`**

```php
<?php

declare(strict_types=1);

namespace App\Models;

final class Task
{
    public function __construct(
        public readonly int $id,
        public readonly int $boardId,
        public readonly string $title,
        public readonly ?string $description,
        public readonly string $status,
        public readonly string $priority,
        public readonly ?string $color,
        public readonly ?string $dueDate,
        public readonly int $position,
    ) {
    }

    public static function fromRow(array $row): self
    {
        return new self(
            (int) $row['id'],
            (int) $row['board_id'],
            (string) $row['title'],
            $row['description'] !== null ? (string) $row['description'] : null,
            (string) $row['status'],
            (string) $row['priority'],
            $row['color'] !== null ? (string) $row['color'] : null,
            $row['due_date'] !== null ? (string) $row['due_date'] : null,
            (int) $row['position'],
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'boardId' => $this->boardId,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'priority' => $this->priority,
            'color' => $this->color,
            'dueDate' => $this->dueDate,
            'position' => $this->position,
        ];
    }
}
```

- [ ] **Paso 2: Crea `app/Repositories/TaskRepository.php`**

```php
<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

final class TaskRepository
{
    public function allForBoard(int $boardId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM tasks WHERE board_id = :board_id ORDER BY status, position ASC'
        );
        $stmt->execute(['board_id' => $boardId]);
        return $stmt->fetchAll();
    }

    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM tasks WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function maxPositionForStatus(int $boardId, string $status): int
    {
        $stmt = Database::connection()->prepare(
            'SELECT COALESCE(MAX(position), -1) AS max_pos FROM tasks WHERE board_id = :board_id AND status = :status'
        );
        $stmt->execute(['board_id' => $boardId, 'status' => $status]);
        return (int) $stmt->fetch()['max_pos'];
    }

    public function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO tasks (board_id, title, description, status, priority, color, due_date, position)
             VALUES (:board_id, :title, :description, :status, :priority, :color, :due_date, :position)'
        );
        $stmt->execute([
            'board_id' => $data['board_id'],
            'title' => $data['title'],
            'description' => $data['description'],
            'status' => $data['status'],
            'priority' => $data['priority'],
            'color' => $data['color'],
            'due_date' => $data['due_date'],
            'position' => $data['position'],
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE tasks SET title = :title, description = :description, priority = :priority,
             color = :color, due_date = :due_date WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'title' => $data['title'],
            'description' => $data['description'],
            'priority' => $data['priority'],
            'color' => $data['color'],
            'due_date' => $data['due_date'],
        ]);
    }

    public function updateStatusAndPosition(int $id, string $status, int $position): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE tasks SET status = :status, position = :position WHERE id = :id'
        );
        $stmt->execute(['id' => $id, 'status' => $status, 'position' => $position]);
    }

    public function delete(int $id): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM tasks WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }
}
```

- [ ] **Paso 3: Crea `app/Services/TaskService.php`**

```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Models\Task;
use App\Repositories\TaskRepository;

final class TaskService
{
    private const VALID_STATUSES = ['backlog', 'planning', 'in_progress', 'testing', 'done'];
    private const VALID_PRIORITIES = ['low', 'medium', 'high'];

    public function __construct(
        private readonly TaskRepository $tasks,
        private readonly BoardService $boardsService,
    ) {
    }

    public function listForBoard(int $boardId, int $userId): array
    {
        $this->boardsService->getOwned($boardId, $userId);

        return array_map(
            static fn (array $row) => Task::fromRow($row)->toArray(),
            $this->tasks->allForBoard($boardId)
        );
    }

    public function create(int $boardId, int $userId, array $data): array
    {
        $this->boardsService->getOwned($boardId, $userId);
        $this->assertValidTitle($data['title'] ?? '');

        $status = 'backlog';
        $position = $this->tasks->maxPositionForStatus($boardId, $status) + 1;

        $id = $this->tasks->create([
            'board_id' => $boardId,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'status' => $status,
            'priority' => $this->validPriority($data['priority'] ?? 'medium'),
            'color' => $data['color'] ?? null,
            'due_date' => $data['dueDate'] ?? null,
            'position' => $position,
        ]);

        $row = $this->tasks->find($id);
        return Task::fromRow($row)->toArray();
    }

    public function update(int $taskId, int $userId, array $data): array
    {
        $task = $this->findOwned($taskId, $userId);
        $this->assertValidTitle($data['title'] ?? $task['title']);

        $this->tasks->update($taskId, [
            'title' => $data['title'] ?? $task['title'],
            'description' => $data['description'] ?? $task['description'],
            'priority' => $this->validPriority($data['priority'] ?? $task['priority']),
            'color' => $data['color'] ?? $task['color'],
            'due_date' => $data['dueDate'] ?? $task['due_date'],
        ]);

        $row = $this->tasks->find($taskId);
        return Task::fromRow($row)->toArray();
    }

    public function moveStatus(int $taskId, int $userId, string $status, int $position): array
    {
        $this->findOwned($taskId, $userId);

        if (!in_array($status, self::VALID_STATUSES, true)) {
            throw new ApiException('Estado inválido', 422);
        }

        $this->tasks->updateStatusAndPosition($taskId, $status, $position);

        $row = $this->tasks->find($taskId);
        return Task::fromRow($row)->toArray();
    }

    public function delete(int $taskId, int $userId): void
    {
        $this->findOwned($taskId, $userId);
        $this->tasks->delete($taskId);
    }

    private function findOwned(int $taskId, int $userId): array
    {
        $row = $this->tasks->find($taskId);

        if ($row === null) {
            throw new ApiException('Tarea no encontrada', 404);
        }

        $this->boardsService->getOwned((int) $row['board_id'], $userId);

        return $row;
    }

    private function assertValidTitle(string $title): void
    {
        if (trim($title) === '') {
            throw new ApiException('El título es obligatorio', 422);
        }
    }

    private function validPriority(string $priority): string
    {
        if (!in_array($priority, self::VALID_PRIORITIES, true)) {
            throw new ApiException('Prioridad inválida', 422);
        }

        return $priority;
    }
}
```

- [ ] **Paso 4: Crea `app/Controllers/Api/TaskController.php`**

```php
<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\BoardRepository;
use App\Repositories\TaskRepository;
use App\Services\BoardService;
use App\Services\TaskService;

final class TaskController
{
    private TaskService $tasksService;
    private AuthMiddleware $auth;

    public function __construct()
    {
        $this->tasksService = new TaskService(new TaskRepository(), new BoardService(new BoardRepository()));
        $this->auth = new AuthMiddleware();
    }

    public function indexForBoard(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $boardId = (int) $request->params()['id'];
        Response::json(['tasks' => $this->tasksService->listForBoard($boardId, $userId)]);
    }

    public function store(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $boardId = (int) $request->input('boardId');
        $task = $this->tasksService->create($boardId, $userId, $request->all());
        Response::json(['task' => $task], 201);
    }

    public function update(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $taskId = (int) $request->params()['id'];
        $task = $this->tasksService->update($taskId, $userId, $request->all());
        Response::json(['task' => $task]);
    }

    public function updateStatus(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $taskId = (int) $request->params()['id'];
        $task = $this->tasksService->moveStatus(
            $taskId,
            $userId,
            (string) $request->input('status'),
            (int) $request->input('position', 0)
        );
        Response::json(['task' => $task]);
    }

    public function destroy(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $taskId = (int) $request->params()['id'];
        $this->tasksService->delete($taskId, $userId);
        Response::json(['ok' => true]);
    }
}
```

- [ ] **Paso 5: Registra las rutas en `public/index.php`**

```php
use App\Controllers\Api\TaskController;

$tasks = new TaskController();
$router->add('GET', '/api/boards/{id}/tasks', [$tasks, 'indexForBoard']);
$router->add('POST', '/api/tasks', [$tasks, 'store']);
$router->add('PATCH', '/api/tasks/{id}', [$tasks, 'update']);
$router->add('PATCH', '/api/tasks/{id}/status', [$tasks, 'updateStatus']);
$router->add('DELETE', '/api/tasks/{id}', [$tasks, 'destroy']);
```

- [ ] **Paso 6: Escribe los tests que fallan para TaskService**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Core\ApiException;
use App\Repositories\BoardRepository;
use App\Repositories\TaskRepository;
use App\Services\BoardService;
use App\Services\TaskService;
use PHPUnit\Framework\TestCase;

final class TaskServiceTest extends TestCase
{
    public function testCreateRejectsEmptyTitle(): void
    {
        $boardRepo = $this->createMock(BoardRepository::class);
        $boardRepo->method('find')->willReturn(['id' => 1, 'user_id' => 1, 'name' => 'B']);
        $taskRepo = $this->createMock(TaskRepository::class);
        $taskRepo->expects($this->never())->method('create');

        $service = new TaskService($taskRepo, new BoardService($boardRepo));

        $this->expectException(ApiException::class);
        $service->create(1, 1, ['title' => '  ']);
    }

    public function testCreateAssignsNextPositionInBacklog(): void
    {
        $boardRepo = $this->createMock(BoardRepository::class);
        $boardRepo->method('find')->willReturn(['id' => 1, 'user_id' => 1, 'name' => 'B']);

        $taskRepo = $this->createMock(TaskRepository::class);
        $taskRepo->method('maxPositionForStatus')->with(1, 'backlog')->willReturn(2);
        $taskRepo->expects($this->once())->method('create')->with($this->callback(
            static fn (array $data) => $data['position'] === 3 && $data['status'] === 'backlog'
        ))->willReturn(99);
        $taskRepo->method('find')->willReturn([
            'id' => 99, 'board_id' => 1, 'title' => 'Nueva', 'description' => null,
            'status' => 'backlog', 'priority' => 'medium', 'color' => null,
            'due_date' => null, 'position' => 3,
        ]);

        $service = new TaskService($taskRepo, new BoardService($boardRepo));
        $task = $service->create(1, 1, ['title' => 'Nueva']);

        $this->assertSame(3, $task['position']);
    }

    public function testMoveStatusRejectsInvalidStatus(): void
    {
        $boardRepo = $this->createMock(BoardRepository::class);
        $boardRepo->method('find')->willReturn(['id' => 1, 'user_id' => 1, 'name' => 'B']);

        $taskRepo = $this->createMock(TaskRepository::class);
        $taskRepo->method('find')->willReturn([
            'id' => 5, 'board_id' => 1, 'title' => 'X', 'description' => null,
            'status' => 'backlog', 'priority' => 'medium', 'color' => null,
            'due_date' => null, 'position' => 0,
        ]);
        $taskRepo->expects($this->never())->method('updateStatusAndPosition');

        $service = new TaskService($taskRepo, new BoardService($boardRepo));

        $this->expectException(ApiException::class);
        $service->moveStatus(5, 1, 'estado_invalido', 0);
    }
}
```

- [ ] **Paso 7: Ejecuta los tests, comprueba que fallan y luego que pasan**

Ejecuta: `vendor/bin/phpunit tests/Unit/Services/TaskServiceTest.php`
Esperado: PASS (3 tests) una vez existan los archivos de los pasos 1-3.

- [ ] **Paso 8: Commit**

```bash
git add app/Models/Task.php app/Repositories/TaskRepository.php app/Services/TaskService.php app/Controllers/Api/TaskController.php public/index.php tests/Unit/Services/TaskServiceTest.php
git commit -m "feat: add Task model, repository, service with position logic, controller and routes"
```

---

## Tarea 7: Tests de integración contra MySQL real (BD de test)

**Archivos:**
- Crear: `tests/Integration/Repositories/UserRepositoryTest.php`
- Crear: `tests/Integration/Repositories/TaskRepositoryTest.php`
- Crear: `database/schema_test.sql` (mismo schema, BD llamada `todo_test`)
- Reutiliza el `phpunit.xml` existente; indica `DB_NAME=todo_test` como comentario al inicio de los archivos de test explicando la variable de entorno requerida (la documentación es tarea propia del usuario según la spec, así que no se crea un README aquí).

**Interfaces:**
- Consume: `App\Core\Database::connection()`, `App\Repositories\UserRepository`, `App\Repositories\TaskRepository`, `App\Repositories\BoardRepository`.

- [ ] **Paso 1: Crea `database/schema_test.sql`**

Copia de `database/schema.sql` con `todo` sustituido por `todo_test` (solo cambia el nombre de la BD, la estructura de tablas es idéntica).

```sql
CREATE DATABASE IF NOT EXISTS todo_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE todo_test;

-- (resto idéntico a database/schema.sql, con las mismas 3 tablas: users, boards, tasks)
```

- [ ] **Paso 2: Escribe `tests/Integration/Repositories/UserRepositoryTest.php`**

```php
<?php

declare(strict_types=1);

namespace Tests\Integration\Repositories;

use App\Core\Database;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;

/**
 * Requiere DB_NAME=todo_test apuntando a una base con database/schema_test.sql importado.
 */
final class UserRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        if (getenv('DB_NAME') !== 'todo_test') {
            $this->markTestSkipped('Configura DB_NAME=todo_test para correr tests de integración');
        }
        Database::connection()->exec('DELETE FROM users');
    }

    public function testCreateAndFindByEmail(): void
    {
        $repo = new UserRepository();
        $id = $repo->create('Rober', 'rober@test.com', password_hash('secret123', PASSWORD_DEFAULT));

        $found = $repo->findByEmail('rober@test.com');

        $this->assertNotNull($found);
        $this->assertSame($id, (int) $found['id']);
    }

    public function testFindByEmailReturnsNullWhenMissing(): void
    {
        $repo = new UserRepository();
        $this->assertNull($repo->findByEmail('nadie@test.com'));
    }
}
```

- [ ] **Paso 3: Escribe `tests/Integration/Repositories/TaskRepositoryTest.php`**

```php
<?php

declare(strict_types=1);

namespace Tests\Integration\Repositories;

use App\Core\Database;
use App\Repositories\BoardRepository;
use App\Repositories\TaskRepository;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;

final class TaskRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        if (getenv('DB_NAME') !== 'todo_test') {
            $this->markTestSkipped('Configura DB_NAME=todo_test para correr tests de integración');
        }
        Database::connection()->exec('DELETE FROM tasks');
        Database::connection()->exec('DELETE FROM boards');
        Database::connection()->exec('DELETE FROM users');
    }

    public function testMaxPositionForStatusIsMinusOneWhenEmpty(): void
    {
        [$boardId] = $this->makeUserAndBoard();
        $repo = new TaskRepository();

        $this->assertSame(-1, $repo->maxPositionForStatus($boardId, 'backlog'));
    }

    public function testCreateAndUpdateStatusAndPosition(): void
    {
        [$boardId] = $this->makeUserAndBoard();
        $repo = new TaskRepository();

        $id = $repo->create([
            'board_id' => $boardId, 'title' => 'T1', 'description' => null,
            'status' => 'backlog', 'priority' => 'medium', 'color' => null,
            'due_date' => null, 'position' => 0,
        ]);

        $repo->updateStatusAndPosition($id, 'planning', 1);
        $row = $repo->find($id);

        $this->assertSame('planning', $row['status']);
        $this->assertSame(1, (int) $row['position']);
    }

    private function makeUserAndBoard(): array
    {
        $userRepo = new UserRepository();
        $userId = $userRepo->create('Rober', 'rober@test.com', password_hash('secret123', PASSWORD_DEFAULT));

        $boardRepo = new BoardRepository();
        $boardId = $boardRepo->create($userId, 'Tablero de prueba');

        return [$boardId, $userId];
    }
}
```

- [ ] **Paso 4: Crea la BD de test y ejecuta la suite de integración**

Ejecuta (con MySQL corriendo en local, p.ej. vía Laragon):
`mysql -u root < database/schema_test.sql`
`DB_NAME=todo_test vendor/bin/phpunit tests/Integration`
Esperado: PASS (4 tests). Si MySQL no está accesible todavía, estos tests se saltan (skip), no fallan — aceptable hasta que la Tarea 15 (Docker) provea MySQL.

- [ ] **Paso 5: Commit**

```bash
git add database/schema_test.sql tests/Integration
git commit -m "test: add integration tests for UserRepository and TaskRepository"
```

---

## Tarea 8: Esqueleto del frontend, api.js y estilos base

**Archivos:**
- Crear: `frontend/index.html`
- Crear: `frontend/services/api.js`
- Crear: `frontend/styles/base.css`
- Crear: `package.json`
- Crear: `vitest.config.js`

**Interfaces:**
- Produce: `frontend/services/api.js` exporta el objeto `api` con `register(name, email, password)`, `login(email, password)`, `logout()`, `me()`, `listBoards()`, `createBoard(name)`, `listTasks(boardId)`, `createTask(data)`, `updateTask(id, data)`, `moveTask(id, status, position)`, `deleteTask(id)` — todos `async`, usando `fetch` con `credentials: 'include'`, lanzando un `Error` con el mensaje `error` de la API si la respuesta no es 2xx.

- [ ] **Paso 1: Crea `package.json`**

```json
{
  "name": "taskboard-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Paso 2: Crea `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/frontend/**/*.test.js'],
  },
});
```

- [ ] **Paso 3: Crea `frontend/services/api.js`**

```js
const BASE_URL = '/api';

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Error de red');
  }

  return data;
}

export const api = {
  register: (name, email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  logout: () => request('/auth/logout', { method: 'POST' }),

  me: () => request('/auth/me'),

  listBoards: () => request('/boards'),

  createBoard: (name) =>
    request('/boards', { method: 'POST', body: JSON.stringify({ name }) }),

  listTasks: (boardId) => request(`/boards/${boardId}/tasks`),

  createTask: (data) =>
    request('/tasks', { method: 'POST', body: JSON.stringify(data) }),

  updateTask: (id, data) =>
    request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  moveTask: (id, status, position) =>
    request(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, position }) }),

  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
};
```

- [ ] **Paso 4: Crea `frontend/styles/base.css`**

```css
:root {
  --color-bg: #f4f5f7;
  --color-surface: #ffffff;
  --color-border: #dfe1e6;
  --color-text: #172b4d;
  --color-primary: #4f46e5;
  --radius: 8px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
}

.board {
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow-x: auto;
}

@media (max-width: 768px) {
  .board {
    flex-direction: column;
    overflow-x: visible;
  }
}
```

- [ ] **Paso 5: Crea `frontend/index.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Taskboard</title>
  <link rel="stylesheet" href="styles/base.css" />
  <link rel="stylesheet" href="styles/animations.css" />
</head>
<body>
  <app-board></app-board>
  <script type="module" src="components/app-board.js"></script>
</body>
</html>
```

- [ ] **Paso 6: Instala las dependencias del frontend**

Ejecuta: `npm install`
Esperado: crea `node_modules/`, `package-lock.json`, sin errores.

- [ ] **Paso 7: Commit**

```bash
git add frontend/index.html frontend/services/api.js frontend/styles/base.css package.json vitest.config.js package-lock.json
git commit -m "feat: add frontend skeleton, api.js client and base styles"
```

---

## Tarea 9: Web Component task-card con lógica de posición/prioridad + tests Vitest

**Archivos:**
- Crear: `frontend/components/task-card.js`
- Crear: `frontend/utils/priority.js`
- Test: `tests/frontend/task-card.test.js`

**Interfaces:**
- Produce: `frontend/utils/priority.js` exports `priorityLabel(priority: string): string` (`low→'Baja'`, `medium→'Media'`, `high→'Alta'`) and `priorityWeight(priority: string): number` (for sorting, `high=0, medium=1, low=2`).
- Produce: custom element `<task-card>` with attribute/property `task` (object), renders title/description/priority/date/color, dispatches `CustomEvent('task-move', { detail: { taskId, status, position }, bubbles: true })` — actual dispatch wired in Task 10 (board-column) on `drop`; this task only renders + sets `draggable=true` + `dragstart` sets `event.dataTransfer.setData('text/plain', String(taskId))`.

- [ ] **Paso 1: Escribe el test que falla para `priority.js`**

```js
import { describe, it, expect } from 'vitest';
import { priorityLabel, priorityWeight } from '../../frontend/utils/priority.js';

describe('priority utils', () => {
  it('translates priority to a Spanish label', () => {
    expect(priorityLabel('high')).toBe('Alta');
    expect(priorityLabel('medium')).toBe('Media');
    expect(priorityLabel('low')).toBe('Baja');
  });

  it('orders high before medium before low', () => {
    expect(priorityWeight('high')).toBeLessThan(priorityWeight('medium'));
    expect(priorityWeight('medium')).toBeLessThan(priorityWeight('low'));
  });
});
```

- [ ] **Paso 2: Ejecuta el test para comprobar que falla**

Ejecuta: `npm test -- tests/frontend/task-card.test.js`
Esperado: FAIL (módulo `priority.js` no encontrado)

- [ ] **Paso 3: Crea `frontend/utils/priority.js`**

```js
const LABELS = { low: 'Baja', medium: 'Media', high: 'Alta' };
const WEIGHTS = { high: 0, medium: 1, low: 2 };

export function priorityLabel(priority) {
  return LABELS[priority] ?? priority;
}

export function priorityWeight(priority) {
  return WEIGHTS[priority] ?? 99;
}
```

- [ ] **Paso 4: Crea `frontend/components/task-card.js`**

```js
import { priorityLabel } from '../utils/priority.js';

export class TaskCard extends HTMLElement {
  #task = null;

  set task(value) {
    this.#task = value;
    this.render();
  }

  get task() {
    return this.#task;
  }

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.setAttribute('draggable', 'true');
    this.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/plain', String(this.#task.id));
      this.classList.add('dragging');
    });
    this.addEventListener('dragend', () => this.classList.remove('dragging'));
    this.render();
  }

  render() {
    if (!this.shadowRoot || !this.#task) return;

    const t = this.#task;
    this.shadowRoot.innerHTML = `
      <style>
        .card {
          background: #fff;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 8px;
          box-shadow: 0 1px 2px rgba(0,0,0,.1);
          border-left: 4px solid ${t.color || '#dfe1e6'};
          transition: transform .15s ease, box-shadow .15s ease;
        }
        :host(.dragging) .card { transform: scale(1.03); box-shadow: 0 4px 10px rgba(0,0,0,.2); }
        h3 { margin: 0 0 4px; font-size: 14px; }
        p { margin: 0 0 8px; font-size: 12px; color: #5e6c84; }
        .meta { display: flex; justify-content: space-between; font-size: 11px; color: #5e6c84; }
      </style>
      <div class="card">
        <h3>${t.title}</h3>
        ${t.description ? `<p>${t.description}</p>` : ''}
        <div class="meta">
          <span>${priorityLabel(t.priority)}</span>
          <span>${t.dueDate ?? ''}</span>
        </div>
      </div>
    `;
  }
}

customElements.define('task-card', TaskCard);
```

- [ ] **Paso 5: Ejecuta el test para comprobar que pasa**

Ejecuta: `npm test -- tests/frontend/task-card.test.js`
Esperado: PASS (2 tests)

- [ ] **Paso 6: Commit**

```bash
git add frontend/utils/priority.js frontend/components/task-card.js tests/frontend/task-card.test.js
git commit -m "feat: add task-card Web Component and priority utils with tests"
```

---

## Tarea 10: Web Component board-column con zona de drop y lógica de reordenación FLIP

**Archivos:**
- Crear: `frontend/components/board-column.js`
- Crear: `frontend/utils/reorder.js`
- Test: `tests/frontend/reorder.test.js`

**Interfaces:**
- Produce: `frontend/utils/reorder.js` exports `computeDropPosition(existingPositions: number[], dropIndex: number): number` — returns the integer position value a moved task should take when dropped at `dropIndex` among `existingPositions` (sorted ascending); returns `0` when list is empty, `max(existingPositions) + 1` when dropped at end, otherwise `existingPositions[dropIndex]` (shifts happen server-side via re-numbering not required for v1 — simple integer append/insert is enough given `position` is only used for ordering, not uniqueness).
- Produce: custom element `<board-column>` with property `status` (string) and `title` (string), property `tasks` (array) → renders `<task-card>` children; listens for `dragover` (preventDefault to allow drop) and `drop` (reads `dataTransfer`, dispatches `CustomEvent('task-drop', { detail: { taskId, status, position }, bubbles: true, composed: true })`).

- [ ] **Paso 1: Escribe el test que falla para `reorder.js`**

```js
import { describe, it, expect } from 'vitest';
import { computeDropPosition } from '../../frontend/utils/reorder.js';

describe('computeDropPosition', () => {
  it('returns 0 for an empty column', () => {
    expect(computeDropPosition([], 0)).toBe(0);
  });

  it('appends after the last position when dropped at the end', () => {
    expect(computeDropPosition([0, 1, 2], 3)).toBe(3);
  });

  it('takes the position of the task currently at dropIndex when inserting in the middle', () => {
    expect(computeDropPosition([0, 1, 2], 1)).toBe(1);
  });
});
```

- [ ] **Paso 2: Ejecuta el test para comprobar que falla**

Ejecuta: `npm test -- tests/frontend/reorder.test.js`
Esperado: FAIL (módulo no encontrado)

- [ ] **Paso 3: Crea `frontend/utils/reorder.js`**

```js
export function computeDropPosition(existingPositions, dropIndex) {
  if (existingPositions.length === 0) {
    return 0;
  }

  if (dropIndex >= existingPositions.length) {
    return Math.max(...existingPositions) + 1;
  }

  return existingPositions[dropIndex];
}
```

- [ ] **Paso 4: Crea `frontend/components/board-column.js`**

```js
import './task-card.js';
import { computeDropPosition } from '../utils/reorder.js';

export class BoardColumn extends HTMLElement {
  #tasks = [];

  static get observedAttributes() {
    return ['status', 'title'];
  }

  set tasks(value) {
    this.#tasks = value;
    this.render();
  }

  get tasks() {
    return this.#tasks;
  }

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.shadowRoot.querySelector('.column')?.classList.add('drag-over');
    });
    this.addEventListener('dragleave', () => {
      this.shadowRoot.querySelector('.column')?.classList.remove('drag-over');
    });
    this.addEventListener('drop', (event) => {
      event.preventDefault();
      this.shadowRoot.querySelector('.column')?.classList.remove('drag-over');

      const taskId = Number(event.dataTransfer.getData('text/plain'));
      const positions = this.#tasks.map((t) => t.position);
      const position = computeDropPosition(positions, positions.length);

      this.dispatchEvent(new CustomEvent('task-drop', {
        detail: { taskId, status: this.getAttribute('status'), position },
        bubbles: true,
        composed: true,
      }));
    });
    this.render();
  }

  render() {
    if (!this.shadowRoot) return;

    const title = this.getAttribute('title') ?? '';
    this.shadowRoot.innerHTML = `
      <style>
        .column {
          background: #ebecf0;
          border-radius: 8px;
          padding: 8px;
          min-width: 260px;
          flex: 1 0 260px;
          transition: background .15s ease;
        }
        .column.drag-over { background: #dcdfe6; }
        h2 { font-size: 13px; text-transform: uppercase; color: #5e6c84; margin: 4px 8px 12px; }
      </style>
      <div class="column">
        <h2>${title}</h2>
        <div class="cards"></div>
      </div>
    `;

    const container = this.shadowRoot.querySelector('.cards');
    for (const task of this.#tasks) {
      const card = document.createElement('task-card');
      card.task = task;
      container.appendChild(card);
    }
  }
}

customElements.define('board-column', BoardColumn);
```

- [ ] **Paso 5: Ejecuta el test para comprobar que pasa**

Ejecuta: `npm test -- tests/frontend/reorder.test.js`
Esperado: PASS (3 tests)

- [ ] **Paso 6: Commit**

```bash
git add frontend/utils/reorder.js frontend/components/board-column.js tests/frontend/reorder.test.js
git commit -m "feat: add board-column Web Component with drop zone and reorder util"
```

---

## Tarea 11: Web Component app-board (orquestador) conectando el drag&drop a la API

**Archivos:**
- Crear: `frontend/components/app-board.js`

**Interfaces:**
- Consume: `api.listBoards()`, `api.createBoard()`, `api.listTasks(boardId)`, `api.moveTask(id, status, position)`, `App\...` (n/a, frontend only), `<board-column>`, custom element `<task-modal>` (stubbed usage, built in Task 12).
- Produce: custom element `<app-board>` — on connect: calls `api.me()`; if no user, renders `<login-form>`/`<register-form>` (Task 13); if user, loads first board (or creates "Mi tablero" if none exist) and renders 5 `<board-column>` grouped by status; listens for `task-drop` bubbling from columns and calls `api.moveTask` with optimistic UI update + rollback on failure.

- [ ] **Paso 1: Crea `frontend/components/app-board.js`**

```js
import './board-column.js';
import { api } from '../services/api.js';

const STATUSES = [
  { key: 'backlog', label: 'Idea' },
  { key: 'planning', label: 'Planificación' },
  { key: 'in_progress', label: 'Ejecución' },
  { key: 'testing', label: 'Pruebas' },
  { key: 'done', label: 'Producción' },
];

export class AppBoard extends HTMLElement {
  #board = null;
  #tasks = [];

  async connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.renderLoading();

    const { user } = await api.me();
    if (!user) {
      this.renderLoginRequired();
      return;
    }

    await this.loadBoard();
    this.render();

    this.shadowRoot.addEventListener('task-drop', (event) => this.handleTaskDrop(event));
  }

  async loadBoard() {
    const { boards } = await api.listBoards();
    this.#board = boards[0] ?? (await api.createBoard('Mi tablero')).board;
    const { tasks } = await api.listTasks(this.#board.id);
    this.#tasks = tasks;
  }

  async handleTaskDrop(event) {
    const { taskId, status, position } = event.detail;
    const previous = this.#tasks.map((t) => ({ ...t }));

    this.#tasks = this.#tasks.map((t) =>
      t.id === taskId ? { ...t, status, position } : t
    );
    this.render();

    try {
      await api.moveTask(taskId, status, position);
    } catch (err) {
      this.#tasks = previous;
      this.render();
    }
  }

  renderLoading() {
    this.shadowRoot.innerHTML = '<p style="padding:16px">Cargando…</p>';
  }

  renderLoginRequired() {
    this.shadowRoot.innerHTML = '<p style="padding:16px">Inicia sesión para ver tu tablero.</p>';
  }

  render() {
    this.shadowRoot.innerHTML = '<div class="board"></div>';
    const board = this.shadowRoot.querySelector('.board');
    board.style.cssText = 'display:flex;gap:16px;padding:16px;overflow-x:auto;';

    for (const status of STATUSES) {
      const column = document.createElement('board-column');
      column.setAttribute('status', status.key);
      column.setAttribute('title', status.label);
      column.tasks = this.#tasks
        .filter((t) => t.status === status.key)
        .sort((a, b) => a.position - b.position);
      board.appendChild(column);
    }
  }
}

customElements.define('app-board', AppBoard);
```

- [ ] **Paso 2: Prueba manual en el navegador**

Ejecuta: `php -S 127.0.0.1:8080 -t public` (API) y sirve `frontend/` de forma estática, p.ej. `npx serve frontend`, o abre `frontend/index.html` con un servidor estático simple que apunte el `fetch` al origen de la API (para desarrollo local sin Docker, añadir proxy o CORS — se deja para la Tarea 15 de Docker, donde nginx sirve ambos bajo el mismo origen).
Esperado: la página carga sin errores en consola una vez logueado (la UI de login llega en la Tarea 13); en este paso es aceptable confirmar visualmente que se renderiza el mensaje "Inicia sesión...".

- [ ] **Paso 3: Commit**

```bash
git add frontend/components/app-board.js
git commit -m "feat: add app-board orchestrator component with optimistic drag&drop"
```

---

## Tarea 12: task-modal (formulario crear/editar) y su conexión en app-board

**Archivos:**
- Crear: `frontend/components/task-modal.js`
- Modificar: `frontend/components/app-board.js` (add "+ Nueva tarea" trigger, open modal, call `api.createTask`/`api.updateTask`, refresh list)

**Interfaces:**
- Produce: custom element `<task-modal>` — property `task` (nullable, null = create mode), dispatches `CustomEvent('task-save', { detail: formData, bubbles: true, composed: true })` on submit and `CustomEvent('task-cancel', { bubbles: true, composed: true })` on cancel; method `open()`/`close()` toggling a `hidden` attribute-driven `<dialog>`-like overlay.

- [ ] **Paso 1: Crea `frontend/components/task-modal.js`**

```js
export class TaskModal extends HTMLElement {
  #task = null;

  set task(value) {
    this.#task = value;
    this.render();
  }

  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.hidden = true;
    this.render();
  }

  open(task = null) {
    this.task = task;
    this.hidden = false;
  }

  close() {
    this.hidden = true;
  }

  render() {
    if (!this.shadowRoot) return;
    const t = this.#task ?? { title: '', description: '', priority: 'medium', color: '#4f46e5', dueDate: '' };

    this.shadowRoot.innerHTML = `
      <style>
        .overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; }
        .modal { background: #fff; border-radius: 8px; padding: 24px; width: min(420px, 90vw); animation: pop .15s ease; }
        @keyframes pop { from { transform: scale(.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        label { display: block; font-size: 12px; margin: 12px 0 4px; }
        input, textarea, select { width: 100%; padding: 8px; border: 1px solid #dfe1e6; border-radius: 4px; font: inherit; }
        .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
        button { padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; }
        button[type="submit"] { background: #4f46e5; color: #fff; }
      </style>
      <div class="overlay">
        <form class="modal">
          <label>Título<input name="title" required value="${t.title}"></label>
          <label>Descripción<textarea name="description">${t.description ?? ''}</textarea></label>
          <label>Prioridad
            <select name="priority">
              <option value="low" ${t.priority === 'low' ? 'selected' : ''}>Baja</option>
              <option value="medium" ${t.priority === 'medium' ? 'selected' : ''}>Media</option>
              <option value="high" ${t.priority === 'high' ? 'selected' : ''}>Alta</option>
            </select>
          </label>
          <label>Fecha límite<input type="date" name="dueDate" value="${t.dueDate ?? ''}"></label>
          <label>Color<input type="color" name="color" value="${t.color ?? '#4f46e5'}"></label>
          <div class="actions">
            <button type="button" data-action="cancel">Cancelar</button>
            <button type="submit">Guardar</button>
          </div>
        </form>
      </div>
    `;

    const form = this.shadowRoot.querySelector('form');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      this.dispatchEvent(new CustomEvent('task-save', { detail: data, bubbles: true, composed: true }));
    });

    this.shadowRoot.querySelector('[data-action="cancel"]').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('task-cancel', { bubbles: true, composed: true }));
    });
  }
}

customElements.define('task-modal', TaskModal);
```

- [ ] **Paso 2: Conecta el modal en `frontend/components/app-board.js`**

Añade el import al principio: `import './task-modal.js';`

Modifica `render()` para añadir un botón que lo dispare y el modal, y añade los manejadores en `connectedCallback`:

```js
  render() {
    this.shadowRoot.innerHTML = '<button id="add">+ Nueva tarea</button><div class="board"></div><task-modal></task-modal>';
    this.shadowRoot.querySelector('#add').addEventListener('click', () => {
      this.shadowRoot.querySelector('task-modal').open(null);
    });

    const board = this.shadowRoot.querySelector('.board');
    board.style.cssText = 'display:flex;gap:16px;padding:16px;overflow-x:auto;';

    for (const status of STATUSES) {
      const column = document.createElement('board-column');
      column.setAttribute('status', status.key);
      column.setAttribute('title', status.label);
      column.tasks = this.#tasks
        .filter((t) => t.status === status.key)
        .sort((a, b) => a.position - b.position);
      board.appendChild(column);
    }
  }
```

Añade en `connectedCallback`, después del listener de `task-drop`:

```js
    this.shadowRoot.addEventListener('task-save', async (event) => {
      await api.createTask({ boardId: this.#board.id, ...event.detail });
      const { tasks } = await api.listTasks(this.#board.id);
      this.#tasks = tasks;
      this.render();
    });

    this.shadowRoot.addEventListener('task-cancel', () => {
      this.shadowRoot.querySelector('task-modal').close();
    });
```

- [ ] **Paso 3: Prueba manual**

Levanta el stack completo (Tarea 15 Docker o servidor PHP local + navegador), inicia sesión, haz clic en "+ Nueva tarea", rellena el formulario y envíalo.
Esperado: la nueva tarea aparece en la columna "Idea" sin recargar la página.

- [ ] **Paso 4: Commit**

```bash
git add frontend/components/task-modal.js frontend/components/app-board.js
git commit -m "feat: add task-modal component and wire task creation into app-board"
```

---

## Tarea 13: Web Components login-form / register-form y flujo de autenticación

**Archivos:**
- Crear: `frontend/components/login-form.js`
- Crear: `frontend/components/register-form.js`
- Modificar: `frontend/components/app-board.js` (replace `renderLoginRequired` with real forms, reload board after login/register)

**Interfaces:**
- Produce: `<login-form>` — dispatches `CustomEvent('auth-success', { detail: { user }, bubbles: true, composed: true })` on success, shows inline error message on failure.
- Produce: `<register-form>` — same event contract as `login-form`.

- [ ] **Paso 1: Crea `frontend/components/login-form.js`**

```js
import { api } from '../services/api.js';

export class LoginForm extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        form { max-width: 320px; margin: 64px auto; display: flex; flex-direction: column; gap: 8px; }
        input { padding: 8px; border: 1px solid #dfe1e6; border-radius: 4px; }
        button { padding: 8px; background: #4f46e5; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        .error { color: #b91c1c; font-size: 12px; }
      </style>
      <form>
        <h2>Iniciar sesión</h2>
        <input name="email" type="email" placeholder="Email" required>
        <input name="password" type="password" placeholder="Contraseña" required>
        <p class="error" hidden></p>
        <button type="submit">Entrar</button>
      </form>
    `;

    const form = this.shadowRoot.querySelector('form');
    const error = this.shadowRoot.querySelector('.error');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());

      try {
        const { user } = await api.login(data.email, data.password);
        this.dispatchEvent(new CustomEvent('auth-success', { detail: { user }, bubbles: true, composed: true }));
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
  }
}

customElements.define('login-form', LoginForm);
```

- [ ] **Paso 2: Crea `frontend/components/register-form.js`**

```js
import { api } from '../services/api.js';

export class RegisterForm extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        form { max-width: 320px; margin: 64px auto; display: flex; flex-direction: column; gap: 8px; }
        input { padding: 8px; border: 1px solid #dfe1e6; border-radius: 4px; }
        button { padding: 8px; background: #4f46e5; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        .error { color: #b91c1c; font-size: 12px; }
      </style>
      <form>
        <h2>Crear cuenta</h2>
        <input name="name" placeholder="Nombre" required>
        <input name="email" type="email" placeholder="Email" required>
        <input name="password" type="password" placeholder="Contraseña (mín. 6)" required minlength="6">
        <p class="error" hidden></p>
        <button type="submit">Registrarme</button>
      </form>
    `;

    const form = this.shadowRoot.querySelector('form');
    const error = this.shadowRoot.querySelector('.error');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());

      try {
        const { user } = await api.register(data.name, data.email, data.password);
        this.dispatchEvent(new CustomEvent('auth-success', { detail: { user }, bubbles: true, composed: true }));
      } catch (err) {
        error.textContent = err.message;
        error.hidden = false;
      }
    });
  }
}

customElements.define('register-form', RegisterForm);
```

- [ ] **Paso 3: Conéctalo en `frontend/components/app-board.js`**

Añade los imports: `import './login-form.js'; import './register-form.js';`

Sustituye `renderLoginRequired` por:

```js
  renderLoginRequired() {
    this.shadowRoot.innerHTML = '<login-form></login-form><register-form></register-form>';
    this.shadowRoot.addEventListener('auth-success', async () => {
      await this.loadBoard();
      this.render();
    }, { once: true });
  }
```

- [ ] **Paso 4: Prueba manual**

Sirve el frontend + API, ábrelo en el navegador sin cookie de sesión.
Esperado: aparecen los formularios de login/registro; tras registrarte, se renderiza el tablero con la columna "Idea" vacía.

- [ ] **Paso 5: Commit**

```bash
git add frontend/components/login-form.js frontend/components/register-form.js frontend/components/app-board.js
git commit -m "feat: add login-form and register-form components with auth flow"
```

---

## Tarea 14: Animaciones y acabado responsive

**Archivos:**
- Crear: `frontend/styles/animations.css`
- Modificar: `frontend/components/task-card.js` (add entry animation class on first render)

**Interfaces:**
- Sin interfaces nuevas; solo CSS y un pequeño toggle de clase.

- [ ] **Paso 1: Crea `frontend/styles/animations.css`**

```css
@keyframes card-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.card-enter {
  animation: card-in .2s ease-out;
}
```

- [ ] **Paso 2: Modifica el `render()` de `frontend/components/task-card.js` para añadir la clase de entrada**

Dentro del bloque `<style>` del template del shadow DOM, añade:

```css
        .card { animation: card-in .2s ease-out; }
        @keyframes card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
```

(Se duplica dentro del `<style>` del Shadow DOM porque los estilos de `frontend/styles/animations.css` no atraviesan el límite del Shadow DOM — es encapsulación intencionada, no un descuido.)

- [ ] **Paso 3: Comprobación visual manual**

Corre la app en el navegador, añade una tarea, arrástrala entre columnas.
Esperado: la tarjeta nueva entra con fade/slide; la tarjeta arrastrada se eleva (sombra+escala) durante el arrastre; el fondo de la columna resalta en `dragover`.

- [ ] **Paso 4: Commit**

```bash
git add frontend/styles/animations.css frontend/components/task-card.js
git commit -m "feat: add card entry animation and drag visual feedback"
```

---

## Tarea 15: Docker (nginx + php-fpm + mysql)

**Archivos:**
- Crear: `docker/Dockerfile`
- Crear: `docker/nginx.conf`
- Crear: `docker-compose.yml`

**Interfaces:**
- Sin interfaces PHP/JS; solo infraestructura. `docker-compose up` debe servir la app en `http://localhost:8080` con `public/` como document root, `frontend/` accesible, y MySQL precargado desde `database/schema.sql`.

- [ ] **Paso 1: Crea `docker/Dockerfile`**

```dockerfile
FROM php:8.4-fpm

RUN docker-php-ext-install pdo_mysql

WORKDIR /var/www/html
```

- [ ] **Paso 2: Crea `docker/nginx.conf`**

```nginx
server {
    listen 80;
    root /var/www/html/public;
    index index.php;

    location /frontend/ {
        alias /var/www/html/frontend/;
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass php:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

- [ ] **Paso 3: Crea `docker-compose.yml`**

```yaml
services:
  php:
    build:
      context: .
      dockerfile: docker/Dockerfile
    volumes:
      - .:/var/www/html
    environment:
      DB_HOST: mysql
      DB_NAME: todo
      DB_USER: root
      DB_PASS: root

  nginx:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - .:/var/www/html
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - php

  mysql:
    image: mysql:8.4
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: todo
    volumes:
      - db_data:/var/lib/mysql
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "3306:3306"

volumes:
  db_data:
```

- [ ] **Paso 4: Compila y levanta**

Ejecuta: `docker compose up --build -d`
Luego: `docker compose ps`
Esperado: 3 servicios en `Up`/`running`.

- [ ] **Paso 5: Prueba a través de Docker**

Ejecuta: `curl -s -X POST http://localhost:8080/api/auth/register -H "Content-Type: application/json" -d "{\"name\":\"Rober\",\"email\":\"rober@test.com\",\"password\":\"secret123\"}"`
Esperado: HTTP 201 con el JSON del usuario creado. Luego abre `http://localhost:8080/frontend/index.html` en el navegador y confirma que el tablero carga (nota: `frontend/services/api.js` usa rutas relativas `/api`, que resuelven bien porque nginx sirve `public/` y `frontend/` bajo el mismo origen/puerto).

- [ ] **Paso 6: Commit**

```bash
git add docker/Dockerfile docker/nginx.conf docker-compose.yml
git commit -m "feat: add Docker setup (nginx + php-fpm + mysql)"
```

---

## Notas de autorrevisión (completadas al escribir el plan)

1. **Cobertura de la spec:** capas MVC (Tareas 1-6), routing/API (Tareas 2, 4-6), auth por sesión (Tareas 3-4), modelo de datos con `position` (Tareas 1, 6), Web Components + drag&drop + animaciones (Tareas 8-14), PHPUnit unit+integration (Tareas 3, 5-7), Vitest+jsdom (Tareas 8-10), Docker (Tarea 15), responsive (Tarea 8 base.css + Tarea 14 acabado). La documentación es explícitamente tarea propia del usuario según la spec — no se planifica aquí.
2. **Búsqueda de placeholders:** sin TBD/TODO; todos los pasos incluyen código completo.
3. **Consistencia de tipos:** las claves de `Task::toArray()` (`boardId`, `dueDate` en camelCase) coinciden con lo que envía/recibe `frontend/services/api.js` (`dueDate`, `boardId`) y con lo que leen `TaskController`/`TaskService` vía `$request->input('boardId')` / `$data['dueDate']` — consistente de punta a punta.
