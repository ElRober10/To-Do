<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Services\TaskService;
use App\Services\TaskServiceFactory;

final class TaskController
{
    private TaskService $tasksService;
    private AuthMiddleware $auth;

    public function __construct()
    {
        $this->tasksService = TaskServiceFactory::make();
        $this->auth = new AuthMiddleware();
    }

    /** GET /api/boards/{id}/tasks — lista las tareas de un tablero. */
    public function indexForBoard(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $boardId = $request->intParam('id');
        Response::json(['tasks' => $this->tasksService->listForBoard($boardId, $userId)]);
    }

    /** POST /api/tasks — crea una tarea nueva en la columna "Idea" del tablero indicado. */
    public function store(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $boardId = (int) $request->input('boardId');
        $task = $this->tasksService->create($boardId, $userId, $request->all());
        Response::json(['task' => $task], 201);
    }

    /** PATCH /api/tasks/{id} — edita el contenido de una tarea (título, descripción, prioridad, color, fecha). */
    public function update(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $taskId = $request->intParam('id');
        $task = $this->tasksService->update($taskId, $userId, $request->all());
        Response::json(['task' => $task]);
    }

    /** PATCH /api/tasks/{id}/status — mueve la tarea de columna/posición (lo dispara el drag&drop). */
    public function updateStatus(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $taskId = $request->intParam('id');
        $task = $this->tasksService->moveStatus(
            $taskId,
            $userId,
            (string) $request->input('status'),
            (int) $request->input('position', 0)
        );
        Response::json(['task' => $task]);
    }

    /** DELETE /api/tasks/{id} — borra una tarea. */
    public function destroy(Request $request): void
    {
        $userId = $this->auth->requireUserId();
        $taskId = $request->intParam('id');
        $this->tasksService->delete($taskId, $userId);
        Response::json(['ok' => true]);
    }
}
