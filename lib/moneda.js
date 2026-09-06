// Formato de precios — compartido entre el catálogo y el escáner de
// código, para que ambos muestren el USD/Bs exactamente igual.

// Bs con el formato venezolano (punto de miles, coma decimal).
const formatoBs = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const formatBs = (monto) => `Bs. ${formatoBs.format(monto)}`;

// A mano en vez de Intl.DateTimeFormat: los datos ICU que trae Node por
// defecto no siempre traen el paquete completo de es-VE, y "2-digit" ahí
// puede salir sin el cero ("4/9" en vez de "04/09").
export const formatFechaTasa = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
};
