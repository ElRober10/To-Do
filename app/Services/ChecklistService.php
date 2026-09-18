<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Models\ChecklistItem;
use App\Repositories\ChecklistItemRepository;

final class ChecklistService
{
    public function __construct(
        private readonly ChecklistItemRepository $items,
        private readonly TaskService $tasksService,
    ) {
    }

    /** Lista los pasos de una tarea, comprobando antes que la tarea pertenece al usuario. */
    public function listForTask(int $taskId, int $userId): array
    {
        $this->tasksService->findOwned($taskId, $userId);

        return array_map(
            static fn (array $row) => ChecklistItem::fromRow($row)->toArray(),
            $this->items->allForTask($taskId)
        );
    }

    /** Añade un paso nuevo al final de la checklist de una tarea. */
    public function create(int $taskId, int $userId, array $data): array
    {
        $this->tasksService->findOwned($taskId, $userId);
        $this->assertValidText($data['text'] ?? '');

        $position = $this->items->maxPositionForTask($taskId) + 1;

        $id = $this->items->create([
            'task_id' => $taskId,
            'text' => $data['text'],
            'completed' => false,
            'position' => $position,
        ]);

        $row = $this->items->find($id);
        return ChecklistItem::fromRow($row)->toArray();
    }

    /** Edita el texto y/o el estado (completado) de un paso, comprobando propiedad. */
    public function update(int $itemId, int $userId, array $data): array
    {
        $item = $this->findOwned($itemId, $userId);
        $text = $data['text'] ?? $item['text'];
        $this->assertValidText($text);

        $this->items->update($itemId, [
            'text' => $text,
            'completed' => array_key_exists('completed', $data) ? (bool) $data['completed'] : (bool) $item['completed'],
        ]);

        $row = $this->items->find($itemId);
        return ChecklistItem::fromRow($row)->toArray();
    }

    /** Borra un paso, comprobando antes que pertenece al usuario. */
    public function delete(int $itemId, int $userId): void
    {
        $this->findOwned($itemId, $userId);
        $this->items->delete($itemId);
    }

    /** Busca el paso y comprueba, a través de su tarea y tablero, que pertenece a ese usuario. */
    private function findOwned(int $itemId, int $userId): array
    {
        $row = $this->items->find($itemId);

        if ($row === null) {
            throw new ApiException('Paso no encontrado', 404);
        }

        $this->tasksService->findOwned((int) $row['task_id'], $userId);

        return $row;
    }

    /** Rechaza textos vacíos o solo espacios. */
    private function assertValidText(string $text): void
    {
        if (trim($text) === '') {
            throw new ApiException('El texto del paso es obligatorio', 422);
        }
    }
}
