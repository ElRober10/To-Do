<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Core\ApiException;
use App\Repositories\BoardRepository;
use App\Services\BoardService;
use PHPUnit\Framework\TestCase;

final class BoardServiceTest extends TestCase
{
    /** Nombre de tablero vacío (o solo espacios) debe rechazarse sin llegar a crearlo. */
    public function testCreateRejectsEmptyName(): void
    {
        $repo = $this->createMock(BoardRepository::class);
        $repo->expects($this->never())->method('create');

        $service = new BoardService($repo);

        $this->expectException(ApiException::class);
        $service->create(1, '   ');
    }

    /** Tablero que existe pero pertenece a otro usuario debe dar el mismo error que si no existiera. */
    public function testGetOwnedThrowsWhenNotOwner(): void
    {
        $repo = $this->createMock(BoardRepository::class);
        $repo->method('find')->willReturn(['id' => 5, 'user_id' => 99, 'name' => 'Otro']);

        $service = new BoardService($repo);

        $this->expectException(ApiException::class);
        $service->getOwned(5, 1);
    }

    /** Tablero que sí pertenece al usuario se devuelve normalmente. */
    public function testGetOwnedReturnsBoardWhenOwner(): void
    {
        $repo = $this->createMock(BoardRepository::class);
        $repo->method('find')->willReturn(['id' => 5, 'user_id' => 1, 'name' => 'Mío']);

        $service = new BoardService($repo);
        $board = $service->getOwned(5, 1);

        $this->assertSame('Mío', $board['name']);
    }
}
