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

    public static function fromRow(array $row): self
    {
        return new self((int) $row['id'], (int) $row['user_id'], (string) $row['name']);
    }

    public function toArray(): array
    {
        return ['id' => $this->id, 'name' => $this->name];
    }
}
