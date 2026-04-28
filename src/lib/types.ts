export type AppRole = "staff" | "mch";

export type Agency = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type Store = {
  id: string;
  name: string;
  code: string;
  agencyId: string | null;
  isActive: boolean;
};

export type StaffIdPoolItem = {
  id: string;
  staffingCode: string;
  isAssigned: boolean;
  importedAt: string;
};

export type Profile = {
  id: string;
  role: AppRole;
  staffingCode: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNumber: string | null;
  email: string;
  agencyId: string | null;
  storeId: string | null;
  hourlyRate: number | null;
  createdBy: string | null;
  isActive: boolean;
};

export type Visit = {
  id: string;
  mchProfileId: string;
  storeId: string;
  visitDate: string;
  checkInAt: string;
  checkOutAt: string | null;
  notes: string | null;
};
