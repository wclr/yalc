import { addPackages, parsePackageName } from '.'
import { AddPackagesOptions } from './add'
import { PackageInstallation, removeInstallations } from './installations'
import { readLockfile } from './lockfile'

export interface UpdatePackagesOptions {
  workingDir: string
  noInstallationsRemove?: boolean
  replace?: boolean
  // if need run package manager update procedure
  update?: boolean
  // if need just to restore retreated packages
  restore?: boolean
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
    packages.forEach((packageName) => {
      const { name, version } = parsePackageName(packageName)
      if (lockfile.packages[name]) {
        if (version) {
          lockfile.packages[name].version = version
        }
        packagesToUpdate.push(name)
      } else {
        installationsToRemove.push({ name, path: options.workingDir })
        console.warn(
          `Did not find package ${name} in lockfile, ` +
            `please use 'add' command to add it explicitly.`
        )
      }
    })
  } else {
    packagesToUpdate = Object.keys(lockfile.packages)
  }

  const lockPackages = packagesToUpdate.map((name) => ({
    name: lockfile.packages[name].version
      ? name + '@' + lockfile.packages[name].version
      : name,
    file: lockfile.packages[name].file,
    link: lockfile.packages[name].link,
    pure: lockfile.packages[name].pure,
    workspace: lockfile.packages[name].workspace,
  }))

  const packagesFiles = lockPackages.filter((p) => p.file).map((p) => p.name)

  const addOpts: Pick<
    AddPackagesOptions,
    'workingDir' | 'replace' | 'update' | 'restore'
  > = {
    workingDir: options.workingDir,
    replace: options.replace,
    update: options.update,
    restore: options.restore,
  }

  await addPackages(packagesFiles, {
    ...addOpts,
  })

  const packagesLinks = lockPackages
    .filter((p) => !p.file && !p.link && !p.pure && !p.workspace)
    .map((p) => p.name)
  await addPackages(packagesLinks, {
    ...addOpts,
    link: true,
    pure: false,
  })

  const packagesWks = lockPackages.filter((p) => p.workspace).map((p) => p.name)
  await addPackages(packagesWks, {
    ...addOpts,
    workspace: true,
    pure: false,
  })

  const packagesLinkDep = lockPackages.filter((p) => p.link).map((p) => p.name)
  await addPackages(packagesLinkDep, {
    ...addOpts,
    linkDep: true,
    pure: false,
  })

  const packagesPure = lockPackages.filter((p) => p.pure).map((p) => p.name)
  await addPackages(packagesPure, {
    ...addOpts,
    pure: true,
  })
  if (!options.noInstallationsRemove) {
    await removeInstallations(installationsToRemove)
  }
  return installationsToRemove
}
