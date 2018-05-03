import { execSync } from 'child_process'
import * as fs from 'fs-extra'
import { join } from 'path'
import {
  PackageInstallation,
  InstallationsFile,
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

import {
  getStorePackagesDir,
  PackageManifest,
  getPackageStoreDir,
  values,
  parsePackageName,
  addPackages
} from '.'

export interface UpdatePackagesOptions {
  safe?: boolean,
  noInstallationsRemove?: boolean,
  workingDir: string,
}
export const updatePackages = (packages: string[], options: UpdatePackagesOptions) => {
  const lockfile = readLockfile({ workingDir: options.workingDir })

  let packagesToUpdate: string[] = []
  let installationsToRemove: PackageInstallation[] = []
  if (packages.length) {
    packages.forEach((packageName) => {
      const { name, version } = parsePackageName(packageName)
      if (lockfile.packages[name]) {
        if (version) {
          lockfile.packages[name].version = version
        }
        packagesToUpdate.push(name)
      } else {
        installationsToRemove.push({ name, version, path: options.workingDir })
        console.log(`Did not find package ${name} in lockfile, ` +
          `please use 'add' command to add it explicitly.`
        )
      }
    })
  } else {
    packagesToUpdate = Object.keys(lockfile.packages)
  }

  const lockPackages = packagesToUpdate
    .map(name => ({
      name: lockfile.packages[name].version
        ? name + '@' + lockfile.packages[name].version : name,
      file: lockfile.packages[name].file,
      link: lockfile.packages[name].link,
    }))
  
  const packagesFiles = lockPackages
    .filter(p => p.file).map(p => p.name)
  addPackages(packagesFiles, { workingDir: options.workingDir })

  const packagesLinks = lockPackages
    .filter(p => !p.file && !p.link).map(p => p.name)
  addPackages(packagesLinks, { workingDir: options.workingDir, link: true })

  const packagesLinkDep = lockPackages
    .filter(p => p.link).map(p => p.name)
  addPackages(packagesLinkDep, { workingDir: options.workingDir, linkDep: true })

  if (!options.noInstallationsRemove) {
    removeInstallations(installationsToRemove)
  }
  return installationsToRemove
}
