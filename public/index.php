<?php

declare(strict_types=1);

require dirname(__DIR__) . '/vendor/autoload.php';

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;
use App\Core\Session;

Session::start();

$router = new Router();
require_once dirname(__DIR__) . '/routes.php';

$request = Request::fromGlobals();

try {
    $router->dispatch($request);
} catch (ApiException $e) {
    Response::json(['error' => $e->getMessage()], $e->getStatus());
} catch (\Throwable $e) {
    Response::json(['error' => 'Error interno del servidor'], 500);
}
