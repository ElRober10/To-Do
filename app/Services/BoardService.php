<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Models\Board;
use App\Repositories\BoardRepository;

final class BoardService
{
    public function __construct(private readonly BoardRepository $boards)
    {
    }

    public function listForUser(int $userId): array
    {
        return array_map(
            static fn (array $row) => Board::fromRow($row)->toArray(),
            $this->boards->allForUser($userId)
        );
    }

    public function create(int $userId, string $name): array
    {
        if (trim($name) === '') {
            throw new ApiException('El nombre del tablero es obligatorio', 422);
        }

        $id = $this->boards->create($userId, $name);
        return Board::fromRow(['id' => $id, 'user_id' => $userId, 'name' => $name])->toArray();
    }

    public function getOwned(int $boardId, int $userId): array
    {
        $row = $this->boards->find($boardId);

        if ($row === null || (int) $row['user_id'] !== $userId) {
            throw new ApiException('Tablero no encontrado', 404);
        }

        return Board::fromRow($row)->toArray();
    }
}
