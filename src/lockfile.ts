import { values } from '.'
import { join } from 'path'
import * as fs from 'fs-extra'

export type LockFileConfigV0 = {
  [packageName: string]: {
    version?: string
    file?: boolean
  }
}

export type LockFilePackageEntry = {
  version?: string
  file?: boolean,
  link?: boolean,
  replaced?: string,
  signature?: string
}

export type LockFileConfigV1 = {
  version: 'v1',
  packages: {
    [packageName: string]: LockFilePackageEntry
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


export const removeLockfile = (options: { workingDir: string }) => {
  const lockfilePath = join(options.workingDir, values.lockfileName)
  fs.removeSync(lockfilePath)
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
  const data = JSON.stringify(lockfile, null, 2)
  fs.writeFileSync(lockfilePath, data)
}

export const addPackageToLockfile = (
  packages: ({ name: string } & LockFilePackageEntry)[],
  options: { workingDir: string }) => {
  const lockfile = readLockfile(options)
  packages.forEach(({ name, version, file, link, replaced, signature }) => {
    let old = lockfile.packages[name] || {}
    lockfile.packages[name] = {}
    version && (lockfile.packages[name].version = version)
    signature && (lockfile.packages[name].signature = signature)
    file && (lockfile.packages[name].file = true)
    link && (lockfile.packages[name].link = true)
    if (replaced || old.replaced) {
      lockfile.packages[name].replaced = replaced || old.replaced
    }
  })
  writeLockfile(lockfile, options)
}
