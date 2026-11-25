/* es-6.js — diccionario ES: vista Production del Dashboard (reactor OEE, flujo, odómetro, pérdidas, flota, panel lateral) */
(function () { const I = window.G.i18n;
  I.add({
    'Targets': 'Objetivos', 'OEE target %': 'Objetivo de OEE %', 'Availability target %': 'Objetivo de Disponibilidad %', 'Performance target %': 'Objetivo de Rendimiento %', 'Quality target %': 'Objetivo de Calidad %',
    'KPI CONFIGURATION': 'CONFIGURACIÓN DE KPI', 'Idle': 'Inactiva',
    'Overall Equipment Effectiveness': 'Eficiencia general del equipo (OEE)', 'OEE target': 'Objetivo de OEE', 'Machine status vs target': 'Estado de máquinas vs objetivo',
    'Yield output (pieces)': 'Producción (piezas)', 'machines': 'máquinas', 'On track': 'En objetivo', 'Watch': 'Vigilar', 'Attention': 'Atención',
    'OEE Reactor': 'Reactor OEE', 'Concentric performance rings: Availability · Performance · Quality': 'Anillos concéntricos: Disponibilidad · Rendimiento · Calidad',
    'Inspect all': 'Inspeccionar todo', 'Availability': 'Disponibilidad', 'Performance': 'Rendimiento', 'Quality': 'Calidad',
    'Production time flow': 'Flujo del tiempo de producción', 'Planned time → effective production time': 'Tiempo planeado → tiempo efectivo de producción',
    'Planned time': 'Tiempo planeado', 'Operating': 'Operando', 'Operating time': 'Tiempo operando', 'Net operating': 'Operando neto', 'Effective': 'Efectivo', 'Effective time': 'Tiempo efectivo',
    'Downtime': 'Paros', 'Speed loss': 'Pérdida de velocidad', 'Scrap': 'Scrap',
    'No planned time in this selection.': 'No hay tiempo planeado en esta selección.', 'Primary bottleneck detected': 'Cuello de botella principal detectado', 'Inspect bottleneck': 'Inspeccionar cuello de botella',
    'Plan vs Actual': 'Plan vs Real', 'Detail': 'Detalle', 'Produced pieces': 'Piezas producidas', 'Production pace': 'Ritmo de producción', 'Variance': 'Variación',
    'Production loss intelligence': 'Inteligencia de pérdidas de producción', 'Ranked impact': 'Impacto rankeado',
    'Unplanned downtime': 'Paros no planeados', 'Speed loss (cycle time & micro-stops)': 'Pérdida de velocidad (ciclo y microparos)', 'Scrap (quality loss)': 'Scrap (pérdida de calidad)', 'Planned downtime & setup': 'Paros planeados y cambios',
    'OEE evolution': 'Evolución del OEE', 'The trend needs at least two days with data. Pick a wider period.': 'La tendencia necesita al menos dos días con datos. Elige un periodo más amplio.',
    'Machine fleet': 'Flota de máquinas', 'Click a row to filter the sections above to that machine.': 'Haz clic en una fila para filtrar las secciones de arriba a esa máquina.',
    'No machines with data in this period.': 'No hay máquinas con datos en este periodo.', 'Status': 'Estado', 'Downtime (min)': 'Paros (min)',
    'Availability drill-down': 'Detalle de disponibilidad', 'Downtime & stop events': 'Paros y eventos de detención', 'Performance drill-down': 'Detalle de rendimiento', 'Cycle-time & speed loss': 'Ciclo y pérdida de velocidad',
    'Quality & scrap drill-down': 'Detalle de calidad y scrap', 'Rejections & defect breakdown': 'Rechazos y desglose de defectos', 'Plan vs actual': 'Plan vs real', 'Production Real vs Plan': 'Producción real vs plan',
    'Overall inspection': 'Inspección general', 'Plant OEE master telemetry': 'Telemetría maestra de OEE de planta', 'Formula audit': 'Auditoría de fórmula',
    'Planned downtime': 'Paros planeados', 'Downtime by reason': 'Paros por motivo', 'Downtime by machine': 'Paros por máquina', 'Performance by machine (lowest first)': 'Rendimiento por máquina (menor primero)',
    'Scrap by part number': 'Scrap por número de parte', 'First time quality': 'Calidad a la primera', 'Rejected': 'Rechazadas', 'Good parts': 'Piezas buenas', 'Loss ranking': 'Ranking de pérdidas',
    'Total lost production equivalent': 'Pérdida total equivalente de producción', 'Root causes': 'Causas raíz', 'Does not affect OEE': 'No afecta el OEE',
    'Planned target': 'Objetivo planeado', 'Achievement': 'Cumplimiento', 'Actual run rate': 'Ritmo real', 'Target rate': 'Ritmo objetivo', 'Average': 'Promedio', 'Latest:': 'Último:',
    'Close inspection': 'Cerrar inspección', 'Total': 'Total', 'Target': 'Objetivo', 'Reset': 'Restablecer', 'Close': 'Cerrar',
    'Planned quantity = planned time ÷ cycle time': 'Cantidad planeada = tiempo planeado ÷ tiempo de ciclo', 'OVERALL OEE': 'OEE GENERAL'
  });
  I.addPatterns([
    [/^(\d+) (On track|Watch|Attention|Idle)$/, (m, n, k) => n + ' ' + I.t(k)],
    [/^\s*running · (\d+) machines$/, (m, n) => ' en producción · ' + n + ' máquinas'],
    [/^(.+) vs target$/, (m, a) => I.t(a) + ' vs objetivo'],
    [/^([+\-−]?[\d.]+) pts vs target$/, (m, a) => a + ' pts vs objetivo'],
    [/^−([\d.]+) pts of OEE$/, (m, a) => '−' + a + ' pts de OEE'],
    [/^Availability (\S+) · Performance (\S+) · Quality (\S+)$/, (m, a, p, q) => 'Disponibilidad ' + a + ' · Rendimiento ' + p + ' · Calidad ' + q],
    [/^FTQ (\S+) · Scrap (\S+) · (\S+) rejected$/, (m, f, s, n) => 'FTQ ' + f + ' · Scrap ' + s + ' · ' + n + ' rechazadas'],
    [/^Downtime: (\S+) min$/, (m, a) => 'Paros: ' + a + ' min'], [/^Speed loss: (\S+) min$/, (m, a) => 'Pérdida de velocidad: ' + a + ' min'], [/^Scrap: (.+)$/, (m, a) => 'Scrap: ' + a],
    [/^Target: (\S+)$/, (m, a) => 'Objetivo: ' + a], [/^Overall efficiency: (\S+)$/, (m, a) => 'Eficiencia general: ' + a],
    [/^Scope: (.+)$/, (m, a) => 'Alcance: ' + a], [/^Unplanned downtime$/, () => 'Paros no planeados']
  ]);
})();
