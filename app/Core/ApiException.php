<?php

declare(strict_types=1);

namespace App\Core;

class ApiException extends \RuntimeException
{
    public function __construct(string $message, private readonly int $status = 400)
    {
        parent::__construct($message);
    }

    public function getStatus(): int
    {
        return $this->status;
    }
}
