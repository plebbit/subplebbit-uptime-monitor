export const fetchMultisubUrl = async (multisubUrl) => {
  let textResponse
  try {
    console.log(`fetching multisub url '${multisubUrl}'`)
    textResponse = await fetch(multisubUrl).then((res) => res.text())
    try {
      const multisub = JSON.parse(textResponse)
      if (!Array.isArray(multisub.subplebbits)) {
        throw Error(`failed fetching multisub from url '${multisubUrl}' got response '${textResponse.substring(0, 400)}'`)
      }
      return multisub
    }
    catch (e) {
      try {
        textResponse = stripHtml(textResponse).result
      }
      catch (e) {}
      throw Error(`failed fetching multisub from url '${multisubUrl}' got response '${textResponse.substring(0, 400)}'`)
    }
  } 
  catch (e) {
    throw Error(`failed fetching multisub from url '${multisubUrl}': ${e.message}`)
  }
}
