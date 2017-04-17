#!/usr/bin/env node
import * as yargs from 'yargs'
import { myNameIs, publishPackage, addPackages } from '.'

const cliCommand = myNameIs

console.log(`Fuck local npm/yarn packages like a boss.\n`)
yargs
  .usage(cliCommand + '[command] [options] [package1 [package2...]]')
  .command({
    command: 'publish',
    describe: 'Publish',
    handler: (argv) => {
      publishPackage({
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
    handler: (argv) => {
      addPackages(argv._.slice(1))
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

