/* es-7.js — diccionario ES: multi-empresa (login por empresa, prueba de aislamiento) */
(function () { const I = window.G.i18n;
  I.add({
    'Company isolation test': 'Prueba de aislamiento entre empresas', 'Run test': 'Ejecutar prueba',
    'Checks that this company cannot read, change, delete or reference data from any other company.': 'Verifica que esta empresa no pueda leer, modificar, borrar ni referenciar datos de otra empresa.',
    'Running checks…': 'Ejecutando verificaciones…',
    'Your role comes from your company membership. Prototype accounts:': 'Tu rol sale de tu membresía en la empresa. Cuentas del prototipo:',
    'select() returns only this company’s rows (all tables)': 'select() solo devuelve filas de esta empresa (todas las tablas)',
    'Only my own company record is visible': 'Solo es visible el registro de mi propia empresa',
    'get() on another company’s id returns nothing': 'get() con el id de otra empresa no devuelve nada',
    'count() ignores another company’s rows': 'count() ignora las filas de otra empresa',
    'Filters cannot reach another company’s rows': 'Los filtros no alcanzan filas de otra empresa',
    'update() on another company’s row is rejected': 'update() sobre una fila de otra empresa es rechazado',
    'delete() on another company’s row does nothing': 'delete() sobre una fila de otra empresa no hace nada',
    'insert() ignores a forged company_id': 'insert() ignora un company_id falsificado',
    'update() cannot move a row to another company': 'update() no puede mover una fila a otra empresa',
    'Cannot reference another company’s customer (FK)': 'No se puede referenciar un cliente de otra empresa (FK)',
    'Cannot link another company’s part and machine': 'No se puede enlazar la parte y la máquina de otra empresa',
    'A suspended company cannot read or write anything': 'Una empresa suspendida no puede leer ni escribir nada',
    'A member of another company cannot sign in here': 'Un miembro de otra empresa no puede iniciar sesión aquí',
    'Memberships: sign-in requires an active membership (non-demo companies)': 'Membresías: iniciar sesión exige una membresía activa (empresas no demo)'
  });
  I.addPatterns([[/^Active company: (.+)$/, (m, n) => 'Empresa activa: ' + n]]);
})();
