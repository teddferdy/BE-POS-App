require('dotenv').config({ path: __dirname + '/../.env' })
process.env.NODE_ENV = 'production'

const path = require('path')
const fs = require('fs')
const db = require('../db/models')

async function runSeeders() {
  console.log('🌱 Running all seeders on PRODUCTION...\n')

  try {
    await db.sequelize.authenticate()
    console.log('✅ Connected to database!\n')

    const seedersDir = path.join(__dirname, '..', 'db', 'seeders')
    const seederFiles = fs.readdirSync(seedersDir)
      .filter(f => f.endsWith('.js'))
      .sort()

    // Fix order: tables seeder needs location from simulation admin seeder
    const reordered = [...seederFiles]
    let simulationIdx = -1
    let tablesIdx = -1
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].includes('create-simulation')) simulationIdx = i
      if (reordered[i].includes('default-tables-and-discounts')) tablesIdx = i
    }
    if (simulationIdx >= 0 && tablesIdx >= 0 && simulationIdx > tablesIdx) {
      const [simFile] = reordered.splice(simulationIdx, 1)
      reordered.splice(tablesIdx, 0, simFile)
    }

    console.log(`📋 Found ${reordered.length} seeder files:\n`)

    for (const file of reordered) {
      const seeder = require(path.join(seedersDir, file))
      console.log(`▶ Running: ${file}`)
      try {
        await seeder.up(db.sequelize.getQueryInterface(), db.Sequelize)
        console.log(`✅ Done: ${file}\n`)
      } catch (err) {
        console.error(`❌ Failed: ${file} — ${err.message}\n`)
      }
    }

    console.log('🎉 All seeders completed!')
  } catch (error) {
    console.error('❌ Seeder runner failed:', error.message)
    process.exit(1)
  } finally {
    await db.sequelize.close()
  }
}

runSeeders()
