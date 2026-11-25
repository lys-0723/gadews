export class RequestValidationError extends Error {
  constructor(field = "request", detail = "has an invalid value") {
    super(`${field} ${detail}`);
    this.name = "RequestValidationError";
  }
}

export class UnknownAquacultureDeviceError extends Error {
  constructor() {
    super("Unknown or disabled deviceKey");
    this.name = "UnknownAquacultureDeviceError";
  }
}

export class CollectionRangeError extends Error {
  constructor() {
    super("Collection startDate must not be after endDate");
    this.name = "CollectionRangeError";
  }
}
