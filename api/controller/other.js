/* eslint-disable no-unused-vars */
/* eslint-disable no-unsafe-finally */

// get List Years
exports.getListYears = async (req, res, next) => {
  try {
    const arrDataList = []
    const currentYear = new Date().getFullYear()

    // Plus Year Now
    for (let index = 0; index < 5; index++) {
      arrDataList.push(currentYear + index)
    }

    // Minus Year Now
    for (let index = 5; index > 1; index--) {
      arrDataList.push(currentYear - index)
    }

    const newFormat = arrDataList.sort()

    return res.status(200).json({
      message: 'Success',
      data: newFormat
    })
  } catch (error) {
    console.log('Error =>', error)
    return res.status(500).json({
      error: 'Terjadi Kesalahan Internal Server'
    })
  } finally {
    console.log('resEND')
    return res.end()
  }
}
