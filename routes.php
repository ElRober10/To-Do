<?php

declare(strict_types=1);

use App\Controllers\Api\AuthController;
use App\Controllers\Api\BoardController;
use App\Controllers\Api\TaskController;

/** @var App\Core\Router $router */

$auth = new AuthController();

$router->add('POST', '/api/auth/register', [$auth, 'register']);
$router->add('POST', '/api/auth/login', [$auth, 'login']);
$router->add('POST', '/api/auth/logout', [$auth, 'logout']);
$router->add('GET', '/api/auth/me', [$auth, 'me']);

$boards = new BoardController();

$router->add('GET', '/api/boards', [$boards, 'index']);
$router->add('POST', '/api/boards', [$boards, 'store']);
$router->add('GET', '/api/boards/{id}', [$boards, 'show']);

$tasks = new TaskController();

$router->add('GET', '/api/boards/{id}/tasks', [$tasks, 'indexForBoard']);
$router->add('POST', '/api/tasks', [$tasks, 'store']);
$router->add('PATCH', '/api/tasks/{id}', [$tasks, 'update']);
$router->add('PATCH', '/api/tasks/{id}/status', [$tasks, 'updateStatus']);
$router->add('DELETE', '/api/tasks/{id}', [$tasks, 'destroy']);
