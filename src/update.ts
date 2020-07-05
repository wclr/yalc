import { execSync } from 'child_process'
import { join } from 'path'
import { PackageInstallation, removeInstallations } from './installations'

import { readLockfile } from './lockfile'

import {
  parsePackageName,
  addPackages,
  readPackageManifest,
  values,
  runOrWarnPackageManagerInstall
} from '.'

export interface UpdatePackagesOptions {
  workingDir: string
  noInstallationsRemove?: boolean
  replace?: boolean
  yarn?: boolean
}
export const updatePackages = async (
  packages: string[],
  options: UpdatePackagesOptions
) => {
  const { workingDir } = options
  const lockfile = readLockfile({ workingDir })

  let packagesToUpdate: string[] = []
  let installationsToRemove: PackageInstallation[] = []
  if (packages.length) {
    packages.forEach(packageName => {
      const { name, version } = parsePackageName(packageName)
      if (lockfile.packages[name]) {
        if (version) {
          lockfile.packages[name].version = version
        }
        packagesToUpdate.push(name)
      } else {
        installationsToRemove.push({ name, path: options.workingDir })
        console.log(
          `Did not find package ${name} in lockfile, ` +
            `please use 'add' command to add it explicitly.`
        )
      }
    })
  } else {
    packagesToUpdate = Object.keys(lockfile.packages)
  }

  const lockPackages = packagesToUpdate.map(name => ({
    name: lockfile.packages[name].version
      ? name + '@' + lockfile.packages[name].version
      : name,
    file: lockfile.packages[name].file,
    link: lockfile.packages[name].link,
    pure: lockfile.packages[name].pure
  }))

  const packagesFiles = lockPackages.filter(p => p.file).map(p => p.name)

  const addOpts = {
    workingDir: options.workingDir,
    replace: options.replace
  }

  await addPackages(packagesFiles, {
    ...addOpts,
    yarn: false
  })

  const packagesLinks = lockPackages
    .filter(p => !p.file && !p.link && !p.pure)
    .map(p => p.name)
  await addPackages(packagesLinks, {
    ...addOpts,
    link: true,
    pure: false,
    yarn: false
  })

  const packagesLinkDep = lockPackages.filter(p => p.link).map(p => p.name)
  await addPackages(packagesLinkDep, {
    ...addOpts,
    linkDep: true,
    pure: false,
    yarn: false
  })

  const packagesPure = lockPackages.filter(p => p.pure).map(p => p.name)
  await addPackages(packagesPure, {
    ...addOpts,
    pure: true,
    yarn: false
  })

  for (const packageName of packages) {
    const pkg = readPackageManifest(
      join(options.workingDir, values.yalcPackagesFolder, packageName)
    )
    const postupdate = pkg && pkg.scripts && pkg.scripts.postupdate
    if (postupdate) {
      console.log(
        `Running postupdate script of package ${packageName} in ${workingDir}`
      )
      execSync(postupdate, { cwd: workingDir })
    }
  }

  if (!options.noInstallationsRemove) {
    await removeInstallations(installationsToRemove)
  }
  return installationsToRemove
}
