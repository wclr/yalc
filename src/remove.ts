import * as fs from 'fs-extra'
import { join } from 'path'
import {
  PackageInstallation,
  removeInstallations,
  PackageName
} from './installations'

import { readLockfile, writeLockfile, removeLockfile } from './lockfile'

import {
  values,
  parsePackageName,
  readPackage,
  writePackage,
  findPackage
} from '.'

export interface RemovePackagesOptions {
  all?: boolean
  retreat?: boolean
  workingDir: string
}

const isYalcFileAddress = (address: string, name: string) => {
  const regExp = new RegExp(
    'file|link:' + values.yalcPackagesFolder + '/' + name
  )
  return regExp.test(address)
}

export const removePackages = async (
  packages: string[],
  options: RemovePackagesOptions
) => {
  const workingDir = findPackage(options.workingDir)
  if (!workingDir) return

  const pkg = readPackage(workingDir)
  if (!pkg) return

  const lockFileConfig = readLockfile({ workingDir })
  let packagesToRemove: PackageName[] = []

  if (packages.length) {
    packages.forEach(packageName => {
      const { name, version } = parsePackageName(packageName)
      if (lockFileConfig.packages[name]) {
        if (!version || version === lockFileConfig.packages[name].version) {
          packagesToRemove.push(name)
        }
      } else {
        console.log(
          `Package ${packageName} not found in ${values.lockfileName}` +
            `, still will try to remove.`
        )
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

  let lockfileUpdated = false
  let localPkgChanged = false
  packagesToRemove.forEach(name => {
    const lockedPackage = lockFileConfig.packages[name]

    let depsWithPackage
    if (pkg.dependencies && pkg.dependencies[name]) {
      depsWithPackage = pkg.dependencies
    }
    if (pkg.devDependencies && pkg.devDependencies[name]) {
      depsWithPackage = pkg.devDependencies
    }
    if (depsWithPackage && isYalcFileAddress(depsWithPackage[name], name)) {
      localPkgChanged = true

      // Remove symlink from node_modules
      fs.removeSync(join(workingDir, 'node_modules', name))

      // Remove symlinks from node_modules/.bin
      if (pkg.bin) {
        const names =
          typeof pkg.bin === 'string' ? [pkg.name] : Object.keys(pkg.bin)
        names.forEach(name => {
          fs.removeSync(join(workingDir, 'node_modules', '.bin', name))
        })
      }

      // Update the package.json
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

  if (localPkgChanged) {
    writePackage(workingDir, pkg)
  }

  if (lockfileUpdated) {
    writeLockfile(lockFileConfig, { workingDir })
  }

  if (!Object.keys(lockFileConfig.packages).length && !options.retreat) {
    fs.removeSync(join(workingDir, values.yalcPackagesFolder))
    removeLockfile({ workingDir })
  }

  if (!options.retreat) {
    await removeInstallations(
      packagesToRemove.map(name => {
        fs.removeSync(join(workingDir, values.yalcPackagesFolder, name))
        return {
          name,
          version: '',
          path: workingDir
        }
      })
    )
  }
}
