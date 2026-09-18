<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Core\ApiException;
use App\Repositories\BoardRepository;
use App\Repositories\ChecklistItemRepository;
use App\Repositories\TaskRepository;
use App\Services\BoardService;
use App\Services\ChecklistService;
use App\Services\TaskService;
use PHPUnit\Framework\TestCase;

final class ChecklistServiceTest extends TestCase
{
    /**
     * TaskService es `final` (no se puede mockear con createMock), así que para comprobar la
     * comprobación de propiedad se construye uno real apoyado en un TaskRepository y un
     * BoardRepository mockeados — mismo patrón que usa TaskServiceTest para sí mismo.
     */
    private function taskServiceOwnedBy(int $taskId, BoardRepository $boardRepo): TaskService
    {
        $taskRepo = $this->createMock(TaskRepository::class);
        $taskRepo->method('find')->with($taskId)->willReturn([
            'id' => $taskId, 'board_id' => 1, 'title' => 'T', 'description' => null,
            'status' => 'backlog', 'priority' => 'medium', 'color' => null, 'due_date' => null, 'position' => 0,
        ]);

        return new TaskService($taskRepo, new BoardService($boardRepo), $this->createMock(ChecklistItemRepository::class));
    }

    /** BoardRepository mockeado cuyo tablero pertenece a $userId (para el caso "propiedad correcta"). */
    private function boardRepoOwnedBy(int $userId): BoardRepository
    {
        $boardRepo = $this->createMock(BoardRepository::class);
        $boardRepo->method('find')->willReturn(['id' => 1, 'user_id' => $userId, 'name' => 'B']);
        return $boardRepo;
    }

    /** listForTask comprueba antes que la tarea pertenece al usuario, y devuelve los pasos ya convertidos (camelCase). */
    public function testListForTaskChecksOwnershipAndReturnsItems(): void
    {
        $boardRepo = $this->boardRepoOwnedBy(1);
        $boardRepo->expects($this->once())->method('find');
        $tasksService = $this->taskServiceOwnedBy(5, $boardRepo);

        $itemsRepo = $this->createMock(ChecklistItemRepository::class);
        $itemsRepo->method('allForTask')->with(5)->willReturn([
            ['id' => 1, 'task_id' => 5, 'text' => 'Paso 1', 'completed' => 0, 'position' => 0],
        ]);

        $service = new ChecklistService($itemsRepo, $tasksService);
        $items = $service->listForTask(5, 1);

        $this->assertCount(1, $items);
        $this->assertSame('Paso 1', $items[0]['text']);
    }

    /** Listar la checklist de una tarea de otro usuario debe rechazarse (404), delegado en TaskService::findOwned. */
    public function testListForTaskRejectsWhenTaskBelongsToAnotherUser(): void
    {
        $boardRepo = $this->boardRepoOwnedBy(99);
        $tasksService = $this->taskServiceOwnedBy(5, $boardRepo);

        $itemsRepo = $this->createMock(ChecklistItemRepository::class);
        $itemsRepo->expects($this->never())->method('allForTask');

        $service = new ChecklistService($itemsRepo, $tasksService);

        $this->expectException(ApiException::class);
        $service->listForTask(5, 1);
    }

    /** Un texto vacío (o solo espacios) debe rechazarse sin llegar a crear el paso. */
    public function testCreateRejectsEmptyText(): void
    {
        $tasksService = $this->taskServiceOwnedBy(5, $this->boardRepoOwnedBy(1));

        $itemsRepo = $this->createMock(ChecklistItemRepository::class);
        $itemsRepo->expects($this->never())->method('create');

        $service = new ChecklistService($itemsRepo, $tasksService);

        $this->expectException(ApiException::class);
        $service->create(5, 1, ['text' => '   ']);
    }

    /** Al crear, el paso entra al final de la checklist (posición siguiente a la última existente). */
    public function testCreateAssignsNextPosition(): void
    {
        $tasksService = $this->taskServiceOwnedBy(5, $this->boardRepoOwnedBy(1));

        $itemsRepo = $this->createMock(ChecklistItemRepository::class);
        $itemsRepo->method('maxPositionForTask')->with(5)->willReturn(1);
        $itemsRepo->expects($this->once())->method('create')->with($this->callback(
            static fn (array $data) => $data['position'] === 2 && $data['text'] === 'Paso nuevo' && $data['completed'] === false
        ))->willReturn(99);
        $itemsRepo->method('find')->with(99)->willReturn([
            'id' => 99, 'task_id' => 5, 'text' => 'Paso nuevo', 'completed' => 0, 'position' => 2,
        ]);

        $service = new ChecklistService($itemsRepo, $tasksService);
        $item = $service->create(5, 1, ['text' => 'Paso nuevo']);

        $this->assertSame(2, $item['position']);
    }

