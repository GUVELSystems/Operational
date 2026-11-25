/* es-2b.js — diccionario ES: Part Numbers (lista y perfil), Registers, Runs */
(function () { const I = window.G.i18n;
  I.add({
    /* ----- Números de parte: lista y formulario ----- */
    'Search part numbers…': 'Buscar números de parte…', 'Search part numbers': 'Buscar números de parte', 'New part number': 'Nuevo número de parte', 'Edit part number': 'Editar número de parte',
    'You have view-only access to part numbers.': 'Tienes acceso de solo lectura a los números de parte.',
    'Part number': 'Número de parte', 'Description': 'Descripción', 'Customer': 'Cliente', 'Piece cost': 'Costo por pieza', 'Scrap cost': 'Costo de scrap', 'Ops': 'Ops.', 'Machines': 'Máquinas', 'Actions': 'Acciones',
    'Open profile': 'Abrir perfil', 'Edit': 'Editar', 'Delete': 'Eliminar',
    'No part numbers match your search.': 'Ningún número de parte coincide con tu búsqueda.', 'No part numbers yet — add the first one.': 'Aún no hay números de parte: agrega el primero.',
    'Its operations, cycle times, machine links and part-specific defects will be deleted too. This cannot be undone.': 'Sus operaciones, tiempos de ciclo, vínculos con máquinas y defectos propios de la parte también se eliminarán. Esto no se puede deshacer.',
    'Delete part number': 'Eliminar número de parte', 'Part number deleted': 'Número de parte eliminado', 'Part number updated': 'Número de parte actualizado', 'Part number added': 'Número de parte agregado',
    'Select customer…': 'Selecciona el cliente…', 'Piece cost ($)': 'Costo por pieza ($)', 'Scrap cost ($)': 'Costo de scrap ($)', 'Cancel': 'Cancelar', 'Save changes': 'Guardar cambios', 'Add part number': 'Agregar número de parte',
    'Select a customer.': 'Selecciona un cliente.', 'Enter the part number.': 'Ingresa el número de parte.', 'Costs must be numbers of 0 or more.': 'Los costos deben ser números de 0 o más.',
    /* ----- Perfil: pestañas ----- */
    'Operations': 'Operaciones', 'Defects': 'Defectos', 'Barcode': 'Código de barras',
    /* ----- Operaciones ----- */
    'Add operation': 'Agregar operación', 'Op #': 'N.º op.', 'Operation': 'Operación', 'Ideal cycle (s)': 'Ciclo ideal (s)', 'Cycle time per machine': 'Tiempo de ciclo por máquina', 'Uses ideal': 'Usa el ideal',
    'Edit operation': 'Editar operación', 'Delete operation': 'Eliminar operación', 'No operations yet.': 'Aún no hay operaciones.',
    'Link machines in the Machines tab to set per-machine cycle times.': 'Vincula máquinas en la pestaña Máquinas para definir tiempos de ciclo por máquina.',
    'Its cycle times and defects will be deleted too.': 'Sus tiempos de ciclo y defectos también se eliminarán.', 'Operation deleted': 'Operación eliminada', 'Operation updated': 'Operación actualizada', 'Operation added': 'Operación agregada',
    'Operation number': 'Número de operación', 'Ideal cycle time (s)': 'Tiempo de ciclo ideal (s)', 'Operation name': 'Nombre de la operación', 'Cycle time per machine (s)': 'Tiempo de ciclo por máquina (s)',
    'Leave empty to use the ideal cycle time.': 'Déjalo vacío para usar el tiempo de ciclo ideal.',
    'Enter the operation number as a whole number.': 'Ingresa el número de operación como un número entero.', 'Enter the operation name.': 'Ingresa el nombre de la operación.',
    'Enter an ideal cycle time greater than 0.': 'Ingresa un tiempo de ciclo ideal mayor que 0.', 'Cycle times must be numbers greater than 0.': 'Los tiempos de ciclo deben ser números mayores que 0.',
    /* ----- Máquinas (vincular) ----- */
    'Machine linked': 'Máquina vinculada', 'Machine unlinked': 'Máquina desvinculada',
    /* ----- Defectos ----- */
    'Loading defects…': 'Cargando defectos…', 'Add defect': 'Agregar defecto', 'Add an operation first': 'Primero agrega una operación', 'Select operation…': 'Selecciona la operación…', 'Select category…': 'Selecciona la categoría…',
    'e.g. BRK-05': 'p. ej. BRK-05', 'Code': 'Código', 'Defect': 'Defecto', 'Category': 'Categoría', 'All': 'Todas', 'Read only': 'Solo lectura', 'General — all Part Numbers': 'General — todos los números de parte',
    'No defects yet for this part number.': 'Aún no hay defectos para este número de parte.', 'Select the operation.': 'Selecciona la operación.', 'Enter the defect code.': 'Ingresa el código del defecto.', 'Enter the defect name.': 'Ingresa el nombre del defecto.', 'Select a category.': 'Selecciona una categoría.',
    'Delete this defect?': '¿Eliminar este defecto?', 'It will no longer be offered when capturing scrap.': 'Ya no se ofrecerá al capturar scrap.', 'Delete defect': 'Eliminar defecto', 'Defect added': 'Defecto agregado', 'Defect deleted': 'Defecto eliminado',
    /* ----- Código de barras ----- */
    'Print barcode': 'Imprimir código de barras',
    'This part number has characters Code 39 cannot encode (it supports A–Z, 0–9 and - . space $ / + %). Edit the part number to generate a barcode.': 'Este número de parte tiene caracteres que Code 39 no puede codificar (admite A–Z, 0–9 y - . espacio $ / + %). Edita el número de parte para generar un código de barras.',
    'Allow pop-ups to print the barcode.': 'Permite las ventanas emergentes para imprimir el código de barras.',
    /* ----- Registros ----- */
    'Production': 'Producción', 'Scrap': 'Scrap', 'Downtime': 'Paros', 'Refresh': 'Actualizar', 'Export Data': 'Exportar datos',
    'Date From': 'Fecha desde', 'Date To': 'Fecha hasta', 'Shift': 'Turno', 'Part Number': 'Número de parte', 'Search': 'Buscar', 'Lot, part, machine, defect…': 'Lote, parte, máquina, defecto…',
    'All customers': 'Todos los clientes', 'All shifts': 'Todos los turnos', 'Clear filters': 'Borrar filtros',
    'Date / Time': 'Fecha / Hora', 'Date': 'Fecha', 'Lot': 'Lote', 'Machine': 'Máquina', 'Operator': 'Operador', 'Supervisor': 'Supervisor', 'Quantity': 'Cantidad', 'Confirmed': 'Confirmada', 'Yes': 'Sí',
    'Cost': 'Costo', 'Reason': 'Motivo', 'Type': 'Tipo', 'Minutes': 'Minutos', 'Note': 'Nota', 'Planned': 'Planeado', 'Unplanned': 'No planeado',
    'Captures': 'Capturas', 'Pieces produced': 'Piezas producidas', 'Scrap records': 'Registros de scrap', 'Scrap quantity': 'Cantidad de scrap', 'Downtime records': 'Registros de paros', 'Total minutes': 'Minutos totales', 'Unplanned minutes': 'Minutos no planeados',
    'Delete capture': 'Eliminar captura', 'Delete record': 'Eliminar registro', 'Delete Capture': 'Eliminar captura', 'No records match these filters.': 'Ningún registro coincide con estos filtros.', 'No records yet.': 'Aún no hay registros.',
    'Show more': 'Mostrar más', 'Loading registers…': 'Cargando registros…', 'Registers refreshed': 'Registros actualizados', 'There is nothing to export with these filters.': 'No hay nada que exportar con estos filtros.',
    'Delete capture?': '¿Eliminar captura?', 'Delete record?': '¿Eliminar registro?', 'Record deleted': 'Registro eliminado',
    'on': 'en', 'and': 'y', 'Its': 'Sus', 'records will be deleted with it. This cannot be undone.': 'registros asociados también se eliminarán. Esto no se puede deshacer.',
    '? This cannot be undone.': '? Esto no se puede deshacer.',
    /* ----- Corridas ----- */
    'TRACEABILITY': 'TRAZABILIDAD', 'Runs': 'Corridas', 'Search lot, PN, machine, operator…': 'Buscar lote, NP, máquina, operador…', 'Search runs': 'Buscar corridas', 'Loading runs…': 'Cargando corridas…',
    'No runs match your search.': 'Ninguna corrida coincide con tu búsqueda.', 'Select a run to see its profile.': 'Selecciona una corrida para ver su perfil.', 'Allow pop-ups to print the run.': 'Permite las ventanas emergentes para imprimir la corrida.',
    'PRODUCTION RUN': 'CORRIDA DE PRODUCCIÓN', 'LOT': 'LOTE', 'RUNNING': 'EN PRODUCCIÓN', 'COMPLETED': 'COMPLETADA', 'session': 'sesión', 'manual': 'manual', 'real time': 'tiempo real',
    'Yield': 'Rendimiento', 'CUSTOMER': 'CLIENTE', 'PART NUMBER': 'NÚMERO DE PARTE', 'OPERATION': 'OPERACIÓN', 'MACHINE': 'MÁQUINA', 'CT IDEAL': 'TC IDEAL', 'SHIFT': 'TURNO', 'OPERATOR': 'OPERADOR', 'SUPERVISOR': 'SUPERVISOR',
    'RECORDED': 'REGISTRADA', 'In progress': 'En curso', 'QUALITY': 'CALIDAD', 'Quality Events': 'Eventos de calidad', 'MAINTENANCE': 'MANTENIMIENTO', 'No quality events.': 'Sin eventos de calidad.', 'No downtime events.': 'Sin eventos de paros.'
  });

  I.addPatterns([
    [/^Edit operation (\d+)$/, 'Editar operación $1'],
    [/^Delete operation (\d+)\?$/, '¿Eliminar operación $1?'],
    [/^Delete (.+)\?$/, '¿Eliminar $1?'],
    [/^Piece (.+)$/, 'Pieza $1'],
    [/^Scrap (\$.+|USD .+)$/, 'Scrap $1'],
    [/^Code 39 barcode (.+)$/, 'Código de barras Code 39 $1'],
    [/^Choose the machines that can run (.+)\. \(view only\)$/, 'Elige las máquinas que pueden producir $1. (solo lectura)'],
    [/^Choose the machines that can run (.+)\.$/, 'Elige las máquinas que pueden producir $1.'],
    [/^Link (.+)$/, 'Vincular $1'],
    [/^Showing ([\d.,]+) of ([\d.,]+)$/, 'Mostrando $1 de $2'],
    [/^([\d.,]+) rows exported$/, '$1 filas exportadas'],
    [/^\((.+), (\S+) pieces\)\?$/, '($1, $2 piezas)?'],
    [/^Delete the capture of$/, '¿Eliminar la captura de'],
    [/^(\d+) scrap$/, '$1 registros de scrap'],
    [/^(\d+) downtime$/, '$1 registros de paros'],
    [/^Delete this scrap record \((.+) · (\S+) pcs\) for$/, '¿Eliminar este registro de scrap ($1 · $2 pzas) de'],
    [/^Delete this downtime record \((.+) · (\S+) min\) for$/, '¿Eliminar este registro de paros ($1 · $2 min) de'],
    [/^([\d.,]+) pcs$/, '$1 pzas'],
    [/^Show more \((\d+)\)$/, 'Mostrar más ($1)'],
    [/^Planned · (.+)$/, 'Planeado · $1'],
    [/^Unplanned · (.+)$/, 'No planeado · $1'],
    [/^Planned$/, 'Planeado'],
    [/^Unplanned$/, 'No planeado']
  ]);
})();
