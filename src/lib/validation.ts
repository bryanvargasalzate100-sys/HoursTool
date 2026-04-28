import { z } from "zod";

export const agencySchema = z.object({
  name: z.string().min(2).max(120),
  charge: z.coerce.number().min(0).max(100)
});

export const storeSchema = z.object({
  name: z.string().min(2).max(120),
  customer: z.string().min(2).max(120)
});

export const mchRegistrationSchema = z
  .object({
    firstName: z.string().min(2).max(80),
    lastName: z.string().min(2).max(80),
    phoneNumber: z.string().min(7).max(30),
    email: z.string().email(),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72)
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export const mchUserSchema = z.object({
  staffingCode: z.string().min(3).max(50),
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  phoneNumber: z.string().min(7).max(30),
  email: z.string().email(),
  storeId: z.string().uuid(),
  agencyId: z.string().uuid(),
  hourlyRate: z.coerce.number().nonnegative()
});

export const visitSchema = z
  .object({
    storeId: z.string().uuid(),
    visitDate: z.string().min(10).max(10),
    checkInAt: z.string().regex(/^\d{2}:\d{2}$/),
    checkOutAt: z.string().regex(/^\d{2}:\d{2}$/),
    notes: z.string().max(500).optional()
  })
  .refine(
    (value) => value.checkOutAt > value.checkInAt,
    {
      message: "Check-out must be later than check-in.",
      path: ["checkOutAt"]
    }
  );

export const auditVisitEntrySchema = z
  .object({
    id: z.string().uuid(),
    checkInAt: z.string().regex(/^\d{2}:\d{2}$/),
    checkOutAt: z.string().regex(/^\d{2}:\d{2}$/),
    notes: z.string().max(500).nullable().optional()
  })
  .refine(
    (value) => value.checkOutAt > value.checkInAt,
    {
      message: "Check-out must be later than check-in.",
      path: ["checkOutAt"]
    }
  );

export const auditDayReviewSchema = z.object({
  mchProfileId: z.string().uuid(),
  visitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezoneOffsetMinutes: z.coerce.number(),
  visits: z.array(auditVisitEntrySchema).min(1),
  rejectionReason: z.string().max(500).nullable().optional()
});
