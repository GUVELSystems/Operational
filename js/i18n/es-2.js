/* es-2.js — diccionario ES: Customers, Machines, Personnel, Settings (Shifts), Catalogs, errores de db.js */
(function () { const I = window.G.i18n;
  /* ---------- Textos por sustantivo del generador CRUD (customer / machine / person / shift) ---------- */
  const NOUNS = [['customer', 'cliente', 'clientes', 'o'], ['machine', 'máquina', 'máquinas', 'a'], ['person', 'persona', 'personas', 'a'], ['shift', 'turno', 'turnos', 'o']];
  const nd = {}, np = [];
  NOUNS.forEach(([en, es, pl, g]) => {
    const En = en.charAt(0).toUpperCase() + en.slice(1), Es = es.charAt(0).toUpperCase() + es.slice(1);
    nd['Add ' + en] = 'Agregar ' + es; nd['Edit ' + en] = 'Editar ' + es;
    nd[En + ' updated'] = Es + ' actualizad' + g; nd[En + ' added'] = Es + ' agregad' + g; nd[En + ' deleted'] = Es + ' eliminad' + g;
    nd['Delete ' + en + '?'] = '¿Eliminar ' + es + '?'; nd['Delete ' + en] = 'Eliminar ' + es;
    nd['Search ' + en + 's…'] = 'Buscar ' + pl + '…'; nd['Search ' + en + 's'] = 'Buscar ' + pl;
    nd['You have view-only access to ' + en + 's.'] = 'Tienes acceso de solo lectura a ' + pl + '.';
    np.push([new RegExp('^No ' + en + 's match “(.*)”\\.$'), 'Ninguna coincidencia de ' + pl + ' con “$1”.']);
  });
  /* db.js: «This <x> is used by N other record(s) and cannot be deleted.» */
  const FR = { customer: 'este cliente', 'part number': 'este número de parte', machine: 'esta máquina', shift: 'este turno', person: 'esta persona', 'scrap defect': 'este defecto de scrap', 'downtime reason': 'este motivo de paro', operation: 'esta operación', record: 'este registro' };
  Object.keys(FR).forEach((k) => { np.push([new RegExp('^This ' + k + ' is used by (\\d+) other records? and cannot be deleted\\.$'), 'No se puede eliminar ' + FR[k] + ': lo usan $1 registro(s) más.']); });
  I.add(nd);
  I.addPatterns(np);

  I.add({
    /* ----- CRUD genérico ----- */
    'Cancel': 'Cancelar', 'Save changes': 'Guardar cambios', 'Actions': 'Acciones', 'Code': 'Código', 'Name': 'Nombre', 'Status': 'Estatus', 'Role': 'Rol',
    'All': 'Todos', 'Active': 'Activo', 'Inactive': 'Inactivo', 'Operator': 'Operador', 'Supervisor': 'Supervisor',
    'This cannot be undone.': 'Esto no se puede deshacer.', 'will be removed. This cannot be undone.': 'se eliminará. Esto no se puede deshacer.',
    /* ----- Clientes ----- */
    'Add customer': 'Agregar cliente', 'No customers yet — add the first company you build parts for.': 'Aún no hay clientes: agrega la primera empresa para la que fabricas piezas.',
    'Customer code': 'Código de cliente', 'Customer name': 'Nombre del cliente', 'e.g. ACM': 'p. ej. ACM', 'e.g. Acme Automotive': 'p. ej. Acme Automotive',
    'Short and unique. Saved in capitals.': 'Corto y único. Se guarda en mayúsculas.', 'Part numbers': 'Números de parte',
    'Enter the customer code.': 'Ingresa el código del cliente.', 'Enter the customer name.': 'Ingresa el nombre del cliente.',
    /* ----- Máquinas ----- */
    'Add machine': 'Agregar máquina', 'No machines yet — add the first one to start tracking production.': 'Aún no hay máquinas: agrega la primera para comenzar a dar seguimiento a la producción.',
    'Machine code': 'Código de máquina', 'Machine name': 'Nombre de la máquina', 'Brand': 'Marca', 'e.g. PRS-05': 'p. ej. PRS-05', 'e.g. Press 200T C': 'p. ej. Prensa 200T C', 'e.g. Schuler': 'p. ej. Schuler',
    'Family prefix + number (PRS, CNC, INJ…). Must be unique.': 'Prefijo de familia + número (PRS, CNC, INJ…). Debe ser único.',
    'Enter the machine code.': 'Ingresa el código de la máquina.', 'Enter the machine name.': 'Ingresa el nombre de la máquina.',
    'Use a family prefix, a dash and a number — for example PRS-05.': 'Usa un prefijo de familia, un guion y un número; por ejemplo PRS-05.',
    'RUNNING': 'EN PRODUCCIÓN', 'IDLE': 'INACTIVA', 'No brand set': 'Sin marca', 'No active session': 'Sin sesión activa',
    'Linked part numbers': 'Números de parte vinculados', 'No part numbers linked yet. Link them from the part number profile.': 'Aún no hay números de parte vinculados. Vincúlalos desde el perfil del número de parte.',
    'Edit machine': 'Editar máquina', 'Open in Production': 'Abrir en Producción',
    /* ----- Personal ----- */
    'Add person': 'Agregar persona', 'No people yet — add operators and supervisors to assign them to sessions.': 'Aún no hay personal: agrega operadores y supervisores para asignarlos a las sesiones.',
    'Active people appear in the Operator and Supervisor lists when you start production.': 'El personal activo aparece en las listas de Operador y Supervisor al iniciar producción.',
    'Employee ID': 'ID de empleado', 'e.g. E-1005': 'p. ej. E-1005', 'First name': 'Nombre(s)', 'Last name': 'Apellido(s)',
    'Enter the employee id.': 'Ingresa el ID de empleado.', 'Enter the role.': 'Ingresa el rol.', 'Enter the first name.': 'Ingresa el nombre.', 'Enter the last name.': 'Ingresa el apellido.', 'Enter the status.': 'Ingresa el estatus.',
    /* ----- Configuración / Turnos ----- */
    'Shifts': 'Turnos', 'Preferences': 'Preferencias', 'Add shift': 'Agregar turno',
    'No shifts yet — add one so Real Time hours and OEE know the plant schedule.': 'Aún no hay turnos: agrega uno para que las horas de Tiempo real y el OEE conozcan el horario de la planta.',
    'You have view-only access to Settings. Ask an admin to change shifts.': 'Tienes acceso de solo lectura a Configuración. Pide a un administrador que modifique los turnos.',
    'Shift schedules drive the': 'Los horarios de turno determinan las', 'Real Time hours': 'horas de Tiempo real', 'in Production and the': 'en Producción y el', 'planned time': 'tiempo planeado',
    'used for OEE. Night shifts can end after midnight (e.g. 22:00 → 06:00).': 'usado para el OEE. Los turnos nocturnos pueden terminar después de medianoche (p. ej. 22:00 → 06:00).',
    'Shift code': 'Código de turno', 'Shift name': 'Nombre del turno', 'e.g. T1': 'p. ej. T1', 'e.g. Shift 1 (Day)': 'p. ej. Turno 1 (Día)', 'Start time': 'Hora de inicio', 'End time': 'Hora de fin',
    'Excluded planned minutes (breaks)': 'Minutos planeados excluidos (descansos)', 'Breaks and meals removed from planned production time.': 'Descansos y comidas que se restan del tiempo de producción planeado.',
    'Enter the shift code.': 'Ingresa el código del turno.', 'Enter the shift name.': 'Ingresa el nombre del turno.', 'Enter the start time.': 'Ingresa la hora de inicio.', 'Enter the end time.': 'Ingresa la hora de fin.',
    'Enter the excluded planned minutes (breaks).': 'Ingresa los minutos planeados excluidos (descansos).',
    'Pick a start and end time to preview the shift length.': 'Elige una hora de inicio y de fin para ver la duración del turno.',
    'Shift length': 'Duración del turno', '(crosses midnight) · planned time': '(cruza la medianoche) · tiempo planeado', '· planned time': '· tiempo planeado',
    'Excluded minutes must be a whole number, 0 or more.': 'Los minutos excluidos deben ser un número entero, 0 o más.', 'Start and end time must be different.': 'La hora de inicio y la de fin deben ser distintas.',
    'Excluded minutes must be shorter than the shift.': 'Los minutos excluidos deben ser menores que la duración del turno.',
    'Window': 'Horario', 'Length': 'Duración', 'Excluded': 'Excluido', 'Planned': 'Planeado',
    /* ----- Catálogos ----- */
    'Operations are managed only from the Part Number profile (Part Numbers → Operations). Here you maintain the defects and downtime reasons used when capturing production.': 'Las operaciones se administran únicamente desde el perfil del número de parte (Números de parte → Operaciones). Aquí mantienes los defectos y los motivos de paro que se usan al capturar la producción.',
    'Your role can view the catalog but not change it.': 'Tu rol puede ver el catálogo, pero no modificarlo.',
    'Scrap Catalog': 'Catálogo de scrap', 'Downtime Catalog': 'Catálogo de paros',
    'Edit defect': 'Editar defecto', 'Add a defect': 'Agregar un defecto', 'General': 'General', 'Add defect': 'Agregar defecto',
    '— applies to every Part Number, including new ones added later (ignores Operation)': '— aplica a todos los números de parte, incluidos los que se agreguen después (ignora la operación)',
    'Part Number': 'Número de parte', 'Operation': 'Operación', 'Defect': 'Defecto', 'Category': 'Categoría', 'Downtime': 'Paros',
    'Select part number…': 'Selecciona el número de parte…', 'Select operation…': 'Selecciona la operación…', 'Select part number first…': 'Primero selecciona el número de parte…', 'Not used for General': 'No se usa en General', 'Select category…': 'Selecciona la categoría…',
    'Search code, defect, category or part…': 'Buscar código, defecto, categoría o parte…', 'Search defects': 'Buscar defectos', 'Filter by part number': 'Filtrar por número de parte',
    'All part numbers': 'Todos los números de parte', 'General only': 'Solo General', 'General — all Part Numbers': 'General — todos los números de parte',
    'No defects match your search.': 'Ningún defecto coincide con tu búsqueda.', 'Select a part number, or tick General.': 'Selecciona un número de parte o marca General.',
    'Select an operation.': 'Selecciona una operación.', 'Enter the defect code.': 'Ingresa el código del defecto.', 'Enter the defect name.': 'Ingresa el nombre del defecto.', 'Enter a category.': 'Ingresa una categoría.',
    'That code already exists as a General defect.': 'Ese código ya existe como defecto General.', 'That defect code already exists for this operation.': 'Ese código de defecto ya existe para esta operación.',
    'Defect updated': 'Defecto actualizado', 'General defect added — available for every part number': 'Defecto General agregado: disponible para todos los números de parte', 'Defect added': 'Defecto agregado', 'Defect deleted': 'Defecto eliminado',
    'Edit downtime reason': 'Editar motivo de paro', 'Add a downtime reason': 'Agregar un motivo de paro', 'Add reason': 'Agregar motivo',
    'Search code, reason or category…': 'Buscar código, motivo o categoría…', 'Search downtime reasons': 'Buscar motivos de paro', 'No downtime reasons match your search.': 'Ningún motivo de paro coincide con tu búsqueda.',
    'Enter the downtime code.': 'Ingresa el código del paro.', 'Enter the downtime reason.': 'Ingresa el motivo del paro.', 'Select a category.': 'Selecciona una categoría.',
    'Downtime reason updated': 'Motivo de paro actualizado', 'Downtime reason added': 'Motivo de paro agregado', 'Downtime reason deleted': 'Motivo de paro eliminado',
    'Delete this defect?': '¿Eliminar este defecto?', 'Delete this downtime reason?': '¿Eliminar este motivo de paro?', 'Delete': 'Eliminar',
    'The defect will be removed from the catalog. If it is already used in captures, it cannot be deleted.': 'El defecto se eliminará del catálogo. Si ya se usa en capturas, no se puede eliminar.',
    'The downtime reason will be removed from the catalog. If it is already used in captures, it cannot be deleted.': 'El motivo de paro se eliminará del catálogo. Si ya se usa en capturas, no se puede eliminar.',
    /* categorías */
    'Machine': 'Máquina', 'Tooling': 'Herramental', 'Quality': 'Calidad', 'Setup': 'Preparación', 'Personnel': 'Personal', 'Logistics': 'Logística', 'Material': 'Material',
    'Process': 'Proceso', 'Handling': 'Manejo', 'Dimensional': 'Dimensional', 'Cosmetic': 'Cosmético',
    /* ----- Errores de db.js ----- */
    'That record no longer exists.': 'Ese registro ya no existe.', 'That machine code already exists.': 'Ese código de máquina ya existe.', 'That customer code already exists.': 'Ese código de cliente ya existe.',
    'That employee ID already exists.': 'Ese ID de empleado ya existe.', 'That shift code already exists.': 'Ese código de turno ya existe.', 'That downtime code already exists.': 'Ese código de paro ya existe.',
    'That part number already exists.': 'Ese número de parte ya existe.', 'That defect code already exists as a General defect.': 'Ese código de defecto ya existe como defecto General.',
    'That operation number already exists for this part number.': 'Ese número de operación ya existe para este número de parte.',
    'Scrap cannot exceed the pieces produced.': 'El scrap no puede superar las piezas producidas.', 'This machine already has an active production session.': 'Esta máquina ya tiene una sesión de producción activa.',
    'This session is no longer active.': 'Esta sesión ya no está activa.', 'Pieces produced must be a whole number, 0 or more.': 'Las piezas producidas deben ser un número entero, 0 o más.',
    'There are no hours to consolidate.': 'No hay horas por consolidar.'
  });

  I.addPatterns([
    [/^Edit operation (\d+)$/, 'Editar operación $1'],
    [/^Brand: (.+)$/, 'Marca: $1'],
    [/^(.+) · Lot (.+?) · (\S+)$/, '$1 · Lote $2 · $3'],
    [/^e\.g\. (.+)$/, 'p. ej. $1'],
    [/^Edit (.+)$/, 'Editar $1'],
    [/^Delete (.+)\?$/, '¿Eliminar $1?'],
    [/^Delete (.+)$/, 'Eliminar $1']
  ]);
})();
