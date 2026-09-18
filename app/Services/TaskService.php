<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Models\ChecklistItem;
use App\Models\Task;
use App\Repositories\ChecklistItemRepository;
use App\Repositories\TaskRepository;

final class TaskService
{
    private const VALID_STATUSES = ['backlog', 'planning', 'in_progress', 'testing', 'done'];
    private const VALID_PRIORITIES = ['low', 'medium', 'high'];
    private const COLOR_PATTERN = '/^#[0-9a-fA-F]{6}$/';
    private const STATUSES_REQUIRING_COMPLETE_CHECKLIST = ['testing', 'done'];

    public function __construct(
        private readonly TaskRepository $tasks,
        private readonly BoardService $boardsService,
        private readonly ChecklistItemRepository $checklistItems,
    ) {
    }

    /** Lista las tareas del tablero (con su checklist ya incluida), comprobando antes que el tablero pertenece al usuario. */
    public function listForBoard(int $boardId, int $userId): array
    {
        $this->boardsService->getOwned($boardId, $userId);

        $rows = $this->tasks->allForBoard($boardId);
        $taskIds = array_map(static fn (array $row) => (int) $row['id'], $rows);
        $itemsByTask = $this->groupChecklistItemsByTask($this->checklistItems->allForTaskIds($taskIds));

        return array_map(
            static function (array $row) use ($itemsByTask) {
                $task = Task::fromRow($row)->toArray();
                $task['checklistItems'] = $itemsByTask[$task['id']] ?? [];
                return $task;
            },
            $rows
        );
    }

    /** Agrupa filas de checklist_items por task_id, ya convertidas al formato del frontend. */
    private function groupChecklistItemsByTask(array $rows): array
    {
        $grouped = [];
        foreach ($rows as $row) {
            $grouped[(int) $row['task_id']][] = ChecklistItem::fromRow($row)->toArray();
        }
        return $grouped;
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
            'color' => $this->validColor($data['color'] ?? null),
            'due_date' => $this->normalizeDueDate($data['dueDate'] ?? null),
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
            'color' => $this->validColor($data['color'] ?? $task['color']),
            'due_date' => $this->normalizeDueDate($data['dueDate'] ?? $task['due_date']),
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

        if (in_array($status, self::STATUSES_REQUIRING_COMPLETE_CHECKLIST, true)
            && $this->checklistItems->hasPendingItems($taskId)
        ) {
            throw new ApiException('No puedes mover una tarea con pasos de checklist sin completar a Pruebas o Producción', 422);
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

    /** Busca la tarea y comprueba, a través de su tablero, que pertenece a ese usuario. Público: lo reutiliza ChecklistService. */
    public function findOwned(int $taskId, int $userId): array
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

    /** Convierte una fecha vacía ('') en null: una columna DATE de MySQL rechaza el string vacío. */
    private function normalizeDueDate(?string $dueDate): ?string
    {
        return $dueDate === '' ? null : $dueDate;
    }

    /** Comprueba que el color sea un hexadecimal válido (#rrggbb) o esté vacío. */
    private function validColor(?string $color): ?string
    {
        if ($color === null || $color === '') {
            return null;
        }

        if (!preg_match(self::COLOR_PATTERN, $color)) {
            throw new ApiException('El color debe ser un hexadecimal válido (#rrggbb)', 422);
        }

        return $color;
    }
}
