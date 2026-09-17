<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

class BoardRepository
{
    public function allForUser(int $userId): array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM boards WHERE user_id = :user_id ORDER BY created_at DESC');
        $stmt->execute(['user_id' => $userId]);
        return $stmt->fetchAll();
    }

    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM boards WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    public function create(int $userId, string $name): int
    {
        $stmt = Database::connection()->prepare('INSERT INTO boards (user_id, name) VALUES (:user_id, :name)');
        $stmt->execute(['user_id' => $userId, 'name' => $name]);
        return (int) Database::connection()->lastInsertId();
    }
}
