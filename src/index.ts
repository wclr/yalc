import { ExecSyncOptions } from 'child_process'
import * as fs from 'fs-extra'
import { homedir } from 'os'
import { join } from 'path'
import pkg from '../package.json'

const userHome = homedir()

export const values = {
  myNameIs: pkg.name,
  ignoreFileName: '.knitignore',
  myNameIsCapitalized: 'Knit',
  lockfileName: 'knit.lock',
  knitPackagesFolder: '.knit',
  prescript: 'preknit',
  postscript: 'postknit',
  installationsFile: 'installations.json',
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
export * from './pkg'
export * from './pm'

export interface KnitGlobal {
  knitStoreMainDir: string
}
/*
  Not using Node.Global because in this case
  <reference types="mocha" /> is aded in built d.ts file
*/
export const knitGlobal: KnitGlobal = global as any

export function getStoreMainDir(): string {
  if (knitGlobal.knitStoreMainDir) {
    return knitGlobal.knitStoreMainDir
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, values.myNameIsCapitalized)
  }
  return join(userHome, '.' + values.myNameIs)
}

export function getStorePackagesDir(): string {
  return join(getStoreMainDir(), 'packages')
}

export const getPackageStoreDir = (packageName: string, version = '') =>
  join(getStorePackagesDir(), packageName, version)

export const execLoudOptions = { stdio: 'inherit' } as ExecSyncOptions

const signatureFileName = 'knit.sig'

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
    console.error('Could not write signature file')
    throw e
  }
}
