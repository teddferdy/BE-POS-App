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

module.exports = compareObjects
