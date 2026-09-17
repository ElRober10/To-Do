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

    public function register(Request $request): void
    {
        $user = $this->auth->register(
            (string) $request->input('name', ''),
            (string) $request->input('email', ''),
            (string) $request->input('password', '')
        );

        Response::json(['user' => $user], 201);
    }

    public function login(Request $request): void
    {
        $user = $this->auth->login(
            (string) $request->input('email', ''),
            (string) $request->input('password', '')
        );

        Response::json(['user' => $user]);
    }

    public function logout(Request $request): void
    {
        $this->auth->logout();
        Response::json(['ok' => true]);
    }

    public function me(Request $request): void
    {
        Response::json(['user' => $this->auth->currentUser()]);
    }
}
