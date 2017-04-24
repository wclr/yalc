import { execSync } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { copyWithIgnorePackageToStore } from './copy'
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

const userHome = require('user-home')

const { join } = path

const ensureSymlinkSync = fs.ensureSymlinkSync as typeof fs.symlinkSync

export const myNameIs = 'yalc'
export const myNameIsCapitalized = 'Yalc'

export const values = {
  lockfileName: 'yalc.lock',
  locedPackagesFolder: '.yalc',
  installationsFile: 'installations.json'
}

export interface AddPackagesOptions {
  dev?: boolean,
  link?: boolean,
  yarn?: boolean,
  safe?: boolean
  workingDir: string,
}

export interface UpdatePackagesOptions {
  safe?: boolean,
  workingDir: string,
}

export interface RemovePackagesOptions {
  workingDir: string,
}

export { publishPackage } from './publish'

export interface YalcGlobal extends NodeJS.Global {
  yalcStoreMainDir: string
}
export const yalcGlobal = global as YalcGlobal

export function getStoreMainDir(): string {
  if (yalcGlobal.yalcStoreMainDir) {    
    return yalcGlobal.yalcStoreMainDir
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, myNameIsCapitalized);
  }
  return join(userHome, '.' + myNameIs);
}

export function getStorePackagesDir(): string {
  return join(getStoreMainDir(), 'packages');
}

export const getPackageStoreDir = (packageName: string, version = '') =>
  path.join(getStorePackagesDir(), packageName, version)

export interface PackageManifest {
  name: string,
  version: string,
  dependencies?: { [name: string]: string },
  devDependencies?: { [name: string]: string },
  scripts?: {
    preinstall?: string,
    install?: string,
    prepublish?: string
    postpublish?: string
    preloc?: string
    postloc?: string
  }
}

export const getPackageManager = () =>
  execSync('yarn.lock') ? 'yarn' : 'npm'

export const execLoudOptions = { stdio: 'inherit' }

const getLatestPackageVersion = (packageName: string) => {
  const dir = getPackageStoreDir(packageName)
  const versions = fs.readdirSync(dir)
  const latest = versions.map(version => ({
    version, created: fs.statSync(path.join(dir, version)).ctime.getTime()
  }))
    .sort((a, b) => b.created - a.created).map(x => x.version)[0]
  return latest || ''
}

const parsePackageName = (packageName: string) => {
  const match = packageName.match(/(^@[^/]+\/)?([^@]+)@?(.*)/) || []
  if (!match) {
    return { name: '' as PackageName, version: '' }
  }
  return { name: (match[1] || '') + match[2] as PackageName, version: match[3] || '' }
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

    const pkgFile = path.join(storedPackageDir, 'package.json')
    let pkg
    try {
      pkg = fs.readJsonSync(path.join(storedPackageDir, 'package.json'))
    } catch (e) {
      console.log('Could not read and parse ', pkgFile)
      return null
    }
    const destLoctedCopyDir = path.join(options.workingDir,
      values.locedPackagesFolder, name)
    const destloctedLinkDir = path.join(options.workingDir, 'node_modules', name)

    fs.emptyDirSync(destLoctedCopyDir)
    fs.copySync(storedPackageDir, destLoctedCopyDir)
    fs.removeSync(destloctedLinkDir)

    let replacedVersion = ''
    if (options.link) {
      ensureSymlinkSync(destLoctedCopyDir, destloctedLinkDir, 'dir')
    } else {
      const localAddress = 'file:' + values.locedPackagesFolder + '/' + pkg.name
      fs.copySync(destLoctedCopyDir, destloctedLinkDir)
      const localManifestFile = path.join(options.workingDir, 'package.json')
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

export const showInstallations = (options: { workingDir: string }) => {

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
      file: lockfile.packages[name].file
    }))
  const packagesFiles = lockPackages
    .filter(p => p.file).map(p => p.name)
  addPackages(packagesFiles, { workingDir: options.workingDir })

  const packagesLinks = lockPackages
    .filter(p => !p.file).map(p => p.name)
  addPackages(packagesLinks, { workingDir: options.workingDir, link: true })

  removeInstallations(installationsToRemove)
}

export const removePackages = (packages: string[], options: RemovePackagesOptions) => {

}  
