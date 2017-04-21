import { values } from '.'
import { join } from 'path'
import * as fs from 'fs-extra'

export type LockFileConfigV0 = {
  [packageName: string]: {
    version?: string
    file?: boolean
  }
}

export type LockFileConfigV1 = {
  version: 'v1',
  packages: {
    [packageName: string]: {
      version?: string
      file?: boolean
    }
  }
}
type LockFileVersions = 'v1' | 'v0'


type LockFileConfig = LockFileConfigV1

const currentVersion = 'v1'

const determineLockFileVersion = (locfile: any) => {
  if (locfile.version == 'v1' && locfile.packages) {
    return 'v1'
  }
  return 'v0'
}

type ConfigTransformers = {[key in LockFileVersions]: (locfile: any) => LockFileConfig}

const configTransformers: ConfigTransformers = {
  v0: (lockFile: LockFileConfigV0) => {
    return {
      version: 'v1',
      packages: lockFile
    }
  },
  v1: (lockFile: LockFileConfigV1) => lockFile
}

const getLockFileCurrentConfig = (lockFileConfig: any) => {
  const version = determineLockFileVersion(lockFileConfig)
  return configTransformers[version](lockFileConfig)
}


export const readLockfile = (options: { workingDir: string }) => {
  const lockfilePath = join(options.workingDir, values.lockfileName)
  fs.ensureFileSync(lockfilePath)
  let lockfile: LockFileConfig = {
    version: 'v1',
    packages: {}
  }
  try {
    lockfile = getLockFileCurrentConfig(
      fs.readJSONSync(lockfilePath))
  } catch (e) {
    return lockfile
  }
  return lockfile as LockFileConfig
}

export const writeLockfile = (lockfile: LockFileConfig, options: { workingDir: string }) => {
  const lockfilePath = join(options.workingDir, values.lockfileName)
  fs.writeJSONSync(lockfilePath, lockfile)
}

export const addPackageToLockfile = (
  packages: { name: string, version: string, file?: boolean }[],
  options: { workingDir: string }) => {
  const lockfile = readLockfile(options)
  packages.forEach(({ name, version, file }) => {
    lockfile.packages[name] = {}
    version && (lockfile.packages[name].version = version)
    file && (lockfile.packages[name].file = true)
  })
  writeLockfile(lockfile, options)
}
