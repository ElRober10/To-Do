<?php

declare(strict_types=1);

namespace Tests\Unit\Core;

use App\Core\Request;
use App\Core\Router;
use PHPUnit\Framework\TestCase;

final class RouterTest extends TestCase
{
    public function testDispatchesMatchingRouteWithParams(): void
    {
        $router = new Router();
        $captured = null;

        $router->add('GET', '/api/boards/{id}', function (Request $request) use (&$captured): void {
            $captured = $request->params();
        });

        $reflection = new \ReflectionClass(Request::class);
        $request = $reflection->newInstanceWithoutConstructor();
        $this->setPrivate($request, 'method', 'GET');
        $this->setPrivate($request, 'path', '/api/boards/42');
        $this->setPrivate($request, 'query', []);
        $this->setPrivate($request, 'body', []);

        $router->dispatch($request);

        $this->assertSame(['id' => '42'], $captured);
    }

    private function setPrivate(object $object, string $property, mixed $value): void
    {
        $ref = new \ReflectionProperty($object, $property);
        $ref->setValue($object, $value);
    }
}
