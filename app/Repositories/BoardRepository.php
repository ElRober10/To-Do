<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

class BoardRepository extends Repository
{
    protected function table(): string
    {
        return 'boards';
    }

    /** Lista los tableros de un usuario, más recientes primero. */
    public function allForUser(int $userId): array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM boards WHERE user_id = :user_id ORDER BY created_at DESC');
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    /** Busca un tablero por id, sin comprobar dueño (esa comprobación la hace el Service). */
    public function find(int $id): ?array
    {
        return $this->findOneBy('id', $id);
    }

    /** Inserta un tablero nuevo para ese usuario y devuelve su id autogenerado. */
    public function create(int $userId, string $name): int
    {
        $stmt = Database::connection()->prepare('INSERT INTO boards (user_id, name) VALUES (:user_id, :name)');
        $stmt->execute(['user_id' => $userId, 'name' => $name]);
        return (int) Database::connection()->lastInsertId();
    }
}
