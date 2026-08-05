import { testAdminClient } from "./supabase-admin";

// Phase 5's transactional book_appointment() function does not exist yet, so
// this fixture writes availability_slots + appointments directly through the
// service-role client — the only way ADMIN-08 can be verified against real
// data during Phase 2. Slot windows must not overlap for the same doctor
// (availability_slots_no_overlap) and no two active appointments may share a
// slot (appointments_active_slot_unique_idx).
const createdAppointmentIds: string[] = [];
const createdSlotIds: string[] = [];

export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "cancelled_by_patient"
  | "cancelled_by_doctor"
  | "completed"
  | "no_show";

export async function createTestAppointment(opts: {
  doctorId: string;
  patientId: string;
  startAt: string;
  endAt: string;
  status?: AppointmentStatus;
}): Promise<{ id: string; slotId: string }> {
  const admin = testAdminClient();

  const { data: slot, error: slotError } = await admin
    .from("availability_slots")
    .insert({
      doctor_id: opts.doctorId,
      start_at: opts.startAt,
      end_at: opts.endAt,
      status: "booked",
    })
    .select("id")
    .single();

  if (slotError || !slot) {
    throw new Error(`Failed to create test availability slot: ${slotError?.message}`);
  }
  createdSlotIds.push(slot.id);

  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .insert({
      slot_id: slot.id,
      patient_id: opts.patientId,
      doctor_id: opts.doctorId,
      status: opts.status ?? "scheduled",
    })
    .select("id")
    .single();

  if (appointmentError || !appointment) {
    throw new Error(`Failed to create test appointment: ${appointmentError?.message}`);
  }
  createdAppointmentIds.push(appointment.id);

  return { id: appointment.id, slotId: slot.id };
}

export async function cleanupTestAppointments(): Promise<void> {
  const admin = testAdminClient();

  const appointmentIds = createdAppointmentIds.splice(0, createdAppointmentIds.length);
  for (const id of appointmentIds) {
    try {
      await admin.from("appointments").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }

  // Appointments reference slots via on-delete-restrict, so slots must be
  // removed after their appointment, never before.
  const slotIds = createdSlotIds.splice(0, createdSlotIds.length);
  for (const id of slotIds) {
    try {
      await admin.from("availability_slots").delete().eq("id", id);
    } catch {
      // Swallow individual failures so one dead id cannot abort the rest.
    }
  }
}
