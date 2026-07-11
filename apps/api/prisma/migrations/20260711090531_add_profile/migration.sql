-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "skills" TEXT[],
    "yearsOfExperience" INTEGER NOT NULL,
    "targetSeniority" TEXT NOT NULL,
    "targetWorkModes" TEXT[],
    "locations" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);
