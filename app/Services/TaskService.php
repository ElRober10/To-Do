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

    /** Lista las tareas del tablero, comprobando antes que el tablero pertenece al usuario. */
    public function listForBoard(int $boardId, int $userId): array
    {
        $this->boardsService->getOwned($boardId, $userId);

        return array_map(
            static fn (array $row) => Task::fromRow($row)->toArray(),
            $this->tasks->allForBoard($boardId)
        );
    }

    /** Crea una tarea nueva en la columna "Idea" (backlog), al final de esa columna. */
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

    /** Actualiza el contenido de una tarea (título, descripción, prioridad, color, fecha), comprobando propiedad. */
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

    /** Mueve una tarea a otra columna/posición (lo que dispara el drag&drop), comprobando propiedad y estado válido. */
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

    /** Borra una tarea, comprobando antes que pertenece al usuario. */
    public function delete(int $taskId, int $userId): void
    {
        $this->findOwned($taskId, $userId);
        $this->tasks->delete($taskId);
    }

    /** Busca la tarea y comprueba, a través de su tablero, que pertenece a ese usuario. */
    private function findOwned(int $taskId, int $userId): array
    {
        $row = $this->tasks->find($taskId);

        if ($row === null) {
            throw new ApiException('Tarea no encontrada', 404);
        }

        $this->boardsService->getOwned((int) $row['board_id'], $userId);

        return $row;
    }

    /** Rechaza títulos vacíos o solo espacios. */
    private function assertValidTitle(string $title): void
    {
        if (trim($title) === '') {
            throw new ApiException('El título es obligatorio', 422);
        }
    }

    /** Comprueba que la prioridad sea una de las 3 válidas. */
    private function validPriority(string $priority): string
    {
        if (!in_array($priority, self::VALID_PRIORITIES, true)) {
            throw new ApiException('Prioridad inválida', 422);
        }

        return $priority;
    }
}
