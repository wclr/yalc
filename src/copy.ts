import { symlink } from 'fs';
const ignore = require('ignore')
import * as fs from 'fs-extra'
import * as path from 'path'
import {
  PackageManifest,
  getStoreDir,
  locedPackagesFolder
} from '.'

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

const getIngoreFilesContent = (): string => {
  let content: string = ''
  if (fs.existsSync('.npmignore')) {
    content += fs.readFileSync('.npmignore', 'utf-8') + '\n'
  }
  if (fs.existsSync('.yarnignore')) {
    content += fs.readFileSync('.npmignore', 'utf-8') + '\n'
  }
  if (content.length === 0 && fs.existsSync('.gitignore')) {
    content += fs.readFileSync('.gitignore', 'utf-8')
  }
  return content
}

export const copyWithIgnorePackageToStore = async (pkg: PackageManifest, knit?: boolean) => {  
  const knitIgnore = ignore()
    .add(npmIgnoreDefaults)
    .add(locedPackagesFolder)
    .add(getIngoreFilesContent())  
  const copyFromDir = process.cwd()
  const locPackageStoreDir = path.join(getStoreDir(), pkg.name, pkg.version)
  const filesToKnit: string[] = []
  const copyFilter: fs.CopyFilter = (f) => {
    f = path.relative(copyFromDir, f)    
    const ignores = knitIgnore.ignores(f)    
    if (knit && !ignores) {
      filesToKnit.push(f)
    }
    return !f || !ignores
  }  
  fs.removeSync(locPackageStoreDir)
  fs.copySync(copyFromDir, locPackageStoreDir, copyFilter)  
  if (knit) {    
    fs.removeSync(locPackageStoreDir)
    const ensureSymlinkSync = fs.ensureSymlinkSync as any
    filesToKnit.forEach(f => {      
      const source = path.join(copyFromDir, f)
      if (fs.statSync(source).isDirectory()) {
        return
      }
      ensureSymlinkSync(
        source,
        path.join(locPackageStoreDir, f)
      )
    })
  }
}
