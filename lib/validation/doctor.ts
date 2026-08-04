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
