<?php

declare(strict_types=1);

namespace App\Core;

final class Request
{
    private array $params = [];

    private function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $query,
        private readonly array $body,
    ) {
    }

    /** Construye el Request leyendo método, ruta, query y body JSON de las variables globales de PHP. */
    public static function fromGlobals(): self
    {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        $path = rtrim((string) parse_url($uri, PHP_URL_PATH), '/');
        $path = $path === '' ? '/' : $path;

        $rawBody = file_get_contents('php://input') ?: '';
        $decoded = [];
        if ($rawBody !== '') {
            $decoded = json_decode($rawBody, true) ?? [];
        }

        return new self($method, $path, $_GET, $decoded);
    }

    /** Método HTTP de la petición (GET, POST, PATCH, DELETE...). */
    public function method(): string
    {
        return $this->method;
    }

    /** Ruta de la petición, sin query string ni barra final. */
    public function path(): string
    {
        return $this->path;
    }

    /** Lee un campo del body JSON o, si no está, del query string; si no hay ninguno, devuelve $default. */
    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $this->query[$key] ?? $default;
    }

    /** Devuelve todos los datos de entrada (query + body) combinados. */
    public function all(): array
    {
        return array_merge($this->query, $this->body);
    }

    /** Parámetros capturados de la ruta (ej. el {id} de /api/boards/{id}). */
    public function params(): array
    {
        return $this->params;
    }

    /** Inyecta los parámetros de ruta que el Router capturó al hacer el match. */
    public function setParams(array $params): void
    {
        $this->params = $params;
    }
}
