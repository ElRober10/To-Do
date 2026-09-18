<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\BoardRepository;
use App\Repositories\ChecklistItemRepository;
use App\Repositories\TaskRepository;

final class TaskServiceFactory
{
    /** Construye un TaskService con sus dependencias reales. Centraliza este cableado porque lo necesitan tanto TaskController como ChecklistController (éste último para comprobar propiedad vía TaskService::findOwned). */
    public static function make(): TaskService
    {
        return new TaskService(
            new TaskRepository(),
            new BoardService(new BoardRepository()),
            new ChecklistItemRepository(),
        );
    }
}
