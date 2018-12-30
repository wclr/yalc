import * as fs from 'fs-extra'
import { homedir } from 'os'
import * as path from 'path'
import { PackageName } from './installations'

const { join } = path

export const values = {
  myNameIs: 'yalc',
  ignoreFileName: '.yalcignore',
  myNameIsCapitalized: 'Yalc',
  lockfileName: 'yalc.lock',
  yalcPackagesFolder: '.yalc',
  prescript: 'preyalc',
  postscript: 'postyalc',
  installationsFile: 'installations.json'
}

export interface AddPackagesOptions {
  dev?: boolean
  link?: boolean
  yarn?: boolean
  safe?: boolean
  workingDir: string
}

export interface UpdatePackagesOptions {
  safe?: boolean
  workingDir: string
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
    return join(process.env.LOCALAPPDATA, values.myNameIsCapitalized)
  }
  return join(homedir(), '.' + values.myNameIs)
}

export function getStorePackagesDir(): string {
  return join(getStoreMainDir(), 'packages')
}

export const getPackageStoreDir = (packageName: string, version = '') =>
  join(getStorePackagesDir(), packageName, version)

export type PackageScripts = Partial<{
  preinstall: string
  postupdate: string
  postpush: string
  prepare: string
  install: string
  prepublish: string
  prepublishOnly: string
  postpublish: string
  preyalc: string
  postyalc: string
}>

export interface PackageManifest {
  name: string
  version: string
  private?: boolean
  bin?: string | { [name: string]: string }
  dependencies?: { [name: string]: string }
  devDependencies?: { [name: string]: string }
  workspaces?: string[]
  scripts?: PackageScripts
  __JSONSpaces: number
}

export const getPackageManager = (cwd: string) =>
  fs.existsSync(join(cwd, 'yarn.lock')) ? 'yarn' : 'npm'

export const execLoudOptions = { stdio: 'inherit' }

export const parsePackageName = (packageName: string) => {
  const match = packageName.match(/(^@[^/]+\/)?([^@]+)@?(.*)/) || []
  if (!match) {
    return { name: '' as PackageName, version: '' }
  }
  return {
    name: ((match[1] || '') + match[2]) as PackageName,
    version: match[3] || ''
  }
}

const getJSONSpaces = (jsonStr: string) => {
  let match = jsonStr.match(/^[^{]*{.*\n([ ]+?)\S/)
  return match && match[1] ? match[1].length : null
}

export function findPackage(workingDir: string) {
  let dir = path.resolve(workingDir)
  while (true) {
    const pkg = join(dir, 'package.json')
    if (fs.existsSync(pkg)) return dir
    if (dir === '/') return null
    dir = path.dirname(dir)
  }
}

export function readPackage(packageDir: string) {
  let pkg: PackageManifest
  const manifestPath = join(packageDir, 'package.json')
  try {
    const fileData = fs.readFileSync(manifestPath, 'utf-8')
    pkg = JSON.parse(fileData) as PackageManifest
    if (!pkg.name && pkg.version) {
      console.log(
        'Package manifest',
        manifestPath,
        'should contain name and version.'
      )
      return null
    }
    const formatSpaces = getJSONSpaces(fileData) || 2
    if (!formatSpaces) {
      console.log('Could not get JSON formatting for', manifestPath, 'using 2')
    }
    pkg.__JSONSpaces = formatSpaces
    return pkg
  } catch (e) {
    console.error('Could not read', manifestPath)
    return null
  }
}

const signatureFileName = 'yalc.sig'

export const readSignatureFile = (workingDir: string) => {
  const signatureFilePath = join(workingDir, signatureFileName)
  try {
    const fileData = fs.readFileSync(signatureFilePath, 'utf-8')
    return fileData
  } catch (e) {
    return ''
  }
}

export const readIgnoreFile = (workingDir: string) => {
  const filePath = join(workingDir, values.ignoreFileName)
  try {
    const fileData = fs.readFileSync(filePath, 'utf-8')
    return fileData
  } catch (e) {
    return ''
  }
}

export const writeSignatureFile = (workingDir: string, signature: string) => {
  const signatureFilePath = join(workingDir, signatureFileName)
  try {
    fs.writeFileSync(signatureFilePath, signature)
  } catch (e) {
    console.log('Could not write signature file')
    throw e
  }
}

const sortDependencies = (dependencies: { [name: string]: string }) => {
  return Object.keys(dependencies)
    .sort()
    .reduce(
      (deps, key) => Object.assign(deps, { [key]: dependencies[key] }),
      {}
    )
}

export function writePackage(packageDir: string, pkg: PackageManifest) {
  pkg = Object.assign({}, pkg)

  if (pkg.dependencies) {
    pkg.dependencies = sortDependencies(pkg.dependencies)
  }
  if (pkg.devDependencies) {
    pkg.devDependencies = sortDependencies(pkg.devDependencies)
  }

  const formatSpaces = pkg.__JSONSpaces
  delete pkg.__JSONSpaces

  const manifestPath = join(packageDir, 'package.json')
  try {
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(pkg, null, formatSpaces) + '\n'
    )
  } catch (e) {
    console.error('Could not write ', manifestPath)
  }
}
