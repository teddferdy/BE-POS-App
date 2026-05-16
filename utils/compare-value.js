const compareObjects = (obj1, obj2) => {
  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) {
    return false
  }

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false
    }
  }

  return true
}

const compareProduct = (newData, existingData) => {
  if (newData.name !== existingData.name) {
    return false
  }
  if (newData.category !== existingData.category) {
    return false
  }
  if (newData.subCategory !== existingData.subCategory) {
    return false
  }
  if (newData.store !== existingData.store) {
    return false
  }
  return true
}

module.exports = {
  compareObjects,
  compareProduct
}