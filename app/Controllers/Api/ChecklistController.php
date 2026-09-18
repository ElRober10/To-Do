<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\BoardRepository;
use App\Repositories\ChecklistItemRepository;
use App\Repositories\TaskRepository;
use App\Services\BoardService;
use App\Services\ChecklistService;
use App\Services\TaskService;

final class ChecklistController
{
    private ChecklistService $checklistService;
    private AuthMiddleware $auth;

    public function __construct()
    {
        $tasksService = new TaskService(
            new TaskRepository(),
            new BoardService(new BoardRepository()),
            new ChecklistItemRepository(),
        );
        $this->checklistService = new ChecklistService(new ChecklistItemRepository(), $tasksService);
        $this->auth = new AuthMiddleware();
    }

    /** POST /api/tasks/{id}/checklist-items — añade un paso nuevo al final de la checklist de una tarea. */
    public function store(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $taskId = (int) $request->params()['id'];
        $item = $this->checklistService->create($taskId, $userId, $request->all());
        Response::json(['item' => $item], 201);
    }

    /** PATCH /api/checklist-items/{id} — edita el texto y/o marca/desmarca un paso como completado. */
    public function update(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $itemId = (int) $request->params()['id'];
        $item = $this->checklistService->update($itemId, $userId, $request->all());
        Response::json(['item' => $item]);
    }

    /** DELETE /api/checklist-items/{id} — borra un paso. */
    public function destroy(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $itemId = (int) $request->params()['id'];
        $this->checklistService->delete($itemId, $userId);
        Response::json(['ok' => true]);
    }
}
