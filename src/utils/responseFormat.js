function stableSortObject(value) {
  if (Array.isArray(value)) {
    return value.map(stableSortObject)
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = stableSortObject(value[key])
        return acc
      }, {})
  }

  return value
}

function serializeResponseFormat(responseFormat) {
  if (!responseFormat) return ""

  return JSON.stringify(stableSortObject(responseFormat))
}

module.exports = {
  serializeResponseFormat
}