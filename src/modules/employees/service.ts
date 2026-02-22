import prisma from "../../config/prisma";
import * as argon2 from "argon2";
import { CreateEmployeePayload } from "./model";

export const EmployeeService = {
  async CreateEmployeeTransaction(payload: CreateEmployeePayload) {
    const { user, employee, details } = payload;

    // ? validasi posisi
    if (!employee.positionId) {
      throw new Error("Posisi harus dipilih.");
    }

    const positionExists = await prisma.positions.findUnique({
      where: { id: employee.positionId },
    });

    if (!positionExists) {
      throw new Error("Posisi (Jabatan) tidak ditemukan di sistem.");
    }

    // ? validasi duplikasi data (nip, email, phone)
    const [existingNip, existingEmail, existingPhone] = await Promise.all([
      // ? nip pasti ada, jadi langsung query
      prisma.users.findUnique({ where: { nip: user.nip } }),
      // ? email bisa null, jadi cek dulu sebelum query
      employee.email
        ? prisma.employees.findUnique({ where: { email: employee.email } })
        : null,
      // ? nomor hp bisa null, jadi cek dulu sebelum query
      employee.phoneNumber
        ? prisma.employees.findUnique({
            where: { phoneNumber: employee.phoneNumber },
          })
        : null,
    ]);

    if (existingNip)
      throw new Error(`Conflict: NIP ${user.nip} sudah digunakan.`);
    if (existingEmail)
      throw new Error(`Conflict: Email ${employee.email} sudah terdaftar.`);
    if (existingPhone)
      throw new Error(
        `Conflict: Nomor HP ${employee.phoneNumber} sudah terdaftar.`,
      );

    // ? hashing password sblm masuk db
    const hashedPassword = await argon2.hash(
      user.password,
      //    {
      //   type: argon2.argon2id,
      // }
    );

    
  },
};
