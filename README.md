## 🤖 Cómo se ha desarrollado este proyecto

Este proyecto está desarrollado con **asistencia de IA (Claude Code)**, usada como herramienta bajo mi dirección. Yo decido qué se construye, cómo y con qué criterios; la IA ejecuta y automatiza la parte mecánica. Nada entra en el repositorio sin que yo lo haya revisado, entendido y validado.

### Reparto de responsabilidades

| Lo hago yo | Lo automatizo con la IA |
|---|---|
| Definir alcance y requisitos (taskboard Kanban, checklists por tarea, autenticación) | Generar código repetitivo y boilerplate (esqueleto del frontend, `api.js`, estilos base) |
| Decidir la arquitectura (`routes.php` separado, capa PDO, estructura backend/frontend) | Implementar las decisiones ya tomadas siguiendo mis instrucciones |
| Elegir stack e infraestructura (PHP, JavaScript, MySQL, nginx + php-fpm en Docker) | Escribir configuración inicial (`docker-compose.yml`, `phpunit.xml`, `vitest.config.js`) |
| Dar instrucciones concretas y acotadas, y specs previas (`docs/superpowers`) | Redactar borradores de specs, planes y documentación |
| **Revisar, retocar y adaptar cada archivo** a las necesidades del proyecto | Proponer refactors (SOLID, eliminar duplicidades) |
| **Probar cada archivo** y verificar que hace lo que debe antes de pasar al siguiente | Escribir tests (PHPUnit y Vitest) que yo reviso y ejecuto |
| Depurar y decidir cuando algo falla (p. ej. pointer events en lugar de drag&drop nativo) | Proponer hipótesis y aplicar correcciones que yo valido |
| **Ordenar el commit** cuando todo está revisado y verificado | Ejecutar el commit y el push bajo mi orden |

### Flujo de trabajo

1. **Especifico** la funcionalidad y sus restricciones.
2. **Encargo** a la IA una tarea concreta y acotada, archivo a archivo.
3. **Reviso** el archivo generado: lógica, seguridad, estructura y estilo.
4. **Retoco y adapto** lo que haga falta hasta que encaje con lo que necesito.
5. **Pruebo** el resultado (tests y prueba manual) y compruebo que entiendo qué hace y por qué.
6. **No paso al siguiente archivo** hasta cerrar el anterior.
7. **Cuando todo está revisado y verificado, ordeno a Claude que haga el commit.**

### Por qué lo explico

Usar IA es una herramienta legítima y prefiero ser transparente: por eso Claude figura como colaborador en el historial. Lo que aporto yo es lo que la IA no sustituye: criterio, arquitectura, revisión y responsabilidad sobre el resultado. Puedo explicar y defender cada decisión técnica de este repositorio.
