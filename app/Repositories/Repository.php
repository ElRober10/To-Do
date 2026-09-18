<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

/** Base común a los repositorios: centraliza el patrón "buscar una fila por una columna" (find por id, por email...) que todos repetían igual. */
abstract class Repository
{
    /** Nombre de la tabla que gestiona este repositorio. */
    abstract protected function table(): string;

    /**
     * Busca una única fila cuya $column valga $value; null si no hay ninguna.
     * $column siempre es un literal fijo escrito en el propio repositorio (nunca input del usuario),
     * así que interpolarlo en la consulta es seguro; el valor sí va parametrizado.
     */
    protected function findOneBy(string $column, int|string $value): ?array
    {
        $stmt = Database::connection()->prepare(
            sprintf('SELECT * FROM %s WHERE %s = :value LIMIT 1', $this->table(), $column)
        );
        $stmt->execute(['value' => $value]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }
}
