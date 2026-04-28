# Arquitectura inicial

La aplicación queda pensada para correr en `Next.js` sobre Vercel y usar Supabase para autenticación, base de datos y seguridad por rol.

## Roles

- `staff`
  Puede cargar IDs desde CSV/Excel, crear agencias, crear y editar usuarios MCH, y exportar listados.

- `mch`
  Inicia sesión, consulta su información y registra visitas por tienda con hora de entrada y salida.

## Tablas base

- `agencies`
  Catálogo administrado desde la web.

- `stores`
  Catálogo de tiendas para que MCH seleccione dónde hizo la visita.

- `staffing_id_pool`
  Pool de IDs importados desde archivo. Cada `staffing_code` es único y puede quedar asignado una sola vez.

- `profiles`
  Perfil de aplicación enlazado a `auth.users`. Guarda rol, nombres, teléfono, email, tarifa, agencia, tienda por defecto, `login_name` y `staffing_code`.

- `visits`
  Registro horario de cada MCH.

## Inicio de sesión

Supabase Auth sigue almacenando el usuario real por email, pero la app guarda `login_name` como:

`last_name + first_name`

Eso nos deja dos caminos:

1. Loguear por email directamente.
2. Hacer un login por `login_name` que primero busque el email asociado y luego llame a Supabase Auth.

## Contraseña inicial

Patrón actual:

`apellido + nombre + "-" + últimos 3 dígitos del ID + "**"`

Ejemplo:

`torresana-512**`

## Exportación

La vista `staff_export_users` ya deja la forma base para sacar un Excel con:

- ID
- First Name
- Last Name
- Phone Number
- Email
- Store
- Rate
- Agency
- Login name

## Siguiente fase recomendada

1. Conectar las pantallas con consultas reales a Supabase.
2. Crear el flujo de login por `login_name`.
3. Agregar exportación real a Excel desde `staff_export_users`.
4. Definir si una visita será editable siempre o solo el mismo día.
