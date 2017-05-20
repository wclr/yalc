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
import {
  checkManifest
} from './check'


const cliCommand = values.myNameIs
// console.log(`Work with npm/yarn local packages like a boss.\n`)
yargs
  .usage(cliCommand + ' [command] [options] [package1 [package2...]]')
  .demand(1)
  .command({
    command: '*',
    handler: (argv) => {
      if (argv._[0]) {
        console.log('Unknown commmand', argv._[0],
          'use just `yalc` to see available commands.')        
      }      
    }
  })
  .command({
    command: 'publish',
    describe: 'Publish package in yalc local repo',
    builder: () => {
      return yargs
        .default('sig', true)  
        .boolean(['push', 'knit', 'force', 'push-safe', 'sig'])
    },
    handler: (argv) => {
      const folder = argv._[1]
      publishPackage({
        workingDir: join(process.cwd(), folder || ''),
        force: argv.force,
        knit: argv.knit,
        push: argv.push,
        pushSafe: argv.pushSafe,
        signature: argv.sig
      })
    }
  })
  .command({
    command: 'push',
    describe: 'Publish package in yalc local repo and push to all installactions',
    builder: () => {
      return yargs
        .default('force', undefined)
        .default('sig', true)
        .boolean(['knit', 'safe', 'force', 'sig'])
    },
    handler: (argv) => {
      publishPackage({
        workingDir: join(process.cwd(), argv._[1] || ''),
        force: argv.force !== undefined ? argv.force : true,
        knit: argv.knit,
        push: true,
        pushSafe: argv.safe,
        signature: argv.sig
      })
    }
  })
  .command({
    command: 'add',
    describe: 'Add package from yalc repo to the project',
    builder: () => {
      return yargs
        .default('yarn', false)
        .boolean(['file', 'dev', 'yarn'])
        .help(true)
    },
    handler: (argv) => {
      addPackages(argv._.slice(1), {
        dev: argv.dev,
        yarn: argv.yarn,
        workingDir: process.cwd()
      })
    }
  })
  .command({
    command: 'link ',
    describe: 'Link package from yalc repo to the project',
    builder: () => {
      return yargs
        .default('yarn', true)
        .help(true)
    },
    handler: (argv) => {
      addPackages(argv._.slice(1), {
        link: true,
        workingDir: process.cwd()
      })
    }
  })
  .command({
    command: ['update'],
    describe: 'Update packages from yalc repo',
    builder: () => {
      return yargs        
        .help(true)
    },
    handler: (argv) => {
      updatePackages(argv._.slice(1), {
        workingDir: process.cwd()
      })
    }
  })  
  .command({
    command: 'remove',
    describe: 'Remove packages from the project',
    builder: () => {
      return yargs          
        .boolean(['retreat', 'all'])
        .help(true)
    },
    handler: (argv) => {
      removePackages(argv._.slice(1), {
        retreat: argv.retreat,
        workingDir: process.cwd(),
        all: argv.all
      })
    }
  })
  .command({
    command: 'retreat',
    describe: 'Remove packages from project, but leave in lock file (to be restored later)',
    builder: () => {
      return yargs
        .help(true)
    },
    handler: (argv) => {
      removePackages(argv._.slice(1), {
        retreat: true,
        workingDir: process.cwd()
      })
    }
  })
  .command({
    command: 'check',
    describe: 'Check package.json for yalc packages',
    builder: () => {
      return yargs.boolean(['commit'])
        .usage('check usage here')
        .help(true)
    },
    handler: (argv) => {
      const gitParams = process.env.GIT_PARAMS
      if (argv.commit) {
        console.log('gitParams', gitParams)
      }
      const folder = argv._[1]
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
    handler: (argv) => {
      console.log(getStoreMainDir())
    }
  }) 
  .help('help')
  .argv
