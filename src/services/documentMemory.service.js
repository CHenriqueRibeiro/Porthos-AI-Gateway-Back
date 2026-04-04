const prisma = require("../db/prisma")
const {
  buildDocumentFingerprint
} = require("./documentFingerprint.service")

async function findExactDocumentMemory({
  sessionId,
  text,
  extractionProfile = "generic_document",
  responseFormat = null
}) {
  const fingerprintData = buildDocumentFingerprint({
    text,
    extractionProfile,
    responseFormat
  })

  const found = await prisma.documentMemory.findUnique({
    where: {
      sessionId_extractionProfile_schemaSignature_documentFingerprint: {
        sessionId,
        extractionProfile,
        schemaSignature: fingerprintData.schemaSignature,
        documentFingerprint: fingerprintData.documentFingerprint
      }
    }
  })

  return {
    found,
    fingerprintData
  }
}

async function findLatestDocumentMemoryByProfile({
  sessionId,
  extractionProfile = "generic_document"
}) {
  return prisma.documentMemory.findFirst({
    where: {
      sessionId,
      extractionProfile
    },
    orderBy: {
      updatedAt: "desc"
    }
  })
}

async function pruneDocumentMemory({
  sessionId,
  extractionProfile = "generic_document",
  retentionDays = 30,
  maxItemsPerProfile = 500
}) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)

  await prisma.documentMemory.deleteMany({
    where: {
      sessionId,
      extractionProfile,
      updatedAt: {
        lt: cutoff
      }
    }
  })

  const items = await prisma.documentMemory.findMany({
    where: {
      sessionId,
      extractionProfile
    },
    orderBy: {
      updatedAt: "desc"
    }
  })

  if (items.length > maxItemsPerProfile) {
    const toDelete = items.slice(maxItemsPerProfile)

    await prisma.documentMemory.deleteMany({
      where: {
        id: {
          in: toDelete.map((item) => item.id)
        }
      }
    })
  }
}

async function saveDocumentMemory({
  sessionId,
  text,
  normalizedContent,
  extractionProfile = "generic_document",
  responseFormat = null,
  blocks = [],
  data = {},
  confidence = {},
  provenance = {},
  llmUsed = false,
  retentionDays = 30,
  maxItemsPerProfile = 500
}) {
  const fingerprintData = buildDocumentFingerprint({
    text: normalizedContent || text,
    extractionProfile,
    responseFormat
  })

  const saved = await prisma.documentMemory.upsert({
    where: {
      sessionId_extractionProfile_schemaSignature_documentFingerprint: {
        sessionId,
        extractionProfile,
        schemaSignature: fingerprintData.schemaSignature,
        documentFingerprint: fingerprintData.documentFingerprint
      }
    },
    update: {
      rawContent: text,
      normalizedContent: normalizedContent || text,
      blocks,
      extractedData: data,
      confidenceData: confidence,
      provenanceData: provenance,
      llmUsed
    },
    create: {
      sessionId,
      extractionProfile,
      schemaSignature: fingerprintData.schemaSignature,
      documentFingerprint: fingerprintData.documentFingerprint,
      contentHash: fingerprintData.contentHash,
      rawContent: text,
      normalizedContent: normalizedContent || text,
      blocks,
      extractedData: data,
      confidenceData: confidence,
      provenanceData: provenance,
      llmUsed
    }
  })

  await pruneDocumentMemory({
    sessionId,
    extractionProfile,
    retentionDays,
    maxItemsPerProfile
  })

  return saved
}

module.exports = {
  findExactDocumentMemory,
  findLatestDocumentMemoryByProfile,
  saveDocumentMemory
}