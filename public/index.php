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
