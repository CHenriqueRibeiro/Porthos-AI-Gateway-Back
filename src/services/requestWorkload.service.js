function getLastUserContent(messages = []) {
  return [...messages]
    .reverse()
    .find((msg) => msg && msg.role === "user" && typeof msg.content === "string")
    ?.content || ""
}

function classifyWorkload({
  routeKey = "",
  body = {}
}) {
  const content =
    typeof body.content === "string"
      ? body.content
      : getLastUserContent(body.messages || [])

  const contentLength = String(content || "").length
  const responseFormat = body.response_format || body.responseFormat || null
  const extractionProfile = body.extraction_profile || body.extractionProfile || null
  const attachments = Array.isArray(body.attachments) ? body.attachments : []
  const attachmentTextLength = attachments.reduce((sum, item) => {
    if (!item || typeof item !== "object") return sum

    const text = item.extractedText || item.text || item.content || ""
    return sum + (typeof text === "string" ? text.length : 0)
  }, 0)
  const attachmentBytes = attachments.reduce((sum, item) => {
    if (!item || typeof item !== "object") return sum
    return sum + Number(item.sizeBytes || item.size_bytes || 0)
  }, 0)
  const totalContentLength = contentLength + attachmentTextLength

  if (routeKey.includes("/chat")) {
    if (responseFormat?.type === "json_schema" || attachments.length > 0) {
      return {
        category: "heavy",
        reason: attachments.length > 0 ? "attachment_request" : "json_schema_request",
        contentLength: totalContentLength,
        attachmentCount: attachments.length,
        attachmentBytes,
        extractionProfile
      }
    }

    if (totalContentLength > 12000) {
      return {
        category: "heavy",
        reason: "large_content",
        contentLength: totalContentLength,
        attachmentCount: attachments.length,
        attachmentBytes,
        extractionProfile
      }
    }

    if (totalContentLength > 4000) {
      return {
        category: "medium",
        reason: "medium_content",
        contentLength: totalContentLength,
        attachmentCount: attachments.length,
        attachmentBytes,
        extractionProfile
      }
    }

    return {
      category: "light",
      reason: "standard_chat",
      contentLength: totalContentLength,
      attachmentCount: attachments.length,
      attachmentBytes,
      extractionProfile
    }
  }

  return {
    category: "light",
    reason: "default",
    contentLength: totalContentLength,
    attachmentCount: attachments.length,
    attachmentBytes,
    extractionProfile
  }
}

module.exports = {
  classifyWorkload
}
