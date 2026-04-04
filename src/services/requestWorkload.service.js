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

  if (routeKey.includes("/chat")) {
    if (responseFormat?.type === "json_schema") {
      return {
        category: "heavy",
        reason: "json_schema_request",
        contentLength,
        extractionProfile
      }
    }

    if (contentLength > 12000) {
      return {
        category: "heavy",
        reason: "large_content",
        contentLength,
        extractionProfile
      }
    }

    if (contentLength > 4000) {
      return {
        category: "medium",
        reason: "medium_content",
        contentLength,
        extractionProfile
      }
    }

    return {
      category: "light",
      reason: "standard_chat",
      contentLength,
      extractionProfile
    }
  }

  return {
    category: "light",
    reason: "default",
    contentLength,
    extractionProfile
  }
}

module.exports = {
  classifyWorkload
}