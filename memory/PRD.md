# Class Up · El Castillo — PRD

## Resumen
Aplicación móvil educativa (Expo · React Native) para estudiantes de grado 9° de la Institución Educativa Colegio El Castillo. Ayuda a organizar tareas, calificaciones, sesiones de estudio y recursos educativos.

## Autenticación
- **Emergent Managed Google Auth** — cualquier cuenta de Google (sin restricción de dominio).
- Sesión persistente (7 días) vía `expo-secure-store` (móvil) / `localStorage` (web).
- Endpoints: `POST /api/auth/session`, `GET /api/auth/me`, `POST /api/auth/logout`.

## Flujo obligatorio (formularios iniciales)
1. Login con Google.
2. `AuthGate` verifica `profile_setup_completed` y `initial_assessment_completed`.
3. Si falta cualquiera → redirige a `/onboarding` (sin opción de saltar).
4. **Paso 1 – Datos personales**: nombre, sección (A/B/C/D), jornada, fecha de nacimiento, nombre y teléfono del acudiente. Todos obligatorios, validación en servidor.
5. **Paso 2 – Evaluaciones iniciales**: 5 Google Forms (Lectura Crítica, Matemáticas, Sociales, Ciencias, Inglés). El botón "Continuar" se habilita solo al abrir las 5.
6. Solo entonces se marca `initial_assessment_completed=true` y se accede a las tabs.

## Navegación principal
- Bottom tabs: **Inicio · Tareas · Calendario · Perfil**.
- Rutas adicionales accesibles desde Inicio/Perfil: **Calificaciones · Temporizador · Recursos**.

## Módulos
| Módulo | Backend | Frontend |
|---|---|---|
| Auth | `/api/auth/*` | `src/auth/AuthContext.tsx` |
| Perfil (setup) | `/api/profile/setup` | `app/onboarding.tsx` (paso 1) |
| Evaluaciones | `/api/assessments*` | `app/onboarding.tsx` (paso 2) |
| Tareas | `/api/tasks` CRUD | `app/(tabs)/tasks.tsx` |
| Calificaciones | `/api/grades`, `/api/grades/summary` | `app/grades.tsx` |
| Sesiones estudio | `/api/sessions`, `/api/sessions/summary` | `app/timer.tsx` |
| Recursos | `/api/resources` (22 videos YouTube) | `app/resources.tsx` |
| Calendario | derivado de tasks + sessions | `app/(tabs)/calendar.tsx` |
| Progreso | `/api/progress` | Dashboard `app/(tabs)/index.tsx` |

## Base de datos (MongoDB)
Colecciones: `users`, `user_sessions` (TTL), `tasks`, `grades`, `study_sessions`, `resources`. Cada documento con id UUID; `_id` de Mongo se excluye siempre en las respuestas.

## Diseño
- Paleta: verde esmeralda (#10B981) + ámbar (#F59E0B), fondo blanco/gris muy claro.
- Login: fondo blanco con escudo del Colegio El Castillo.
- Tipografía nativa, esquinas redondeadas grandes, sin emojis (íconos internos).

## Preparado para el futuro
- Modelo `Resource` con `topic/subtopic/difficulty` listo para recomendaciones personalizadas.
- Estructura de evaluaciones iniciales lista para conectar con Google Sheets + análisis por pregunta.
- Niveles de rendimiento (Dominio/Reforzamiento/Dificultad/Prioridad) reservados en la spec — no se muestran hasta tener resultados reales.

## Estado de testing
- Backend: 40/40 pytest en verde (auth, onboarding obligatorio, tasks, grades, sessions, resources, progress, aislamiento entre usuarios, logout).
