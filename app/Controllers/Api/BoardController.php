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
