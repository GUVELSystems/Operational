/* es-8.js — diccionario ES: Users (invitaciones) y consola de empresas (GUVEL Systems) */
(function () { const I = window.G.i18n;
  I.add({
    'First name': 'Nombre', 'Last name': 'Apellido', 'Owner first name': 'Nombre del owner', 'Owner last name': 'Apellido del owner', 'Enter the first name and last name.': 'Escribe el nombre y el apellido.',
    'Users': 'Usuarios', 'Companies': 'Empresas', 'Invite and manage portal users': 'Invitar y administrar usuarios del portal',
    'Invite people to this company and control what each one can do.': 'Invita personas a esta empresa y controla qué puede hacer cada una.',
    'Create, suspend and manage the client companies of GUVEL Operational System.': 'Crea, suspende y administra las empresas cliente de GUVEL Operational System.',
    'Members': 'Miembros', 'People who can sign in to this company. Personnel (operators) is a separate catalog.': 'Personas que pueden entrar a esta empresa. Personal (operadores) es un catálogo aparte.',
    'Invite user': 'Invitar usuario', 'User': 'Usuario', 'Role': 'Rol', 'Since': 'Desde', 'Active': 'Activo', 'Disabled': 'Deshabilitado', 'Disable': 'Deshabilitar', 'Enable': 'Habilitar',
    'No users yet.': 'Aún no hay usuarios.', 'Pending invitations': 'Invitaciones pendientes', 'No pending invitations.': 'No hay invitaciones pendientes.', 'Expires': 'Caduca',
    'Resend (new link)': 'Reenviar (nuevo enlace)', 'Revoke': 'Revocar', 'You': 'Tú', 'Invitation revoked': 'Invitación revocada', 'User disabled': 'Usuario deshabilitado', 'User enabled': 'Usuario habilitado', 'Role updated': 'Rol actualizado',
    'They will lose access to this company immediately.': 'Perderá el acceso a esta empresa de inmediato.',
    'Create invitation': 'Crear invitación', 'Invitation ready': 'Invitación lista', 'Copy': 'Copiar', 'Link copied': 'Enlace copiado', 'Link selected — press Ctrl+C': 'Enlace seleccionado — presiona Ctrl+C', 'Done': 'Listo',
    'Full control of the company, including users': 'Control total de la empresa, incluidos los usuarios', 'Everything except changing owners': 'Todo excepto cambiar owners',
    'Operations, catalogs and notices': 'Operación, catálogos y avisos', 'Capture production and run sessions': 'Capturar producción y manejar sesiones', 'Read-only': 'Solo lectura',
    'Enter a valid email address.': 'Ingresa un correo válido.', 'Choose a role.': 'Elige un rol.', 'That person already belongs to this company.': 'Esa persona ya pertenece a esta empresa.',
    'This invitation link is not valid.': 'Este enlace de invitación no es válido.', 'This invitation belongs to another company.': 'Esta invitación pertenece a otra empresa.',
    'This invitation was already used.': 'Esta invitación ya fue usada.', 'This invitation was cancelled.': 'Esta invitación fue cancelada.', 'This invitation has expired.': 'Esta invitación caducó.',
    'Use at least 8 characters for the password.': 'Usa al menos 8 caracteres en la contraseña.',
    'Only GUVEL Systems administrators can manage companies.': 'Solo los administradores de GUVEL Systems pueden administrar empresas.',
    'Enter the company name.': 'Escribe el nombre de la empresa.', 'That address name is reserved.': 'Ese nombre de dirección está reservado.',
    'Use only lowercase letters, numbers and hyphens for the address.': 'Usa solo minúsculas, números y guiones en la dirección.', 'That address is already taken by another company.': 'Esa dirección ya la usa otra empresa.',
    'Enter the email of the first owner.': 'Escribe el correo del primer owner.', 'Company not found.': 'Empresa no encontrada.', 'Invalid status.': 'Estado inválido.',
    'New company': 'Nueva empresa', 'Company name': 'Nombre de la empresa', 'Address name': 'Nombre de la dirección', 'First owner (email)': 'Primer owner (correo)', 'Create company': 'Crear empresa', 'Company created': 'Empresa creada',
    'Suspended': 'Suspendida', 'Deactivated': 'Dada de baja', 'Address active': 'Dirección activa', 'Address pending': 'Dirección pendiente', 'Created': 'Creada', 'Open': 'Abrir', 'Manage': 'Administrar',
    'No companies yet. Create the first one.': 'Aún no hay empresas. Crea la primera.', 'How a company goes live': 'Cómo sale una empresa a producción',
    'Save name': 'Guardar nombre', 'Name updated': 'Nombre actualizado', 'Address marked active': 'Dirección marcada como activa', 'Suspend': 'Suspender', 'Reactivate': 'Reactivar', 'Deactivate': 'Dar de baja',
    'Company reactivated': 'Empresa reactivada', 'Company suspended': 'Empresa suspendida', 'Company deactivated': 'Empresa dada de baja', 'All its users lose access immediately.': 'Todos sus usuarios pierden el acceso de inmediato.',
    'Invite and manage portal users:': 'Invitar y administrar usuarios del portal:'
  });
  I.addPatterns([
    [/^Each link works once and expires in (\d+) days\.$/, (m, n) => 'Cada enlace funciona una vez y caduca en ' + n + ' días.'],
    [/^Disable (.+)\?$/, (m, n) => '¿Deshabilitar a ' + n + '?'], [/^Suspend (.+)\?$/, (m, n) => '¿Suspender ' + n + '?'], [/^Deactivate (.+)\?$/, (m, n) => '¿Dar de baja ' + n + '?'],
    [/^\+(\d+) pending$/, (m, n) => '+' + n + ' pendientes'], [/^(\d+) active · (\d+) pending$/, (m, a, p) => a + ' activos · ' + p + ' pendientes'],
    [/^(\d+) accepted · (\d+) revoked · (\d+) expired$/, (m, a, r, e) => a + ' aceptadas · ' + r + ' revocadas · ' + e + ' caducadas']
  ]);
})();
