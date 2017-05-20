import { execSync } from 'child_process'
import * as fs from 'fs-extra'
import { join } from 'path'
import {
  PackageInstallation, InstallationsFile,
  readInstallationsFile,
  addInstallations,
  removeInstallations,
  PackageName
} from './installations'

import {
  readLockfile,
  writeLockfile,
  addPackageToLockfile,
  LockFilePackageEntry,
  removeLockfile
} from './lockfile'

import {
  getStorePackagesDir,
  getPackageStoreDir,
  values,
  parsePackageName,
  readPackageManifest,
  writePackageManifest
} from '.'

export interface RemovePackagesOptions {
  all?: boolean,
  retreat?: boolean,
  workingDir: string
}

const isYalcFileAddress = (address: string, name: string,
  lockedPackage: LockFilePackageEntry) => {
  const localAddress = 'file:' + values.locedPackagesFolder + '/' + name
  return address === localAddress
}

export const removePackages = (packages: string[], options: RemovePackagesOptions) => {
  const { workingDir } = options
  const lockFileConfig = readLockfile({ workingDir: workingDir })
  const pkg = readPackageManifest(workingDir)
  if (!pkg) return
  let packagesToRemove: PackageName[] = []

  if (packages.length) {
    packages.forEach((packageName) => {
      const { name, version } = parsePackageName(packageName)
      if (lockFileConfig.packages[name]) {
        if (!version || version === lockFileConfig.packages[name].version) {
          packagesToRemove.push(name)
        }
      } else {
        console.log(`Package ${packageName} not found in ${values.lockfileName}` +
          `, still will try to remove.`)
        packagesToRemove.push(name)
      }
    })
  } else {
    if (options.all) {
      packagesToRemove = Object.keys(lockFileConfig.packages) as PackageName[]
    } else {
      console.log(`Use --all option to remove all packages.`)
    }
  }

  let pkgUpdated = false
  let lockfileUpdated = false
  packagesToRemove.forEach((name) => {
    const lockedPackage = lockFileConfig.packages[name]

    let depsWithPackage
    if (pkg.dependencies && pkg.dependencies[name]) {
      depsWithPackage = pkg.dependencies
    }
    if (pkg.devDependencies && pkg.devDependencies[name]) {
      depsWithPackage = pkg.devDependencies
    }
    if (depsWithPackage &&
      isYalcFileAddress(depsWithPackage[name], name, lockedPackage || {})) {
      pkgUpdated = true
      if (lockedPackage && lockedPackage.replaced) {
        depsWithPackage[name] = lockedPackage.replaced
      } else {
        delete depsWithPackage[name]
      }
    }
    if (!options.retreat) {
      lockfileUpdated = true
      delete lockFileConfig.packages[name]
    }
  })

  if (lockfileUpdated) {
    writeLockfile(lockFileConfig, { workingDir })
  }

  if (!Object.keys(lockFileConfig.packages).length && !options.retreat) {
    fs.removeSync(join(workingDir, values.locedPackagesFolder))
    removeLockfile({ workingDir })
  }

  if (pkgUpdated) {
    writePackageManifest(workingDir, pkg)
  }

  const installationsToRemove: PackageInstallation[] =
    packagesToRemove.map(name => ({
      name, version: '', path: workingDir
    }))

  packagesToRemove.forEach((name) => {
    fs.removeSync(join(workingDir, 'node_modules', name))
    if (!options.retreat) {
      fs.removeSync(join(workingDir, values.locedPackagesFolder, name))
    }
  })

  if (!options.retreat) {
    removeInstallations(installationsToRemove)
  }
}
