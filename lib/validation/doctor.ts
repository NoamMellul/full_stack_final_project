// Manual TypeScript validation for the doctor create/edit form (no schema library).
// Messages must match the UI-SPEC Copywriting Contract verbatim so the client
// and server produce identical text.

export function validateDoctorInput(body: Record<string, unknown>): string | null {
  const fullName = body.fullName;
  if (typeof fullName !== "string" || !fullName.trim()) {
    return "Full name is required.";
  }

  const specialtyId = body.specialtyId;
  if (typeof specialtyId !== "string" || !specialtyId.trim()) {
    return "Specialty is required.";
  }

  const locationId = body.locationId;
  if (typeof locationId !== "string" || !locationId.trim()) {
    return "Location is required.";
  }

  const photoUrl = body.photoUrl;
  if (photoUrl !== undefined && photoUrl !== null && photoUrl !== "") {
    if (typeof photoUrl !== "string" || !/^https?:\/\//i.test(photoUrl.trim())) {
      return "Photo URL must be a valid http(s) URL.";
    }
  }

  const bio = body.bio;
  if (bio !== undefined && bio !== null && typeof bio !== "string") {
    return "Bio must be text.";
  }

  const languageIds = body.languageIds;
  if (languageIds !== undefined && languageIds !== null) {
    const isValidList =
      Array.isArray(languageIds) &&
      languageIds.every((id) => typeof id === "string" && id.trim().length > 0);
    if (!isValidList) {
      return "Languages must be a list of language ids.";
    }
  }

  return null;
}

const EDITABLE_KEYS = [
  "fullName",
  "specialtyId",
  "locationId",
  "bio",
  "photoUrl",
  "languageIds",
] as const;

// Validates a partial update: only keys actually present on the body are
// checked, reusing the exact message strings from validateDoctorInput above
// so the create and edit paths never disagree on copy.
export function validateDoctorPatch(body: Record<string, unknown>): string | null {
  const hasEditableKey = EDITABLE_KEYS.some((key) => key in body);
  if (!hasEditableKey) {
    return "Nothing to update.";
  }

  if ("fullName" in body) {
    const fullName = body.fullName;
    if (typeof fullName !== "string" || !fullName.trim()) {
      return "Full name is required.";
    }
  }

  if ("specialtyId" in body) {
    const specialtyId = body.specialtyId;
    if (typeof specialtyId !== "string" || !specialtyId.trim()) {
      return "Specialty is required.";
    }
  }

  if ("locationId" in body) {
    const locationId = body.locationId;
    if (typeof locationId !== "string" || !locationId.trim()) {
      return "Location is required.";
    }
  }

  if ("photoUrl" in body) {
    const photoUrl = body.photoUrl;
    if (photoUrl !== undefined && photoUrl !== null && photoUrl !== "") {
      if (typeof photoUrl !== "string" || !/^https?:\/\//i.test(photoUrl.trim())) {
        return "Photo URL must be a valid http(s) URL.";
      }
    }
  }

  if ("bio" in body) {
    const bio = body.bio;
    if (bio !== undefined && bio !== null && typeof bio !== "string") {
      return "Bio must be text.";
    }
  }

  if ("languageIds" in body) {
    const languageIds = body.languageIds;
    if (languageIds !== undefined && languageIds !== null) {
      const isValidList =
        Array.isArray(languageIds) &&
        languageIds.every((id) => typeof id === "string" && id.trim().length > 0);
      if (!isValidList) {
        return "Languages must be a list of language ids.";
      }
    }
  }

  return null;
}

// Requires isActive to be a real boolean — no truthy-string coercion.
export function validateStatusInput(body: Record<string, unknown>): string | null {
  if (typeof body.isActive !== "boolean") {
    return "Status must be true or false.";
  }
  return null;
}
