<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Core\ApiException;
use App\Repositories\BoardRepository;
use App\Repositories\ChecklistItemRepository;
use App\Repositories\TaskRepository;
use App\Services\BoardService;
use App\Services\TaskService;
use PHPUnit\Framework\TestCase;

final class TaskServiceTest extends TestCase
{
    /** Título vacío (o solo espacios) debe rechazarse sin llegar a crear la tarea. */
    public function testCreateRejectsEmptyTitle(): void
    {
        $boardRepo = $this->createMock(BoardRepository::class);
        $boardRepo->method('find')->willReturn(['id' => 1, 'user_id' => 1, 'name' => 'B']);
        $taskRepo = $this->createMock(TaskRepository::class);
        $taskRepo->expects($this->never())->method('create');

        $service = new TaskService($taskRepo, new BoardService($boardRepo), $this->createMock(ChecklistItemRepository::class));

        $this->expectException(ApiException::class);
        $service->create(1, 1, ['title' => '  ']);
    }

    /** Al crear, la tarea entra en "backlog" en la posición siguiente a la última existente en esa columna. */
    public function testCreateAssignsNextPositionInBacklog(): void
    {
        $boardRepo = $this->createMock(BoardRepository::class);
        $boardRepo->method('find')->willReturn(['id' => 1, 'user_id' => 1, 'name' => 'B']);

        $taskRepo = $this->createMock(TaskRepository::class);
        $taskRepo->method('maxPositionForStatus')->with(1, 'backlog')->willReturn(2);
        $taskRepo->expects($this->once())->method('create')->with($this->callback(
            static fn (array $data) => $data['position'] === 3 && $data['status'] === 'backlog'
        ))->willReturn(99);
        $taskRepo->method('find')->willReturn([
            'id' => 99, 'board_id' => 1, 'title' => 'Nueva', 'description' => null,
            'status' => 'backlog', 'priority' => 'medium', 'color' => null,
            'due_date' => null, 'position' => 3,
        ]);

        $service = new TaskService($taskRepo, new BoardService($boardRepo), $this->createMock(ChecklistItemRepository::class));
        $task = $service->create(1, 1, ['title' => 'Nueva']);

        $this->assertSame(3, $task['position']);
    }

    /** Mover una tarea a un estado que no es uno de los 5 válidos debe rechazarse sin tocar la BD. */
    public function testMoveStatusRejectsInvalidStatus(): void
    {
        $boardRepo = $this->createMock(BoardRepository::class);
        $boardRepo->method('find')->willReturn(['id' => 1, 'user_id' => 1, 'name' => 'B']);

        $taskRepo = $this->createMock(TaskRepository::class);
        $taskRepo->method('find')->willReturn([
            'id' => 5, 'board_id' => 1, 'title' => 'X', 'description' => null,
            'status' => 'backlog', 'priority' => 'medium', 'color' => null,
            'due_date' => null, 'position' => 0,
        ]);
        $taskRepo->expects($this->never())->method('updateStatusAndPosition');

        $service = new TaskService($taskRepo, new BoardService($boardRepo), $this->createMock(ChecklistItemRepository::class));

        $this->expectException(ApiException::class);
        $service->moveStatus(5, 1, 'estado_invalido', 0);
    }

    /** listForBoard debe adjuntar a cada tarea su propia checklist (y [] si no tiene pasos). */
    public function testListForBoardAttachesChecklistItemsToEachTask(): void
    {
        $boardRepo = $this->createMock(BoardRepository::class);
        $boardRepo->method('find')->willReturn(['id' => 1, 'user_id' => 1, 'name' => 'B']);

        $taskRepo = $this->createMock(TaskRepository::class);
        $taskRepo->method('allForBoard')->willReturn([
            ['id' => 1, 'board_id' => 1, 'title' => 'Con pasos', 'description' => null,
                'status' => 'backlog', 'priority' => 'medium', 'color' => null, 'due_date' => null, 'position' => 0],
            ['id' => 2, 'board_id' => 1, 'title' => 'Sin pasos', 'description' => null,
                'status' => 'backlog', 'priority' => 'medium', 'color' => null, 'due_date' => null, 'position' => 1],
        ]);

        $checklistRepo = $this->createMock(ChecklistItemRepository::class);
        $checklistRepo->method('allForTaskIds')->with([1, 2])->willReturn([
            ['id' => 10, 'task_id' => 1, 'text' => 'Paso 1', 'completed' => 0, 'position' => 0],
        ]);

        $service = new TaskService($taskRepo, new BoardService($boardRepo), $checklistRepo);
        $tasks = $service->listForBoard(1, 1);

        $this->assertCount(1, $tasks[0]['checklistItems']);
        $this->assertSame('Paso 1', $tasks[0]['checklistItems'][0]['text']);
        $this->assertSame([], $tasks[1]['checklistItems']);
    }
}
