const compareObjects = (obj1, obj2) => {
  // Get all keys from both objects
  const obj1Keys = Object.keys(obj1)
  const obj2Keys = Object.keys(obj2)

  // Check if both objects have the same number of keys
  if (obj1Keys.length !== obj2Keys.length) return false

  // Check if all values are equal
  for (let key of obj1Keys) {
    if (obj1[key] !== obj2[key]) {
      return false
    }
  }

  return true
}

const compareProduct = (obj1, obj2) => {
  if (
    typeof obj1 === 'object' &&
    typeof obj2 === 'object' &&
    obj1 !== null &&
    obj2 !== null
  ) {
    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)

    if (keys1.length !== keys2.length) {
      return false
    }

    for (let key of keys1) {
      if (!keys2.includes(key) || !compareProduct(obj1[key], obj2[key])) {
        return false
      }
    }

    return true
  }

  return obj1 === obj2
}

module.exports = {
  compareProduct,
  compareObjects
}
