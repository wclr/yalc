#!/usr/bin/env node
import * as yargs from 'yargs'
import { myNameIs, publishPackage, addPackages, updatePackages, removePackages } from '.'

const cliCommand = myNameIs

console.log(`Loc npm/yarn packages like a boss.\n`)
yargs
  .usage(cliCommand + '[command] [options] [package1 [package2...]]')
  .command({
    command: 'publish',
    describe: 'Publish',
    builder: () => {
      return yargs.help(true)
    },
    handler: (argv) => {
      publishPackage({
        workingDir: process.cwd(),
        force: argv.knit,
        knit: argv.knit,
        push: argv.knit,
        pushSafe: argv.knit
      })
    }
  })
  .command({
    command: 'add',
    describe: 'Add',
    builder: () => {
      return yargs
        .usage('Add usage here')
        .boolean(['file', 'dev'])
        .help(true)
    },
    handler: (argv) => {
      addPackages(argv._.slice(1), {
        dev: argv.dev,
        file: argv.file,
        workingDir: process.cwd()
      })
    }
  })
  .command({
    command: 'update',
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
  })
  // .describe('force', 'Skips executing `preloc` and `postloc` scripts')
  // .describe('empty', 'Cleans up destignation directory before copying')
  // .boolean('empty')
  // .example(cliCommand + ' --skip-scripts', '- packs and puts to yknit store ' +
  // 'current folder package without running `pre` and `post` scripts ')
  // .example(cliCommand + ' my-module', '- copies `my-module` from yknit store')
  // .example(cliCommand + ' --empty mongoose express', '- empty destignation directory before and copies two modules')
  .help(true)
  .argv

