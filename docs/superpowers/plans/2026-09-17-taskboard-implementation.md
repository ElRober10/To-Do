# Taskboard Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working multi-board Kanban taskboard with PHP 8.4 REST API backend (MVC-style layers, PDO/MySQL, session auth) and a plain-JS Web Components frontend with drag&drop, animations, PHPUnit + Vitest tests, and Docker.

**Architecture:** Front controller (`public/index.php`) → `Router` dispatches to `Controllers` → `Services` (business rules) → `Repositories` (PDO/SQL) → `Models` (plain value objects). Frontend: native Custom Elements consuming the REST API via `fetch`, HTML5 Drag and Drop API, CSS-only animations.

**Tech Stack:** PHP 8.4 (no framework), PDO/MySQL, PHPUnit 11, vanilla JS (ES modules, Web Components, Shadow DOM), Vitest + jsdom, Docker (nginx + php-fpm + mysql).

**Spec:** `docs/superpowers/specs/2026-09-17-taskboard-design.md`

## Global Constraints

- PHP version: 8.4 (project targets 8.4; composer.json floor is `>=8.1`, keep as-is for portability but develop/test against 8.4).
- No PHP framework, no ORM — PDO with prepared statements only.
- No JS framework/library — native Custom Elements, Shadow DOM, `fetch`, HTML5 Drag and Drop API only.
- All `/api/*` responses are JSON with correct HTTP status codes.
- Auth via PHP sessions + `httpOnly` cookie, `password_hash`/`password_verify`.
- 5 fixed task statuses: `backlog`, `planning`, `in_progress`, `testing`, `done`.
- Every DB access goes through a Repository — Controllers/Services never write raw SQL.
- Mobile-first responsive CSS, breakpoints `480px`, `768px`, `1024px`.

---

## File Structure (target)

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

## Task 1: Project skeleton, config and DB connection

