<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Core\ApiException;
use App\Repositories\BoardRepository;
use App\Services\BoardService;
use PHPUnit\Framework\TestCase;

final class BoardServiceTest extends TestCase
{
    public function testCreateRejectsEmptyName(): void
    {
        $repo = $this->createMock(BoardRepository::class);
        $repo->expects($this->never())->method('create');

        $service = new BoardService($repo);

        $this->expectException(ApiException::class);
        $service->create(1, '   ');
    }

    public function testGetOwnedThrowsWhenNotOwner(): void
    {
        $repo = $this->createMock(BoardRepository::class);
        $repo->method('find')->willReturn(['id' => 5, 'user_id' => 99, 'name' => 'Otro']);

        $service = new BoardService($repo);

        $this->expectException(ApiException::class);
        $service->getOwned(5, 1);
    }

    public function testGetOwnedReturnsBoardWhenOwner(): void
    {
        $repo = $this->createMock(BoardRepository::class);
        $repo->method('find')->willReturn(['id' => 5, 'user_id' => 1, 'name' => 'Mío']);

        $service = new BoardService($repo);
        $board = $service->getOwned(5, 1);

        $this->assertSame('Mío', $board['name']);
    }
}
