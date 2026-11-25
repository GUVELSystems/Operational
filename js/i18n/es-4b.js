/* es-4b.js — diccionario ES (datos de ejemplo de seed.js) */
(function () { const I = window.G.i18n;
  I.add({
    /* compañía */
    'GUVEL Demo Plant': 'Planta demo GUVEL',
    /* máquinas */
    'Press 200T A': 'Prensa 200T A', 'Press 200T B': 'Prensa 200T B', 'Press 110T': 'Prensa 110T', 'Press 110T B': 'Prensa 110T B',
    'Machining Center 1': 'Centro de maquinado 1', 'Machining Center 2': 'Centro de maquinado 2', 'Injection 150T': 'Inyectora 150T', 'Injection 220T': 'Inyectora 220T',
    /* partes */
    'Front bracket LH': 'Soporte frontal izq.', 'Gearbox housing': 'Carcasa de caja de engranes', 'Control panel bezel': 'Bisel del panel de control',
    'Mounting clip': 'Clip de montaje', 'Sensor cover': 'Cubierta de sensor', 'Heat sink plate': 'Placa disipadora de calor',
    /* operaciones */
    'Blanking': 'Troquelado', 'Forming': 'Formado', 'Drill & tap': 'Taladrado y roscado', 'Rough machining': 'Maquinado de desbaste', 'Finish bore': 'Barrenado de acabado',
    'Injection molding': 'Moldeo por inyección', 'Stamping': 'Estampado', 'Pressing': 'Prensado', 'Mill slots': 'Fresado de ranuras', 'Deburr': 'Desbarbado',
    /* turnos */
    'Shift 1 (Day)': 'Turno 1 (Día)', 'Shift 2 (Afternoon)': 'Turno 2 (Tarde)', 'Shift 3 (Night)': 'Turno 3 (Noche)',
    /* personal */
    'Operator': 'Operador', 'Supervisor': 'Supervisor',
    /* categorías */
    'Material': 'Material', 'Process': 'Proceso', 'Handling': 'Manejo', 'Tooling': 'Herramental', 'Dimensional': 'Dimensional', 'Cosmetic': 'Cosmético',
    'Machine': 'Máquina', 'Setup': 'Preparación', 'Personnel': 'Personal', 'Logistics': 'Logística', 'Quality': 'Calidad',
    /* defectos de scrap */
    'Handling damage': 'Daño por manejo', 'Dimensional out of tolerance': 'Dimensional fuera de tolerancia', 'Contamination / dirt': 'Contaminación / suciedad',
    'Burr': 'Rebaba', 'Crack': 'Grieta', 'Wrong angle': 'Ángulo incorrecto', 'Thread defect': 'Defecto de rosca',
    'Porosity': 'Porosidad', 'Bore oversize': 'Barreno sobredimensionado', 'Tool mark': 'Marca de herramienta',
    'Short shot': 'Llenado incompleto', 'Flash': 'Rebaba de inyección', 'Sink mark': 'Rechupe',
    'Spring-back': 'Recuperación elástica', 'Weld line': 'Línea de soldadura',
    'Flatness out of spec': 'Planitud fuera de especificación', 'Slot width': 'Ancho de ranura', 'Burr left': 'Rebaba residual',
    /* razones de paro */
    'Machine breakdown': 'Falla de máquina', 'Sensor / PLC fault': 'Falla de sensor / PLC', 'Tool breakage': 'Rotura de herramienta', 'Die / mold change': 'Cambio de dado / molde',
    'First-piece approval': 'Aprobación de primera pieza', 'Quality hold': 'Retención de calidad', 'Waiting for operator': 'Esperando operador', 'Waiting for material': 'Esperando material',
    'Forklift / logistics delay': 'Retraso de montacargas / logística', 'Preventive maintenance': 'Mantenimiento preventivo', 'Team meeting / 5S': 'Junta de equipo / 5S',
    'Scheduled changeover': 'Cambio de modelo programado',
    /* motivos de scrap */
    'Operator found at inspection': 'Detectado por el operador en inspección', 'Detected on line': 'Detectado en línea',
    'Customer feedback loop': 'Retroalimentación del cliente', 'Setup adjustment': 'Ajuste de preparación',
    /* avisos de ejemplo */
    'Daily plant summary': 'Resumen diario de planta', 'Weekly quality review': 'Revisión semanal de calidad', 'Machine health — monthly': 'Salud de máquinas — mensual'
  });
  I.addPatterns([
    [/^(Press 200T [AB]|Press 110T B?)\s*$/, (m) => m.replace('Press', 'Prensa')],
    [/^Machining Center (\d+)$/, 'Centro de maquinado $1'],
    [/^Injection (\d+T)$/, 'Inyectora $1'],
    [/^Shift (\d+) \((Day|Afternoon|Night)\)$/, (m, n, k) => 'Turno ' + n + ' (' + ({ Day: 'Día', Afternoon: 'Tarde', Night: 'Noche' })[k] + ')']
  ]);
})();
