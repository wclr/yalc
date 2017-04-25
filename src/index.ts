import { execSync } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { copyWithIgnorePackageToStore } from './copy'
import {
  PackageInstallation, InstallationsFile,
  readInstallationsFile,
  addInstallations,
  removeInstallations,
  PackageName
} from './installations'
import {
  readLockfile,
  addPackageToLockfile,
  LockFilePackageEntry
} from './lockfile'

const userHome = require('user-home')

const { join } = path

const ensureSymlinkSync = fs.ensureSymlinkSync as typeof fs.symlinkSync

export const values = {
  myNameIs: 'yalc',
  myNameIsCapitalized: 'Yalc',
  lockfileName: 'yalc.lock',
  locedPackagesFolder: '.yalc',
  installationsFile: 'installations.json'
}

export interface AddPackagesOptions {
  dev?: boolean,
  link?: boolean,
  yarn?: boolean,
  safe?: boolean
  workingDir: string,
}

export interface UpdatePackagesOptions {
  safe?: boolean,
  workingDir: string,
}

export { publishPackage } from './publish'
export { updatePackages } from './update'
export { checkManifest } from './check'
export { removePackages } from './remove'
export { addPackages } from './add'

export interface YalcGlobal extends NodeJS.Global {
  yalcStoreMainDir: string
}
export const yalcGlobal = global as YalcGlobal

export function getStoreMainDir(): string {
  if (yalcGlobal.yalcStoreMainDir) {    
    return yalcGlobal.yalcStoreMainDir
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, values.myNameIsCapitalized);
  }
  return join(userHome, '.' + values.myNameIs);
}

export function getStorePackagesDir(): string {
  return join(getStoreMainDir(), 'packages');
}

export const getPackageStoreDir = (packageName: string, version = '') =>
  path.join(getStorePackagesDir(), packageName, version)

export interface PackageManifest {
  name: string,
  version: string,
  dependencies?: { [name: string]: string },
  devDependencies?: { [name: string]: string },
  scripts?: {
    preinstall?: string,
    install?: string,
    prepublish?: string
    postpublish?: string
    preloc?: string
    postloc?: string
  }
}

export const getPackageManager = () =>
  execSync('yarn.lock') ? 'yarn' : 'npm'

export const execLoudOptions = { stdio: 'inherit' }

export const parsePackageName = (packageName: string) => {
  const match = packageName.match(/(^@[^/]+\/)?([^@]+)@?(.*)/) || []
  if (!match) {
    return { name: '' as PackageName, version: '' }
  }
  return { name: (match[1] || '') + match[2] as PackageName, version: match[3] || '' }
}
