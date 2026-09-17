<?php

declare(strict_types=1);

namespace Tests\Integration\Repositories;

use App\Core\Database;
use App\Repositories\BoardRepository;
use App\Repositories\TaskRepository;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;

final class TaskRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        if (getenv('DB_NAME') !== 'todo_test') {
            $this->markTestSkipped('Configura DB_NAME=todo_test para correr tests de integración');
        }
        Database::connection()->exec('DELETE FROM tasks');
        Database::connection()->exec('DELETE FROM boards');
        Database::connection()->exec('DELETE FROM users');
    }

    /** Columna vacía: la posición máxima es -1 (para que la primera tarea entre en posición 0). */
    public function testMaxPositionForStatusIsMinusOneWhenEmpty(): void
    {
        [$boardId] = $this->makeUserAndBoard();
        $repo = new TaskRepository();

        $this->assertSame(-1, $repo->maxPositionForStatus($boardId, 'backlog'));
    }

    /** Crear una tarea y luego moverla de columna/posición persiste ambos cambios en la BD real. */
    public function testCreateAndUpdateStatusAndPosition(): void
    {
        [$boardId] = $this->makeUserAndBoard();
        $repo = new TaskRepository();

        $id = $repo->create([
            'board_id' => $boardId, 'title' => 'T1', 'description' => null,
            'status' => 'backlog', 'priority' => 'medium', 'color' => null,
            'due_date' => null, 'position' => 0,
        ]);

        $repo->updateStatusAndPosition($id, 'planning', 1);
        $row = $repo->find($id);

        $this->assertSame('planning', $row['status']);
        $this->assertSame(1, (int) $row['position']);
    }

    /** Crea un usuario y un tablero de prueba; devuelve [boardId, userId] para usar en los tests. */
    private function makeUserAndBoard(): array
    {
        $userRepo = new UserRepository();
        $userId = $userRepo->create('Rober', 'rober@test.com', password_hash('secret123', PASSWORD_DEFAULT));

        $boardRepo = new BoardRepository();
        $boardId = $boardRepo->create($userId, 'Tablero de prueba');

        return [$boardId, $userId];
    }
}
