<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Session;

final class AuthMiddleware
{
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
