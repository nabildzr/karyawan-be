// * File ini adalah orchestrator/facade untuk seluruh service module employees.

import { CreateEmployeeTransaction, DeleteEmployee, UpdateEmployee } from "./create";
import { GetAllEmployees, GetById } from "./report";

export const EmployeeService = {
  // & Get paginated employee list.
  // % Ambil daftar karyawan paginasi.
  GetAllEmployees,

  // & Get employee deep detail by id.
  // % Ambil detail karyawan lengkap berdasarkan id.
  GetById,

  // & Create employee transaction flow.
  // % Jalankan alur transaksi pembuatan karyawan.
  CreateEmployeeTransaction,

  // & Update employee transaction flow.
  // % Jalankan alur transaksi update karyawan.
  UpdateEmployee,

  // & Delete employee transaction flow.
  // % Jalankan alur transaksi hapus karyawan.
  DeleteEmployee,
};
