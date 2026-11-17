import recommendedIncremental from 'eslint-config-agent/recommended-incremental'

export default [
  ...recommendedIncremental,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
]
