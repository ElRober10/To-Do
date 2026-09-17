<?php

declare(strict_types=1);

namespace App\Controllers\Api;

use App\Core\Request;
use App\Core\Response;
use App\Repositories\UserRepository;
use App\Services\AuthService;

final class AuthController
{
    private AuthService $auth;

    public function __construct()
    {
        $this->auth = new AuthService(new UserRepository());
    }

    /** POST /api/auth/register — crea una cuenta y responde 201 con el usuario creado. */
    public function register(Request $request): void
    {
        $user = $this->auth->register(
            (string) $request->input('name', ''),
            (string) $request->input('email', ''),
            (string) $request->input('password', '')
        );

        Response::json(['user' => $user], 201);
    }

    /** POST /api/auth/login — comprueba credenciales y responde con el usuario logueado. */
    public function login(Request $request): void
    {
        $user = $this->auth->login(
            (string) $request->input('email', ''),
            (string) $request->input('password', '')
        );

        Response::json(['user' => $user]);
    }

    /** POST /api/auth/logout — cierra la sesión actual. */
    public function logout(Request $request): void
    {
        $this->auth->logout();
        Response::json(['ok' => true]);
    }

    /** GET /api/auth/me — devuelve el usuario logueado (o null) para que el front sepa el estado al cargar. */
    public function me(Request $request): void
    {
        Response::json(['user' => $this->auth->currentUser()]);
    }
}
