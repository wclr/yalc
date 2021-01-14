#!/usr/bin/env node
import yargs from 'yargs'
import { join, resolve } from 'path'
import { rcFile } from 'rc-config-loader'

import {
  values,
  publishPackage,
  addPackages,
  updatePackages,
  removePackages,
  getStoreMainDir,
  yalcGlobal,
} from '.'

import { showInstallations, cleanInstallations } from './installations'

import { checkManifest } from './check'
import { makeConsoleColored, disabledConsoleOutput } from './console'
import { PublishPackageOptions } from './publish'
import { readRcConfig } from './rc'

const updateFlags = ['update', 'upgrade', 'up']

const publishFlags = ['sig', 'dev-mod', 'changed', 'files', ...updateFlags]

const cliCommand = values.myNameIs

const getVersionMessage = () => {
  const pkg = require(__dirname + '/../package.json')
  return pkg.version
}

makeConsoleColored()

const rcArgs = readRcConfig()

if (process.argv.includes('--quiet') || rcArgs.quiet) {
  disabledConsoleOutput()
}

const getPublishOptions = (
  argv: any,
  override: Partial<PublishPackageOptions> = {}
): PublishPackageOptions => {
  const folder = argv._[1]
  return {
    workingDir: join(process.cwd(), folder || ''),
    push: argv.push,
    replace: argv.replace,
    signature: argv.sig,
    changed: argv.changed,
    files: argv.files,
    private: argv.private,
    scripts: argv.scripts,
    update: argv.update || argv.upgrade,
    workspaceResolve: argv.workspaceResolve,
    devMod: argv.devMod,
    ...override,
  }
}

/* tslint:disable-next-line */
yargs
  .usage(cliCommand + ' [command] [options] [package1 [package2...]]')
  .coerce('store-folder', function (folder: string) {
    if (!yalcGlobal.yalcStoreMainDir) {
      yalcGlobal.yalcStoreMainDir = resolve(folder)
      console.log('Package store folder used:', yalcGlobal.yalcStoreMainDir)
    }
  })
  .command({
    command: '*',
    builder: () => {
      return yargs.boolean(['version'])
    },
    handler: (argv) => {
      let msg = 'Use `yalc help` to see available commands.'
      if (argv._[0]) {
        msg = 'Unknown command `' + argv._[0] + '`. ' + msg
      } else {
        if (argv.version) {
          msg = getVersionMessage()
        }
      }
      console.log(msg)
    },
  })
  .command({
    command: 'publish',
    describe: 'Publish package in yalc local repo',
    builder: () => {
      return yargs
        .default('sig', true)
        .default('scripts', true)
        .default('dev-mod', true)
        .default('workspace-resolve', true)
        .default(rcArgs)
        .alias('script', 'scripts')
        .boolean(['push'].concat(publishFlags))
    },
    handler: (argv) => {
      return publishPackage(getPublishOptions(argv))
    },
  })
  .command({
    command: 'push',
    describe:
      'Publish package in yalc local repo and push to all installations',
    builder: () => {
      return yargs
        .default('force', undefined)
        .default('sig', true)
        .default('scripts', true)
        .default('dev-mod', true)
        .default('workspace-resolve', true)
        .default(rcArgs)
        .alias('script', 'scripts')
        .boolean(['safe'].concat(publishFlags))
        .option('replace', { describe: 'Force package content replacement' })
    },
    handler: (argv) => {
      return publishPackage(getPublishOptions(argv, { push: true }))
    },
  })
  .command({
    command: 'installations',
    describe: 'Work with installations file: show/clean',
    builder: () => {
      return yargs.boolean(['dry'])
    },
    handler: async (argv) => {
      const action = argv._[1]
      const packages = argv._.slice(2)
      switch (action) {
        case 'show':
          showInstallations({ packages })
          break
        case 'clean':
          await cleanInstallations({ packages, dry: argv.dry })
          break
        default:
          console.info('Need installation action: show | clean')
      }
    },
  })
  .command({
    command: 'add',
    describe: 'Add package from yalc repo to the project',
    builder: () => {
      return yargs
        .boolean(['file', 'dev', 'link', ...updateFlags])
        .alias('D', 'dev')
        .boolean('-W')
        .alias('save-dev', 'dev')
        .default(rcArgs)
        .help(true)
    },
    handler: (argv) => {
      const pure = argv.W ? false : argv.pure
      return addPackages(argv._.slice(1), {
        dev: argv.dev,
        linkDep: argv.link,
        pure,
        update: argv.update || argv.upgrade,
        workingDir: process.cwd(),
      })
    },
  })
  .command({
    command: 'link',
    describe: 'Link package from yalc repo to the project',
    builder: () => {
      return yargs.default(rcArgs).help(true)
    },
    handler: (argv) => {
      return addPackages(argv._.slice(1), {
        link: true,
        pure: argv.pure,
        workingDir: process.cwd(),
      })
    },
  })
  .command({
    command: 'update',
    describe: 'Update packages from yalc repo',
    builder: () => {
      return yargs
        .boolean([...updateFlags])
        .default(rcArgs)
        .help(true)
    },
    handler: (argv) => {
      return updatePackages(argv._.slice(1), {
        update: argv.update || argv.upgrade,
        workingDir: process.cwd(),
      })
    },
  })
  .command({
    command: 'remove',
    describe: 'Remove packages from the project',
    builder: () => {
      return yargs.boolean(['retreat', 'all']).default(rcArgs).help(true)
    },
    handler: (argv) => {
      return removePackages(argv._.slice(1), {
        retreat: argv.retreat,
        workingDir: process.cwd(),
        all: argv.all,
      })
    },
  })
  .command({
    command: 'retreat',
    describe:
      'Remove packages from project, but leave in lock file (to be restored later)',
    builder: () => {
      return yargs.boolean(['all']).help(true)
    },
    handler: (argv) => {
      return removePackages(argv._.slice(1), {
        all: argv.all,
        retreat: true,
        workingDir: process.cwd(),
      })
    },
  })
  .command({
    command: 'check',
    describe: 'Check package.json for yalc packages',
    builder: () => {
      return yargs.boolean(['commit']).usage('check usage here').help(true)
    },
    handler: (argv) => {
      const gitParams = process.env.GIT_PARAMS
      if (argv.commit) {
        console.log('gitParams', gitParams)
      }
      checkManifest({
        commit: argv.commit,
        all: argv.all,
        workingDir: process.cwd(),
      })
    },
  })
  .command({
    command: 'dir',
    describe: 'Show yalc system directory',
    handler: () => {
      console.log(getStoreMainDir())
    },
  })
  .help('help').argv
