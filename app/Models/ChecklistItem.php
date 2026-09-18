<?php

declare(strict_types=1);

namespace App\Models;

final class ChecklistItem
{
    public function __construct(
        public readonly int $id,
        public readonly int $taskId,
        public readonly string $text,
        public readonly bool $completed,
        public readonly int $position,
    ) {
    }

    /** Construye un ChecklistItem a partir de una fila cruda de la tabla `checklist_items`. */
    public static function fromRow(array $row): self
    {
        return new self(
            (int) $row['id'],
            (int) $row['task_id'],
            (string) $row['text'],
            (bool) $row['completed'],
            (int) $row['position'],
        );
    }

    /** Datos expuestos en la API, en camelCase para que encajen con el JSON que consume el frontend. */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'taskId' => $this->taskId,
            'text' => $this->text,
            'completed' => $this->completed,
            'position' => $this->position,
        ];
    }
}
