import * as argon2 from "argon2";
import prisma from "../../config/prisma";
import { isValidEmail, isValidPhoneNumber } from "../../utils";
import { CreateEmployeePayload } from "./model";

export const EmployeeService = {
  async CreateEmployeeTransaction(payload: CreateEmployeePayload) {
    const { user, employee, details } = payload;

    // ? validasi posisi
    if (!employee.positionId) {
      throw new Error("Bad Request: Posisi harus dipilih.");
    }

    const positionExists = await prisma.positions.findUnique({
      where: { id: employee.positionId },
    });

    if (!positionExists) {
      throw new Error("Not Found: Posisi (Jabatan) tidak ditemukan di sistem.");
    }

    if (employee.workingSchedulesId) {
      const scheduleExists = await prisma.workingSchedules.findUnique({
        where: { id: employee.workingSchedulesId },
      });

      if (!scheduleExists) {
        throw new Error(
          "Not Found: Jadwal Kerja yang dipilih tidak ditemukan di sistem.",
        );
      }
    } else {
      employee.workingSchedulesId = null; // set null jika tidak dipilih
    }

    // ? validasi format email dan nomor hp (jika ada), function telah di buat di utils
    if (employee.email && !isValidEmail(employee.email)) {
      throw new Error("Bad Request: Format email tidak valid.");
    }

    if (employee.phoneNumber && !isValidPhoneNumber(employee.phoneNumber)) {
      throw new Error("Bad Request: Format nomor HP tidak valid.");
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

    // ? auto generated password Privilige Misuse & High Entropy
    const password = `P@ssw0rd${Math.floor(Math.random() * 10000)}`;

    console.log("Generated password for new employee:", password); // ? log password sementara, di real case harusnya dikirim via email atau channel aman lainnya

    // ? hashing password sblm masuk db
    const hashedPassword = await argon2.hash(
      password,
      //    {
      //   type: argon2.argon2id,
      // }
    );

    // ? eksekusi prisma transaction: create user -> create employee -> create details (optional)
    const result = await prisma.$transaction(async (tx) => {
      // ! STEP A: Create User Authentication
      const createdUser = await tx.users.create({
        data: {
          ...user,
          password: hashedPassword,
        },
      });

      // ! STEP B: Create Employee Profile
      const createdEmployee = await tx.employees.create({
        data: {
          ...employee,
          userId: createdUser.id, // relasi ke user
          positionId: employee.positionId, // relasi ke position
        },
      });

      // ! STEP C: Create Employee Details (optional)
      if (details) {
        await tx.employeeDetails.create({
          data: {
            ...details,
            employeeId: createdEmployee.id, // relasi ke employee
          },
        });
      }

      // ! STEP D: Return gabungan data (terintegrasi)
      return tx.employees.findUnique({
        where: { id: createdEmployee.id },
        include: {
          user: {
            select: {
              id: true,
              nip: true,
              role: true,
            },
          },
          employeeDetails: true,
          position: true,
        },
      });
    });

    return result;
  },
};
