import { values } from '.'
import { join } from 'path'
import * as fs from 'fs-extra'

export type Lockfile = {
  [packageName: string]: {
    version?: string
    file?: boolean
  }
}

export const readLockfile = (options: { workingDir: string }) => {
  const lockfilePath = join(options.workingDir, values.lockfileName)
  fs.ensureFileSync(lockfilePath)
  let lockfile: Lockfile = {}
  try {
    lockfile = fs.readJSONSync(lockfilePath) as Lockfile
  } catch (e) {
    return lockfile
  }
  return lockfile as Lockfile
}

export const writeLockfile = (lockfile: Lockfile, options: { workingDir: string }) => {
  const lockfilePath = join(options.workingDir, values.lockfileName)
  fs.writeJSONSync(lockfilePath, lockfile)
}

export const addPackageToLockfile = (
  packages: { name: string, version: string, file?: boolean }[],
  options: { workingDir: string }) => {
  const lockfile = readLockfile(options)
  packages.forEach(({ name, version, file }) => {
    lockfile[name] = {}
    version && (lockfile[name].version = version)
    file && (lockfile[name].file = true)
  })
  writeLockfile(lockfile, options)
}
