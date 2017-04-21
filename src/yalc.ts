#!/usr/bin/env node
import * as yargs from 'yargs'
import { join } from 'path'
import { myNameIs, publishPackage, addPackages, updatePackages, removePackages } from '.'

const cliCommand = myNameIs

console.log(`Work with npm/yarn local packages like a boss.\n`)
yargs
  .usage(cliCommand + '[command] [options] [package1 [package2...]]')  
  .command({
    command: 'publish',
    describe: 'Publish',
    builder: () => {
      return yargs
        .boolean(['push', 'knit', 'force', 'push-safe'])
    },
    handler: (argv) => {
      publishPackage({
        workingDir: join(process.cwd(), argv._[1] || ''),
        force: argv.force,
        knit: argv.knit,
        push: argv.push,
        pushSafe: argv.pushSafe
      })
    }
  })
  .command({
    command: 'push',
    describe: 'Push',
    builder: () => {
      return yargs
        .default('force', undefined)  
        .boolean(['knit', 'safe', 'force'])
    },
    handler: (argv) => {      
      publishPackage({
        workingDir: join(process.cwd(), argv._[1] || ''),
        force: argv.force !== undefined ? argv.force : true,
        knit: argv.knit,
        push: true,
        pushSafe: argv.safe
      })
    }
  })
  .command({
    command: 'add',
    describe: 'Add',
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
    command: 'link',
    describe: 'Link',
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
    command: ['*', 'update'],    
    describe: 'Update packages',
    builder: () => {
      return yargs
        .usage('Update usage here')
        .help(true)
    },
    handler: (argv) => {
      updatePackages(argv._.slice(1), {
        workingDir: process.cwd()
      })
    }
  }).argv
   