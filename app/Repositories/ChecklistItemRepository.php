<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

class ChecklistItemRepository
{
    /** Lista los pasos de una tarea, ordenados por posición. */
    public function allForTask(int $taskId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM checklist_items WHERE task_id = :task_id ORDER BY position ASC'
        );
        $stmt->execute(['task_id' => $taskId]);
        return $stmt->fetchAll();
    }

    /** Lista los pasos de varias tareas a la vez (evita N+1 al listar el tablero completo). */
    public function allForTaskIds(array $taskIds): array
    {
        if ($taskIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($taskIds), '?'));
        $stmt = Database::connection()->prepare(
            "SELECT * FROM checklist_items WHERE task_id IN ($placeholders) ORDER BY position ASC"
        );
        $stmt->execute(array_values($taskIds));
        return $stmt->fetchAll();
    }

    /** Busca un paso por id; null si no existe. */
    public function find(int $id): ?array
    {
        $stmt = Database::connection()->prepare('SELECT * FROM checklist_items WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row === false ? null : $row;
    }

    /** Mayor posición usada actualmente en esa tarea (o -1 si no tiene pasos) — para saber dónde añadir el siguiente. */
    public function maxPositionForTask(int $taskId): int
    {
        $stmt = Database::connection()->prepare(
            'SELECT COALESCE(MAX(position), -1) AS max_pos FROM checklist_items WHERE task_id = :task_id'
        );
        $stmt->execute(['task_id' => $taskId]);
        return (int) $stmt->fetch()['max_pos'];
    }

    /** Inserta un paso nuevo y devuelve su id autogenerado. */
    public function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO checklist_items (task_id, text, completed, position)
             VALUES (:task_id, :text, :completed, :position)'
        );
        $stmt->execute([
            'task_id' => $data['task_id'],
            'text' => $data['text'],
            'completed' => $data['completed'] ? 1 : 0,
            'position' => $data['position'],
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    /** Actualiza el texto y/o el estado (completado) de un paso. */
    public function update(int $id, array $data): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE checklist_items SET text = :text, completed = :completed WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'text' => $data['text'],
            'completed' => $data['completed'] ? 1 : 0,
        ]);
    }

    /** Borra un paso. */
    public function delete(int $id): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM checklist_items WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }
}
