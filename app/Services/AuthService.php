<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\ApiException;
use App\Core\Session;
use App\Models\User;
use App\Repositories\UserRepository;

final class AuthService
{
    public function __construct(private readonly UserRepository $users)
    {
    }

    public function register(string $name, string $email, string $password): array
    {
        if (trim($name) === '' || trim($email) === '' || strlen($password) < 6) {
            throw new ApiException('Nombre, email y contraseña (mínimo 6 caracteres) son obligatorios', 422);
        }

        if ($this->users->findByEmail($email) !== null) {
            throw new ApiException('Ese email ya está registrado', 422);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $id = $this->users->create($name, $email, $hash);

        $user = User::fromRow(['id' => $id, 'name' => $name, 'email' => $email]);
        $this->startSession($user);

        return $user->toArray();
    }

    public function login(string $email, string $password): array
    {
        $row = $this->users->findByEmail($email);

        if ($row === null || !password_verify($password, $row['password_hash'])) {
            throw new ApiException('Credenciales inválidas', 401);
        }

        $user = User::fromRow($row);
        $this->startSession($user);

        return $user->toArray();
    }

    public function logout(): void
    {
        Session::destroy();
    }

    public function currentUser(): ?array
    {
        $id = Session::get('user_id');
        if ($id === null) {
            return null;
        }

        $row = $this->users->findById((int) $id);
        return $row === null ? null : User::fromRow($row)->toArray();
    }

    private function startSession(User $user): void
    {
        Session::start();
        Session::regenerate();
        Session::set('user_id', $user->id);
    }
}
