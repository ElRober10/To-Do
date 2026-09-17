<?php

declare(strict_types=1);

use App\Controllers\Api\AuthController;

/** @var App\Core\Router $router */

$auth = new AuthController();

$router->add('POST', '/api/auth/register', [$auth, 'register']);
$router->add('POST', '/api/auth/login', [$auth, 'login']);
$router->add('POST', '/api/auth/logout', [$auth, 'logout']);
$router->add('GET', '/api/auth/me', [$auth, 'me']);
