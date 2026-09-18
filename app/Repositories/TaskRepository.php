<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;

class TaskRepository extends Repository
{
    protected function table(): string
    {
        return 'tasks';
    }

    /** Lista las tareas de un tablero, agrupadas por estado y ordenadas por posición dentro de cada columna. */
    public function allForBoard(int $boardId): array
    {
        $stmt = Database::connection()->prepare(
            'SELECT * FROM tasks WHERE board_id = :board_id ORDER BY status, position ASC'
        );
        $stmt->execute(['board_id' => $boardId]);
        return $stmt->fetchAll();
    }

    /** Busca una tarea por id; null si no existe. */
    public function find(int $id): ?array
    {
        return $this->findOneBy('id', $id);
    }

    /** Mayor posición usada actualmente en esa columna (o -1 si está vacía) — para saber dónde añadir la siguiente. */
    public function maxPositionForStatus(int $boardId, string $status): int
    {
        $stmt = Database::connection()->prepare(
            'SELECT COALESCE(MAX(position), -1) AS max_pos FROM tasks WHERE board_id = :board_id AND status = :status'
        );
        $stmt->execute(['board_id' => $boardId, 'status' => $status]);
        return (int) $stmt->fetch()['max_pos'];
    }

    /** Inserta una tarea nueva y devuelve su id autogenerado. */
    public function create(array $data): int
    {
        $stmt = Database::connection()->prepare(
            'INSERT INTO tasks (board_id, title, description, status, priority, color, due_date, position)
             VALUES (:board_id, :title, :description, :status, :priority, :color, :due_date, :position)'
        );
        $stmt->execute([
            'board_id' => $data['board_id'],
            'title' => $data['title'],
            'description' => $data['description'],
            'status' => $data['status'],
            'priority' => $data['priority'],
            'color' => $data['color'],
            'due_date' => $data['due_date'],
            'position' => $data['position'],
        ]);
        return (int) Database::connection()->lastInsertId();
    }

    /** Actualiza los campos editables de una tarea (no toca status ni position: eso lo hace updateStatusAndPosition). */
    public function update(int $id, array $data): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE tasks SET title = :title, description = :description, priority = :priority,
             color = :color, due_date = :due_date WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'title' => $data['title'],
            'description' => $data['description'],
            'priority' => $data['priority'],
            'color' => $data['color'],
            'due_date' => $data['due_date'],
        ]);
    }

    /** Cambia de columna (status) y posición dentro de ella — es lo que ejecuta el drag&drop al soltar una tarjeta. */
    public function updateStatusAndPosition(int $id, string $status, int $position): void
    {
        $stmt = Database::connection()->prepare(
            'UPDATE tasks SET status = :status, position = :position WHERE id = :id'
        );
        $stmt->execute(['id' => $id, 'status' => $status, 'position' => $position]);
    }

    /** Borra una tarea. */
    public function delete(int $id): void
    {
        $stmt = Database::connection()->prepare('DELETE FROM tasks WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }
}
