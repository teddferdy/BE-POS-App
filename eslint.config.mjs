export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.wwebjs_auth*/**',
      '**/.wwebjs_auth_default*/**'
    ]
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        console: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        JSON: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        Boolean: 'readonly',
        Error: 'readonly',
        TypeError: 'readonly',
        RegExp: 'readonly',
        Map: 'readonly',
        Set: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'no-unsafe-finally': 'warn',
      'no-console': 'off'
    }
  },
  {
    // Sequelize CLI passes (queryInterface, Sequelize) even when unused
    files: ['db/migrations/**', 'db/seeders/**'],
    rules: {
      'no-unused-vars': 'off'
    }
  }
]