    /** Editar con texto vacío debe rechazarse sin tocar la BD. */
    public function testUpdateRejectsEmptyText(): void
    {
        $tasksService = $this->taskServiceOwnedBy(5, $this->boardRepoOwnedBy(1));

        $itemsRepo = $this->createMock(ChecklistItemRepository::class);
        $itemsRepo->method('find')->with(10)->willReturn([
            'id' => 10, 'task_id' => 5, 'text' => 'Paso original', 'completed' => 0, 'position' => 0,
        ]);
        $itemsRepo->expects($this->never())->method('update');

        $service = new ChecklistService($itemsRepo, $tasksService);

        $this->expectException(ApiException::class);
        $service->update(10, 1, ['text' => '   ']);
    }

    /** Marcar/desmarcar sin mandar texto debe conservar el texto original del paso. */
    public function testUpdateTogglesCompletedKeepingOriginalText(): void
    {
        $tasksService = $this->taskServiceOwnedBy(5, $this->boardRepoOwnedBy(1));

        $itemsRepo = $this->createMock(ChecklistItemRepository::class);
        $itemsRepo->method('find')
            ->willReturnOnConsecutiveCalls(
                ['id' => 10, 'task_id' => 5, 'text' => 'Paso original', 'completed' => 0, 'position' => 0],
                ['id' => 10, 'task_id' => 5, 'text' => 'Paso original', 'completed' => 1, 'position' => 0],
            );
        $itemsRepo->expects($this->once())->method('update')->with(10, [
            'text' => 'Paso original',
            'completed' => true,
        ]);

        $service = new ChecklistService($itemsRepo, $tasksService);
        $item = $service->update(10, 1, ['completed' => true]);

        $this->assertTrue($item['completed']);
        $this->assertSame('Paso original', $item['text']);
    }

    /** Borrar un paso que no existe debe devolver 404 sin llamar a delete. */
    public function testDeleteRejectsMissingItem(): void
    {
        $itemsRepo = $this->createMock(ChecklistItemRepository::class);
        $itemsRepo->method('find')->with(10)->willReturn(null);
        $itemsRepo->expects($this->never())->method('delete');

        $tasksService = $this->taskServiceOwnedBy(5, $this->boardRepoOwnedBy(1));
        $service = new ChecklistService($itemsRepo, $tasksService);

        $this->expectException(ApiException::class);
        $service->delete(10, 1);
    }

    /** Borrar un paso existente, tras comprobar propiedad vía la tarea, sí lo elimina. */
    public function testDeleteRemovesOwnedItem(): void
    {
        $boardRepo = $this->boardRepoOwnedBy(1);
        $boardRepo->expects($this->once())->method('find');
        $tasksService = $this->taskServiceOwnedBy(5, $boardRepo);

        $itemsRepo = $this->createMock(ChecklistItemRepository::class);
        $itemsRepo->method('find')->with(10)->willReturn([
            'id' => 10, 'task_id' => 5, 'text' => 'Paso', 'completed' => 0, 'position' => 0,
        ]);
        $itemsRepo->expects($this->once())->method('delete')->with(10);

        $service = new ChecklistService($itemsRepo, $tasksService);
        $service->delete(10, 1);
    }

    /** Borrar un paso de una tarea que pertenece a otro usuario debe rechazarse sin llamar a delete. */
    public function testDeleteRejectsWhenTaskBelongsToAnotherUser(): void
    {
        $tasksService = $this->taskServiceOwnedBy(5, $this->boardRepoOwnedBy(99));

        $itemsRepo = $this->createMock(ChecklistItemRepository::class);
        $itemsRepo->method('find')->with(10)->willReturn([
            'id' => 10, 'task_id' => 5, 'text' => 'Paso', 'completed' => 0, 'position' => 0,
        ]);
        $itemsRepo->expects($this->never())->method('delete');

        $service = new ChecklistService($itemsRepo, $tasksService);

        $this->expectException(ApiException::class);
        $service->delete(10, 1);
    }
}
