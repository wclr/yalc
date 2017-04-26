const ignore = require('ignore')
import * as fs from 'fs-extra'
import { join, relative } from 'path'
import {
  PackageManifest,
  getStorePackagesDir,
  values
} from '.'

const npmIncludeDefaults = [
  'package.json',
  'README.*',
  'CHANGES.*',
  'HISTORY.*',
  'LICENSE.*',
  'LICENCE.*',
  'NOTICE.*',
  'README',
  'CHANGES',
  'HISTORY',
  'LICENSE',
  'LICENCE',
  'NOTICE'
]

const npmIgnoreDefaults = [
  '.*.swp',
  '._*',
  '.DS_Store',
  '.git',
  '.hg',
  '.npmrc',
  '.lock-wscript',
  '.svn',
  '.wafpickle-*',
  'config.gypi',
  'CVS',
  'npm-debug.log',
  'node_modules'
]

const getIngoreFilesContent = (workingDir: string): string => {
  let content: string = ''
  const ignoreFiles = {
    npm: join(workingDir, '.npmignore'),
    yarn: join(workingDir, '.yarnignore'),
    git: join(workingDir, '.gitignore'),
  }
  if (fs.existsSync(ignoreFiles.npm)) {
    content += fs.readFileSync(ignoreFiles.npm, 'utf-8') + '\n'
  }
  if (fs.existsSync(ignoreFiles.yarn)) {
    content += fs.readFileSync(ignoreFiles.yarn, 'utf-8') + '\n'
  }
  if (!content.length && fs.existsSync(ignoreFiles.git)) {
    content += fs.readFileSync(ignoreFiles.git, 'utf-8')
  }
  return content
}

export const copyWithIgnorePackageToStore = async (pkg: PackageManifest, options: {
  knit?: boolean
  workingDir: string
}) => {
  const { workingDir } = options
  
  const ignoreRule = ignore()
    .add(npmIgnoreDefaults)
    .add(values.locedPackagesFolder)
    .add(getIngoreFilesContent(workingDir))

  const includeRule = pkg.files ? ignore()
    .add(npmIncludeDefaults)
    .add(pkg.files || []) : null

  const copyFromDir = options.workingDir
  const locPackageStoreDir = join(getStorePackagesDir(), pkg.name, pkg.version)
  const filesToKnit: string[] = []
  const copyFilter: fs.CopyFilter = (f) => {
    f = relative(copyFromDir, f)
    const ignores = ignoreRule.ignores(f)
      || (includeRule && !includeRule.ignores(f))      
    if (options.knit && !ignores) {
      filesToKnit.push(f)
    }
    return !f || !ignores
  }
  fs.removeSync(locPackageStoreDir)
  fs.copySync(copyFromDir, locPackageStoreDir, copyFilter)
  if (options.knit) {
    fs.removeSync(locPackageStoreDir)
    const ensureSymlinkSync = fs.ensureSymlinkSync as any
    filesToKnit.forEach(f => {
      const source = join(copyFromDir, f)
      if (fs.statSync(source).isDirectory()) {
        return
      }
      ensureSymlinkSync(
        source,
        join(locPackageStoreDir, f)
      )
    })
  }
}
