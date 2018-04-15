import { execSync } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { copyPackageToStore } from './copy'
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
  yalcPackagesFolder: '.yalc',
  prescript: 'preyalc',
  postscript: 'postyalc',
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
  files: string[],
  dependencies?: { [name: string]: string },
  devDependencies?: { [name: string]: string },
  scripts?: {
    preinstall?: string,
    install?: string,
    prepublish?: string
    prepublishOnly?: string
    postpublish?: string
    preyalc?: string
    postyalc?: string
  },
  __JSONSpaces: number
}

export const getPackageManager = (workingDir: string) =>
  fs.existsSync('yarn.lock') ? 'yarn' : 'npm'

export const execLoudOptions = { stdio: 'inherit' }

export const parsePackageName = (packageName: string) => {
  const match = packageName.match(/(^@[^/]+\/)?([^@]+)@?(.*)/) || []
  if (!match) {
    return { name: '' as PackageName, version: '' }
  }
  return { name: (match[1] || '') + match[2] as PackageName, version: match[3] || '' }
}

const getJSONSpaces = (jsonStr: string) => {
  let match = jsonStr.match(/^[^{]*{.*\n([ ]+?)\S/)
  return match && match[1] ? match[1].length : null
}

export function readPackageManifest(workingDir: string) {
  let pkg: PackageManifest
  const packagePath = join(workingDir, 'package.json')
  try {
    const fileData = fs.readFileSync(
      packagePath, 'utf-8')
    pkg = JSON.parse(fileData) as PackageManifest
    if (!pkg.name && pkg.version) {
      console.log('Package manifest', packagePath, 'should contain name and version.')
      return null
    }
    const formatSpaces = getJSONSpaces(fileData) || 2
    if (!formatSpaces) {

      console.log('Could not get JSON formatting for', packagePath, 'using 2')
    }
    pkg.__JSONSpaces = formatSpaces
    return pkg
  } catch (e) {
    console.error('Could not read', packagePath)
    return null
  }
}

const signatureFileName = 'yalc.sig'

export function readSignatureFile(workingDir: string) {
  let pkg: PackageManifest
  const signatureFilePath = join(workingDir, signatureFileName)
  try {
    const fileData = fs.readFileSync(signatureFilePath, 'utf-8')
    return fileData
  } catch (e) {    
    return ''
  }
}

export function writeSignatureFile(workingDir: string, signature: string) {
  let pkg: PackageManifest
  const signatureFilePath = join(workingDir, signatureFileName)
  try {
    fs.writeFileSync(signatureFilePath, signature)    
  } catch (e) {    
    console.log('Could not write signature file')
    throw e
  }
}


const sortDependencies = (dependencies: { [name: string]: string }) => {
  return Object.keys(dependencies).sort().reduce((deps, key) =>
    Object.assign(deps, { [key]: dependencies[key] })
    , {})
}

export function writePackageManifest(workingDir: string, pkg: PackageManifest) {
  pkg = Object.assign({}, pkg)
  if (pkg.dependencies) {
    pkg.dependencies = sortDependencies(pkg.dependencies)
  }
  if (pkg.devDependencies) {
    pkg.devDependencies = sortDependencies(pkg.devDependencies)
  }
  const formatSpaces = pkg.__JSONSpaces
  delete pkg.__JSONSpaces
  const packagePath = join(workingDir, 'package.json')
  try {
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, formatSpaces) + '\n')
  } catch (e) {
    console.error('Could not write ', packagePath)
  }
}