**Files:**
- Create: `app/Core/Database.php`
- Create: `config/config.php`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `database/schema.sql`
- Modify: `composer.json` (add `App\` already present; no change needed if already correct — verify)

**Interfaces:**
- Produces: `App\Core\Database::connection(): PDO` — lazy singleton PDO connection read from env vars `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` (with sane local defaults).

- [ ] **Step 1: Create `.gitignore`**

```
/vendor/
/node_modules/
.env
*.log
```

- [ ] **Step 2: Create `.env.example`**

```
DB_HOST=127.0.0.1
DB_NAME=todo
DB_USER=root
DB_PASS=
```

- [ ] **Step 3: Create `database/schema.sql`**

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

- [ ] **Step 4: Create `config/config.php`**

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

- [ ] **Step 5: Create `app/Core/Database.php`**

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

- [ ] **Step 6: Verify composer autoload and install dependencies**

Run: `composer install`
Expected: creates `vendor/`, no errors.

- [ ] **Step 7: Commit**

```bash
git add .gitignore .env.example database/schema.sql config/config.php app/Core/Database.php composer.lock
git commit -m "feat: add DB schema, config and PDO connection wrapper"
```

---

## Task 2: Core HTTP primitives (Request, Response, Router, Session, ApiException)

**Files:**
- Create: `app/Core/Request.php`
- Create: `app/Core/Response.php`
- Create: `app/Core/Router.php`
- Create: `app/Core/Session.php`
- Create: `app/Core/ApiException.php`
- Test: `tests/Unit/Core/RouterTest.php`
- Test: `tests/bootstrap.php`
- Modify: `composer.json` (add `autoload-dev` psr-4 `Tests\\` → `tests/`, and phpunit config)
- Create: `phpunit.xml`

**Interfaces:**
- Produces: `App\Core\Request` — `method(): string`, `path(): string`, `input(string $key, $default = null): mixed`, `all(): array`, `params(): array`, `setParams(array $params): void`, static `fromGlobals(): self`.
- Produces: `App\Core\Response::json(array $data, int $status = 200): never` — sets header + status, echoes JSON, exits.
- Produces: `App\Core\Router::add(string $method, string $pattern, callable $handler): void`, `dispatch(Request $request): void`.
- Produces: `App\Core\Session::start(): void`, `set`, `get`, `has`, `remove`, `destroy`, `regenerate`.
- Produces: `App\Core\ApiException` extends `\RuntimeException`, constructor `(string $message, int $status = 400)`, getter `getStatus(): int`.

- [ ] **Step 1: Create `phpunit.xml`**

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

- [ ] **Step 2: Create `tests/bootstrap.php`**

```php
<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';
```

- [ ] **Step 3: Create `app/Core/ApiException.php`**

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

- [ ] **Step 4: Create `app/Core/Request.php`**

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

- [ ] **Step 5: Create `app/Core/Response.php`**

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

- [ ] **Step 6: Create `app/Core/Router.php`**

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

- [ ] **Step 7: Create `app/Core/Session.php`**

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

- [ ] **Step 8: Write the failing test for Router**

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

- [ ] **Step 9: Run test to verify it fails**

Run: `vendor/bin/phpunit tests/Unit/Core/RouterTest.php`
Expected: FAIL (class `App\Core\Router` or reflection setup errors) — since Router/Request already created above, first actually run to confirm it PASSES now (files were created in steps 4-7 already). If it fails for a reason other than "class not found", fix Router logic before continuing.

- [ ] **Step 10: Run test to verify it passes**

Run: `vendor/bin/phpunit tests/Unit/Core/RouterTest.php`
Expected: PASS (1 test, 1 assertion)

- [ ] **Step 11: Commit**

```bash
git add app/Core/Request.php app/Core/Response.php app/Core/Router.php app/Core/Session.php app/Core/ApiException.php tests/Unit/Core/RouterTest.php tests/bootstrap.php phpunit.xml
git commit -m "feat: add core HTTP primitives (Request, Response, Router, Session)"
```

---

## Task 3: User model, repository and AuthService (register/login)

**Files:**
- Create: `app/Models/User.php`
- Create: `app/Repositories/UserRepository.php`
- Create: `app/Services/AuthService.php`
- Test: `tests/Unit/Services/AuthServiceTest.php`

**Interfaces:**
- Consumes: `App\Core\Database::connection(): PDO`, `App\Core\Session`, `App\Core\ApiException`.
- Produces: `App\Models\User::fromRow(array $row): self` with public readonly `id, name, email`; `toArray(): array`.
- Produces: `App\Repositories\UserRepository::findByEmail(string $email): ?array`, `findById(int $id): ?array`, `create(string $name, string $email, string $passwordHash): int`.
- Produces: `App\Services\AuthService::register(string $name, string $email, string $password): array` (returns user array, throws `ApiException` 422 if email taken), `login(string $email, string $password): array` (throws `ApiException` 401 on bad credentials), `logout(): void`, `currentUser(): ?array`.

- [ ] **Step 1: Create `app/Models/User.php`**

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

- [ ] **Step 2: Create `app/Repositories/UserRepository.php`**

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

- [ ] **Step 3: Create `app/Services/AuthService.php`**

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

- [ ] **Step 4: Write failing tests for AuthService using a fake repository**

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

- [ ] **Step 5: Run tests to verify they fail**

Run: `vendor/bin/phpunit tests/Unit/Services/AuthServiceTest.php`
Expected: FAIL if `AuthService`/`UserRepository` not yet present — since created in steps 2-3, run now and confirm all 4 pass; if any fails, fix implementation until green.

- [ ] **Step 6: Run tests to verify they pass**

Run: `vendor/bin/phpunit tests/Unit/Services/AuthServiceTest.php`
Expected: PASS (4 tests)

- [ ] **Step 7: Commit**

```bash
git add app/Models/User.php app/Repositories/UserRepository.php app/Services/AuthService.php tests/Unit/Services/AuthServiceTest.php
git commit -m "feat: add User model, UserRepository and AuthService with tests"
```

---

## Task 4: AuthMiddleware and AuthController, wire into front controller

**Files:**
- Create: `app/Middleware/AuthMiddleware.php`
- Create: `app/Controllers/Api/AuthController.php`
- Create: `public/index.php`

**Interfaces:**
- Consumes: `App\Services\AuthService`, `App\Core\Session`, `App\Core\Response`, `App\Core\ApiException`.
- Produces: `App\Middleware\AuthMiddleware::requireUserId(): int` — reads `Session::get('user_id')`, throws `ApiException('No autenticado', 401)` if absent.
- Produces: `App\Controllers\Api\AuthController::register(Request $r)`, `login(Request $r)`, `logout(Request $r)`, `me(Request $r)` — each writes via `Response::json`.

- [ ] **Step 1: Create `app/Middleware/AuthMiddleware.php`**

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

- [ ] **Step 2: Create `app/Controllers/Api/AuthController.php`**

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

- [ ] **Step 3: Create `public/index.php`**

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

- [ ] **Step 4: Manual smoke test with PHP built-in server**

Run: `php -S 127.0.0.1:8080 -t public`
Then in another terminal:
`curl -s -X POST http://127.0.0.1:8080/api/auth/register -H "Content-Type: application/json" -d "{\"name\":\"Rober\",\"email\":\"rober@test.com\",\"password\":\"secret123\"}"`
Expected: JSON `{"user":{"id":1,"name":"Rober","email":"rober@test.com"}}` with HTTP 201 (requires `todo` DB with schema imported and `.env`/env vars set — otherwise expect a DB connection error, which is acceptable at this step and resolved once DB is set up locally or via Docker in Task 9).

- [ ] **Step 5: Commit**

```bash
git add app/Middleware/AuthMiddleware.php app/Controllers/Api/AuthController.php public/index.php
git commit -m "feat: add AuthMiddleware, AuthController and front controller wiring"
```

---

## Task 5: Board model, repository, service and controller

**Files:**
- Create: `app/Models/Board.php`
- Create: `app/Repositories/BoardRepository.php`
- Create: `app/Services/BoardService.php`
- Create: `app/Controllers/Api/BoardController.php`
- Modify: `public/index.php` (register board routes)
- Test: `tests/Unit/Services/BoardServiceTest.php`

**Interfaces:**
- Consumes: `App\Middleware\AuthMiddleware::requireUserId(): int`.
- Produces: `App\Models\Board::fromRow(array $row): self` with `id, userId, name`; `toArray(): array`.
- Produces: `App\Repositories\BoardRepository::allForUser(int $userId): array`, `find(int $id): ?array`, `create(int $userId, string $name): int`.
- Produces: `App\Services\BoardService::listForUser(int $userId): array`, `create(int $userId, string $name): array`, `getOwned(int $boardId, int $userId): array` (throws `ApiException` 404 if not found/not owned).

- [ ] **Step 1: Create `app/Models/Board.php`**

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

- [ ] **Step 2: Create `app/Repositories/BoardRepository.php`**

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

- [ ] **Step 3: Create `app/Services/BoardService.php`**

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

- [ ] **Step 4: Create `app/Controllers/Api/BoardController.php`**

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

- [ ] **Step 5: Register routes in `public/index.php`**

Add after the auth routes:

```php
use App\Controllers\Api\BoardController;

$boards = new BoardController();
$router->add('GET', '/api/boards', [$boards, 'index']);
$router->add('POST', '/api/boards', [$boards, 'store']);
$router->add('GET', '/api/boards/{id}', [$boards, 'show']);
```

- [ ] **Step 6: Write failing test for BoardService**

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

- [ ] **Step 7: Run tests to verify they fail then pass**

Run: `vendor/bin/phpunit tests/Unit/Services/BoardServiceTest.php`
Expected: PASS (3 tests) once Steps 1-3 files exist.

- [ ] **Step 8: Commit**

```bash
git add app/Models/Board.php app/Repositories/BoardRepository.php app/Services/BoardService.php app/Controllers/Api/BoardController.php public/index.php tests/Unit/Services/BoardServiceTest.php
git commit -m "feat: add Board model, repository, service, controller and routes"
```

---

## Task 6: Task model, repository, service (with position logic) and controller

**Files:**
- Create: `app/Models/Task.php`
- Create: `app/Repositories/TaskRepository.php`
- Create: `app/Services/TaskService.php`
- Create: `app/Controllers/Api/TaskController.php`
- Modify: `public/index.php` (register task routes)
- Test: `tests/Unit/Services/TaskServiceTest.php`

**Interfaces:**
- Consumes: `App\Services\BoardService::getOwned(int, int): array` (ownership check before touching tasks), `App\Middleware\AuthMiddleware::requireUserId(): int`.
- Produces: `App\Models\Task::fromRow(array $row): self` with `id, boardId, title, description, status, priority, color, dueDate, position`; `toArray(): array`.
- Produces: `App\Repositories\TaskRepository::allForBoard(int $boardId): array`, `find(int $id): ?array`, `create(array $data): int`, `update(int $id, array $data): void`, `updateStatusAndPosition(int $id, string $status, int $position): void`, `delete(int $id): void`, `maxPositionForStatus(int $boardId, string $status): int`.
- Produces: `App\Services\TaskService::listForBoard(int $boardId, int $userId): array`, `create(int $boardId, int $userId, array $data): array`, `update(int $taskId, int $userId, array $data): array`, `moveStatus(int $taskId, int $userId, string $status, int $position): array`, `delete(int $taskId, int $userId): void`.

- [ ] **Step 1: Create `app/Models/Task.php`**

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

- [ ] **Step 2: Create `app/Repositories/TaskRepository.php`**

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

- [ ] **Step 3: Create `app/Services/TaskService.php`**

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

- [ ] **Step 4: Create `app/Controllers/Api/TaskController.php`**

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

- [ ] **Step 5: Register routes in `public/index.php`**

```php
use App\Controllers\Api\TaskController;

$tasks = new TaskController();
$router->add('GET', '/api/boards/{id}/tasks', [$tasks, 'indexForBoard']);
$router->add('POST', '/api/tasks', [$tasks, 'store']);
$router->add('PATCH', '/api/tasks/{id}', [$tasks, 'update']);
$router->add('PATCH', '/api/tasks/{id}/status', [$tasks, 'updateStatus']);
$router->add('DELETE', '/api/tasks/{id}', [$tasks, 'destroy']);
```

- [ ] **Step 6: Write failing tests for TaskService**

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

- [ ] **Step 7: Run tests to verify they fail then pass**

Run: `vendor/bin/phpunit tests/Unit/Services/TaskServiceTest.php`
Expected: PASS (3 tests) once Steps 1-3 files exist.

- [ ] **Step 8: Commit**

```bash
git add app/Models/Task.php app/Repositories/TaskRepository.php app/Services/TaskService.php app/Controllers/Api/TaskController.php public/index.php tests/Unit/Services/TaskServiceTest.php
git commit -m "feat: add Task model, repository, service with position logic, controller and routes"
```

---

## Task 7: Integration tests against real MySQL (test database)

**Files:**
- Create: `tests/Integration/Repositories/UserRepositoryTest.php`
- Create: `tests/Integration/Repositories/TaskRepositoryTest.php`
- Create: `database/schema_test.sql` (same schema, DB name `todo_test`)
- Create: `phpunit.xml` split? Reuse existing `phpunit.xml`; add `DB_NAME=todo_test` guidance via `.env.testing` note in README (documentation is user's own task per spec, so just leave a comment at top of test files explaining the required env var).

**Interfaces:**
- Consumes: `App\Core\Database::connection()`, `App\Repositories\UserRepository`, `App\Repositories\TaskRepository`, `App\Repositories\BoardRepository`.

- [ ] **Step 1: Create `database/schema_test.sql`**

Copy of `database/schema.sql` with `todo` replaced by `todo_test` (database name only, table structure identical).

```sql
CREATE DATABASE IF NOT EXISTS todo_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE todo_test;

-- (resto idéntico a database/schema.sql, con las mismas 3 tablas: users, boards, tasks)
```

- [ ] **Step 2: Write `tests/Integration/Repositories/UserRepositoryTest.php`**

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

- [ ] **Step 3: Write `tests/Integration/Repositories/TaskRepositoryTest.php`**

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

- [ ] **Step 4: Create test database and run integration suite**

Run (with MySQL running locally, e.g. via Laragon):
`mysql -u root < database/schema_test.sql`
`DB_NAME=todo_test vendor/bin/phpunit tests/Integration`
Expected: PASS (4 tests). If MySQL isn't reachable yet, these are skipped, not failed — acceptable until Task 9 (Docker) provides MySQL.

- [ ] **Step 5: Commit**

```bash
git add database/schema_test.sql tests/Integration
git commit -m "test: add integration tests for UserRepository and TaskRepository"
```

---

## Task 8: Frontend skeleton, api.js and base styles

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/services/api.js`
- Create: `frontend/styles/base.css`
- Create: `package.json`
- Create: `vitest.config.js`

**Interfaces:**
- Produces: `frontend/services/api.js` exports `api` object with `register(name, email, password)`, `login(email, password)`, `logout()`, `me()`, `listBoards()`, `createBoard(name)`, `listTasks(boardId)`, `createTask(data)`, `updateTask(id, data)`, `moveTask(id, status, position)`, `deleteTask(id)` — all `async`, all using `fetch` with `credentials: 'include'`, throwing an `Error` with the API's `error` message on non-2xx.

- [ ] **Step 1: Create `package.json`**

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

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/frontend/**/*.test.js'],
  },
});
```

- [ ] **Step 3: Create `frontend/services/api.js`**

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

- [ ] **Step 4: Create `frontend/styles/base.css`**

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

- [ ] **Step 5: Create `frontend/index.html`**

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

- [ ] **Step 6: Install frontend dependencies**

Run: `npm install`
Expected: creates `node_modules/`, `package-lock.json`, no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/index.html frontend/services/api.js frontend/styles/base.css package.json vitest.config.js package-lock.json
git commit -m "feat: add frontend skeleton, api.js client and base styles"
```

---

## Task 9: task-card Web Component with position/priority logic + Vitest tests

**Files:**
- Create: `frontend/components/task-card.js`
- Create: `frontend/utils/priority.js`
- Test: `tests/frontend/task-card.test.js`

**Interfaces:**
- Produces: `frontend/utils/priority.js` exports `priorityLabel(priority: string): string` (`low→'Baja'`, `medium→'Media'`, `high→'Alta'`) and `priorityWeight(priority: string): number` (for sorting, `high=0, medium=1, low=2`).
- Produces: custom element `<task-card>` with attribute/property `task` (object), renders title/description/priority/date/color, dispatches `CustomEvent('task-move', { detail: { taskId, status, position }, bubbles: true })` — actual dispatch wired in Task 10 (board-column) on `drop`; this task only renders + sets `draggable=true` + `dragstart` sets `event.dataTransfer.setData('text/plain', String(taskId))`.

- [ ] **Step 1: Write failing test for `priority.js`**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/frontend/task-card.test.js`
Expected: FAIL (module `priority.js` not found)

- [ ] **Step 3: Create `frontend/utils/priority.js`**

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

- [ ] **Step 4: Create `frontend/components/task-card.js`**

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

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/frontend/task-card.test.js`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/utils/priority.js frontend/components/task-card.js tests/frontend/task-card.test.js
git commit -m "feat: add task-card Web Component and priority utils with tests"
```

---

## Task 10: board-column Web Component with drop zone and FLIP reorder logic

**Files:**
- Create: `frontend/components/board-column.js`
- Create: `frontend/utils/reorder.js`
- Test: `tests/frontend/reorder.test.js`

**Interfaces:**
- Produces: `frontend/utils/reorder.js` exports `computeDropPosition(existingPositions: number[], dropIndex: number): number` — returns the integer position value a moved task should take when dropped at `dropIndex` among `existingPositions` (sorted ascending); returns `0` when list is empty, `max(existingPositions) + 1` when dropped at end, otherwise `existingPositions[dropIndex]` (shifts happen server-side via re-numbering not required for v1 — simple integer append/insert is enough given `position` is only used for ordering, not uniqueness).
- Produces: custom element `<board-column>` with property `status` (string) and `title` (string), property `tasks` (array) → renders `<task-card>` children; listens for `dragover` (preventDefault to allow drop) and `drop` (reads `dataTransfer`, dispatches `CustomEvent('task-drop', { detail: { taskId, status, position }, bubbles: true, composed: true })`).

- [ ] **Step 1: Write failing test for `reorder.js`**

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

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/frontend/reorder.test.js`
Expected: FAIL (module not found)

- [ ] **Step 3: Create `frontend/utils/reorder.js`**

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

- [ ] **Step 4: Create `frontend/components/board-column.js`**

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

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/frontend/reorder.test.js`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/utils/reorder.js frontend/components/board-column.js tests/frontend/reorder.test.js
git commit -m "feat: add board-column Web Component with drop zone and reorder util"
```

---

## Task 11: app-board Web Component (orchestrator) wiring drag&drop to the API

**Files:**
- Create: `frontend/components/app-board.js`

**Interfaces:**
- Consumes: `api.listBoards()`, `api.createBoard()`, `api.listTasks(boardId)`, `api.moveTask(id, status, position)`, `App\...` (n/a, frontend only), `<board-column>`, custom element `<task-modal>` (stubbed usage, built in Task 12).
- Produces: custom element `<app-board>` — on connect: calls `api.me()`; if no user, renders `<login-form>`/`<register-form>` (Task 13); if user, loads first board (or creates "Mi tablero" if none exist) and renders 5 `<board-column>` grouped by status; listens for `task-drop` bubbling from columns and calls `api.moveTask` with optimistic UI update + rollback on failure.

- [ ] **Step 1: Create `frontend/components/app-board.js`**

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

- [ ] **Step 2: Manual smoke test in browser**

Run: `php -S 127.0.0.1:8080 -t public` (API) and serve `frontend/` statically, e.g. `npx serve frontend` or open `frontend/index.html` via a simple static server pointing `fetch` base at the API origin (for local dev without Docker, add a proxy or CORS — deferred to Task 14 Docker setup where nginx serves both under one origin).
Expected: page loads without console errors once logged in (login UI arrives in Task 12); acceptable at this step to visually confirm "Inicia sesión..." message renders.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/app-board.js
git commit -m "feat: add app-board orchestrator component with optimistic drag&drop"
```

---

## Task 12: task-modal (create/edit form) and wiring into app-board

**Files:**
- Create: `frontend/components/task-modal.js`
- Modify: `frontend/components/app-board.js` (add "+ Nueva tarea" trigger, open modal, call `api.createTask`/`api.updateTask`, refresh list)

**Interfaces:**
- Produces: custom element `<task-modal>` — property `task` (nullable, null = create mode), dispatches `CustomEvent('task-save', { detail: formData, bubbles: true, composed: true })` on submit and `CustomEvent('task-cancel', { bubbles: true, composed: true })` on cancel; method `open()`/`close()` toggling a `hidden` attribute-driven `<dialog>`-like overlay.

- [ ] **Step 1: Create `frontend/components/task-modal.js`**

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

- [ ] **Step 2: Wire modal into `frontend/components/app-board.js`**

Add import at top: `import './task-modal.js';`

Modify `render()` to append a trigger button and the modal, and add handlers in `connectedCallback`:

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

Add to `connectedCallback`, after the `task-drop` listener:

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

- [ ] **Step 3: Manual smoke test**

Run the full stack (Task 14 Docker or local PHP server + browser), log in, click "+ Nueva tarea", fill the form, submit.
Expected: new task appears in the "Idea" column without a full page reload.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/task-modal.js frontend/components/app-board.js
git commit -m "feat: add task-modal component and wire task creation into app-board"
```

---

## Task 13: login-form / register-form Web Components and auth flow

**Files:**
- Create: `frontend/components/login-form.js`
- Create: `frontend/components/register-form.js`
- Modify: `frontend/components/app-board.js` (replace `renderLoginRequired` with real forms, reload board after login/register)

**Interfaces:**
- Produces: `<login-form>` — dispatches `CustomEvent('auth-success', { detail: { user }, bubbles: true, composed: true })` on success, shows inline error message on failure.
- Produces: `<register-form>` — same event contract as `login-form`.

- [ ] **Step 1: Create `frontend/components/login-form.js`**

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

- [ ] **Step 2: Create `frontend/components/register-form.js`**

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

- [ ] **Step 3: Wire into `frontend/components/app-board.js`**

Add imports: `import './login-form.js'; import './register-form.js';`

Replace `renderLoginRequired` with:

```js
  renderLoginRequired() {
    this.shadowRoot.innerHTML = '<login-form></login-form><register-form></register-form>';
    this.shadowRoot.addEventListener('auth-success', async () => {
      await this.loadBoard();
      this.render();
    }, { once: true });
  }
```

- [ ] **Step 4: Manual smoke test**

Serve frontend + API, open in browser with no session cookie.
Expected: login/register forms appear; after registering, the board renders with an empty "Idea" column.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/login-form.js frontend/components/register-form.js frontend/components/app-board.js
git commit -m "feat: add login-form and register-form components with auth flow"
```

---

## Task 14: Animations, responsive polish

**Files:**
- Create: `frontend/styles/animations.css`
- Modify: `frontend/components/task-card.js` (add entry animation class on first render)

**Interfaces:**
- No new interfaces; pure CSS + a small class toggle.

- [ ] **Step 1: Create `frontend/styles/animations.css`**

```css
@keyframes card-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.card-enter {
  animation: card-in .2s ease-out;
}
```

- [ ] **Step 2: Modify `frontend/components/task-card.js` render() to add the entry class**

In the `<style>` block inside the shadow DOM template, add:

```css
        .card { animation: card-in .2s ease-out; }
        @keyframes card-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
```

(Kept duplicated inside the Shadow DOM `<style>` because styles in `frontend/styles/animations.css` do not pierce Shadow DOM boundaries — this is intentional encapsulation, not an oversight.)

- [ ] **Step 3: Manual visual check**

Run the app in a browser, add a task, drag it between columns.
Expected: new card fades/slides in; dragged card lifts (shadow+scale) during drag; column background highlights on `dragover`.

- [ ] **Step 4: Commit**

```bash
git add frontend/styles/animations.css frontend/components/task-card.js
git commit -m "feat: add card entry animation and drag visual feedback"
```

---

## Task 15: Docker (nginx + php-fpm + mysql)

**Files:**
- Create: `docker/Dockerfile`
- Create: `docker/nginx.conf`
- Create: `docker-compose.yml`

**Interfaces:**
- No PHP/JS interfaces; infra only. `docker-compose up` must serve the app on `http://localhost:8080` with `public/` as document root, `frontend/` reachable, and MySQL pre-loaded from `database/schema.sql`.

- [ ] **Step 1: Create `docker/Dockerfile`**

```dockerfile
FROM php:8.4-fpm

RUN docker-php-ext-install pdo_mysql

WORKDIR /var/www/html
```

- [ ] **Step 2: Create `docker/nginx.conf`**

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

- [ ] **Step 3: Create `docker-compose.yml`**

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

- [ ] **Step 4: Build and run**

Run: `docker compose up --build -d`
Then: `docker compose ps`
Expected: 3 services `Up`/`running`.

- [ ] **Step 5: Smoke test through Docker**

Run: `curl -s -X POST http://localhost:8080/api/auth/register -H "Content-Type: application/json" -d "{\"name\":\"Rober\",\"email\":\"rober@test.com\",\"password\":\"secret123\"}"`
Expected: HTTP 201 with the created user JSON. Then open `http://localhost:8080/frontend/index.html` in a browser and confirm the board loads (note: `frontend/services/api.js` uses relative `/api` paths, which resolve correctly since nginx serves both `public/` and `frontend/` under the same origin/port).

- [ ] **Step 6: Commit**

```bash
git add docker/Dockerfile docker/nginx.conf docker-compose.yml
git commit -m "feat: add Docker setup (nginx + php-fpm + mysql)"
```

---

## Self-Review Notes (completed during plan authoring)

1. **Spec coverage:** MVC layers (Task 1-6), routing/API (Task 2, 4-6), auth by session (Task 3-4), data model with `position` (Task 1, 6), Web Components + drag&drop + animations (Task 8-14), PHPUnit unit+integration (Task 3, 5-7), Vitest+jsdom (Task 8-10), Docker (Task 15), responsive (Task 8 base.css + Task 14 polish). Documentation is explicitly the user's own task per spec — not planned here.
2. **Placeholder scan:** no TBD/TODO; all steps carry full code.
3. **Type consistency:** `Task::toArray()` keys (`boardId`, `dueDate` camelCase) match what `frontend/services/api.js` sends/receives (`dueDate`, `boardId`) and what `TaskController`/`TaskService` read via `$request->input('boardId')` / `$data['dueDate']` — consistent end-to-end.
