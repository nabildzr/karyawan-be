export interface CheckInPayload {
  image: File;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  timezone?: string;
}

export interface CheckOutPayload {
  image: File;
  latitude?: number;
  longitude?: number;
  deviceInfo?: string;
  timezone?: string;
}

export interface ManualAttendancePayload {
  employeeId: string;
  status: string;
  statusCheckOut?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
  shiftName: string;
  expectedCheckIn: string;
  expectedCheckOut?: string | null;
  note: string;
  reason: string;
  forceBypassSubmission?: boolean;
}

export interface CorrectAttendancePayload {
  checkIn?: string | null;
  checkOut?: string | null;
  status?: string | null;
  statusCheckOut?: string | null;
  note: string;
  reason?: string | null;
  forceBypassSubmission?: boolean;
}
