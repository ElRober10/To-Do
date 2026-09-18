<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

class UserRepository extends Repository
{
    protected function table(): string
    {
        return 'users';
    }

    /** Busca un usuario por email; null si no existe. Se usa en login y para comprobar duplicados en registro. */
    public function findByEmail(string $email): ?array
    {
        return $this->findOneBy('email', $email);
    }

    /** Busca un usuario por id; null si no existe. Se usa para recuperar el usuario logueado desde la sesión. */
    public function findById(int $id): ?array
    {
        return $this->findOneBy('id', $id);
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
