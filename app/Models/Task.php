<?php

declare(strict_types=1);

namespace App\Models;

final class Task
{
    public function __construct(
        public readonly int $id,
        public readonly int $boardId,
        public readonly string $title,
        public readonly ?string $description,
        public readonly string $status,
        public readonly string $priority,
        public readonly ?string $color,
        public readonly ?string $dueDate,
        public readonly int $position,
    ) {
    }

    /** Construye una Task a partir de una fila cruda de la tabla `tasks`. */
    public static function fromRow(array $row): self
    {
        return new self(
            (int) $row['id'],
            (int) $row['board_id'],
            (string) $row['title'],
            $row['description'] !== null ? (string) $row['description'] : null,
            (string) $row['status'],
            (string) $row['priority'],
            $row['color'] !== null ? (string) $row['color'] : null,
            $row['due_date'] !== null ? (string) $row['due_date'] : null,
            (int) $row['position'],
        );
    }

    /** Datos expuestos en la API, en camelCase para que encajen con el JSON que consume el frontend. */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'boardId' => $this->boardId,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'priority' => $this->priority,
            'color' => $this->color,
            'dueDate' => $this->dueDate,
            'position' => $this->position,
        ];
    }
}
