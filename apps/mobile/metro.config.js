// Metro dans un monorepo pnpm : il faut lui dire de surveiller la racine et d'y
// chercher les modules, sinon les packages @rack/* et les dépendances hissées
// sont introuvables.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm utilise des liens symboliques : Metro doit les suivre sans les dédupliquer.
config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
