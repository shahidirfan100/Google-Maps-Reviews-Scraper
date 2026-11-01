import apifyEslintConfig from '@apify/eslint-config';
import prettier from 'eslint-config-prettier';

export default [{ ignores: ['eslint.config.mjs', 'node_modules', 'storage'] }, ...apifyEslintConfig, prettier];
