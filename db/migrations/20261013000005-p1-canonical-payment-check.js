'use strict'

// PAYMENT P1 Register & Settlement Attribution — M3 canonical payment CHECK.
//
// Restricts NEW transaction.typePayment writes to the locked canonical set
// (DR-PAY-ATTR-06): CASH, CARD, BANK_TRANSFER, E_WALLET, QRIS, POINTS, OTHER.
//
// The constraint is introduced NOT VALID:
// - historical rows (cash, tunai, banknote, debit, QRIS display strings,
//   type ids, free text) are NOT validated, NOT rewritten, NOT destroyed;
// - every row inserted or updated AFTER the migration must carry a canonical
//   value — legacy aliases on new writes fail instead of leaking into the
//   drawer classification.
// The column type stays VARCHAR (no PostgreSQL ENUM): the method set evolves
// and ENUM values are effectively irreversible (see the refunded-value
// migration precedent). Application-side write refusal and read
// normalization arrive in the later application phase; this migration only
// provides the DB backstop. Validation (VALIDATE CONSTRAINT) is M6 and is
// NOT run here — only after historical reconciliation is complete.

const CANONICAL = ['CASH', 'CARD', 'BANK_TRANSFER', 'E_WALLET', 'QRIS', 'POINTS', 'OTHER']
const CONSTRAINT = 'transaction_typepayment_canonical'

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${CONSTRAINT}') THEN
           ALTER TABLE "transaction" ADD CONSTRAINT "${CONSTRAINT}"
           CHECK ("typePayment" IN (${CANONICAL.map((m) => `'${m}'`).join(', ')})) NOT VALID;
         END IF;
       END $$;`
    )
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(
      `ALTER TABLE "transaction" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`
    )
  }
}

module.exports.CANONICAL_METHODS = CANONICAL
module.exports.CONSTRAINT_NAME = CONSTRAINT
