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
  addPackageToLockfile,
  LockFilePackageEntry
} from './lockfile'

import {
  getStorePackagesDir,
  PackageManifest,
  getPackageStoreDir,
  values,
  parsePackageName
} from '.'

const ensureSymlinkSync = fs.ensureSymlinkSync as typeof fs.symlinkSync

export interface AddPackagesOptions {
  dev?: boolean,
  link?: boolean,
  yarn?: boolean,
  safe?: boolean
  workingDir: string,
}

const getLatestPackageVersion = (packageName: string) => {
  const dir = getPackageStoreDir(packageName)
  const versions = fs.readdirSync(dir)
  const latest = versions.map(version => ({
    version, created: fs.statSync(join(dir, version)).ctime.getTime()
  }))
    .sort((a, b) => b.created - a.created).map(x => x.version)[0]
  return latest || ''
}

export const addPackages = (packages: string[], options: AddPackagesOptions) => {
  const packagesStoreDir = getStorePackagesDir()
  const addedInstalls = packages.map((packageName) => {
    const { name, version = '' } = parsePackageName(packageName)

    if (!name) {
      console.log('Could not parse package name', packageName)
    }

    if (!fs.existsSync(getPackageStoreDir(name))) {
      console.log(`Could not find package \`${name}\` in store.`)
      return null
    }
    const versionToInstall = version || getLatestPackageVersion(name)

    const storedPackageDir = getPackageStoreDir(name, versionToInstall)

    if (!fs.existsSync(storedPackageDir)) {
      console.log(`Could not find package \`${packageName}\` ` + storedPackageDir)
      return null
    }

    const pkgFile = join(storedPackageDir, 'package.json')
    let pkg
    try {
      pkg = fs.readJsonSync(join(storedPackageDir, 'package.json'))
    } catch (e) {
      console.log('Could not read and parse ', pkgFile)
      return null
    }
    const destLoctedCopyDir = join(options.workingDir,
      values.locedPackagesFolder, name)
    const destloctedLinkDir = join(options.workingDir, 'node_modules', name)

    fs.emptyDirSync(destLoctedCopyDir)
    fs.copySync(storedPackageDir, destLoctedCopyDir)
    fs.removeSync(destloctedLinkDir)

    let replacedVersion = ''
    if (options.link) {
      ensureSymlinkSync(destLoctedCopyDir, destloctedLinkDir, 'dir')
    } else {
      const localAddress = 'file:' + values.locedPackagesFolder + '/' + pkg.name
      fs.copySync(destLoctedCopyDir, destloctedLinkDir)
      const localManifestFile = join(options.workingDir, 'package.json')
      const localPkg = fs.readJsonSync(localManifestFile) as PackageManifest

      const dependencies = localPkg.dependencies || {}
      const devDependencies = localPkg.devDependencies || {}
      let whereToAdd = options.dev
        ? devDependencies : dependencies

      if (options.dev) {
        if (dependencies[pkg.name]) {
          replacedVersion = dependencies[pkg.name]
          delete dependencies[pkg.name]
        }
      } else {
        if (!dependencies[pkg.name]) {
          if (devDependencies[pkg.name]) {
            whereToAdd = devDependencies
          }
        }
      }

      if (whereToAdd[pkg.name] !== localAddress) {
        replacedVersion = replacedVersion || whereToAdd[pkg.name]
        whereToAdd[pkg.name] = localAddress
        localPkg.dependencies = dependencies
        localPkg.devDependencies = devDependencies
        fs.writeJsonSync(localManifestFile, localPkg)
      }
      replacedVersion = replacedVersion == localAddress ? '' : replacedVersion
    }
    console.log(`${pkg.name}@${pkg.version} locted ==> ${destloctedLinkDir}`)
    return {
      name,
      version,
      replaced: replacedVersion,
      path: options.workingDir
    }
  }).filter(_ => _) as PackageInstallation[]

  addPackageToLockfile(
    addedInstalls
      .map((i) => ({
        name: i!.name,
        version: i!.version,
        replaced: i!.replaced,
        file: !options.link
      })), { workingDir: options.workingDir }
  )

  addInstallations(addedInstalls)

  if (options.yarn) {
    const changeDirCmd = 'cd ' + options.workingDir + ' && '
    execSync(changeDirCmd + 'yarn')
  }
}
