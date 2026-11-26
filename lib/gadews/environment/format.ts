const units: Record<string, string> = {
  C: "°C", degree_C: "°C", degrees_C: "°C", "milligram m-3": "mg/m³", "mg m^-3": "mg/m³",
  "mmol m-3": "mmol/m³", "1e-3": "10⁻³",
};
export const unitText = (unit: string) => units[unit] ?? unit;
export const numberText = (value: number) => String(Number(value.toPrecision(4)));
