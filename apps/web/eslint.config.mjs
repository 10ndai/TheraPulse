import rootConfig from '../../eslint.config.mjs';

export default [
  // Ignore Next.js generated declaration files
  { ignores: ['next-env.d.ts'] },
  ...rootConfig,
];
