import prisma from "../../config/prisma";

// Shared db runtime for assessments repository.
export const AssessmentsRepository = {
  db: prisma,
};
