/* es-4.js — diccionario ES (Notices: página y correo) */
(function () { const I = window.G.i18n;
  const MON = { Jan: 'ene', Feb: 'feb', Mar: 'mar', Apr: 'abr', May: 'may', Jun: 'jun', Jul: 'jul', Aug: 'ago', Sep: 'sep', Oct: 'oct', Nov: 'nov', Dec: 'dic' };
  const WD = { Sun: 'dom', Mon: 'lun', Tue: 'mar', Wed: 'mié', Thu: 'jue', Fri: 'vie', Sat: 'sáb' };
  const DAYS = { Sunday: 'domingo', Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miércoles', Thursday: 'jueves', Friday: 'viernes', Saturday: 'sábado' };
  const FREQ = { Daily: 'Diario', Weekly: 'Semanal', Monthly: 'Mensual' };
  const CITY = { 'Mexico City': 'Ciudad de México', 'New York': 'Nueva York', 'Los Angeles': 'Los Ángeles', 'Sao Paulo': 'São Paulo', Bogota: 'Bogotá' };
  const COVERS = { "yesterday's data": 'los datos de ayer', "the previous week's data": 'los datos de la semana anterior', "the previous month's data": 'los datos del mes anterior' };
  const PER = { Yesterday: 'Ayer', 'Previous Week': 'Semana anterior', 'This Month': 'Este mes', 'Previous Month': 'Mes anterior' };
  const PERL = { yesterday: 'ayer', 'previous week': 'la semana anterior', 'this month': 'este mes', 'previous month': 'el mes anterior' };
  const REP = { General: 'General', Quality: 'Calidad', Production: 'Producción' };
  const dayEs = (s) => DAYS[s.replace(/s$/, '')] || s;
  const WDS = Object.keys(DAYS).map((d) => d + 's').join('|');
  I.add({
    /* tarjetas y página */
    'Emails are simulated in this prototype — preview them and copy the result into a real message.': 'Los correos se simulan en este prototipo: míralos en vista previa y copia el resultado en un mensaje real.',
    'You have view-only access to notices. You can still preview them.': 'Solo tienes acceso de lectura a los avisos. Aún puedes verlos en vista previa.',
    'No notices yet. Create one to schedule a report by email.': 'Aún no hay avisos. Crea uno para programar un reporte por correo.',
    'New notice': 'Nuevo aviso', 'Edit notice': 'Editar aviso', 'Delete notice': 'Eliminar aviso', 'Create notice': 'Crear aviso', 'Save changes': 'Guardar cambios', 'Cancel': 'Cancelar',
    'Active': 'Activo', 'Paused': 'Pausado', 'Schedule': 'Programación', 'Covers': 'Cubre', 'Next send': 'Próximo envío', 'Last sent': 'Último envío', 'Never': 'Nunca',
    'Preview': 'Vista previa', 'Send test': 'Enviar prueba',
    'Notice created': 'Aviso creado', 'Notice updated': 'Aviso actualizado', 'Notice deleted': 'Aviso eliminado', 'Notice activated': 'Aviso activado', 'Notice paused': 'Aviso pausado',
    'This notice will stop being sent. This cannot be undone.': 'Este aviso dejará de enviarse. Esta acción no se puede deshacer.',
    /* vista previa */
    'This is exactly how the email will look when it arrives.': 'Así se verá exactamente el correo cuando llegue.',
    'Building the report…': 'Generando el reporte…',
    'Data period': 'Periodo de datos', 'Device': 'Dispositivo', 'Desktop': 'Escritorio', 'Mobile': 'Móvil',
    'Copy for email': 'Copiar para correo', 'Copy HTML code': 'Copiar código HTML', 'Copy the HTML code': 'Copiar el código HTML', 'Done': 'Listo',
    'There is no production in this period. Pick another period to see the report with data.': 'No hay producción en este periodo. Elige otro periodo para ver el reporte con datos.',
    'From': 'De', 'To': 'Para', 'Date': 'Fecha', 'No recipients yet': 'Aún no hay destinatarios', 'Email preview': 'Vista previa del correo',
    'Tip: press': 'Consejo: presiona',
    ', open a new message in Outlook or Gmail and paste (Ctrl + V) to see it in your own mail client.': ', abre un mensaje nuevo en Outlook o Gmail y pega (Ctrl + V) para verlo en tu propio cliente de correo.',
    'Copied — paste it into an email message': 'Copiado: pégalo en un mensaje de correo',
    'Your browser blocked copying. Use "Copy HTML code" instead.': 'Tu navegador bloqueó el copiado. Usa "Copiar código HTML".',
    'HTML code copied': 'Código HTML copiado',
    'Your browser blocked automatic copying. Select all and copy (Ctrl + C).': 'Tu navegador bloqueó el copiado automático. Selecciona todo y copia (Ctrl + C).',
    /* formulario */
    'Notice name': 'Nombre del aviso', 'What to send': 'Qué enviar', 'Recipients': 'Destinatarios', 'How often': 'Con qué frecuencia', 'Day of the week': 'Día de la semana', 'Day of the month': 'Día del mes',
    'Send time': 'Hora de envío', 'Time zone': 'Zona horaria', 'Subject': 'Asunto', '(optional)': '(opcional)',
    'e.g. Daily plant summary': 'p. ej. Resumen diario de planta', 'name@company.com, other@company.com': 'nombre@empresa.com, otro@empresa.com',
    'Separate emails with commas, semicolons or new lines.': 'Separa los correos con comas, punto y coma o saltos de línea.',
    'Leave empty for an automatic subject': 'Déjalo vacío para un asunto automático',
    '— send this notice on schedule': '— enviar este aviso según lo programado',
    'Sent every day with': 'Se envía todos los días con los datos', 'Sent every week with': 'Se envía cada semana con los datos', 'Sent every month with': 'Se envía cada mes con los datos',
    "yesterday's": 'de ayer.', "previous week's": 'de la semana anterior.', "previous month's": 'del mes anterior.', 'data.': '',
    'Give the notice a name.': 'Ponle un nombre al aviso.', 'Add at least one recipient email.': 'Agrega al menos un correo de destinatario.',
    'Choose the send time.': 'Elige la hora de envío.', 'Pick a day of the month between 1 and 28.': 'Elige un día del mes entre 1 y 28.',
    /* reportes, frecuencias, días, periodos */
    'General Report': 'Reporte general', 'Quality Report': 'Reporte de calidad', 'Production Report': 'Reporte de producción',
    'OEE + Scrap + FTQ + PPMs + Downtime, by part number.': 'OEE + Scrap + FTQ + PPMs + Paros, por número de parte.',
    'Scrap Rank + Scrap % + FTQ + PPMs + defects with quantities.': 'Ranking de scrap + Scrap % + FTQ + PPMs + defectos con cantidades.',
    'Health by machine: OEE, availability, downtime and scrap.': 'Salud por máquina: OEE, disponibilidad, paros y scrap.',
    'Daily': 'Diario', 'Weekly': 'Semanal', 'Monthly': 'Mensual',
    'Sunday': 'Domingo', 'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles', 'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado',
    'Yesterday': 'Ayer', 'Previous Week': 'Semana anterior', 'This Month': 'Este mes', 'Previous Month': 'Mes anterior',
    "yesterday's data": 'Datos de ayer', "the previous week's data": 'Datos de la semana anterior', "the previous month's data": 'Datos del mes anterior',
    'Mexico City (CST)': 'Ciudad de México (CST)', 'New York (ET)': 'Nueva York (ET)', 'Los Angeles (PT)': 'Los Ángeles (PT)',
    /* correo */
    'Total': 'Total', 'Downtime': 'Paros', 'min': 'min', 'By part number': 'Por número de parte', 'Part number': 'Número de parte', 'Customer': 'Cliente', 'Downtime (min)': 'Paros (min)',
    'Defect': 'Defecto', 'Quantity': 'Cantidad', 'Share': 'Participación', 'Scrap qty': 'Cant. de scrap', 'Scrap': 'Scrap',
    'Scrap Rank — top 3 part numbers': 'Ranking de scrap — top 3 números de parte', 'Defects with quantities': 'Defectos con cantidades',
    'No scrap recorded in this period.': 'No se registró scrap en este periodo.',
    'Plant OEE': 'OEE de planta', 'Availability': 'Disponibilidad', 'Machines': 'Máquinas', 'Machine': 'Máquina',
    'Process / part numbers': 'Proceso / números de parte', 'Avail.': 'Disp.', 'Health by machine': 'Salud por máquina',
    'Sent automatically by': 'Enviado automáticamente por',
    'Prepared with Ramiro AI. You receive this notice because you are on its recipients list.': 'Preparado con Ramiro AI. Recibes este aviso porque estás en su lista de destinatarios.'
  });
  I.addPatterns([
    [/^(\d+) notices?$/, (m, n) => n + (n === '1' ? ' aviso' : ' avisos')],
    [/^(\d+) active$/, (m, n) => n + (n === '1' ? ' activo' : ' activos')],
    [/^Preview — (.*)$/, 'Vista previa — $1'],
    [/^Delete “(.*)”\?$/, 'Eliminar “$1”?'],
    [/^These emails are not valid: (.*)$/, 'Estos correos no son válidos: $1'],
    [/^Simulated: “(.*)” → (\d+) recipients?$/, (m, s, n) => 'Simulado: “' + s.replace(/\b(General|Quality|Production) Report\b/, (x, k) => 'Reporte ' + ({ General: 'general', Quality: 'de calidad', Production: 'de producción' })[k]) + '” → ' + n + (n === '1' ? ' destinatario' : ' destinatarios')],
    [/^GUVEL · (General|Quality|Production) Report — (.*)$/, (m, k, d) => 'GUVEL · Reporte ' + ({ General: 'general', Quality: 'de calidad', Production: 'de producción' })[k] + ' — ' + d],
    [/^(Yesterday|Previous Week|This Month|Previous Month) \(scheduled\)$/, (m, p) => PER[p] + ' (programado)'],
    [/^(Yesterday|Previous Week|This Month|Previous Month) had no production, so the preview shows (yesterday|previous week|this month|previous month) instead\.$/, (m, a, b) => PER[a] + ' no tuvo producción, por lo que la vista previa muestra ' + PERL[b] + ' en su lugar.'],
    [new RegExp('^(Daily|Weekly|Monthly) at (\\d{2}:\\d{2})(?: · (' + WDS + ')| · day (\\d+))?$'), (m, f, t, d1, d2) => FREQ[f] + ' a las ' + t + (d1 ? ' · ' + dayEs(d1) : d2 ? ' · día ' + d2 : '')],
    [new RegExp('^· (Daily|Weekly|Monthly) at (\\d{2}:\\d{2})(?: · (' + WDS + ')| · day (\\d+))? \\((.+)\\) · covers (.+)\\.$'), (m, f, t, d1, d2, tz, c) => '· ' + FREQ[f] + ' a las ' + t + (d1 ? ' · ' + dayEs(d1) : d2 ? ' · día ' + d2 : '') + ' (' + tz + ') · cubre ' + (COVERS[c] || c) + '.'],
    [/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}),? (\d{2}:\d{2})( [AP]M)?(?: · (.+))?$/, (m, w, mo, d, t, ap, c) => WD[w] + ', ' + d + ' ' + MON[mo] + ', ' + t + (ap || '') + (c ? ' · ' + (CITY[c] || c) : '')],
    [/^Rank (\d+)$/, 'Lugar $1'],
    [/^pcs · (.*)$/, 'pzas · $1'],
    [/^No production was recorded in this period \((.*)\)\. Nothing to report\.$/, 'No se registró producción en este periodo ($1). No hay nada que reportar.']
  ]);
})();
