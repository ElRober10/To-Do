<?php

declare(strict_types=1);

namespace App\Core;

class ApiException extends \RuntimeException
{
    /** Crea la excepción con su mensaje y el código HTTP que debe devolver la API. */
    public function __construct(string $message, private readonly int $status = 400)
    {
        parent::__construct($message);
    }

    /** Código de estado HTTP asociado a este error (401, 404, 422...). */
    public function getStatus(): int
    {
        return $this->status;
    }
}
