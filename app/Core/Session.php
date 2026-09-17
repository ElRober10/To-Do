<?php

declare(strict_types=1);

namespace App\Core;

final class Session
{
    /** Arranca la sesión PHP (si no está ya activa), con cookie httpOnly + SameSite=Lax. */
    public static function start(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_set_cookie_params([
                'httponly' => true,
                'samesite' => 'Lax',
                'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            ]);
            session_start();
        }
    }

    /** Guarda un valor en la sesión bajo esa clave. */
    public static function set(string $key, mixed $value): void
    {
        $_SESSION[$key] = $value;
    }

    /** Lee un valor de la sesión; si no existe, devuelve $default. */
    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    /** Indica si esa clave existe en la sesión. */
    public static function has(string $key): bool
    {
        return isset($_SESSION[$key]);
    }

    /** Elimina una clave concreta de la sesión. */
    public static function remove(string $key): void
    {
        unset($_SESSION[$key]);
    }

    /** Vacía y destruye la sesión por completo (logout). */
    public static function destroy(): void
    {
        $_SESSION = [];
        session_destroy();
    }

    /** Genera un nuevo ID de sesión manteniendo los datos (evita session fixation tras login). */
    public static function regenerate(): void
    {
        session_regenerate_id(true);
    }
}
