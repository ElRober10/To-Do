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

    /** Contraseña de menos de 6 caracteres debe rechazarse sin llegar a crear el usuario. */
    public function testRegisterRejectsShortPassword(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->expects($this->never())->method('create');

        $service = new AuthService($repo);

        $this->expectException(ApiException::class);
        $service->register('Rober', 'rober@example.com', '123');
    }

    /** Email ya registrado debe rechazarse sin llegar a crear el usuario. */
    public function testRegisterRejectsDuplicateEmail(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn(['id' => 1, 'email' => 'rober@example.com']);
        $repo->expects($this->never())->method('create');

        $service = new AuthService($repo);

        $this->expectException(ApiException::class);
        $service->register('Rober', 'rober@example.com', 'secret123');
    }

    /** Email que no existe debe rechazar el login con el mismo error genérico que una contraseña incorrecta. */
    public function testLoginRejectsInvalidCredentials(): void
    {
        $repo = $this->createMock(UserRepository::class);
        $repo->method('findByEmail')->willReturn(null);

        $service = new AuthService($repo);

        $this->expectException(ApiException::class);
        $service->login('nobody@example.com', 'whatever');
    }

    /** Con email y contraseña correctos, el login devuelve los datos del usuario. */
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
