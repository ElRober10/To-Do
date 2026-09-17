<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

class UserRepository
{
    /** Busca un usuario por email; null si no existe. Se usa en login y para comprobar duplicados en registro. */
    public function findByEmail(string $email): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $stmt->execute(['email' => $email]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** Busca un usuario por id; null si no existe. Se usa para recuperar el usuario logueado desde la sesión. */
    public function findById(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** Inserta un usuario nuevo y devuelve su id autogenerado. */
    public function create(string $name, string $email, string $passwordHash): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO users (name, email, password_hash) VALUES (:name, :email, :password_hash)'
        );
        $stmt->execute(['name' => $name, 'email' => $email, 'password_hash' => $passwordHash]);
        return (int) Database::connection()->lastInsertId();
    }
}
