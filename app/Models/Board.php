<?php

declare(strict_types=1);

namespace App\Models;

final class Board
{
    public function __construct(
        public readonly int $id,
        public readonly int $userId,
        public readonly string $name,
    ) {
    }

    /** Construye un Board a partir de una fila cruda de la tabla `boards`. */
    public static function fromRow(array $row): self
    {
        return new self((int) $row['id'], (int) $row['user_id'], (string) $row['name']);
    }

    /** Datos expuestos en la API (sin userId: el front no necesita saber el dueño de su propio tablero). */
    public function toArray(): array
    {
        return ['id' => $this->id, 'name' => $this->name];
    }
}
