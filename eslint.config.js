import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import prettierConfig from 'eslint-config-prettier'
//import googleConfig from "eslint-config-google";
import importPlugin from "eslint-plugin-import";
//import jsdoc from "eslint-plugin-jsdoc";

export default [
  // Apply Google style config so tools won't miss eslint-config-google
 // googleConfig,
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      '@typescript-eslint': tseslint,
      import: importPlugin,
  //    jsdoc: jsdoc,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      },
    },
    settings: {
    },
    rules: {
      // Disable the old, removed valid-jsdoc rule from googleConfig
      'valid-jsdoc': 'off', // <--- Add this line
      'require-jsdoc': 'off', // <--- Add this line to disable require-jsdoc

      // Use the recommended rules from eslint-plugin-jsdoc
  //    ...jsdoc.configs['recommended'].rules,
      'require-jsdoc': 'off',
      'jsdoc/require-jsdoc': ['off', {
        require: {
          FunctionDeclaration: false,
          MethodDefinition: false,
          ClassDeclaration: false,
          ArrowFunctionExpression: false,
          FunctionExpression: false
        }
      }],
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
      'jsdoc/require-description': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/no-types': 'off',
      'jsdoc/check-alignment': 'off',
      'jsdoc/check-indentation': 'off',
      // Standard style guide rules
      'no-unused-vars': 'warn', // Turn off base rule
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-console': 'warn',
      'no-var': 'warn',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-const': 'warn',
      'no-shadow': 'off', // Turn off base rule for TS version
      '@typescript-eslint/no-shadow': 'error',

      // TypeScript specific rules
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/prefer-as-const': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'warn',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/member-ordering': [
        'warn',
        {
          default: [
            'signature',
            'field',
            'constructor',
            'method'
          ]
        }
      ],
      '@typescript-eslint/prefer-readonly': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'warn',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'warn',
      '@typescript-eslint/prefer-regexp-exec': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',

      // Disable some rules that conflict with Standard
      'no-undef': 'off', // TypeScript handles this
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'error',

      // Additional code quality rules
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
    }
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.mastra/**',
      'eslint.config.js',
      'vitest.config.ts',
      'globalSetup.ts',
      'testSetup.ts',
      'vite.config.ts',
      '.genkit/**',
      '.github/**',
      '.gemini/**',
      'plans/**',
      'chroma/**',
      '.github/prompts/*.md',
      '.github/instructions/*.md',
      '.github/workflows/*.yml',
      '.github/*.md',
      'memory-bank/**',
      'tasks/**',
      '.gemini/**',
      '.github/workflows/*.yml',
      'scripts/**',
    ]
  }
]