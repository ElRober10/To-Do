<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use App\Core\ApiException;
use App\Repositories\UserRepository;
use App\Services\AuthService;
use PHPUnit\Framework\TestCase;

final class AuthServiceTest extends TestCase
{
    protected function setUp(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            @session_start();
        }
        $_SESSION = [];
    }

    public function testRegisterRejectsShortPassword(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->expects($this->never())->method('create');

        $service = new AuthService($repo);

        $this->expectException(ApiException::class);
        $service->register('Rober', 'rober@example.com', '123');
    }

    public function testRegisterRejectsDuplicateEmail(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn(['id' => 1, 'email' => 'rober@example.com']);
        $repo->expects($this->never())->method('create');

        $service = new AuthService($repo);

        $this->expectException(ApiException::class);
        $service->register('Rober', 'rober@example.com', 'secret123');
    }

    public function testLoginRejectsInvalidCredentials(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn(null);

        $service = new AuthService($repo);

        $this->expectException(ApiException::class);
        $service->login('nobody@example.com', 'whatever');
    }

    public function testLoginReturnsUserOnValidCredentials(): void
    {
        $hash = password_hash('secret123', PASSWORD_DEFAULT);
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn([
            'id' => 7,
            'name' => 'Rober',
            'email' => 'rober@example.com',
            'password_hash' => $hash,
        ]);

        $service = new AuthService($repo);
        $result = $service->login('rober@example.com', 'secret123');

        $this->assertSame(7, $result['id']);
        $this->assertSame('rober@example.com', $result['email']);
    }
}
