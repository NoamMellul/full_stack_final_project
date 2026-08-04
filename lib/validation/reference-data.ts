// Manual TypeScript validation functions (locked project convention) for the
// two reference-data resources — no schema library, same style as
// lib/validation/auth.ts and lib/validation/doctor.ts.

export function validateSpecialtyInput(body: Record<string, unknown>): string | null {
  const nameEn = body.nameEn;
  if (typeof nameEn !== "string" || !nameEn.trim()) {
    return "Name is required.";
  }

  const nameHe = body.nameHe;
  if (typeof nameHe !== "string" || !nameHe.trim()) {
    return "Name is required.";
  }

  return null;
}

const SPECIALTY_EDITABLE_KEYS = ["nameEn", "nameHe"] as const;

// Validates a partial update: only keys actually present on the body are
// checked, reusing the exact message string from validateSpecialtyInput above
// so the create and edit paths never disagree on copy.
export function validateSpecialtyPatch(body: Record<string, unknown>): string | null {
  const hasEditableKey = SPECIALTY_EDITABLE_KEYS.some((key) => key in body);
  if (!hasEditableKey) {
    return "Nothing to update.";
  }

  if ("nameEn" in body) {
    const nameEn = body.nameEn;
    if (typeof nameEn !== "string" || !nameEn.trim()) {
      return "Name is required.";
    }
  }

  if ("nameHe" in body) {
    const nameHe = body.nameHe;
    if (typeof nameHe !== "string" || !nameHe.trim()) {
      return "Name is required.";
    }
  }

  return null;
}

export function validateLocationInput(body: Record<string, unknown>): string | null {
  const city = body.city;
  if (typeof city !== "string" || !city.trim()) {
    return "Name is required.";
  }

  const neighborhood = body.neighborhood;
  if (typeof neighborhood !== "string" || !neighborhood.trim()) {
    return "Name is required.";
  }

  const address = body.address;
  if (address !== undefined && address !== null && typeof address !== "string") {
    return "Name is required.";
  }

  return null;
}

const LOCATION_EDITABLE_KEYS = ["city", "neighborhood", "address"] as const;

// Validates a partial update: only keys actually present on the body are
// checked, reusing the exact message string from validateLocationInput above
// so the create and edit paths never disagree on copy.
export function validateLocationPatch(body: Record<string, unknown>): string | null {
  const hasEditableKey = LOCATION_EDITABLE_KEYS.some((key) => key in body);
  if (!hasEditableKey) {
    return "Nothing to update.";
  }

  if ("city" in body) {
    const city = body.city;
    if (typeof city !== "string" || !city.trim()) {
      return "Name is required.";
    }
  }

  if ("neighborhood" in body) {
    const neighborhood = body.neighborhood;
    if (typeof neighborhood !== "string" || !neighborhood.trim()) {
      return "Name is required.";
    }
  }

  if ("address" in body) {
    const address = body.address;
    if (address !== undefined && address !== null && typeof address !== "string") {
      return "Name is required.";
    }
  }

  return null;
}
