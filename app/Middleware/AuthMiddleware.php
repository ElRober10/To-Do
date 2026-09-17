<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Session;

final class AuthMiddleware
{
    /** Comprueba que haya sesión activa y devuelve el user_id; si no, lanza 401. */
    public function requireUserId(): int
    {
        Session::start();
        $id = Session::get('user_id');

        if ($id === null) {
            throw new ApiException('No autenticado', 401);
        }

        return (int) $id;
    }
}
