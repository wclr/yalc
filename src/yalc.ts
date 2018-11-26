#!/usr/bin/env node
import * as yargs from 'yargs'
import { join } from 'path'
import {
  values,
  publishPackage,
  addPackages,
  updatePackages,
  removePackages,
  getStoreMainDir
} from '.'

import { showInstallations, cleanInstallations } from './installations'

import { checkManifest } from './check'

const cliCommand = values.myNameIs

// tslint:disable-next-line:no-unused-expression
yargs
  .usage(cliCommand + ' [command] [options] [package1 [package2...]]')
  .command({
    command: '*',
    handler: argv => {
      let msg = 'Use `yalc help` to see available commands.'
      if (argv._[0]) {
        msg = 'Unknown commmand `' + argv._[0] + '`. ' + msg
      }
      console.log(msg)
    }
  })
  .command({
    command: 'publish',
    describe: 'Publish package in yalc local repo',
    builder: () => {
      return yargs
        .default('sig', true)
        .boolean(['push', 'knit', 'force', 'push-safe', 'sig', 'changed', 'yarn'])
    },
    handler: argv => {
      const folder = argv._[1]
      return publishPackage({
        workingDir: join(process.cwd(), folder || ''),
        force: argv.force,
        knit: argv.knit,
        push: argv.push,
        pushSafe: argv.pushSafe,
        signature: argv.sig,
        yarn: argv.yarn,
        changed: argv.changed
      })
    }
  })
  .command({
    command: 'installations',
    builder: () => {
      return yargs.boolean(['dry'])
    },
    handler: async argv => {
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
          console.log('Need installation action: show | clean')
      }
    }
  })
  .command({
    command: 'push',
    describe:
      'Publish package in yalc local repo and push to all installations',
    builder: () => {
      return yargs
        .default('force', undefined)
        .default('sig', true)
        .boolean(['knit', 'safe', 'force', 'sig', 'changed', 'yarn'])
    },
    handler: argv => {
      return publishPackage({
        workingDir: join(process.cwd(), argv._[1] || ''),
        force: argv.force !== undefined ? argv.force : true,
        knit: argv.knit,
        push: true,
        pushSafe: argv.safe,
        signature: argv.sig,
        yarn: argv.yarn,
        changed: argv.changed
      })
    }
  })
  .command({
    command: 'add',
    describe: 'Add package from yalc repo to the project',
    builder: () => {
      return yargs
        .default('yarn', false)
        .boolean(['file', 'dev', 'save-dev', 'link', 'yarn', 'pure'])
        .help(true)
    },
    handler: argv => {
      const hasPureArg = process.argv.reduce(
        (res, arg) => res || /-pure/.test(arg),
        false
      )
      return addPackages(argv._.slice(1), {
        dev: argv.dev || argv.saveDev,
        yarn: argv.yarn,
        linkDep: argv.link,
        pure: hasPureArg ? argv.pure : undefined,
        workingDir: process.cwd()
      })
    }
  })
  .command({
    command: 'link',
    describe: 'Link package from yalc repo to the project',
    builder: () => {
      return yargs.default('yarn', true).help(true)
    },
    handler: argv => {
      return addPackages(argv._.slice(1), {
        link: true,
        workingDir: process.cwd()
      })
    }
  })
  .command({
    command: 'update',
    describe: 'Update packages from yalc repo',
    builder: () => {
      return yargs.help(true)
    },
    handler: argv => {
      return updatePackages(argv._.slice(1), {
        workingDir: process.cwd()
      })
    }
  })
  .command({
    command: 'remove',
    describe: 'Remove packages from the project',
    builder: () => {
      return yargs.boolean(['retreat', 'all']).help(true)
    },
    handler: argv => {
      return removePackages(argv._.slice(1), {
        retreat: argv.retreat,
        workingDir: process.cwd(),
        all: argv.all
      })
    }
  })
  .command({
    command: 'retreat',
    describe:
      'Remove packages from project, but leave in lock file (to be restored later)',
    builder: () => {
      return yargs.boolean(['all']).help(true)
    },
    handler: argv => {
      return removePackages(argv._.slice(1), {
        all: argv.all,
        retreat: true,
        workingDir: process.cwd()
      })
    }
  })
  .command({
    command: 'check',
    describe: 'Check package.json for yalc packages',
    builder: () => {
      return yargs
        .boolean(['commit'])
        .usage('check usage here')
        .help(true)
    },
    handler: argv => {
      const gitParams = process.env.GIT_PARAMS
      if (argv.commit) {
        console.log('gitParams', gitParams)
      }
      checkManifest({
        commit: argv.commit,
        all: argv.all,
        workingDir: process.cwd()
      })
    }
  })
  .command({
    command: 'dir',
    describe: 'Show yalc system directory',
    handler: () => {
      console.log(getStoreMainDir())
    }
  })
  .help('help').argv
