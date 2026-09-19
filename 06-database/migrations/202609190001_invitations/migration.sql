CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "studentIds" UUID[] NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdBy" UUID NOT NULL,
    "acceptedBy" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Invitation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_schoolId_createdAt_idx" ON "Invitation"("schoolId", "createdAt");
