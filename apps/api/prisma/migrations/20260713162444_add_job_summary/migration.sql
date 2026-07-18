-- CreateTable
CREATE TABLE "JobSummary" (
    "jobId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "responsibilities" TEXT[],
    "requirements" TEXT[],
    "niceToHave" TEXT[],
    "benefits" TEXT[],
    "roleFunction" TEXT NOT NULL,
    "yearsExperienceMin" INTEGER,
    "model" TEXT NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSummary_pkey" PRIMARY KEY ("jobId")
);

-- AddForeignKey
ALTER TABLE "JobSummary" ADD CONSTRAINT "JobSummary_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
