import prisma from "./src/config/prisma";

async function test() {
  try {
    const user = await prisma.users.findUnique({
      where: { nip: 'MGR-001' },
      select: {
        id: true,
        nip: true,
        rbacRole: {
          select: {
            id: true,
            key: true,
            name: true,
            isActive: true,
          },
        },
        password: true,
        employees: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    });
    console.log("Success", user);
  } catch(e) {
    console.error("FAIL", e);
  } finally {
    process.exit(0);
  }
}
test();
