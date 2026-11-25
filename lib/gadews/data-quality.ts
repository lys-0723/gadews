export interface DataQualityResult {
  missingFields: string[];
  invalidFields: string[];
  completenessPercent: number;
  isValid: boolean;
}

type DemoRecord = Record<string, unknown>;

export function checkDataQuality(
  record: DemoRecord,
  requiredFields: string[],
  latitudeField = "latitude",
  longitudeField = "longitude"
): DataQualityResult {
  const missingFields = requiredFields.filter((field) => {
    const value = record[field];
    return value === undefined || value === null || value === "";
  });

  const invalidFields: string[] = [];
  const latitude = record[latitudeField];
  const longitude = record[longitudeField];

  if (latitude !== undefined && latitude !== null) {
    if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
      invalidFields.push(latitudeField);
    }
  }

  if (longitude !== undefined && longitude !== null) {
    if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
      invalidFields.push(longitudeField);
    }
  }

  const presentRequiredCount = requiredFields.length - missingFields.length;
  const completenessPercent =
    requiredFields.length === 0
      ? 100
      : Math.round((presentRequiredCount / requiredFields.length) * 100);

  return {
    missingFields,
    invalidFields,
    completenessPercent,
    isValid: missingFields.length === 0 && invalidFields.length === 0,
  };
}

export function checkDataQualityBatch(
  records: DemoRecord[],
  requiredFields: string[],
  latitudeField = "latitude",
  longitudeField = "longitude"
): DataQualityResult[] {
  return records.map((record) =>
    checkDataQuality(record, requiredFields, latitudeField, longitudeField)
  );
}
