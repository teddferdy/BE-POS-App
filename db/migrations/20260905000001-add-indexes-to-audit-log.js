'use strict'

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addIndex('auditLog', {
      name: 'auditlog_store_entity_entityid',
      fields: ['store', 'entity', 'entityId']
    })
    await queryInterface.addIndex('auditLog', {
      name: 'auditlog_store_createdat',
      fields: ['store', 'createdAt']
    })
  },
  down: async (queryInterface) => {
    await queryInterface.removeIndex('auditLog', 'auditlog_store_entity_entityid')
    await queryInterface.removeIndex('auditLog', 'auditlog_store_createdat')
  }
}
