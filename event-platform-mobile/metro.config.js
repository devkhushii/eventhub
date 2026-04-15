const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);

config.resolver = {
  ...config.resolver,
  alias: {
    ...config.resolver.alias,
    'utils': path.resolve(projectRoot, 'src/utils'),
    'api': path.resolve(projectRoot, 'src/api'),
    'services': path.resolve(projectRoot, 'src/services'),
    'contexts': path.resolve(projectRoot, 'src/contexts'),
    'components': path.resolve(projectRoot, 'src/components'),
    'screens': path.resolve(projectRoot, 'src/screens'),
    'navigation': path.resolve(projectRoot, 'src/navigation'),
    'styles': path.resolve(projectRoot, 'src/styles'),
  },
};

module.exports = config;