<?php

declare(strict_types=1);

namespace Tests\Integration\Repositories;

use App\Core\Database;
use App\Repositories\UserRepository;
use PHPUnit\Framework\TestCase;

/**
 * Requiere DB_NAME=todo_test apuntando a una base con database/schema_test.sql importado.
 */
final class UserRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        if (getenv('DB_NAME') !== 'todo_test') {
            $this->markTestSkipped('Configura DB_NAME=todo_test para correr tests de integración');
        }
        Database::connection()->exec('DELETE FROM users');
    }

    /** Un usuario creado se puede volver a encontrar por su email. */
    public function testCreateAndFindByEmail(): void
    {
        $repo = new UserRepository();
        $id = $repo->create('Rober', 'rober@test.com', password_hash('secret123', PASSWORD_DEFAULT));

        $found = $repo->findByEmail('rober@test.com');

        $this->assertNotNull($found);
        $this->assertSame($id, (int) $found['id']);
    }

    /** Buscar un email que no existe devuelve null, no lanza error. */
    public function testFindByEmailReturnsNullWhenMissing(): void
    {
        $repo = new UserRepository();
        $this->assertNull($repo->findByEmail('nadie@test.com'));
    }
}
