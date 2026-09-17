<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Core\ApiException;
use App\Repositories\BoardRepository;
use App\Repositories\TaskRepository;
use App\Services\BoardService;
use App\Services\TaskService;
use PHPUnit\Framework\TestCase;

final class TaskServiceTest extends TestCase
{
    public function testCreateRejectsEmptyTitle(): void
    {
        $boardRepo = $this->createMock(BoardRepository::class);
        $boardRepo->method('find')->willReturn(['id' => 1, 'user_id' => 1, 'name' => 'B']);
        $taskRepo = $this->createMock(TaskRepository::class);
        $taskRepo->expects($this->never())->method('create');

        $service = new TaskService($taskRepo, new BoardService($boardRepo));

        $this->expectException(ApiException::class);
        $service->create(1, 1, ['title' => '  ']);
    }

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

        $service = new TaskService($taskRepo, new BoardService($boardRepo));
        $task = $service->create(1, 1, ['title' => 'Nueva']);

        $this->assertSame(3, $task['position']);
    }

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

        $service = new TaskService($taskRepo, new BoardService($boardRepo));

        $this->expectException(ApiException::class);
        $service->moveStatus(5, 1, 'estado_invalido', 0);
    }
}
